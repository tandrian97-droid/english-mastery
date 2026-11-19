#!/usr/bin/env node
/**
 * Validator materi English Mastery.
 * Jalankan: npm run validate:content
 *
 * Memeriksa:
 *  - setiap kata punya field wajib, ID unik, IPA berformat /.../
 *  - setiap hari: kata baru ada di daftar kata dan diperkenalkan di hari yang sama
 *  - setiap soal: ID unik, punya penjelasan, kunci jawaban valid
 *  - setiap bacaan: SEMUA kata sudah dipelajari (hari ini atau sebelumnya) atau ada di glosarium
 *  - kurikulum: hari yang ditandai tersedia benar-benar ada filenya
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Harus identik dengan src/engine/audio.ts dan scripts/generate-audio.py
const normalizeForAudio = (t) => t.replace(/[*~]/g, '').replace(/^[A-Z][a-z]+:\s/, '').replace(/\s+/g, ' ').trim();
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (const b of Buffer.from(text, 'utf8')) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const AUDIO_DIR = join(process.cwd(), 'public', 'audio');
let audioChecked = 0;
function needAudio(text, where) {
  audioChecked++;
  if (!existsSync(join(AUDIO_DIR, `${fnv1a(normalizeForAudio(text))}.ogg`))) err(`${where}: audio belum dibuat untuk "${text}" (jalankan scripts/generate-audio.py)`);
}

const ROOT = join(process.cwd(), 'public', 'content');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// Nama orang/tempat dan kata yang boleh muncul di bacaan tanpa diajarkan.
const PROPER_NOUNS = new Set(['budi', 'sara', 'lee', 'rina', 'andi', 'jakarta', 'bandung', 'surabaya']);

const curriculum = JSON.parse(readFileSync(join(ROOT, 'curriculum.json'), 'utf8'));
const exerciseIds = new Set();

function checkExercise(ex, where, isReading = false) {
  if (!ex.id) return err(`${where}: soal tanpa id`);
  if (exerciseIds.has(ex.id)) err(`${where}: id soal ganda ${ex.id}`);
  exerciseIds.add(ex.id);
  if (!ex.prompt?.trim()) err(`${ex.id}: prompt kosong`);
  if (!ex.explain?.trim()) err(`${ex.id}: tidak ada penjelasan (explain)`);
  switch (ex.type) {
    case 'mc':
      if (!Array.isArray(ex.options) || ex.options.length < 2) err(`${ex.id}: pilihan ganda minimal 2 opsi`);
      if (!Number.isInteger(ex.answer) || ex.answer < 0 || ex.answer >= (ex.options?.length ?? 0)) err(`${ex.id}: indeks jawaban tidak valid`);
      ex.options?.forEach((o, i) => {
        if (!isReading && i !== ex.answer && ex.options.length > 2 && !o.why) warn(`${ex.id}: opsi salah #${i} tanpa alasan 'why'`);
      });
      break;
    case 'fill':
    case 'translate':
      if (!Array.isArray(ex.accept) || ex.accept.length === 0 || ex.accept.some((a) => !a.trim())) err(`${ex.id}: kunci 'accept' kosong`);
      if (ex.type === 'fill' && !ex.prompt.includes('___')) err(`${ex.id}: soal isian tanpa '___'`);
      break;
    case 'order':
      if (!Array.isArray(ex.tokens) || ex.tokens.length < 2) err(`${ex.id}: soal susun minimal 2 potongan`);
      break;
    case 'listen':
      if (!ex.audio?.trim()) err(`${ex.id}: soal dengar tanpa audio`);
      if (!Number.isInteger(ex.answer) || ex.answer < 0 || ex.answer >= (ex.options?.length ?? 0)) err(`${ex.id}: indeks jawaban tidak valid`);
      break;
    case 'match':
      if (!Array.isArray(ex.pairs) || ex.pairs.length < 3) err(`${ex.id}: soal cocokkan minimal 3 pasang`);
      break;
    case 'explain':
      if (!ex.model?.trim()) err(`${ex.id}: soal penjelasan tanpa contoh jawaban (model)`);
      break;
    default:
      err(`${ex.id}: tipe soal tidak dikenal '${ex.type}'`);
  }
}

/** Bentuk kata yang dianggap sama dengan kata dasar yang sudah dipelajari. */
function variants(w) {
  const v = new Set([w]);
  v.add(w + 's');
  v.add(w + 'es');
  if (w.endsWith('y')) v.add(w.slice(0, -1) + 'ies');
  return v;
}

const IRREGULAR = { has: 'have', does: 'do', goes: 'go' };
const CONTRACTION_PARTS = { "don't": ['do', 'not'], "doesn't": ['do', 'not'], "can't": ['can', 'not'], "there's": ['there', 'is'], "i'm": ['i', 'am'], "isn't": ['is', 'not'], "aren't": ['are', 'not'], "he's": ['he', 'is'], "she's": ['she', 'is'], "it's": ['it', 'is'], "we're": ['we', 'are'], "they're": ['they', 'are'], "you're": ['you', 'are'] };

for (const month of curriculum.months) {
  if (!month.availableThroughDay) continue;
  const dir = join(ROOT, `month-${String(month.month).padStart(2, '0')}`);
  const words = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8'));
  const byId = new Map();
  for (const w of words) {
    for (const f of ['id', 'word', 'ipa', 'say', 'pos', 'meaning', 'core', 'example', 'exampleId', 'cefr', 'day']) {
      if (w[f] === undefined || w[f] === '') err(`kata ${w.id ?? '?'}: field '${f}' kosong`);
    }
    if (byId.has(w.id)) err(`kata ganda: ${w.id}`);
    byId.set(w.id, w);
    if (!/^\/.+\/$/.test(w.ipa ?? '')) err(`kata ${w.id}: IPA harus diapit /.../`);
    if (!w.example?.toLowerCase().includes(w.word.toLowerCase().replace(/y$/, ''))) warn(`kata ${w.id}: contoh kalimat tidak memuat kata '${w.word}'`);
    needAudio(w.word, `kata ${w.id}`);
    needAudio(w.example, `contoh kata ${w.id}`);
  }

  for (let d = month.days[0]; d <= month.availableThroughDay; d++) {
    const file = join(dir, `day-${String(d).padStart(2, '0')}.json`);
    if (!existsSync(file)) {
      err(`Hari ${d}: file ${file} tidak ada, padahal kurikulum menandainya tersedia`);
      continue;
    }
    const day = JSON.parse(readFileSync(file, 'utf8'));
    const where = `Hari ${d}`;
    if (day.day !== d) err(`${where}: field day = ${day.day}`);
    for (const id of day.newWords) {
      const w = byId.get(id);
      if (!w) err(`${where}: kata baru '${id}' tidak ada di words.json`);
      else if (w.day !== d) err(`${where}: kata '${id}' tercatat di hari ${w.day}`);
    }
    if (day.newWords.length > 0 && day.newWords.length !== 10) warn(`${where}: ${day.newWords.length} kata baru (target 10)`);
    const layers = day.lesson?.layers ?? [];
    if (layers.length < 4) err(`${where}: pelajaran hanya ${layers.length} lapis (minimal 4)`);
    for (const ex of day.lesson.exercises) checkExercise(ex, where);
    for (const ex of day.reading.questions) checkExercise(ex, `${where} bacaan`, true);
    for (const ex of day.writing.exercises) checkExercise(ex, `${where} writing`);
    if (!day.lesson.exercises.some((e) => e.type === 'explain')) warn(`${where}: tidak ada soal 'jelaskan dengan kata-kata sendiri'`);
    if (!day.listening.items.length) err(`${where}: listening kosong`);
    for (const it of day.listening.items) needAudio(it.en, `${where} listening`);
    for (const p of day.reading.paragraphs) needAudio(p.en, `${where} bacaan`);

    // Kosakata bacaan: semua kata harus sudah dikenal
    const known = new Set();
    for (const w of words) if (w.day <= d) for (const part of w.word.toLowerCase().split(/\s+/)) for (const v of variants(part)) known.add(v);
    for (const k of Object.keys(day.reading.glossary)) for (const part of k.toLowerCase().split(/\s+/)) for (const v of variants(part)) known.add(v);
    const unknown = new Set();
    for (const p of day.reading.paragraphs) {
      const text = p.en.replace(/^[A-Z][a-z]+:\s/, ''); // label pembicara "Sara: "
      for (const raw of text.toLowerCase().match(/[a-z0-9']+/g) ?? []) {
        const tok = raw.replace(/^'+|'+$/g, '');
        if (!tok || /\d/.test(tok)) continue;
        if (IRREGULAR[tok] && known.has(IRREGULAR[tok])) continue;
        if (PROPER_NOUNS.has(tok) || known.has(tok)) continue;
        const parts = CONTRACTION_PARTS[tok];
        if (parts && parts.every((x) => known.has(x))) continue;
        unknown.add(tok);
      }
    }
    if (unknown.size) err(`${where} bacaan: kata belum diajarkan & tidak ada di glosarium: ${[...unknown].join(', ')}`);
  }
}

for (const w of warnings) console.log('PERINGATAN ' + w);
for (const e of errors) console.log('ERROR ' + e);
console.log(`\n${errors.length} error, ${warnings.length} peringatan, ${exerciseIds.size} soal diperiksa, ${audioChecked} audio diperiksa`);
process.exit(errors.length ? 1 : 0);
