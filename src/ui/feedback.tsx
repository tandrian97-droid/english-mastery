import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { isQuotaError } from '../db/storage';

interface Notice {
  id: number;
  kind: 'info' | 'warn' | 'bad';
  text: string;
}

interface Ctx {
  notify: (kind: Notice['kind'], text: string) => void;
  reportError: (e: unknown) => void;
}

const FeedbackContext = createContext<Ctx>({ notify: () => {}, reportError: () => {} });

let nextId = 1;

/** Menampilkan pesan di atas layar. Error penyimpanan tidak pernah disembunyikan diam-diam. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const dismiss = (id: number) => setNotices((n) => n.filter((x) => x.id !== id));

  const notify = useCallback((kind: Notice['kind'], text: string) => {
    const id = nextId++;
    setNotices((n) => [...n.filter((x) => x.text !== text), { id, kind, text }]);
    if (kind === 'info') window.setTimeout(() => dismiss(id), 4000);
  }, []);

  const reportError = useCallback(
    (e: unknown) => {
      console.error(e);
      if (isQuotaError(e)) {
        notify('bad', 'Penyimpanan HP penuh. Data terbaru BELUM tersimpan. Kosongkan ruang penyimpanan, lalu buat backup di Pengaturan.');
      } else {
        notify('bad', `Gagal menyimpan data: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [notify],
  );

  return (
    <FeedbackContext.Provider value={{ notify, reportError }}>
      {notices.length > 0 && (
        <div style={{ position: 'fixed', top: 8, left: 8, right: 8, zIndex: 50, display: 'grid', gap: 8, maxWidth: 560, margin: '0 auto' }} role="status" aria-live="polite">
          {notices.map((n) => (
            <div key={n.id} className={`banner ${n.kind}`} style={{ boxShadow: '0 6px 20px rgba(10,16,30,.15)' }}>
              <span>{n.text}</span>
              <button className="btn secondary" style={{ minHeight: 34, padding: '6px 10px' }} onClick={() => dismiss(n.id)}>
                Tutup
              </button>
            </div>
          ))}
        </div>
      )}
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): Ctx {
  return useContext(FeedbackContext);
}
