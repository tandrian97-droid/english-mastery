/**
 * Tipe materi pelajaran. Materi disimpan sebagai file JSON statis di public/content/,
 * terpisah dari data pengguna, dan ikut di-cache oleh service worker untuk offline.
 */
import type { CefrLevel } from '../db/schema';

export interface CurriculumMonth {
  month: number;
  title: string;
  focus: string;
  /** Target level di akhir bulan. */
  target: string;
  days: [number, number];
  /** Apakah paket materi bulan ini sudah tersedia di aplikasi. */
  available: boolean;
}

export interface Curriculum {
  version: string;
  totalDays: number;
  months: CurriculumMonth[];
}

export type { CefrLevel };
