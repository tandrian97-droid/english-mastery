/**
 * PEMERIKSA TULISAN OFFLINE (berbasis aturan).
 *
 * Fokus pada kesalahan yang paling sering dibuat penutur Bahasa Indonesia.
 * Jujur soal batasan: pemeriksa ini menangkap pola yang sudah diketahui (lupa am/is/are,
 * a/an, -s jamak, -s orang ketiga, huruf besar, dll.), TIDAK bisa menilai apakah tulisan
 * jelas, natural, atau isinya tepat. Untuk itu dipakai AI Tutor (Claude).
 */

export interface WritingIssue {
  start: number;
  end: number;
  original: string;
  suggestion: string;
  explanation: string;
  errorTag: string;
  /** 'grammar' lebih berat dari 'mechanics' (huruf besar, tanda baca). */
  kind: 'grammar' | 'mechanics';
}

export interface CheckResult {
  issues: WritingIssue[];
  corrected: string;
  /** 0–100, hanya dari pemeriksa dasar. Bukan nilai CEFR. */
  score: number;
  wordCount: number;
}

// ---------- Kamus kecil ----------

const SUBJECT_BE: Record<string, string> = { i: 'am', you: 'are', we: 'are', they: 'are', he: 'is', she: 'is', it: 'is' };

const ADJECTIVES = new Set(
  'good bad big small new old happy sad tired hungry busy ready late early fine nice beautiful clean dirty hot cold young tall short long expensive cheap modern simple important difficult easy free open closed sick angry rich poor strong weak quiet noisy far near'.split(' '),
);

/** Kata kerja dasar yang sering dipakai (bentuk dasar). */
const VERBS = new Set(
  'work live like love want need have go come eat drink read write speak study design build make do know think see watch play use help start finish open close call meet visit buy sell pay teach learn draw check send create plan manage plan sleep cook drive walk run sit stand talk listen ask answer say get give take bring'.split(' '),
);
/** Bentuk orang ketiga yang tidak cukup +s. */
const THIRD_PERSON: Record<string, string> = { have: 'has', do: 'does', go: 'goes', watch: 'watches', finish: 'finishes', teach: 'teaches', fix: 'fixes', study: 'studies', pay: 'pays', buy: 'buys', play: 'plays', say: 'says' };
const third = (v: string) => THIRD_PERSON[v] ?? (/(s|sh|ch|x|z|o)$/.test(v) ? `${v}es` : /[^aeiou]y$/.test(v) ? `${v.slice(0, -1)}ies` : `${v}s`);

const JOBS = new Set('architect designer contractor engineer manager teacher student doctor nurse driver client friend owner worker developer marketer creator gamer photographer'.split(' '));
const NOUNS = new Set(
  [...JOBS, ...'house room kitchen door window table chair project office car book phone computer day week month year hour minute meeting design drawing building floor wall roof garden bathroom bedroom game video post friend client tile lamp sofa bed'.split(' ')],
);
const QUANTIFIERS = new Set('two three four five six seven eight nine ten many several these those some'.split(' '));
const POSSESSIVES = new Set(['my', 'your', 'his', 'her', 'our', 'their']);
/** Kata yang ejaannya diawali vokal tapi bunyinya konsonan, dan sebaliknya. */
const A_EXCEPTIONS = new Set(['university', 'user', 'one', 'european', 'unit', 'uniform', 'useful', 'usual']);
const AN_EXCEPTIONS = new Set(['hour', 'honest', 'honor', 'honour', 'heir']);
const KNOWN_NAMES = ['budi', 'sara', 'lee', 'rina', 'andi', 'andrian', 'jakarta', 'bandung', 'surabaya', 'bali', 'indonesia', 'english', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ---------- Pemeriksa ----------

export function checkWriting(text: string, extraNames: string[] = []): CheckResult {
  const issues: WritingIssue[] = [];
  const names = new Set([...KNOWN_NAMES, ...extraNames.map((n) => n.toLowerCase())]);
  const add = (i: WritingIssue) => {
    if (!issues.some((x) => x.start < i.end && i.start < x.end)) issues.push(i);
  };
  const words = [...text.matchAll(/[A-Za-z']+/g)].map((m) => ({ w: m[0], lw: m[0].toLowerCase(), start: m.index!, end: m.index! + m[0].length }));

  for (let k = 0; k < words.length; k++) {
    const cur = words[k];
    const next = words[k + 1];
    const next2 = words[k + 2];
    const prev = words[k - 1];
    const between = (a: { end: number }, b: { start: number }) => text.slice(a.end, b.start);
    const adjacent = (a: { end: number }, b: { start: number }) => /^\s+$/.test(between(a, b));

    // 1. Pengulangan kata: "the the"
    if (next && cur.lw === next.lw && adjacent(cur, next) && cur.lw.length > 1) {
      add({ start: cur.start, end: next.end, original: `${cur.w} ${next.w}`, suggestion: cur.w, explanation: 'Kata yang sama ditulis dua kali.', errorTag: 'repeated-word', kind: 'mechanics' });
    }

    // 2. Kombinasi subjek + be yang salah: "I is", "they is", "he are"
    const be = SUBJECT_BE[cur.lw];
    if (be && next && ['am', 'is', 'are'].includes(next.lw) && next.lw !== be && adjacent(cur, next)) {
      add({ start: next.start, end: next.end, original: next.w, suggestion: be, explanation: `${cur.w} memakai "${be}": I → am · he/she/it → is · you/we/they → are.`, errorTag: 'be-agreement', kind: 'grammar' });
      continue;
    }

    // 3. Lupa am/is/are: "I hungry", "She a designer", "We at home", "I not ready"
    // (lewati pertanyaan seperti "Is she at…?" — be sudah di depan subjek)
    const inverted = prev && ['am', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'will'].includes(prev.lw);
    if (be && next && adjacent(cur, next) && !inverted) {
      const n = next.lw;
      const missing = ADJECTIVES.has(n) || n === 'a' || n === 'an' || POSSESSIVES.has(n) || ['at', 'here', 'there', 'from', 'not', 'very', 'so'].includes(n) || JOBS.has(n);
      if (missing && !(cur.lw === 'it' && prev && ['make', 'made', 'like', 'love', 'want'].includes(prev.lw))) {
        add({ start: cur.start, end: next.end, original: `${cur.w} ${next.w}`, suggestion: `${cur.w} ${be} ${next.w}`, explanation: `Kalimat butuh kata kerja. Jika tidak ada aksi, pakai "${be}": "${cur.w} ${be} ${next.w}…".`, errorTag: 'missing-be', kind: 'grammar' });
        continue;
      }
    }
    // "My name Andrian" → "My name is Andrian"
    if (cur.lw === 'name' && prev && POSSESSIVES.has(prev.lw) && next && adjacent(cur, next) && /^[A-Z]/.test(next.w) && next.lw !== 'is') {
      add({ start: cur.start, end: next.end, original: `${cur.w} ${next.w}`, suggestion: `${cur.w} is ${next.w}`, explanation: '"My name is …": kalimat butuh "is".', errorTag: 'missing-be', kind: 'grammar' });
      continue;
    }

    // 4. Kata kerja dobel: "I am work", "she is live"
    if (['am', 'is', 'are'].includes(cur.lw) && next && adjacent(cur, next) && VERBS.has(next.lw)) {
      add({ start: cur.start, end: next.end, original: `${cur.w} ${next.w}`, suggestion: next.w, explanation: `"${next.w}" sudah kata kerja; "${cur.w}" tidak perlu. Contoh: "I work", bukan "I am work".`, errorTag: 'double-verb', kind: 'grammar' });
      continue;
    }

    // 5. -s orang ketiga: "She work" → "She works"
    if (['he', 'she', 'it'].includes(cur.lw) && next && adjacent(cur, next) && VERBS.has(next.lw) && next.lw !== 'be') {
      const fixed = third(next.lw);
      add({ start: next.start, end: next.end, original: next.w, suggestion: fixed, explanation: `Untuk he/she/it, kata kerja simple present mendapat -s: "${cur.w} ${fixed}".`, errorTag: 'third-person-s', kind: 'grammar' });
      continue;
    }
    if (['he', 'she', 'it'].includes(cur.lw) && next && next.lw === "don't" && adjacent(cur, next)) {
      add({ start: next.start, end: next.end, original: next.w, suggestion: "doesn't", explanation: "Untuk he/she/it: doesn't (bukan don't).", errorTag: 'third-person-s', kind: 'grammar' });
      continue;
    }

    // 6. a/an
    if ((cur.lw === 'a' || cur.lw === 'an') && next && adjacent(cur, next)) {
      const vowelSound = (/^[aeiou]/.test(next.lw) && !A_EXCEPTIONS.has(next.lw)) || AN_EXCEPTIONS.has(next.lw);
      if (cur.lw === 'a' && vowelSound) add({ start: cur.start, end: cur.end, original: cur.w, suggestion: cur.w[0] === 'A' ? 'An' : 'an', explanation: `"${next.w}" berbunyi vokal di awal, jadi "an".`, errorTag: 'a-an', kind: 'grammar' });
      if (cur.lw === 'an' && !vowelSound) add({ start: cur.start, end: cur.end, original: cur.w, suggestion: cur.w[0] === 'A' ? 'A' : 'a', explanation: `"${next.w}" berbunyi konsonan di awal, jadi "a".`, errorTag: 'a-an', kind: 'grammar' });
      // "a houses"
      if (NOUNS.has(next.lw.replace(/s$/, '')) && next.lw.endsWith('s') && !NOUNS.has(next.lw)) {
        add({ start: cur.start, end: next.end, original: `${cur.w} ${next.w}`, suggestion: next.w, explanation: 'a/an hanya untuk satu benda. Untuk jamak, tanpa a/an.', errorTag: 'plural-s', kind: 'grammar' });
      }
    }

    // 7. Lupa artikel sebelum pekerjaan: "I am architect"
    if (['am', 'is', 'are'].includes(cur.lw) && next && adjacent(cur, next) && JOBS.has(next.lw) && cur.lw !== 'are') {
      const art = /^[aeiou]/.test(next.lw) ? 'an' : 'a';
      add({ start: next.start, end: next.end, original: next.w, suggestion: `${art} ${next.w}`, explanation: `Satu orang dari sebuah pekerjaan butuh a/an: "${art} ${next.w}".`, errorTag: 'missing-article', kind: 'grammar' });
    }

    // 8. Lupa -s jamak: "two room", "these chair"
    if (QUANTIFIERS.has(cur.lw) && next && adjacent(cur, next) && NOUNS.has(next.lw)) {
      add({ start: next.start, end: next.end, original: next.w, suggestion: `${next.w}s`, explanation: `Setelah "${cur.w}" (lebih dari satu), kata benda mendapat -s.`, errorTag: 'plural-s', kind: 'grammar' });
    }

    // 9. "at here", "at there"
    if (cur.lw === 'at' && next && (next.lw === 'here' || next.lw === 'there') && adjacent(cur, next)) {
      add({ start: cur.start, end: next.end, original: `${cur.w} ${next.w}`, suggestion: next.w, explanation: `"${next.w}" sudah berarti "di …", tanpa "at".`, errorTag: 'at-here', kind: 'grammar' });
    }

    // 10. Urutan pemilik terbalik: "house my."
    if (NOUNS.has(cur.lw) && next && POSSESSIVES.has(next.lw) && adjacent(cur, next) && (!next2 || /[.!?,]/.test(between(next, next2)))) {
      add({ start: cur.start, end: next.end, original: `${cur.w} ${next.w}`, suggestion: `${next.w} ${cur.w}`, explanation: 'Pemilik selalu di depan benda: "my house", bukan "house my".', errorTag: 'possessive-order', kind: 'grammar' });
    }

    // 11. Huruf besar: "i", nama orang/tempat
    if (cur.w === 'i' || cur.w.startsWith("i'")) {
      add({ start: cur.start, end: cur.end, original: cur.w, suggestion: `I${cur.w.slice(1)}`, explanation: '"I" (saya) selalu huruf besar.', errorTag: 'capitalization', kind: 'mechanics' });
    } else if (names.has(cur.lw) && /^[a-z]/.test(cur.w)) {
      add({ start: cur.start, end: cur.end, original: cur.w, suggestion: cur.w[0].toUpperCase() + cur.w.slice(1), explanation: 'Nama orang, tempat, hari, dan bahasa diawali huruf besar.', errorTag: 'capitalization', kind: 'mechanics' });
    }
  }

  // 12. Awal kalimat huruf kecil
  for (const m of text.matchAll(/(^|[.!?]\s+)([a-z])/g)) {
    const pos = m.index! + m[1].length;
    add({ start: pos, end: pos + 1, original: m[2], suggestion: m[2].toUpperCase(), explanation: 'Kalimat diawali huruf besar.', errorTag: 'capitalization', kind: 'mechanics' });
  }

  // 13. Tanda baca akhir
  const trimmed = text.trimEnd();
  if (trimmed.length > 0 && /[A-Za-z0-9]$/.test(trimmed)) {
    add({ start: trimmed.length, end: trimmed.length, original: '', suggestion: '.', explanation: 'Akhiri kalimat dengan tanda titik (.), tanda tanya (?), atau tanda seru (!).', errorTag: 'punctuation', kind: 'mechanics' });
  }

  issues.sort((a, b) => a.start - b.start);
  const corrected = applyFixes(text, issues);
  const grammar = issues.filter((i) => i.kind === 'grammar').length;
  const mechanics = issues.length - grammar;
  const score = words.length ? Math.max(0, 100 - grammar * 10 - mechanics * 3) : 0;
  return { issues, corrected, score, wordCount: words.length };
}

/** Menerapkan semua saran ke teks (dari belakang agar posisi tidak bergeser). Teks asli tidak diubah. */
export function applyFixes(text: string, issues: WritingIssue[]): string {
  let out = text;
  for (const i of [...issues].sort((a, b) => b.start - a.start)) {
    const insertPunct = i.start === i.end;
    out = out.slice(0, i.start) + (insertPunct ? i.suggestion : i.suggestion) + out.slice(i.end);
  }
  return out;
}
