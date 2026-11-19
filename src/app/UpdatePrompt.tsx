import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useFeedback } from '../ui/feedback';

/** Halaman "aman": tidak ada pelajaran/latihan yang sedang dikerjakan, jadi boleh dimuat ulang. */
export function isSafeRoute(path: string): boolean {
  return path === '/' || path === '/learn' || path === '/progress' || path === '/vocabulary' || path === '/settings' || path === '/writing' || /^\/day\/\d+$/.test(path);
}

const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Update otomatis tanpa tombol:
 *  - Aplikasi memeriksa versi baru saat dibuka, saat kembali ke layar, dan setiap jam (jika online).
 *  - Versi baru diunduh di latar belakang (aplikasi + materi + audio).
 *  - Versi baru DIPASANG hanya saat Anda berada di halaman aman (bukan di tengah pelajaran),
 *    supaya jawaban yang sedang dikerjakan tidak hilang. Semua progres sudah tersimpan di database.
 */
export function AutoUpdater() {
  const { pathname } = useLocation();
  const { notify } = useFeedback();
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      registration.current = reg ?? null;
    },
    onRegisterError(error) {
      console.error('Service worker gagal didaftarkan', error);
    },
  });

  // Periksa versi baru secara berkala dan saat aplikasi kembali dibuka.
  useEffect(() => {
    const check = () => {
      if (navigator.onLine) void registration.current?.update().catch(() => {});
    };
    const id = window.setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Pasang versi baru begitu berada di halaman aman.
  useEffect(() => {
    if (needRefresh && isSafeRoute(pathname)) {
      try {
        sessionStorage.setItem('em-just-updated', '1');
      } catch {
        /* abaikan */
      }
      void updateServiceWorker(true);
    }
  }, [needRefresh, pathname, updateServiceWorker]);

  // Beri tahu sekali setelah update terpasang / saat siap offline pertama kali.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('em-just-updated') === '1') {
        sessionStorage.removeItem('em-just-updated');
        notify('info', 'Aplikasi sudah diperbarui otomatis. Materi dan fitur terbaru sudah tersedia.');
      } else if (offlineReady && localStorage.getItem('em-offline-ready-shown') !== '1') {
        localStorage.setItem('em-offline-ready-shown', '1');
        notify('info', 'Aplikasi siap dipakai offline.');
      }
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }, [offlineReady, notify]);

  return null;
}
