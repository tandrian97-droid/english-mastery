import { describe, expect, it } from 'vitest';
import { fnv1a, normalizeForAudio } from '../src/engine/audio';
import { scorePronunciation } from '../src/engine/pronunciation';

describe('nama file audio identik dengan skrip Python', () => {
  // Nilai acuan dihitung dari scripts/generate-audio.py
  const cases: [string, string][] = [
    ['hello', '4f9f2cab'],
    ['Sara: Good morning!', '4a5b08c3'],
    ['I am **an** architect.', '5eb0c2f8'],
    ['Café — naïve', '86ce8493'],
    ['  two   spaces ', '9c72439c'],
  ];
  for (const [text, hash] of cases) {
    it(JSON.stringify(text), () => expect(fnv1a(normalizeForAudio(text))).toBe(hash));
  }
  it('label pembicara dibuang', () => expect(normalizeForAudio('Budi: Hi!')).toBe('Hi!'));
});

describe('penilaian ucapan', () => {
  it('ucapan sama persis = 100%', () => {
    const r = scorePronunciation('She is an architect.', ['she is an architect']);
    expect(r.score).toBe(100);
    expect(r.marks.every((m) => m.heard)).toBe(true);
  });
  it('kata yang tidak terdengar ditandai', () => {
    const r = scorePronunciation('They are busy.', ['they are bossy']);
    expect(r.marks.map((m) => m.heard)).toEqual([true, true, false]);
    expect(r.score).toBeLessThan(70);
  });
  it('singkatan dan bentuk lengkap dianggap sama', () => {
    expect(scorePronunciation('I am tired.', ["I'm tired"]).score).toBe(100);
  });
  it('memilih alternatif terbaik dari mesin', () => {
    expect(scorePronunciation('Good evening.', ['good morning', 'good evening']).score).toBe(100);
  });
  it('homofon (two/too/to) tidak dihukum', () => {
    expect(scorePronunciation('Nice to meet you too.', ['nice 2 meet you to']).score).toBe(100);
  });
  it('nama Indonesia tidak dinilai (Budi terdengar "beauty")', () => {
    for (const heard of ['my name is beauty', 'my name is Moody', 'my name is Booty', 'my name is Budi']) {
      const r = scorePronunciation('My name is Budi.', [heard]);
      expect(r.score).toBe(100);
      expect(r.marks.find((m) => m.word === 'budi')?.name).toBe(true);
    }
  });
  it('nama tidak menutupi kesalahan kata lain', () => {
    expect(scorePronunciation('My name is Budi.', ['my game is beauty']).score).toBeLessThan(80);
  });
  it('nama di tengah kalimat dikenali otomatis', () => {
    expect(scorePronunciation('This is Kevin, my friend.', ['this is cabin my friend']).score).toBe(100);
  });
  it('tidak ada yang terdengar = 0%', () => {
    expect(scorePronunciation('Hello.', []).score).toBe(0);
  });
});
