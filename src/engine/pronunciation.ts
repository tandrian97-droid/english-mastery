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
  /** Nama orang/tempat: tidak dinilai, karena pengenal suara bahasa Inggris tidak mengenal nama Indonesia. */
  name?: boolean;
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

/** Nama yang dipakai di materi. Pengenal suara mengubah 'Budi' menjadi 'Moody'/'beauty', jadi nama tidak dinilai. */
const KNOWN_NAMES = new Set(['budi', 'sara', 'lee', 'rina', 'andi', 'andrian', 'jakarta', 'bandung', 'surabaya']);

/** Kata berhuruf besar di tengah kalimat (selain "I") dianggap nama. */
function namesIn(target: string): Set<string> {
  const names = new Set<string>();
  for (const sentence of target.split(/(?<=[.!?])\s+/)) {
    const words = sentence.match(/[A-Za-z']+/g) ?? [];
    words.forEach((w, i) => {
      if (i > 0 && /^[A-Z][a-z]/.test(w) && w !== 'I' && !w.startsWith("I'")) names.add(w.toLowerCase());
    });
  }
  return names;
}

export function scorePronunciation(target: string, heardAlternatives: string[]): PronunciationResult {
  const tgtRaw = normalizeAnswer(target).split(' ').filter(Boolean);
  const tgt = tokens(target).map(key);
  const names = namesIn(target);
  const isName = tgt.map((t) => KNOWN_NAMES.has(t) || names.has(t));
  const scored = isName.filter((n) => !n).length;
  const mark = (heard: boolean[]) => tgtRaw.map((w, k) => ({ word: w, heard: heard[k] || isName[k], name: isName[k] || undefined }));
  let best: PronunciationResult = { score: 0, marks: mark(new Array<boolean>(tgt.length).fill(false)), heard: heardAlternatives[0] ?? '' };
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
    const matched = heard.filter((h, k) => h && !isName[k]).length;
    const matchedNames = heard.filter((h, k) => h && isName[k]).length;
    // Kata tambahan yang tidak ada di target sedikit mengurangi nilai
    // (kecuali kata pengganti nama, mis. 'Budi' terdengar 'beauty').
    const unmatchedNames = isName.filter(Boolean).length - matchedNames;
    const extra = Math.max(0, got.length - matched - matchedNames - unmatchedNames * 2);
    const score = scored ? Math.max(0, Math.min(100, Math.round(((matched - extra * 0.25) / scored) * 100))) : 100;
    if (score > best.score) best = { score, marks: mark(heard), heard: alt };
  }
  return best;
}
