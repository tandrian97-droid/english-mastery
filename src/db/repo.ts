import { db, type EnglishMasteryDB } from './db';
import type { DailyLog, LocalDate, Profile, Settings } from './schema';
import { addDays, lastNDays, toLocalDate } from '../engine/dates';

export const DEFAULT_AI_TUTOR_URL = 'https://claude.ai/artifact/3jD2JQoYroUh9Uh48uv5n9';
export const TOTAL_CURRICULUM_DAYS = 300;

export function defaultSettings(): Settings {
  return {
    id: 1,
    showTranslationsByDefault: false,
    audioRate: 1,
    backupReminderDays: 7,
    aiTutorUrl: DEFAULT_AI_TUTOR_URL,
  };
}

export function newProfile(name: string, now = Date.now()): Profile {
  return {
    id: 1,
    name: name.trim(),
    startDate: toLocalDate(new Date(now)),
    curriculumDay: 1,
    dailyTargetMinutes: 120,
    minimumDayMinutes: 30,
    levels: {
      vocabulary: 'PreA1',
      grammar: 'PreA1',
      reading: 'PreA1',
      writing: 'PreA1',
      listening: 'PreA1',
      speaking: 'PreA1',
    },
    lastBackupAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createProfile(name: string, database: EnglishMasteryDB = db): Promise<Profile> {
  const clean = name.trim();
  if (clean.length < 1 || clean.length > 40) throw new Error('Nama harus 1–40 karakter.');
  const profile = newProfile(clean);
  await database.transaction('rw', database.profile, database.settings, async () => {
    await database.profile.put(profile);
    if (!(await database.settings.get(1))) await database.settings.put(defaultSettings());
  });
  return profile;
}

/**
 * Menambah detik belajar aktif ke catatan hari ini. Aman dipanggil berkali-kali
 * (misalnya tiap 15 detik) dari timer sesi.
 */
export async function addActiveSeconds(
  seconds: number,
  date: LocalDate = toLocalDate(),
  database: EnglishMasteryDB = db,
): Promise<DailyLog> {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Detik harus angka positif.');
  return database.transaction('rw', database.daily_log, database.profile, async () => {
    const profile = await database.profile.get(1);
    const existing = await database.daily_log.get(date);
    const log: DailyLog = existing ?? {
      date,
      activeSeconds: 0,
      curriculumDay: profile?.curriculumDay ?? 1,
      blocksCompleted: [],
      updatedAt: Date.now(),
    };
    log.activeSeconds += Math.round(seconds);
    log.updatedAt = Date.now();
    await database.daily_log.put(log);
    return log;
  });
}

export interface DashboardStats {
  todaySeconds: number;
  totalSeconds: number;
  daysStudied: number;
  streak: number;
  week: { date: LocalDate; seconds: number }[];
  vocabTotal: number;
  vocabActive: number;
  vocabDue: number;
}

/**
 * Streak = jumlah hari berturut-turut yang memenuhi menit minimum.
 * Hari ini yang belum memenuhi minimum tidak memutus streak (hari belum selesai).
 */
export function computeStreak(logs: DailyLog[], minimumSeconds: number, today: LocalDate = toLocalDate()): number {
  const ok = new Set(logs.filter((l) => l.activeSeconds >= minimumSeconds).map((l) => l.date));
  let day = ok.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (ok.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export async function getDashboardStats(database: EnglishMasteryDB = db, now = Date.now()): Promise<DashboardStats> {
  const today = toLocalDate(new Date(now));
  const [profile, logs, vocabTotal, vocabActive, vocabDue] = await Promise.all([
    database.profile.get(1),
    database.daily_log.toArray(),
    database.vocab_cards.count(),
    database.vocab_cards.where('mastery').aboveOrEqual(3).count(),
    database.vocab_cards.where('due').belowOrEqual(now).count(),
  ]);
  const byDate = new Map(logs.map((l) => [l.date, l.activeSeconds]));
  const minimumSeconds = (profile?.minimumDayMinutes ?? 30) * 60;
  return {
    todaySeconds: byDate.get(today) ?? 0,
    totalSeconds: logs.reduce((s, l) => s + l.activeSeconds, 0),
    daysStudied: logs.filter((l) => l.activeSeconds > 0).length,
    streak: computeStreak(logs, minimumSeconds, today),
    week: lastNDays(7, today).map((date) => ({ date, seconds: byDate.get(date) ?? 0 })),
    vocabTotal,
    vocabActive,
    vocabDue,
  };
}

export function isBackupOverdue(profile: Profile, settings: Settings, now = Date.now()): boolean {
  const reference = profile.lastBackupAt ?? profile.createdAt;
  return now - reference > settings.backupReminderDays * 24 * 60 * 60 * 1000;
}
