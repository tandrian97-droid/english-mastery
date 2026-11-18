/**
 * LATIHAN PINTAR — rumus latihan adaptif.
 *
 * Setiap kali dibuka, aplikasi menyusun ±10 soal dengan komposisi:
 *  1. KELEMAHAN (±40%): soal dari hari-hari sebelumnya yang punya jenis kesalahan
 *     paling sering Anda buat (dihitung dari statistik kesalahan, kesalahan baru lebih berbobot).
 *     Soal yang pernah Anda jawab salah diprioritaskan.
 *  2. KOSAKATA (±40%): kata dengan riwayat paling sulit (sering "Lupa", penguasaan rendah),
 *     dalam 4 bentuk berbeda: arti, kebalikan, dengar-pilih, dan cocokkan.
 *  3. CAMPURAN (sisa): soal acak dari semua hari sebelumnya (interleaving), supaya
 *     materi lama tidak terlupa dan Anda terbiasa memilih aturan yang tepat sendiri.
 * Urutan akhir diacak, sehingga tidak ada dua sesi yang sama.
 */
import type { ContentDay, Exercise, Word } from '../content/types';
import type { ErrorStat, VocabCard } from '../db/schema';
import { pick, rng, shuffle } from './random';

export interface WarmupInput {
  days: ContentDay[];
  words: Word[];
  cards: VocabCard[];
  errorStats: ErrorStat[];
  /** id soal yang pernah dijawab salah. */
  wrongIds: Set<string>;
  seed: number;
  now?: number;
  size?: number;
}

export interface WarmupPlan {
  exercises: Exercise[];
  weakTags: string[];
  focusWords: string[];
}

const WEEK = 7 * 86_400_000;

/** Bobot kelemahan: jumlah kesalahan, dengan kesalahan dalam 7 hari terakhir dihitung penuh. */
export function weakTagRanking(stats: ErrorStat[], now = Date.now()): string[] {
  return [...stats]
    .filter((s) => !['pronunciation', 'listening', 'vocab'].includes(s.errorTag)) // kosakata ditangani lewat FSRS
    .map((s) => ({ tag: s.errorTag, w: s.count * (now - s.lastSeenAt < WEEK ? 1 : 0.5) }))
    .sort((a, b) => b.w - a.w)
    .map((x) => x.tag);
}

/** Kata paling sulit: banyak lupa, penguasaan rendah, stabilitas ingatan rendah. */
export function hardestWords(cards: VocabCard[]): VocabCard[] {
  return [...cards].sort((a, b) => b.fsrs.lapses - a.fsrs.lapses || a.mastery - b.mastery || a.fsrs.stability - b.fsrs.stability);
}

function distractors(target: Word, all: Word[], field: 'meaning' | 'word', n: number, rand: () => number): string[] {
  const samePos = all.filter((w) => w.id !== target.id && w.pos === target.pos && w[field] !== target[field]);
  const other = all.filter((w) => w.id !== target.id && w.pos !== target.pos && w[field] !== target[field]);
  const chosen = [...pick(samePos, n, rand), ...pick(other, n, rand)].map((w) => w[field]);
  return [...new Set(chosen)].slice(0, n);
}

function optionsWith(correct: string, wrong: string[], rand: () => number): { options: { text: string }[]; answer: number } {
  const list = shuffle([correct, ...wrong], rand);
  return { options: list.map((text) => ({ text })), answer: list.indexOf(correct) };
}

export function buildWarmup(input: WarmupInput): WarmupPlan {
  const { days, words, cards, errorStats, wrongIds, seed, now = Date.now(), size = 10 } = input;
  const rand = rng(seed);
  const out: Exercise[] = [];
  const used = new Set<string>();
  const add = (e: Exercise) => {
    if (!used.has(e.id) && out.length < size) {
      used.add(e.id);
      out.push(e);
    }
  };

  // Kumpulan soal lama (tanpa soal 'jelaskan', tanpa pertanyaan bacaan yang butuh teksnya).
  const pool = days.flatMap((d) => [...d.lesson.exercises, ...d.writing.exercises]).filter((e) => e.type !== 'explain');

  // 1. Kelemahan
  const weakTags = weakTagRanking(errorStats, now).slice(0, 3);
  const weakPool = pool.filter((e) => e.errorTag && weakTags.includes(e.errorTag));
  const weakSorted = [...shuffle(weakPool.filter((e) => wrongIds.has(e.id)), rand), ...shuffle(weakPool.filter((e) => !wrongIds.has(e.id)), rand)];
  const weakQuota = Math.round(size * 0.4);
  for (const e of weakSorted.slice(0, weakQuota)) add(e);

  // 2. Kosakata (butuh minimal 4 kata yang sudah dipelajari)
  const byId = new Map(words.map((w) => [w.id, w]));
  const learned = cards.map((c) => byId.get(c.wordId)).filter((w): w is Word => !!w);
  const focus = hardestWords(cards)
    .map((c) => byId.get(c.wordId))
    .filter((w): w is Word => !!w)
    .slice(0, 6);
  if (learned.length >= 4) {
    const [w1, w2, w3, w4] = focus;
    if (w1) {
      const o = optionsWith(w1.meaning, distractors(w1, learned, 'meaning', 3, rand), rand);
      add({ id: `wu:meaning:${w1.id}`, type: 'mc', prompt: `Apa arti **${w1.word}**?`, ...o, explain: `${w1.word} = ${w1.meaning}. ${w1.core}`, errorTag: 'vocab' });
    }
    if (w2) {
      const o = optionsWith(w2.word, distractors(w2, learned, 'word', 3, rand), rand);
      add({ id: `wu:reverse:${w2.id}`, type: 'mc', prompt: `Bahasa Inggrisnya **${w2.meaning}**?`, ...o, explain: `${w2.meaning} = ${w2.word} (${w2.say}).`, errorTag: 'vocab' });
    }
    if (w3) {
      const o = optionsWith(w3.meaning, distractors(w3, learned, 'meaning', 3, rand), rand);
      add({ id: `wu:listen:${w3.id}`, type: 'listen', prompt: 'Dengarkan katanya. Apa artinya?', audio: w3.word, ...o, explain: `${w3.word} (${w3.say}) = ${w3.meaning}. Contoh: ${w3.example} — ${w3.exampleId}`, errorTag: 'vocab' });
    }
    const matchWords = pick(learned.filter((w) => w.id !== w4?.id), 3, rand);
    const set = [w4, ...matchWords].filter((w): w is Word => !!w);
    const uniqueMeanings = new Set(set.map((w) => w.meaning));
    if (set.length >= 4 && uniqueMeanings.size === set.length) {
      add({ id: `wu:match:${set.map((w) => w.id).join('-')}`, type: 'match', prompt: 'Cocokkan kata dengan artinya.', pairs: set.map((w) => [w.word, w.meaning]), explain: '', errorTag: 'vocab' });
    }
  }

  // 3. Campuran dari semua hari
  for (const e of shuffle(pool, rand)) add(e);

  return { exercises: shuffle(out, rand), weakTags, focusWords: focus.map((w) => w.id) };
}
