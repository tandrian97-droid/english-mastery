import { describe, expect, it } from 'vitest';
import { checkWriting } from '../src/engine/writingCheck';

const tags = (t: string, names: string[] = []) => checkWriting(t, names).issues.map((i) => i.errorTag);
const fix = (t: string, names: string[] = []) => checkWriting(t, names).corrected;

describe('pemeriksa tulisan offline', () => {
  it('kalimat benar tidak diberi catatan', () => {
    for (const t of ['I am an architect.', 'She is a designer.', 'They are at home now.', 'My name is Andrian. Nice to meet you.', 'He works in Jakarta.', 'These chairs are new.', 'I work in Bandung.', 'We are not busy today.', 'Is she at the office?', 'Are they ready?', 'Am I late?']) {
      expect(checkWriting(t).issues, t).toEqual([]);
    }
  });
  it('lupa am/is/are', () => {
    expect(fix('I hungry.')).toBe('I am hungry.');
    expect(fix('She a designer.')).toBe('She is a designer.');
    expect(fix('We at home.')).toBe('We are at home.');
    expect(fix('I not tired.')).toBe('I am not tired.');
    expect(fix('My name Andrian.')).toBe('My name is Andrian.');
  });
  it('salah pilih am/is/are', () => {
    expect(fix('They is ready.')).toBe('They are ready.');
    expect(fix('I is busy.')).toBe('I am busy.');
    expect(fix('He are my client.')).toBe('He is my client.');
  });
  it('kata kerja dobel', () => {
    expect(fix('I am work in Bandung.')).toBe('I work in Bandung.');
    expect(tags('I am working now.')).toEqual([]);
  });
  it('-s orang ketiga', () => {
    expect(fix('She work in Jakarta.')).toBe('She works in Jakarta.');
    expect(fix('He watch videos.')).toBe('He watches videos.');
    expect(fix('She study English.')).toBe('She studies English.');
    expect(fix("He don't like coffee.")).toBe("He doesn't like coffee.");
  });
  it('a/an berdasarkan bunyi', () => {
    expect(fix('He is a architect.')).toBe('He is an architect.');
    expect(fix('It is an house.')).toBe('It is a house.');
    expect(tags('It is a university.')).toEqual([]);
    expect(tags('Wait an hour.')).toEqual([]);
  });
  it('lupa artikel sebelum pekerjaan', () => {
    expect(fix('I am architect.')).toBe('I am an architect.');
    expect(fix('She is designer.')).toBe('She is a designer.');
  });
  it('lupa -s jamak', () => {
    expect(fix('I have two room.')).toBe('I have two rooms.');
    expect(fix('These chair are new.')).toBe('These chairs are new.');
  });
  it('at here / at there', () => {
    expect(fix('I am at here.')).toBe('I am here.');
  });
  it('urutan pemilik', () => {
    expect(fix('This is house my.')).toBe('This is my house.');
  });
  it('huruf besar: I, nama, awal kalimat', () => {
    expect(fix('good morning. my name is andrian.', ['Andrian'])).toBe('Good morning. My name is Andrian.');
    expect(fix('Yesterday i was busy.')).toBe('Yesterday I was busy.');
  });
  it('tanda baca akhir', () => {
    expect(fix('Nice to meet you')).toBe('Nice to meet you.');
  });
  it('tulisan asli pengguna (laporan Hari 1)', () => {
    const r = checkWriting('Good morning my name is andrian. Nice to meet you', ['Andrian']);
    expect(r.corrected).toBe('Good morning my name is Andrian. Nice to meet you.');
    expect(r.issues.every((i) => i.kind === 'mechanics')).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });
  it('nilai turun lebih banyak untuk grammar daripada huruf besar', () => {
    expect(checkWriting('I hungry.').score).toBeLessThan(checkWriting('i am hungry.').score);
  });
  it('teks kosong', () => {
    expect(checkWriting('').score).toBe(0);
  });
});
