import { useEffect, useState } from 'react';

/** Status koneksi internet, diperbarui otomatis. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Memuat file JSON statis (materi). Service worker menyajikannya dari cache saat offline. */
export function useJson<T>(url: string): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then((data) => alive && setState({ data, error: null }))
      .catch((e: unknown) => alive && setState({ data: null, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [url]);
  return state;
}

/** URL materi relatif terhadap base path aplikasi (berbeda di lokal dan GitHub Pages). */
export function contentUrl(path: string): string {
  return `${import.meta.env.BASE_URL}content/${path}`;
}
