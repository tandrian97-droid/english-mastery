import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EnglishMasteryDB, TABLE_NAMES } from '../src/db/db';
import { BackupError, exportBackup, importBackup, parseBackupText, validateBackup } from '../src/db/backup';
import { addActiveSeconds, computeStreak, createProfile, getDashboardStats, isBackupOverdue, defaultSettings } from '../src/db/repo';
import { addDays, toLocalDate } from '../src/engine/dates';
import type { DailyLog, VocabCard } from '../src/db/schema';

let database: EnglishMasteryDB;
let n = 0;

beforeEach(async () => {
  database = new EnglishMasteryDB(`test-${++n}`);
  await database.open();
});
afterEach(async () => {
  database.close();
  await database.delete();
});

function card(wordId: string, mastery: 0 | 1 | 2 | 3 | 4, due: number): VocabCard {
  return {
    wordId,
    mastery,
    due,
    firstSeenAt: 1,
    updatedAt: 1,
    fsrs: { due, stability: 1, difficulty: 5, elapsedDays: 0, scheduledDays: 1, reps: 1, lapses: 0, state: 2, lastReview: null },
  };
}

describe('profil', () => {
  it('membuat profil dan pengaturan default', async () => {
    const p = await createProfile('  Budi  ', database);
    expect(p.name).toBe('Budi');
    expect(p.curriculumDay).toBe(1);
    expect(p.levels.reading).toBe('PreA1');
    expect(await database.settings.get(1)).toEqual(defaultSettings());
  });
  it('menolak nama kosong', async () => {
    await expect(createProfile('   ', database)).rejects.toThrow();
  });
});

describe('waktu belajar', () => {
  it('mengakumulasi detik yang dipecah dalam satu hari', async () => {
    await createProfile('A', database);
    await addActiveSeconds(600, '2026-11-19', database);
    await addActiveSeconds(900, '2026-11-19', database);
    const log = await database.daily_log.get('2026-11-19');
    expect(log?.activeSeconds).toBe(1500);
    expect(log?.curriculumDay).toBe(1);
  });
  it('menolak detik tidak valid', async () => {
    await expect(addActiveSeconds(-5, '2026-11-19', database)).rejects.toThrow();
    await expect(addActiveSeconds(Number.NaN, '2026-11-19', database)).rejects.toThrow();
  });
});

describe('streak', () => {
  const today = '2026-11-19';
  const log = (date: string, minutes: number): DailyLog => ({ date, activeSeconds: minutes * 60, curriculumDay: 1, blocksCompleted: [], updatedAt: 0 });
  it('menghitung hari berturut-turut yang memenuhi minimum', () => {
    const logs = [log(today, 40), log(addDays(today, -1), 30), log(addDays(today, -2), 120), log(addDays(today, -4), 60)];
    expect(computeStreak(logs, 30 * 60, today)).toBe(3);
  });
  it('hari ini yang belum cukup tidak memutus streak', () => {
    const logs = [log(today, 5), log(addDays(today, -1), 30), log(addDays(today, -2), 30)];
    expect(computeStreak(logs, 30 * 60, today)).toBe(2);
  });
  it('kurang dari minimum tidak dihitung', () => {
    expect(computeStreak([log(addDays(today, -1), 29)], 30 * 60, today)).toBe(0);
  });
});

describe('statistik dashboard', () => {
  it('menghitung menit, kosakata, dan minggu', async () => {
    await createProfile('A', database);
    const now = Date.now();
    const today = toLocalDate(new Date(now));
    await addActiveSeconds(3600, today, database);
    await addActiveSeconds(1800, addDays(today, -1), database);
    await database.vocab_cards.bulkPut([card('w1', 0, now - 1000), card('w2', 3, now + 86_400_000), card('w3', 4, now - 5)]);
    const s = await getDashboardStats(database, now);
    expect(s.todaySeconds).toBe(3600);
    expect(s.totalSeconds).toBe(5400);
    expect(s.daysStudied).toBe(2);
    expect(s.streak).toBe(2);
    expect(s.week).toHaveLength(7);
    expect(s.week[6]).toEqual({ date: today, seconds: 3600 });
    expect(s.vocabTotal).toBe(3);
    expect(s.vocabActive).toBe(2);
    expect(s.vocabDue).toBe(2);
  });
});

describe('backup dan restore', () => {
  async function seed() {
    await createProfile('Andi', database);
    await addActiveSeconds(1234, '2026-11-19', database);
    await database.vocab_cards.put(card('design', 2, 99));
    await database.writings.add({ promptId: null, level: 1, title: 'Intro', text: 'I am an architect.', wordCount: 4, status: 'submitted', createdAt: 5, updatedAt: 5 });
    await database.writing_feedback.add({ writingId: 1, source: 'offline', correctedText: 'I am an architect.', naturalText: null, issues: [], score: 100, createdAt: 6 });
    await database.exercise_attempts.add({ exerciseId: 'e1', lessonId: 'L1.3', answer: 'am', isCorrect: true, errorTags: ['missing-be'], at: 7 });
  }

  it('ekspor → hapus → impor menghasilkan data yang identik', async () => {
    await seed();
    const before = await exportBackup(database);
    const json = JSON.stringify(before);

    for (const t of TABLE_NAMES) await database.table(t).clear();
    expect(await database.profile.count()).toBe(0);

    const counts = await importBackup(parseBackupText(json), database);
    expect(counts.writings).toBe(1);
    const after = await exportBackup(database);
    expect(after.tables).toEqual(before.tables);
    expect(after.counts).toEqual(before.counts);
    // indeks multi-nilai tetap berfungsi setelah impor
    expect(await database.exercise_attempts.where('errorTags').equals('missing-be').count()).toBe(1);
  });

  it('impor ke database baru (perangkat lain) berhasil', async () => {
    await seed();
    const json = JSON.stringify(await exportBackup(database));
    const other = new EnglishMasteryDB(`test-other-${n}`);
    await importBackup(parseBackupText(json), other);
    expect((await other.profile.get(1))?.name).toBe('Andi');
    expect((await other.daily_log.get('2026-11-19'))?.activeSeconds).toBe(1234);
    other.close();
    await other.delete();
  });

  it('impor yang gagal tidak mengubah data lama (rollback)', async () => {
    await seed();
    const backup = await exportBackup(database);
    // dua baris dengan primary key sama → bulkAdd gagal di tengah transaksi
    backup.tables.vocab_cards = [card('x', 0, 1), card('x', 0, 1)];
    backup.counts.vocab_cards = 2;
    await expect(importBackup(backup, database)).rejects.toThrow();
    expect((await database.profile.get(1))?.name).toBe('Andi');
    expect(await database.vocab_cards.get('design')).toBeDefined();
    expect(await database.writings.count()).toBe(1);
  });

  it('menolak file yang bukan backup', () => {
    expect(() => parseBackupText('bukan json')).toThrow(BackupError);
    expect(() => validateBackup({ app: 'lain' })).toThrow(/bukan backup/);
    expect(() => validateBackup({ app: 'english-mastery', schemaVersion: 99, tables: {} })).toThrow(/lebih baru/);
    expect(() => validateBackup({ app: 'english-mastery', schemaVersion: 1, tables: { profile: 'x' } })).toThrow(/bukan daftar/);
    expect(() => validateBackup({ app: 'english-mastery', schemaVersion: 1, tables: { hacker: [] } })).toThrow(/tidak dikenal/);
    expect(() =>
      validateBackup({ app: 'english-mastery', schemaVersion: 1, counts: { writings: 5 }, tables: { writings: [{}] } }),
    ).toThrow(/tidak lengkap/);
  });
});

describe('pengingat backup', () => {
  it('terlambat setelah 7 hari', async () => {
    const p = await createProfile('A', database);
    const s = defaultSettings();
    expect(isBackupOverdue(p, s, p.createdAt + 6 * 86_400_000)).toBe(false);
    expect(isBackupOverdue(p, s, p.createdAt + 8 * 86_400_000)).toBe(true);
    expect(isBackupOverdue({ ...p, lastBackupAt: p.createdAt + 7 * 86_400_000 }, s, p.createdAt + 8 * 86_400_000)).toBe(false);
  });
});
