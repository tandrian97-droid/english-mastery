/**
 * Penilai jawaban ketik (offline).
 *
 * Prinsip: menilai MAKNA tata bahasa, bukan hal kecil. Jadi yang diabaikan:
 * huruf besar/kecil, spasi berlebih, tanda baca di akhir, tanda kutip miring,
 * dan bentuk singkatan (I'm = I am, isn't = is not).
 * Salah ketik 1 huruf pada kata panjang dianggap benar tapi diberi catatan ejaan.
 */

const CONTRACTIONS: [RegExp, string][] = [
  [/\bi'm\b/g, 'i am'],
  [/\byou're\b/g, 'you are'],
  [/\bwe're\b/g, 'we are'],
  [/\bthey're\b/g, 'they are'],
  [/\bhe's\b/g, 'he is'],
  [/\bshe's\b/g, 'she is'],
  [/\bit's\b/g, 'it is'],
  [/\bthat's\b/g, 'that is'],
  [/\bwhat's\b/g, 'what is'],
  [/\bwhere's\b/g, 'where is'],
  [/\bwho's\b/g, 'who is'],
  [/\bthere's\b/g, 'there is'],
  [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'],
  [/\bwasn't\b/g, 'was not'],
  [/\bweren't\b/g, 'were not'],
  [/\bdon't\b/g, 'do not'],
  [/\bdoesn't\b/g, 'does not'],
  [/\bdidn't\b/g, 'did not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bi'll\b/g, 'i will'],
  [/\bi've\b/g, 'i have'],
];

export function normalizeAnswer(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.!?,;:"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, full] of CONTRACTIONS) s = s.replace(re, full);
  return s;
}

/** Jarak edit Levenshtein (berapa huruf harus diubah). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export type AnswerStatus = 'correct' | 'typo' | 'wrong';

export interface AnswerCheck {
  status: AnswerStatus;
  isCorrect: boolean;
  /** Jawaban kunci yang paling dekat, untuk ditampilkan. */
  expected: string;
}

/**
 * Salah ketik hanya ditoleransi jika kata-katanya sama jumlahnya dan hanya satu kata
 * (panjang ≥ 5 huruf) yang berbeda 1 huruf. Jadi "I am" vs "I is" tetap SALAH,
 * tapi "architect" vs "architec" dianggap salah ketik.
 */
function isTypo(given: string, key: string): boolean {
  const g = given.split(' ');
  const k = key.split(' ');
  if (g.length !== k.length) return false;
  let diffs = 0;
  for (let i = 0; i < k.length; i++) {
    if (g[i] === k[i]) continue;
    if (k[i].length < 5 || editDistance(g[i], k[i]) > 1) return false;
    diffs++;
  }
  return diffs === 1;
}

export function checkTypedAnswer(given: string, accepted: string[]): AnswerCheck {
  if (accepted.length === 0) throw new Error('Soal tanpa kunci jawaban.');
  const g = normalizeAnswer(given);
  for (const a of accepted) if (normalizeAnswer(a) === g) return { status: 'correct', isCorrect: true, expected: a };
  if (g.length > 0) for (const a of accepted) if (isTypo(g, normalizeAnswer(a))) return { status: 'typo', isCorrect: true, expected: a };
  return { status: 'wrong', isCorrect: false, expected: accepted[0] };
}

/** Untuk soal menyusun kata: urutan potongan yang dipilih dibandingkan dengan kunci. */
export function checkOrder(chosen: string[], accepted: string[][]): AnswerCheck {
  const joined = chosen.join(' ');
  return checkTypedAnswer(
    joined,
    accepted.map((a) => a.join(' ')),
  );
}
