import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Service worker: menyimpan aplikasi + materi untuk offline.
 * Saat versi baru tersedia, pengguna yang memilih kapan memuat ulang
 * (supaya sesi belajar yang sedang berjalan tidak terputus).
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service worker gagal didaftarkan', error);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  return (
    <div style={{ position: 'fixed', left: 8, right: 8, bottom: 'calc(var(--nav-h) + 12px)', zIndex: 40, maxWidth: 560, margin: '0 auto' }}>
      <div className="banner info" style={{ boxShadow: '0 6px 20px rgba(10,16,30,.15)' }}>
        <span>{needRefresh ? 'Versi baru aplikasi tersedia.' : 'Aplikasi siap dipakai offline.'}</span>
        <div className="row">
          {needRefresh && (
            <button className="btn" onClick={() => updateServiceWorker(true)}>
              Perbarui
            </button>
          )}
          <button
            className="btn secondary"
            onClick={() => {
              setOfflineReady(false);
              setNeedRefresh(false);
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
