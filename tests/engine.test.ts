import { describe, expect, it } from 'vitest';
import { checkOrder, checkTypedAnswer, editDistance, normalizeAnswer } from '../src/engine/answers';
import { formatInterval, newVocabCard, previewIntervals, reviewCard } from '../src/engine/srs';

describe('normalisasi jawaban', () => {
  it('mengabaikan huruf besar, spasi, tanda baca akhir', () => {
    expect(normalizeAnswer('  I AM   Tired. ')).toBe('i am tired');
  });
  it('menyamakan singkatan dengan bentuk lengkap', () => {
    expect(normalizeAnswer("I'm an architect")).toBe('i am an architect');
    expect(normalizeAnswer('She isn’t here!')).toBe('she is not here');
  });
});

describe('penilai jawaban ketik', () => {
  it('benar walau beda singkatan', () => {
    expect(checkTypedAnswer("i'm hungry", ['I am hungry.']).status).toBe('correct');
  });
  it('am/is/are yang salah tetap SALAH (bukan salah ketik)', () => {
    expect(checkTypedAnswer('I is hungry', ['I am hungry']).status).toBe('wrong');
    expect(checkTypedAnswer('They is ready', ['They are ready']).status).toBe('wrong');
  });
  it('kehilangan kata (I hungry) SALAH', () => {
    expect(checkTypedAnswer('I hungry', ['I am hungry']).isCorrect).toBe(false);
  });
  it('salah ketik 1 huruf di kata panjang = typo, dihitung benar', () => {
    const r = checkTypedAnswer('She is an architec', ['She is an architect']);
    expect(r.status).toBe('typo');
    expect(r.isCorrect).toBe(true);
  });
  it('salah ketik di kata pendek tidak ditoleransi', () => {
    expect(checkTypedAnswer('I an tired', ['I am tired']).status).toBe('wrong');
  });
  it('menerima beberapa kunci', () => {
    expect(checkTypedAnswer('hi', ['Hello', 'Hi']).status).toBe('correct');
  });
  it('jawaban kosong salah', () => {
    expect(checkTypedAnswer('', ['am']).status).toBe('wrong');
  });
  it('susun kata', () => {
    expect(checkOrder(['She', 'is', 'an', 'architect'], [['She', 'is', 'an', 'architect']]).isCorrect).toBe(true);
    expect(checkOrder(['is', 'She', 'an', 'architect'], [['She', 'is', 'an', 'architect']]).isCorrect).toBe(false);
  });
  it('jarak edit', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('spaced repetition (FSRS)', () => {
  const t0 = new Date('2026-11-19T08:00:00').getTime();
  it('kartu baru langsung jatuh tempo', () => {
    const c = newVocabCard('design', t0);
    expect(c.due).toBeLessThanOrEqual(t0);
    expect(c.mastery).toBe(0);
  });
  it('"Bisa" menjadwalkan lebih lama dari "Lupa"; Mudah paling lama', () => {
    const c = newVocabCard('design', t0);
    const again = reviewCard(c, 1, t0).card.due;
    const good = reviewCard(c, 3, t0).card.due;
    const easy = reviewCard(c, 4, t0).card.due;
    expect(good).toBeGreaterThan(again);
    expect(easy).toBeGreaterThan(good);
  });
  it('flashcard hanya menaikkan penguasaan sampai "dikenali"', () => {
    let c = newVocabCard('design', t0);
    let now = t0;
    for (let i = 0; i < 6; i++) {
      c = reviewCard(c, 4, now).card;
      now = c.due + 1000;
    }
    expect(c.mastery).toBe(1);
    expect(c.fsrs.scheduledDays).toBeGreaterThan(7);
  });
  it('lupa tidak menghapus bukti pemakaian di tulisan', () => {
    const c = { ...newVocabCard('design', t0), mastery: 3 as const };
    expect(reviewCard(c, 1, t0).card.mastery).toBe(3);
  });
  it('pratinjau interval untuk 4 tombol', () => {
    const p = previewIntervals(newVocabCard('x', t0), t0);
    expect(Object.keys(p)).toHaveLength(4);
    expect(formatInterval(10 * 60_000)).toBe('10 mnt');
    expect(formatInterval(3 * 86_400_000)).toBe('3 hr');
  });
});
