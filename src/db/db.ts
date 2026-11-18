import Dexie, { type EntityTable } from 'dexie';
import type {
  Assessment,
  ContentPack,
  DailyLog,
  ErrorStat,
  ExerciseAttempt,
  LessonProgress,
  Profile,
  Settings,
  StudySession,
  VocabCard,
  VocabReview,
  Writing,
  WritingFeedback,
} from './schema';

export const DB_NAME = 'english-mastery';

/**
 * Versi skema. Naikkan angka ini dan tambahkan blok `.version(n)` baru setiap kali
 * struktur tabel berubah. Jangan pernah mengubah blok versi lama: Dexie memakainya
 * untuk memigrasi data pengguna yang masih memakai versi lama.
 */
export const SCHEMA_VERSION = 1;

export class EnglishMasteryDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  daily_log!: EntityTable<DailyLog, 'date'>;
  study_sessions!: EntityTable<StudySession, 'id'>;
  lesson_progress!: EntityTable<LessonProgress, 'lessonId'>;
  exercise_attempts!: EntityTable<ExerciseAttempt, 'id'>;
  vocab_cards!: EntityTable<VocabCard, 'wordId'>;
  vocab_reviews!: EntityTable<VocabReview, 'id'>;
  writings!: EntityTable<Writing, 'id'>;
  writing_feedback!: EntityTable<WritingFeedback, 'id'>;
  error_stats!: EntityTable<ErrorStat, 'errorTag'>;
  assessments!: EntityTable<Assessment, 'id'>;
  content_packs!: EntityTable<ContentPack, 'month'>;

  constructor(name = DB_NAME) {
    super(name);
    // Kunci pertama = primary key. '++' = auto-increment. '*' = indeks multi-nilai (array).
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      daily_log: 'date, curriculumDay',
      study_sessions: '++id, date, curriculumDay, status, startedAt',
      lesson_progress: 'lessonId, status',
      exercise_attempts: '++id, lessonId, exerciseId, *errorTags, at',
      vocab_cards: 'wordId, due, mastery',
      vocab_reviews: '++id, wordId, at',
      writings: '++id, createdAt, level, status, promptId',
      writing_feedback: '++id, writingId, source',
      error_stats: 'errorTag, count',
      assessments: '++id, date, skill, kind',
      content_packs: 'month',
    });
  }
}

/** Daftar semua tabel, dipakai untuk backup/restore. Urutan tidak penting. */
export const TABLE_NAMES = [
  'profile',
  'settings',
  'daily_log',
  'study_sessions',
  'lesson_progress',
  'exercise_attempts',
  'vocab_cards',
  'vocab_reviews',
  'writings',
  'writing_feedback',
  'error_stats',
  'assessments',
  'content_packs',
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

export const db = new EnglishMasteryDB();
