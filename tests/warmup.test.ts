import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ContentDay, Word } from '../src/content/types';
import type { ErrorStat } from '../src/db/schema';
import { newVocabCard } from '../src/engine/srs';
import { buildWarmup, hardestWords, weakTagRanking } from '../src/engine/warmup';
import { rng, shuffle } from '../src/engine/random';

const words: Word[] = JSON.parse(readFileSync('public/content/month-01/words.json', 'utf8'));
const day = (n: number): ContentDay => JSON.parse(readFileSync(`public/content/month-01/day-0${n}.json`, 'utf8'));
const NOW = new Date('2026-11-25T10:00:00').getTime();

describe('pengacak', () => {
  it('seed sama = urutan sama; seed beda = urutan beda', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], rng(42));
    expect(shuffle([1, 2, 3, 4, 5, 6, 7, 8], rng(42))).toEqual(a);
    expect(shuffle([1, 2, 3, 4, 5, 6, 7, 8], rng(43))).not.toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('peringkat kelemahan', () => {
  it('kesalahan baru lebih berbobot dari kesalahan lama', () => {
    const stats: ErrorStat[] = [
      { errorTag: 'a-an', count: 5, lastSeenAt: NOW - 30 * 86_400_000 }, // lama: bobot 2.5
      { errorTag: 'he-she', count: 3, lastSeenAt: NOW - 86_400_000 }, // baru: bobot 3
      { errorTag: 'pronunciation', count: 50, lastSeenAt: NOW }, // bukan soal tulis
    ];
    expect(weakTagRanking(stats, NOW)).toEqual(['he-she', 'a-an']);
  });
});

describe('Latihan Pintar', () => {
  const days = [day(1), day(2), day(3)];
  const learned = words.filter((w) => w.day <= 3);
  const cards = learned.map((w) => newVocabCard(w.id, NOW));
  cards.find((c) => c.wordId === 'architect')!.fsrs.lapses = 4;
  const stats: ErrorStat[] = [{ errorTag: 'missing-be', count: 4, lastSeenAt: NOW }];

  const plan = buildWarmup({ days, words, cards, errorStats: stats, wrongIds: new Set(['d3-e9']), seed: 7, now: NOW });

  it('berisi 10 soal tanpa duplikat', () => {
    expect(plan.exercises).toHaveLength(10);
    expect(new Set(plan.exercises.map((e) => e.id)).size).toBe(10);
  });
  it('memprioritaskan kelemahan terbesar (±40%)', () => {
    expect(plan.weakTags[0]).toBe('missing-be');
    expect(plan.exercises.filter((e) => e.errorTag === 'missing-be').length).toBeGreaterThanOrEqual(3);
    expect(plan.exercises.some((e) => e.id === 'd3-e9')).toBe(true); // pernah salah → pasti masuk
  });
  it('kata tersulit masuk latihan kosakata', () => {
    expect(plan.focusWords[0]).toBe('architect');
    expect(plan.exercises.some((e) => e.id === 'wu:meaning:architect')).toBe(true);
  });
  it('variasi tipe soal (pilihan, dengar, cocokkan, dll.)', () => {
    const types = new Set(plan.exercises.map((e) => e.type));
    expect(types.has('listen')).toBe(true);
    expect(types.has('match')).toBe(true);
    expect(types.size).toBeGreaterThanOrEqual(4);
  });
  it('pilihan jawaban kosakata valid dan tidak ganda', () => {
    for (const e of plan.exercises) {
      if (e.type === 'mc' || e.type === 'listen') {
        expect(new Set(e.options.map((o) => o.text)).size).toBe(e.options.length);
        expect(e.answer).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('tidak memakai soal "jelaskan" (tidak bisa dinilai cepat)', () => {
    expect(plan.exercises.some((e) => e.type === 'explain')).toBe(false);
  });
  it('sesi berbeda menghasilkan urutan berbeda', () => {
    const other = buildWarmup({ days, words, cards, errorStats: stats, wrongIds: new Set(), seed: 8, now: NOW });
    expect(other.exercises.map((e) => e.id)).not.toEqual(plan.exercises.map((e) => e.id));
  });
  it('tetap jalan tanpa riwayat kesalahan dan dengan sedikit kata', () => {
    const p = buildWarmup({ days: [day(1)], words, cards: cards.slice(0, 2), errorStats: [], wrongIds: new Set(), seed: 1, now: NOW });
    expect(p.exercises.length).toBeGreaterThan(0);
  });
  it('kata tersulit diurutkan dari lapses', () => {
    expect(hardestWords(cards)[0].wordId).toBe('architect');
  });
});
