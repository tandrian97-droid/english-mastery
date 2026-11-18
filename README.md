# English Mastery

*Your Personal English Learning System.* Aplikasi belajar bahasa Inggris pribadi untuk Android, berbentuk PWA (Progressive Web App) yang bisa dipasang dari Chrome dan bekerja offline.

Brief proyek lengkap: dokumen **English Mastery — Brief v2 (Revisi)** di Claude.

## Status

| Tahap | Isi | Status |
| --- | --- | --- |
| 1 · Fondasi | Proyek, PWA offline, database, backup/restore, navigasi, dashboard, timer belajar | **Selesai — 13 unit test + 17 uji end-to-end lulus** |
| 2 · Inti belajar | Sesi harian, flashcard FSRS + audio, pelajaran grammar & bacaan, konten bulan 1 | Berikutnya |
| 3 · Writing & data | Writing Studio, Harper, katalog kesalahan, AI Tutor di Claude | — |
| 4 · Melengkapi | Rekam-dan-bandingkan, grafik, AI lokal di Fold 7, pembaca impor buku | — |
| 5 · Lanjutan | Konten bulanan berlanjut, skenario percakapan, review mingguan | — |

## Menjalankan di komputer

Butuh Node.js 22+.

```bash
npm install
npm run dev        # server pengembangan di http://localhost:5173
npm test           # unit test (database, backup, streak)
npm run build      # build produksi ke folder dist/
npm run preview    # menjalankan hasil build di http://localhost:4173
npm run test:e2e   # uji end-to-end di Chrome: offline, restart, backup/restore (butuh Python + Playwright)
```

## Memasang di HP Android

1. Buka alamat aplikasi (`https://<username>.github.io/english-mastery/`) di **Chrome**.
2. Menu ⋮ → **Tambahkan ke layar utama / Instal aplikasi**.
3. Buka sekali saat online. Setelah muncul "Aplikasi siap dipakai offline", aplikasi bisa dipakai dalam mode pesawat.

## Deploy

Setiap push ke branch `main` otomatis menjalankan tes, build, lalu deploy ke GitHub Pages (`.github/workflows/deploy.yml`). Sekali saja di GitHub: **Settings → Pages → Source: GitHub Actions**.

## Arsitektur

- **React + TypeScript + Vite**, routing berbasis hash (aman di GitHub Pages dan offline).
- **PWA** via `vite-plugin-pwa` (Workbox): aplikasi + materi JSON di-cache saat instalasi; audio di-cache saat dipakai.
- **IndexedDB via Dexie** untuk data pengguna. Materi pelajaran **tidak** disimpan di database. Materi berupa file JSON di `public/content/` dan dirujuk lewat ID, sehingga memperbaiki materi tidak perlu migrasi data.
- **Keandalan data:** `navigator.storage.persist()`, timer menyimpan tiap 15 detik dan saat aplikasi disembunyikan, error penyimpanan penuh selalu ditampilkan, backup JSON dengan `schemaVersion` + validasi + rollback jika impor gagal, backup cadangan otomatis sebelum restore.
- **AI:** pemeriksa offline di aplikasi; AI Tutor = halaman Claude yang memakai langganan Claude Pro (online); AI lokal (WebLLM) di Tahap 4.

```
public/content/     materi (JSON) — dipisah dari kode
src/app/            shell, navigasi, onboarding, update service worker
src/db/             skema Dexie, repo, backup/restore, penyimpanan
src/engine/         logika belajar (tanggal, timer; nanti FSRS, penilai, katalog kesalahan)
src/features/       halaman: home, learn, vocabulary, tutor, progress, settings
src/ui/             komponen & hook bersama
tests/              unit test (Vitest) + tests/e2e (Playwright)
```

## Aturan migrasi database

Jangan mengubah blok `this.version(n)` yang sudah ada di `src/db/db.ts`. Untuk perubahan struktur: tambahkan `this.version(n+1)` baru (dengan `.upgrade()` bila perlu), naikkan `SCHEMA_VERSION`, dan uji impor backup dari versi lama sebelum rilis.

## Lisensi materi

Daftar kata NGSL/BSL © Browne, Culligan & Phillips, CC BY-SA 4.0. Harper © Automattic, Apache-2.0.
