/**
 * Tipe data pengguna yang disimpan di IndexedDB.
 *
 * Prinsip: database HANYA menyimpan data Anda (progres, jawaban, tulisan,
 * jadwal review). Materi pelajaran disimpan terpisah sebagai file JSON statis
 * dan dirujuk lewat ID-nya saja. Jadi memperbaiki materi tidak perlu migrasi.
 */

/** Tanggal lokal perangkat, format YYYY-MM-DD. */
export type LocalDate = string;
/** Waktu dalam milidetik sejak epoch (Date.now()). */
export type Timestamp = number;

export type Skill = 'vocabulary' | 'grammar' | 'reading' | 'writing' | 'listening' | 'speaking';
export type CefrLevel = 'PreA1' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface Profile {
  id: 1;
  name: string;
  startDate: LocalDate;
  /** Hari kurikulum yang sedang berjalan (1–300). Hanya maju jika jalur inti hari itu selesai. */
  curriculumDay: number;
  dailyTargetMinutes: number;
  /** Batas minimum menit agar sebuah hari dihitung menjaga streak. */
  minimumDayMinutes: number;
  /** Estimasi level per skill. Diisi dari asesmen, bukan dari jumlah pelajaran selesai. */
  levels: Record<Skill, CefrLevel>;
  lastBackupAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Settings {
  id: 1;
  /** Tampilkan terjemahan langsung, atau hanya saat diketuk. */
  showTranslationsByDefault: boolean;
  /** Kecepatan audio 0.7–1.5. */
  audioRate: number;
  backupReminderDays: number;
  aiTutorUrl: string;
}

/** Catatan per tanggal kalender. Belajar boleh dipecah dan dijeda; menit diakumulasi di sini. */
export interface DailyLog {
  date: LocalDate;
  activeSeconds: number;
  /** Hari kurikulum yang dikerjakan pada tanggal ini. */
  curriculumDay: number;
  blocksCompleted: string[];
  updatedAt: Timestamp;
}

export type SessionStatus = 'running' | 'paused' | 'completed' | 'abandoned';

export interface StudySession {
  id?: number;
  date: LocalDate;
  curriculumDay: number;
  /** Nama blok, misalnya 'vocabulary', 'reading'. */
  block: Skill;
  status: SessionStatus;
  startedAt: Timestamp;
  /** Detik aktif yang benar-benar dipakai (tidak termasuk saat dijeda / layar tidak aktif). */
  activeSeconds: number;
  updatedAt: Timestamp;
}

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  bestScore: number | null;
  attempts: number;
  completedAt: Timestamp | null;
  updatedAt: Timestamp;
}

export interface ExerciseAttempt {
  id?: number;
  exerciseId: string;
  lessonId: string;
  answer: string;
  isCorrect: boolean;
  /** Tag kesalahan dari katalog, misalnya 'missing-be', 'third-person-s'. */
  errorTags: string[];
  at: Timestamp;
}

/**
 * Tingkat penguasaan kata yang jujur:
 * 0 = baru dilihat, 1 = dikenali (flashcard benar), 2 = dipahami dalam konteks,
 * 3 = dipakai benar dalam tulisan sendiri, 4 = dipakai benar berulang kali (aktif stabil).
 */
export type MasteryLevel = 0 | 1 | 2 | 3 | 4;

/** State FSRS (spaced repetition). Field mengikuti library ts-fsrs, disimpan apa adanya. */
export interface FsrsState {
  due: Timestamp;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  /** 0 New, 1 Learning, 2 Review, 3 Relearning */
  state: 0 | 1 | 2 | 3;
  lastReview: Timestamp | null;
}

export interface VocabCard {
  wordId: string;
  fsrs: FsrsState;
  /** Duplikat dari fsrs.due agar bisa diindeks. */
  due: Timestamp;
  mastery: MasteryLevel;
  firstSeenAt: Timestamp;
  updatedAt: Timestamp;
}

export type ReviewRating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export interface VocabReview {
  id?: number;
  wordId: string;
  rating: ReviewRating;
  at: Timestamp;
  /** Interval (hari) yang dijadwalkan setelah review ini. */
  scheduledDays: number;
}

export type WritingLevel = 1 | 2 | 3 | 4 | 5;

export interface Writing {
  id?: number;
  promptId: string | null;
  level: WritingLevel;
  title: string;
  /** Teks asli. Tidak pernah diubah setelah dikirim untuk koreksi. */
  text: string;
  wordCount: number;
  /** draft = masih diedit, submitted = terkunci dan siap/sudah dikoreksi. */
  status: 'draft' | 'submitted';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WritingIssue {
  /** Potongan teks asli yang bermasalah. */
  original: string;
  suggestion: string;
  explanation: string;
  errorTag: string | null;
}

export interface WritingFeedback {
  id?: number;
  writingId: number;
  source: 'offline' | 'local-ai' | 'claude';
  correctedText: string;
  naturalText: string | null;
  issues: WritingIssue[];
  /** Skor rubrik 0–100. Bukan sertifikasi CEFR. */
  score: number | null;
  createdAt: Timestamp;
}

export interface ErrorStat {
  errorTag: string;
  count: number;
  lastSeenAt: Timestamp;
}

export interface Assessment {
  id?: number;
  date: LocalDate;
  kind: 'internal' | 'external';
  /** Nama tes, misalnya 'Asesmen bulan 3' atau 'EF SET'. */
  name: string;
  skill: Skill;
  score: number | null;
  cefrEstimate: CefrLevel | null;
  note: string;
}

export interface ContentPack {
  month: number;
  version: string;
  downloadedAt: Timestamp;
  audioCached: boolean;
}

export const SKILLS: Skill[] = ['vocabulary', 'grammar', 'reading', 'writing', 'listening', 'speaking'];

export const SKILL_LABELS: Record<Skill, string> = {
  vocabulary: 'Kosakata',
  grammar: 'Grammar',
  reading: 'Reading',
  writing: 'Writing',
  listening: 'Listening',
  speaking: 'Speaking',
};
