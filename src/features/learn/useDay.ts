import { useEffect, useState } from 'react';
import { lastAvailableDay, loadAllWords, loadDay } from '../../content/load';
import type { ContentDay, Word } from '../../content/types';

export interface DayData {
  day: ContentDay;
  words: Map<string, Word>;
  lastDay: number;
}

/** Memuat materi satu hari + seluruh daftar kata. Bekerja offline karena file sudah di-cache. */
export function useDayData(dayNumber: number): { data: DayData | null; error: string | null } {
  const [state, setState] = useState<{ data: DayData | null; error: string | null; key: number }>({ data: null, error: null, key: dayNumber });

  useEffect(() => {
    let alive = true;
    Promise.all([loadDay(dayNumber), loadAllWords(), lastAvailableDay()])
      .then(([day, words, lastDay]) => alive && setState({ data: { day, words, lastDay }, error: null, key: dayNumber }))
      .catch((e: unknown) => alive && setState({ data: null, error: e instanceof Error ? e.message : String(e), key: dayNumber }));
    return () => {
      alive = false;
    };
  }, [dayNumber]);

  return state.key === dayNumber ? { data: state.data, error: state.error } : { data: null, error: null };
}
