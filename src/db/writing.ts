import { db, type EnglishMasteryDB } from './db';
import type { Writing, WritingLevel } from './schema';
import type { CheckResult } from '../engine/writingCheck';
import { tagInfo } from '../engine/errorTags';
import { wordsInText } from './learning';

export async function createDraft(promptId: string | null, level: WritingLevel, title: string, database: EnglishMasteryDB = db): Promise<number> {
  const now = Date.now();
  return (await database.writings.add({ promptId, level, title, text: '', wordCount: 0, status: 'draft', createdAt: now, updatedAt: now })) as number;
}

/** Simpan draf. Tulisan yang sudah dikunci (submitted) tidak pernah diubah. */
export async function saveDraft(id: number, text: string, database: EnglishMasteryDB = db): Promise<void> {
  const w = await database.writings.get(id);
  if (!w || w.status !== 'draft') return;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  await database.writings.update(id, { text, wordCount, updatedAt: Date.now() });
}

/** Sentence-sentence yang tidak mengandung catatan pemeriksa. */
function cleanSentences(text: string, result: CheckResult): string {
  const out: string[] = [];
  let pos = 0;
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    const start = text.indexOf(s, pos);
    const end = start + s.length;
    pos = end;
    if (!result.issues.some((i) => i.kind === 'grammar' && i.start < end && i.end > start)) out.push(s);
  }
  return out.join(' ');
}

/**
 * Mengunci tulisan dan menyimpan hasil pemeriksaan:
 *  - tulisan asli disimpan apa adanya (tidak pernah ditimpa koreksi)
 *  - setiap catatan pemeriksa dicatat ke statistik kesalahan
 *  - kata yang dipakai di kalimat tanpa kesalahan naik ke "dipakai" (3);
 *    jika sudah dipakai benar di ≥ 3 tulisan berbeda → "aktif stabil" (4)
 */
export async function submitWriting(
  id: number,
  text: string,
  result: CheckResult,
  words: Map<string, { id: string; word: string }>,
  database: EnglishMasteryDB = db,
): Promise<void> {
  const now = Date.now();
  await database.transaction('rw', [database.writings, database.writing_feedback, database.exercise_attempts, database.vocab_cards], async () => {
    const w = await database.writings.get(id);
    if (!w) throw new Error('Tulisan tidak ditemukan.');
    if (w.status === 'submitted') return;
    await database.writings.update(id, { text, wordCount: result.wordCount, status: 'submitted', updatedAt: now });
    await database.writing_feedback.add({
      writingId: id,
      source: 'offline',
      correctedText: result.corrected,
      naturalText: null,
      issues: result.issues.map((i) => ({ original: i.original, suggestion: i.suggestion, explanation: i.explanation, errorTag: i.errorTag })),
      score: result.score,
      createdAt: now,
    });
    for (const i of result.issues) {
      await database.exercise_attempts.add({ exerciseId: `writing:${id}:${i.start}`, lessonId: 'writing-studio', answer: i.original, isCorrect: false, errorTags: [i.errorTag], at: now });
    }
    const used = wordsInText(cleanSentences(text, result), words);
    if (used.length) {
      const cards = await database.vocab_cards.bulkGet(used);
      const submitted = (await database.writings.where('status').equals('submitted').toArray()).map((x) => x.text.toLowerCase());
      for (const c of cards) {
        if (!c) continue;
        const word = words.get(c.wordId)!.word.toLowerCase();
        const re = new RegExp(`\\b${word.replace(/[^a-z']/g, '')}s?\\b`);
        const times = submitted.filter((t) => re.test(t)).length;
        const level = times >= 3 ? 4 : 3;
        if (c.mastery < level) await database.vocab_cards.update(c.wordId, { mastery: level, updatedAt: now });
      }
    }
  });
}

/** Prompt siap tempel untuk meminta koreksi lengkap dari Claude. */
export function buildAiPrompt(w: Writing, task: string | null, topTags: string[]): string {
  const weak = topTags.length ? topTags.map((t) => tagInfo(t).label).join(', ') : 'belum ada data';
  return [
    'Kamu adalah tutor bahasa Inggris saya. Saya penutur Bahasa Indonesia, level pemula (sekitar A1).',
    `Kesalahan yang paling sering saya buat: ${weak}.`,
    task ? `Tugas menulis saya: ${task}` : '',
    '',
    'Tulisan saya:',
    '"""',
    w.text,
    '"""',
    '',
    'Tolong jawab dalam Bahasa Indonesia yang sederhana, dengan format:',
    '1. VERSI BENAR: tulisan saya yang sudah dikoreksi (ubah seminimal mungkin).',
    '2. KOREKSI: daftar setiap kesalahan → perbaikan → penjelasan singkat KENAPA (seperti menjelaskan ke anak kecil).',
    '3. VERSI NATURAL: bagaimana penutur asli akan menulisnya.',
    '4. YANG SUDAH BAGUS: 2 hal yang sudah benar.',
    '5. FOKUS BERIKUTNYA: 1–2 aturan tata bahasa yang perlu saya latih.',
    '6. SKOR: 0–100 (untuk tata bahasa, kosakata, kejelasan).',
  ].join('\n');
}
