/**
 * Menilai ucapan dari hasil pengenalan suara (speech recognition).
 *
 * Cara kerja: kalimat target dan kalimat yang "didengar" mesin dibandingkan kata per kata
 * (urutan terpanjang yang sama / LCS). Kata target yang tidak terdengar ditandai, karena
 * biasanya itulah kata yang pengucapannya belum jelas.
 *
 * Batasan jujur: ini menilai apakah mesin MENGENALI kata-kata Anda, bukan menilai aksen
 * secara rinci. Nilai tinggi = ucapan Anda bisa dipahami.
 */
import { normalizeAnswer } from './answers';

export interface WordMark {
  word: string;
  heard: boolean;
}

export interface PronunciationResult {
  score: number;
  marks: WordMark[];
  heard: string;
}

function tokens(s: string): string[] {
  return normalizeAnswer(s)
    .split(' ')
    .filter(Boolean)
    .map((t) => t.replace(/[^a-z0-9']/g, ''));
}

/** Kata yang sering didengar mesin dalam bentuk lain tapi bunyinya sama. */
const SAME_SOUND: Record<string, string> = { two: '2', to: '2', too: '2', for: '4', four: '4', one: '1', won: '1', there: 'their', "they're": 'their', hi: 'hi', high: 'hi', i: 'i', eye: 'i', mr: 'mister' };
const key = (t: string) => SAME_SOUND[t] ?? t;

export function scorePronunciation(target: string, heardAlternatives: string[]): PronunciationResult {
  const tgtRaw = normalizeAnswer(target).split(' ').filter(Boolean);
  const tgt = tokens(target).map(key);
  let best: PronunciationResult = { score: 0, marks: tgtRaw.map((w) => ({ word: w, heard: false })), heard: heardAlternatives[0] ?? '' };
  for (const alt of heardAlternatives) {
    const got = tokens(alt).map(key);
    // LCS
    const dp = Array.from({ length: tgt.length + 1 }, () => new Array<number>(got.length + 1).fill(0));
    for (let i = tgt.length - 1; i >= 0; i--)
      for (let j = got.length - 1; j >= 0; j--) dp[i][j] = tgt[i] === got[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const heard = new Array<boolean>(tgt.length).fill(false);
    let i = 0;
    let j = 0;
    while (i < tgt.length && j < got.length) {
      if (tgt[i] === got[j]) {
        heard[i] = true;
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    const matched = heard.filter(Boolean).length;
    // Kata tambahan yang tidak ada di target sedikit mengurangi nilai.
    const extra = Math.max(0, got.length - matched);
    const score = tgt.length ? Math.max(0, Math.round(((matched - extra * 0.25) / tgt.length) * 100)) : 0;
    if (score > best.score) best = { score, marks: tgtRaw.map((w, k) => ({ word: w, heard: heard[k] })), heard: alt };
  }
  return best;
}
