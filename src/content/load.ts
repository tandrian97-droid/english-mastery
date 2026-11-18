import type { ContentDay, Curriculum, Word } from './types';

const base = () => `${import.meta.env.BASE_URL}content/`;
const pad = (n: number) => String(n).padStart(2, '0');

/** Cache di memori agar materi tidak dimuat ulang saat berpindah halaman. */
const cache = new Map<string, Promise<unknown>>();

function getJson<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(base() + path).then((r) => {
      if (!r.ok) throw new Error(`Materi tidak ditemukan (${path}, HTTP ${r.status})`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export function monthOfDay(day: number): number {
  return Math.ceil(day / 30);
}

export const loadCurriculum = () => getJson<Curriculum>('curriculum.json');

export const loadDay = (day: number) => getJson<ContentDay>(`month-${pad(monthOfDay(day))}/day-${pad(day)}.json`);

export const loadMonthWords = (month: number) => getJson<Word[]>(`month-${pad(month)}/words.json`);

/** Semua kata dari bulan-bulan yang sudah tersedia, diindeks berdasarkan id. */
export async function loadAllWords(): Promise<Map<string, Word>> {
  const curriculum = await loadCurriculum();
  const months = curriculum.months.filter((m) => m.availableThroughDay > 0).map((m) => m.month);
  const lists = await Promise.all(months.map(loadMonthWords));
  const map = new Map<string, Word>();
  for (const list of lists) for (const w of list) map.set(w.id, w);
  return map;
}

/** Hari terakhir yang materinya sudah tersedia di aplikasi. */
export async function lastAvailableDay(): Promise<number> {
  const c = await loadCurriculum();
  return c.months.reduce((max, m) => Math.max(max, m.availableThroughDay), 0);
}
