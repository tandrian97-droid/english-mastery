import { db, type EnglishMasteryDB } from './db';
import type { LessonProgress, MasteryLevel, ReviewRating, VocabCard } from './schema';
import type { BlockKey, Exercise } from '../content/types';
import { newVocabCard, reviewCard } from '../engine/srs';
import { toLocalDate } from '../engine/dates';

/** Urutan blok dalam satu hari belajar. */
export const BLOCK_ORDER: BlockKey[] = ['vocab', 'grammar', 'reading', 'listening', 'writing'];

export const BLOCK_LABELS: Record<BlockKey, { title: string; minutes: number; desc: string }> = {
  vocab: { title: 'Kosakata', minutes: 30, desc: 'Kata baru + review flashcard' },
  grammar: { title: 'Grammar', minutes: 20, desc: 'Pelajaran berlapis + latihan' },
  reading: { title: 'Reading', minutes: 20, desc: 'Bacaan + pertanyaan pemahaman' },
  listening: { title: 'Listening & Speaking', minutes: 30, desc: 'Dengar dan tirukan (shadowing)' },
  writing: { title: 'Writing', minutes: 20, desc: 'Menulis kalimat sendiri' },
};

const pad = (n: number) => String(n).padStart(3, '0');
export const blockKey = (day: number, block: BlockKey) => `day-${pad(day)}:${block}`;

export async function getDayProgress(day: number, database: EnglishMasteryDB = db): Promise<Record<BlockKey, LessonProgress | undefined>> {
  const rows = await database.lesson_progress.bulkGet(BLOCK_ORDER.map((b) => blockKey(day, b)));
  return Object.fromEntries(BLOCK_ORDER.map((b, i) => [b, rows[i]])) as Record<BlockKey, LessonProgress | undefined>;
}

/**
 * Menandai satu blok selesai. Jika kelima blok hari itu selesai dan hari itu adalah
 * hari kurikulum saat ini, hari kurikulum maju satu (maksimal sampai hari terakhir yang tersedia + 1).
 * Mengembalikan true jika hari tersebut baru saja selesai seluruhnya.
 */
export async function completeBlock(
  day: number,
  block: BlockKey,
  score: number | null,
  lastAvailableDay: number,
  database: EnglishMasteryDB = db,
): Promise<boolean> {
  const now = Date.now();
  return database.transaction('rw', database.lesson_progress, database.profile, database.daily_log, async () => {
    const key = blockKey(day, block);
    const prev = await database.lesson_progress.get(key);
    await database.lesson_progress.put({
      lessonId: key,
      status: 'completed',
      bestScore: score === null ? (prev?.bestScore ?? null) : Math.max(score, prev?.bestScore ?? 0),
      attempts: (prev?.attempts ?? 0) + 1,
      completedAt: prev?.completedAt ?? now,
      updatedAt: now,
    });

    const today = toLocalDate();
    const log = await database.daily_log.get(today);
    if (log && !log.blocksCompleted.includes(key)) {
      await database.daily_log.update(today, { blocksCompleted: [...log.blocksCompleted, key], updatedAt: now });
    }

    const all = await database.lesson_progress.bulkGet(BLOCK_ORDER.map((b) => blockKey(day, b)));
    const dayDone = all.every((p) => p?.status === 'completed');
    const profile = await database.profile.get(1);
    if (dayDone && profile && profile.curriculumDay === day && day <= lastAvailableDay) {
      await database.profile.update(1, { curriculumDay: day + 1, updatedAt: now });
      return true;
    }
    return false;
  });
}

/** Membuat kartu flashcard untuk kata-kata baru (kata yang sudah punya kartu tidak diubah). */
export async function introduceWords(wordIds: string[], database: EnglishMasteryDB = db): Promise<number> {
  const now = Date.now();
  return database.transaction('rw', database.vocab_cards, async () => {
    const existing = await database.vocab_cards.bulkGet(wordIds);
    const fresh = wordIds.filter((_, i) => !existing[i]).map((id) => newVocabCard(id, now));
    if (fresh.length) await database.vocab_cards.bulkAdd(fresh);
    return fresh.length;
  });
}

export async function getDueCards(now = Date.now(), limit = 60, database: EnglishMasteryDB = db): Promise<VocabCard[]> {
  return database.vocab_cards.where('due').belowOrEqual(now).limit(limit).toArray();
}

export async function saveReview(card: VocabCard, rating: ReviewRating, now = Date.now(), database: EnglishMasteryDB = db): Promise<VocabCard> {
  const { card: next, scheduledDays } = reviewCard(card, rating, now);
  await database.transaction('rw', database.vocab_cards, database.vocab_reviews, async () => {
    await database.vocab_cards.put(next);
    await database.vocab_reviews.add({ wordId: card.wordId, rating, at: now, scheduledDays });
  });
  return next;
}

/** Menaikkan tingkat penguasaan (tidak pernah menurunkan). Hanya untuk kata yang sudah punya kartu. */
export async function raiseMastery(wordIds: string[], level: MasteryLevel, database: EnglishMasteryDB = db): Promise<void> {
  if (!wordIds.length) return;
  await database.transaction('rw', database.vocab_cards, async () => {
    const cards = await database.vocab_cards.bulkGet(wordIds);
    const updated = cards.filter((c): c is VocabCard => !!c && c.mastery < level).map((c) => ({ ...c, mastery: level, updatedAt: Date.now() }));
    if (updated.length) await database.vocab_cards.bulkPut(updated);
  });
}

export async function recordAttempt(
  ex: Exercise,
  lessonId: string,
  answer: string,
  isCorrect: boolean,
  database: EnglishMasteryDB = db,
): Promise<void> {
  const now = Date.now();
  const tags = !isCorrect && ex.errorTag ? [ex.errorTag] : [];
  await database.transaction('rw', database.exercise_attempts, database.error_stats, async () => {
    await database.exercise_attempts.add({ exerciseId: ex.id, lessonId, answer, isCorrect, errorTags: tags, at: now });
    for (const tag of tags) {
      const s = await database.error_stats.get(tag);
      await database.error_stats.put({ errorTag: tag, count: (s?.count ?? 0) + 1, lastSeenAt: now });
    }
  });
}

/** Jawaban "jelaskan dengan kata-kata sendiri" disimpan sebagai tulisan, agar bisa dikoreksi AI Tutor nanti. */
export async function saveExplanation(exerciseId: string, prompt: string, text: string, database: EnglishMasteryDB = db): Promise<number> {
  const now = Date.now();
  const id = await database.writings.add({
    promptId: exerciseId,
    level: 1,
    title: prompt.slice(0, 120),
    text,
    wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

/** Kata-kata (dari daftar yang sudah dipelajari) yang muncul di sebuah teks. */
export function wordsInText(text: string, words: Map<string, { id: string; word: string }>): string[] {
  const tokens = new Set((text.toLowerCase().match(/[a-z']+/g) ?? []).flatMap((t) => [t, t.replace(/(es|s)$/, '')]));
  const found: string[] = [];
  for (const w of words.values()) if (tokens.has(w.word.toLowerCase())) found.push(w.id);
  return found;
}
