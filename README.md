# English Mastery

*Your Personal English Learning System.* Aplikasi belajar bahasa Inggris pribadi untuk Android, berbentuk PWA (Progressive Web App) yang bisa dipasang dari Chrome dan bekerja offline.

Brief proyek lengkap: dokumen **English Mastery — Brief v2 (Revisi)** di Claude.

## Status (versi 1.0.0)

| Bagian | Status |
| --- | --- |
| Aplikasi: PWA offline, database, backup/restore, update otomatis tanpa tombol | Selesai |
| Belajar harian: 5 blok, pelajaran 7 lapis, latihan 7 tipe, flashcard FSRS 3 arah, bacaan ketuk-kata, audio terpasang, rekam suara, cek ucapan, dikte | Selesai |
| Latihan Pintar adaptif, Peta kelemahan, Laporan untuk Claude | Selesai |
| Writing Studio (5 level, pemeriksa offline, riwayat, salin ke Claude) | Selesai |
| Grafik progres & catatan asesmen | Selesai |
| Materi | Hari 1–14 (120 kata, 268 soal, 589 audio). Materi berikutnya ditambahkan per minggu, menyesuaikan laporan |
| AI Tutor di dalam aplikasi, AI lokal, pembaca impor buku | Setelah laporan 7 hari pertama |

Uji: 80 unit test + validator materi + 56 uji end-to-end di Chrome (offline, restart, backup/restore, Hari 1 penuh, Writing Studio, update otomatis).

## Menjalankan di komputer

Butuh Node.js 22+.

```bash
npm install
npm run dev        # server pengembangan di http://localhost:5173
npm test           # validasi materi + unit test (database, backup, FSRS, penilai jawaban)
npm run validate:content  # cek materi: kunci jawaban, kata di bacaan sudah diajarkan, dll.
npm run build      # build produksi ke folder dist/
npm run preview    # menjalankan hasil build di http://localhost:4173
npm run test:e2e   # uji end-to-end di Chrome: offline, restart, backup/restore (butuh Python + Playwright)
python3 tests/e2e/day1_test.py . tests/e2e/out   # menyelesaikan Hari 1 penuh secara offline
python3 tests/e2e/features_test.py . tests/e2e/out   # Writing Studio, grafik, asesmen, update otomatis
```

## Memasang di HP Android

1. Buka alamat aplikasi (`https://<username>.github.io/english-mastery/`) di **Chrome**.
2. Menu ⋮ → **Tambahkan ke layar utama / Instal aplikasi**.
3. Buka sekali saat online. Setelah muncul "Aplikasi siap dipakai offline", aplikasi bisa dipakai dalam mode pesawat.

## Deploy

Setiap push ke branch `main` otomatis menjalankan tes, build, lalu deploy ke GitHub Pages (`.github/workflows/deploy.yml`). Aplikasi di HP memeriksa versi baru saat dibuka dan setiap jam, lalu memasangnya sendiri saat pengguna berada di halaman aman (tidak di tengah pelajaran).

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

## Audio

Audio pengucapan dibuat sekali di komputer pembuat materi dengan [Piper TTS](https://github.com/rhasspy/piper) (suara `en-us-lessac-medium`), lalu disimpan sebagai Ogg Opus 24 kbps di `public/audio/` dan ikut ter-cache untuk offline:

```bash
pip install piper-tts   # + ffmpeg
python3 scripts/generate-audio.py --model /path/en-us-lessac-medium.onnx
```

Nama file = hash FNV-1a dari teks (sama di Python, TypeScript, dan validator). `npm run validate:content` gagal jika ada teks tanpa audio. Suara bawaan perangkat hanya dipakai sebagai cadangan.

Speaking: **Rekam** (MediaRecorder, offline) dan **Cek ucapan** (Web Speech API, butuh internet di sebagian besar perangkat).

## Lisensi materi

Daftar kata NGSL/BSL © Browne, Culligan & Phillips, CC BY-SA 4.0. Harper © Automattic, Apache-2.0. Suara Lessac (Piper) dilatih dari dataset Blizzard 2013 Lessac; lisensi dataset membatasi pemakaian komersial, jadi audio ini untuk pemakaian pribadi.
