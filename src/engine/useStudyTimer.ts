import { useCallback, useEffect, useRef, useState } from 'react';
import { addActiveSeconds } from '../db/repo';

const FLUSH_EVERY_SECONDS = 5;
/** Tanpa sentuhan/ketikan selama ini, timer dijeda otomatis (agar yang dihitung waktu belajar nyata). */
export const IDLE_LIMIT_MS = 10 * 60 * 1000;

export type TimerStopReason = 'user' | 'hidden' | 'idle';

/**
 * Timer belajar yang menghitung waktu AKTIF saja:
 * - berhenti saat aplikasi ditutup/disembunyikan,
 * - berhenti otomatis jika tidak ada interaksi 10 menit,
 * - menyimpan ke database setiap 5 detik dan saat dijeda, jadi paling banyak 5 detik hilang jika HP mati mendadak.
 */
export function useStudyTimer(onError: (e: unknown) => void) {
  const [running, setRunning] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [lastStop, setLastStop] = useState<TimerStopReason | null>(null);
  /** Detik yang sudah dihitung tapi belum tersimpan ke database (untuk tampilan total hari ini yang akurat). */
  const [unsavedSeconds, setUnsavedSeconds] = useState(0);
  const pending = useRef(0);
  const lastInteraction = useRef(0);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const flush = useCallback(async () => {
    const s = pending.current;
    if (s <= 0) return;
    pending.current = 0;
    try {
      await addActiveSeconds(s);
      setUnsavedSeconds(pending.current);
    } catch (e) {
      pending.current += s; // coba lagi pada flush berikutnya, jangan buang waktunya
      setUnsavedSeconds(pending.current);
      onErrorRef.current(e);
    }
  }, []);

  const stop = useCallback(
    (reason: TimerStopReason = 'user') => {
      setRunning(false);
      setLastStop(reason);
      void flush();
    },
    [flush],
  );

  const start = useCallback(() => {
    lastInteraction.current = Date.now();
    setLastStop(null);
    setRunning(true);
  }, []);

  // detak 1 detik
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastInteraction.current > IDLE_LIMIT_MS) {
        stop('idle');
        return;
      }
      pending.current += 1;
      setUnsavedSeconds(pending.current);
      setSessionSeconds((s) => s + 1);
      if (pending.current >= FLUSH_EVERY_SECONDS) void flush();
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, flush, stop]);

  // interaksi = tanda masih belajar
  useEffect(() => {
    const mark = () => {
      lastInteraction.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, mark));
  }, []);

  // aplikasi disembunyikan / ditutup → simpan dan jeda
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && running) stop('hidden');
    };
    const onPageHide = () => void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [running, stop, flush]);

  // keluar dari halaman → simpan sisa detik
  useEffect(() => () => void flush(), [flush]);

  return { running, sessionSeconds, unsavedSeconds, lastStop, start, stop };
}

export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
