import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EnglishMasteryDB } from '../src/db/db';
import { createProfile } from '../src/db/repo';
import {
  BLOCK_ORDER,
  blockKey,
  completeBlock,
  getDayProgress,
  getDueCards,
  introduceWords,
  raiseMastery,
  recordAttempt,
  saveReview,
  wordsInText,
  deriveErrorStats,
} from '../src/db/learning';
import type { Exercise } from '../src/content/types';

let database: EnglishMasteryDB;
let n = 0;
beforeEach(async () => {
  database = new EnglishMasteryDB(`learn-${++n}`);
  await database.open();
  await createProfile('Uji', database);
});
afterEach(async () => {
  database.close();
  await database.delete();
});

describe('progres hari', () => {
  it('hari kurikulum maju hanya setelah kelima blok selesai', async () => {
    for (const b of BLOCK_ORDER.slice(0, 4)) {
      expect(await completeBlock(1, b, 80, 7, database)).toBe(false);
    }
    expect((await database.profile.get(1))?.curriculumDay).toBe(1);
    expect(await completeBlock(1, 'writing', 90, 7, database)).toBe(true);
    expect((await database.profile.get(1))?.curriculumDay).toBe(2);
  });
  it('mengulang hari yang sudah lewat tidak memajukan hari lagi', async () => {
    for (const b of BLOCK_ORDER) await completeBlock(1, b, 80, 7, database);
    for (const b of BLOCK_ORDER) await completeBlock(1, b, 100, 7, database);
    expect((await database.profile.get(1))?.curriculumDay).toBe(2);
    const p = await getDayProgress(1, database);
    expect(p.grammar?.bestScore).toBe(100);
    expect(p.grammar?.attempts).toBe(2);
  });
  it('tidak maju melewati materi yang tersedia', async () => {
    await database.profile.update(1, { curriculumDay: 8 });
    for (const b of BLOCK_ORDER) await completeBlock(8, b, 80, 7, database);
    expect((await database.profile.get(1))?.curriculumDay).toBe(8);
  });
  it('kunci blok konsisten', () => {
    expect(blockKey(3, 'reading')).toBe('day-003:reading');
  });
});

describe('kosakata', () => {
  it('kata baru langsung jatuh tempo, dan tidak menimpa kartu lama', async () => {
    expect(await introduceWords(['hello', 'hi'], database)).toBe(2);
    await database.vocab_cards.update('hello', { mastery: 3 });
    expect(await introduceWords(['hello', 'good'], database)).toBe(1);
    expect((await database.vocab_cards.get('hello'))?.mastery).toBe(3);
    expect(await getDueCards(Date.now() + 1000, 60, database)).toHaveLength(3);
  });
  it('review menyimpan riwayat dan menjadwalkan ulang', async () => {
    await introduceWords(['hello'], database);
    const card = (await database.vocab_cards.get('hello'))!;
    const next = await saveReview(card, 3, Date.now(), database);
    expect(next.due).toBeGreaterThan(card.due);
    expect(next.mastery).toBe(1);
    expect(await database.vocab_reviews.count()).toBe(1);
  });
  it('penguasaan hanya naik', async () => {
    await introduceWords(['a', 'b'], database);
    await raiseMastery(['a', 'b', 'tidak-ada'], 2, database);
    await raiseMastery(['a'], 1, database);
    expect((await database.vocab_cards.get('a'))?.mastery).toBe(2);
  });
  it('menemukan kata yang dipelajari di dalam teks (termasuk bentuk jamak)', () => {
    const words = new Map([
      ['house', { id: 'house', word: 'house' }],
      ['room', { id: 'room', word: 'room' }],
      ['i', { id: 'i', word: 'I' }],
      ['door', { id: 'door', word: 'door' }],
    ]);
    expect(wordsInText('I am in two rooms and a house.', words).sort()).toEqual(['house', 'i', 'room']);
  });
});

describe('jawaban & statistik kesalahan', () => {
  const ex: Exercise = { id: 'x1', type: 'fill', prompt: 'I ___ tired.', accept: ['am'], explain: '...', errorTag: 'be-agreement' };
  it('jawaban salah menambah hitungan tag kesalahan', async () => {
    await recordAttempt(ex, 'day-003:grammar', 'is', false, database);
    await recordAttempt(ex, 'day-003:grammar', 'are', false, database);
    await recordAttempt(ex, 'day-003:grammar', 'am', true, database);
    expect((await database.error_stats.get('be-agreement'))?.count).toBe(2);
    expect(await database.exercise_attempts.count()).toBe(3);
  });
});

describe('statistik kesalahan dihitung ulang', () => {
  it('label baru di materi berlaku untuk jawaban lama', () => {
    const attempts = [
      { exerciseId: 'd1-w1', lessonId: 'day-001:writing', answer: 'good morning mr lee', isCorrect: false, errorTags: [], at: 100 },
      { exerciseId: 'd1-e3', lessonId: 'day-001:grammar', answer: 'x', isCorrect: false, errorTags: ['greeting-time'], at: 200 },
      { exerciseId: 'd1-e1', lessonId: 'day-001:grammar', answer: 'ok', isCorrect: true, errorTags: [], at: 300 },
    ];
    const stats = deriveErrorStats(attempts, new Map([['d1-w1', 'greeting-time'], ['d1-e3', 'greeting-time']]));
    expect(stats).toEqual([{ errorTag: 'greeting-time', count: 2, lastSeenAt: 200 }]);
  });
});
