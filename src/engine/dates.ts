import type { LocalDate } from '../db/schema';

/** Tanggal lokal perangkat dalam format YYYY-MM-DD (bukan UTC). */
export function toLocalDate(d: Date = new Date()): LocalDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Mengubah YYYY-MM-DD menjadi Date pada tengah hari lokal (aman dari pergeseran zona waktu). */
export function fromLocalDate(s: LocalDate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function addDays(s: LocalDate, n: number): LocalDate {
  const d = fromLocalDate(s);
  d.setDate(d.getDate() + n);
  return toLocalDate(d);
}

/** Tanggal 7 hari terakhir, dari yang paling lama sampai hari ini. */
export function lastNDays(n: number, today: LocalDate = toLocalDate()): LocalDate[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export function shortDayName(s: LocalDate): string {
  return DAY_NAMES[fromLocalDate(s).getDay()];
}

export function greeting(hour: number = new Date().getHours()): string {
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 19) return 'Selamat sore';
  return 'Selamat malam';
}

export function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} j ${rest} mnt` : `${h} jam`;
}
