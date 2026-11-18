/**
 * Laporan progres untuk dianalisis Claude.
 * Berisi data belajar mentah yang diringkas (bukan data pribadi lain), dalam format teks
 * yang mudah ditempel ke chat.
 */
import type { Word } from '../content/types';
import type { DailyLog, ErrorStat, ExerciseAttempt, LessonProgress, Profile, VocabCard, VocabReview, Writing } from '../db/schema';
import { tagInfo } from './errorTags';
import { addDays, toLocalDate } from './dates';

export interface ReportData {
  profile: Profile;
  logs: DailyLog[];
  progress: LessonProgress[];
  attempts: ExerciseAttempt[];
  errorStats: ErrorStat[];
  cards: VocabCard[];
  reviews: VocabReview[];
  writings: Writing[];
  words: Map<string, Word>;
  appVersion: string;
  now?: number;
}

const MASTERY = ['dilihat', 'dikenali', 'dipahami', 'dipakai', 'aktif'];
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const mins = (s: number) => Math.round(s / 60);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function buildReport(d: ReportData): string {
  const now = d.now ?? Date.now();
  const today = toLocalDate(new Date(now));
  const L: string[] = [];
  const total = d.logs.reduce((s, l) => s + l.activeSeconds, 0);
  const studied = d.logs.filter((l) => l.activeSeconds > 0);

  L.push('=== LAPORAN ENGLISH MASTERY ===');
  L.push(`Dibuat: ${new Date(now).toLocaleString('id-ID')} · aplikasi ${d.appVersion}`);
  L.push(`Mulai: ${d.profile.startDate} · Hari kurikulum: ${d.profile.curriculumDay} · Hari belajar: ${studied.length} · Total: ${mins(total)} menit`);
  L.push(`Level (estimasi): ${Object.entries(d.profile.levels).map(([k, v]) => `${k} ${v}`).join(', ')}`);

  // Waktu 14 hari terakhir
  L.push('', '## Waktu belajar 14 hari terakhir (menit)');
  const byDate = new Map(d.logs.map((l) => [l.date, l.activeSeconds]));
  const days14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  L.push(days14.map((dt) => `${dt.slice(5)}:${mins(byDate.get(dt) ?? 0)}`).join(' '));

  // Nilai per hari
  L.push('', '## Nilai per hari (percobaan terbaik)');
  const perDay = new Map<number, string[]>();
  for (const p of d.progress) {
    const m = p.lessonId.match(/^day-(\d+):(\w+)$/);
    if (!m) continue;
    const day = Number(m[1]);
    const arr = perDay.get(day) ?? [];
    arr.push(`${m[2]} ${p.bestScore === null ? '✓' : `${p.bestScore}%`}${p.attempts > 1 ? ` (${p.attempts}x)` : ''}`);
    perDay.set(day, arr);
  }
  if (!perDay.size) L.push('(belum ada)');
  for (const [day, arr] of [...perDay].sort((a, b) => a[0] - b[0])) L.push(`Hari ${day}: ${arr.join(' · ')}`);
  const practice = d.progress.filter((p) => p.lessonId.startsWith('practice:'));
  if (practice.length) L.push(`Latihan Pintar: ${practice.length} hari, nilai terbaik rata-rata ${Math.round(practice.reduce((s, p) => s + (p.bestScore ?? 0), 0) / practice.length)}%`);

  // Akurasi per bagian
  L.push('', '## Akurasi jawaban per bagian');
  const groups: Record<string, ExerciseAttempt[]> = {};
  for (const a of d.attempts) {
    const kind = a.exerciseId.includes(':speak-') ? 'speaking' : a.exerciseId.includes(':dictation-') ? 'dikte' : a.lessonId === 'practice' ? 'latihan-pintar' : (a.lessonId.split(':')[1] ?? a.lessonId);
    (groups[kind] ??= []).push(a);
  }
  for (const [k, list] of Object.entries(groups)) L.push(`${k}: ${pct(list.filter((a) => a.isCorrect).length, list.length)} dari ${list.length} jawaban`);

  // Kelemahan
  L.push('', '## Pola kesalahan (jumlah · terakhir)');
  const stats = [...d.errorStats].sort((a, b) => b.count - a.count);
  if (!stats.length) L.push('(belum ada)');
  for (const s of stats) L.push(`${tagInfo(s.errorTag).label} [${s.errorTag}]: ${s.count}x · ${toLocalDate(new Date(s.lastSeenAt))}`);

  // Jawaban salah terbaru
  L.push('', '## 25 jawaban salah terbaru (id soal → jawaban Anda)');
  const wrong = d.attempts.filter((a) => !a.isCorrect && !a.exerciseId.includes(':speak-')).sort((a, b) => b.at - a.at).slice(0, 25);
  if (!wrong.length) L.push('(belum ada)');
  for (const a of wrong) L.push(`${a.exerciseId} → "${clip(a.answer, 80)}"`);

  // Pengucapan
  const speak = d.attempts.filter((a) => a.exerciseId.includes(':speak-'));
  if (speak.length) {
    L.push('', '## Pengucapan (cek ucapan)');
    L.push(`${speak.length} percobaan, lulus (≥70%): ${pct(speak.filter((a) => a.isCorrect).length, speak.length)}`);
    for (const a of speak.filter((x) => !x.isCorrect).slice(-10)) L.push(`${a.exerciseId} → terdengar: "${clip(a.answer, 80)}"`);
  }

  // Kosakata
  L.push('', '## Kosakata');
  const counts = [0, 1, 2, 3, 4].map((m) => d.cards.filter((c) => c.mastery === m).length);
  L.push(`${d.cards.length} kata · ${counts.map((c, i) => `${MASTERY[i]} ${c}`).join(' · ')}`);
  const ratings = [1, 2, 3, 4].map((r) => d.reviews.filter((x) => x.rating === r).length);
  L.push(`Flashcard: ${d.reviews.length} review · Lupa ${ratings[0]} · Sulit ${ratings[1]} · Bisa ${ratings[2]} · Mudah ${ratings[3]}`);
  const hard = [...d.cards].filter((c) => c.fsrs.lapses > 0).sort((a, b) => b.fsrs.lapses - a.fsrs.lapses).slice(0, 12);
  if (hard.length) L.push(`Kata tersulit: ${hard.map((c) => `${d.words.get(c.wordId)?.word ?? c.wordId} (lupa ${c.fsrs.lapses}x)`).join(', ')}`);

  // Penjelasan sendiri
  const explains = [...d.writings].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  if (explains.length) {
    L.push('', '## Penjelasan & tulisan Anda sendiri (terbaru)');
    for (const w of explains) L.push(`[${w.promptId}] ${clip(w.title, 90)}\n  → ${clip(w.text.replace(/\s+/g, ' '), 300)}`);
  }

  L.push('', '=== Akhir laporan. Tempel ke chat Claude untuk dianalisis. ===');
  return L.join('\n');
}
