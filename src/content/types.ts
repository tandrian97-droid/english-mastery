/**
 * Tipe materi pelajaran. Materi disimpan sebagai file JSON statis di public/content/,
 * terpisah dari data pengguna, dan ikut di-cache oleh service worker untuk offline.
 *
 * Teks boleh memakai format ringan: **tebal**, *miring*.
 */
import type { CefrLevel } from '../db/schema';

export interface CurriculumMonth {
  month: number;
  title: string;
  focus: string;
  /** Target level di akhir bulan. */
  target: string;
  days: [number, number];
  /** Hari terakhir yang materinya sudah tersedia (0 = belum ada). */
  availableThroughDay: number;
}

export interface Curriculum {
  version: string;
  totalDays: number;
  months: CurriculumMonth[];
}

// ---------- Kosakata ----------

export interface Word {
  id: string;
  word: string;
  /** Ejaan fonetik (IPA), aksen Amerika. */
  ipa: string;
  /** Petunjuk bunyi dengan huruf Indonesia; suku kata bertekanan ditulis KAPITAL. */
  say: string;
  /** Kelas kata dalam Bahasa Indonesia. */
  pos: string;
  /** Arti singkat. */
  meaning: string;
  /** Arti inti: makna dasar yang menjelaskan semua pemakaian kata ini. */
  core: string;
  example: string;
  exampleId: string;
  cefr: CefrLevel;
  /** Hari kata ini diperkenalkan. */
  day: number;
  /** Jebakan khas penutur Bahasa Indonesia. */
  trap?: string;
  family?: string[];
  collocations?: string[];
}

// ---------- Blok penjelasan ----------

export type Block =
  | { type: 'p'; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'examples'; items: { en: string; id: string; note?: string }[] }
  | { type: 'mistakes'; items: { wrong: string; right: string; why: string }[] }
  | { type: 'tip'; text: string };

export type LayerKind = 'simple' | 'pattern' | 'why' | 'when' | 'nuance' | 'origin';

export interface Layer {
  kind: LayerKind;
  title: string;
  /** Lapis opsional disembunyikan di balik tombol "Pelajari lebih dalam". */
  optional?: boolean;
  blocks: Block[];
}

// ---------- Latihan ----------

interface ExerciseBase {
  id: string;
  prompt: string;
  /** Penjelasan kenapa jawabannya begitu. Selalu ditampilkan setelah menjawab. */
  explain: string;
  /** Tag kesalahan dari katalog, dicatat jika salah. */
  errorTag?: string;
}

export interface McExercise extends ExerciseBase {
  type: 'mc';
  options: { text: string; why?: string }[];
  answer: number;
}

export interface FillExercise extends ExerciseBase {
  type: 'fill';
  accept: string[];
  hint?: string;
}

export interface TranslateExercise extends ExerciseBase {
  type: 'translate';
  accept: string[];
  hint?: string;
}

export interface OrderExercise extends ExerciseBase {
  type: 'order';
  /** Potongan dalam urutan BENAR; aplikasi mengacaknya saat ditampilkan. */
  tokens: string[];
  /** Urutan lain yang juga benar (opsional). */
  alsoAccept?: string[][];
}

/** Teknik Feynman: jelaskan dengan kata-kata sendiri. Tidak dinilai offline; ada contoh jawaban. */
export interface ExplainExercise extends ExerciseBase {
  type: 'explain';
  model: string;
}

/** Dengar audio (tanpa melihat tulisan), lalu pilih jawaban. */
export interface ListenExercise extends ExerciseBase {
  type: 'listen';
  /** Teks yang diputar sebagai audio. */
  audio: string;
  options: { text: string; why?: string }[];
  answer: number;
}

/** Cocokkan pasangan: kiri (bahasa Inggris) dengan kanan (arti). */
export interface MatchExercise extends ExerciseBase {
  type: 'match';
  pairs: [string, string][];
}

export type Exercise = McExercise | FillExercise | TranslateExercise | OrderExercise | ExplainExercise | ListenExercise | MatchExercise;

// ---------- Pelajaran, bacaan, listening, writing ----------

export interface Lesson {
  id: string;
  title: string;
  cefr: CefrLevel;
  goal: string;
  layers: Layer[];
  exercises: Exercise[];
}

export interface Reading {
  id: string;
  title: string;
  cefr: CefrLevel;
  intro: string;
  paragraphs: { en: string; id: string }[];
  /** Arti kata yang belum dipelajari tapi muncul di teks (kata yang sudah dipelajari diambil dari daftar kata). */
  glossary: Record<string, string>;
  questions: Exercise[];
}

export interface ListeningItem {
  en: string;
  id: string;
  tip?: string;
}

export interface Listening {
  intro: string;
  items: ListeningItem[];
}

export interface WritingTask {
  intro: string;
  exercises: Exercise[];
}

export type BlockKey = 'vocab' | 'grammar' | 'reading' | 'listening' | 'writing';

export interface ContentDay {
  day: number;
  month: number;
  title: string;
  goals: string[];
  newWords: string[];
  lesson: Lesson;
  reading: Reading;
  listening: Listening;
  writing: WritingTask;
}

export type { CefrLevel };

// ---------- Writing Studio ----------

export interface WritingPrompt {
  id: string;
  title: string;
  task: string;
  minWords: number;
  hint: string;
}

export interface WritingLevelDef {
  level: 1 | 2 | 3 | 4 | 5;
  title: string;
  desc: string;
  /** Disarankan mulai hari kurikulum ini. */
  fromDay: number;
  prompts: WritingPrompt[];
}

export interface WritingPrompts {
  version: string;
  levels: WritingLevelDef[];
}
