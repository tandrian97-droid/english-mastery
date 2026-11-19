import { useState } from 'react';
import { loadAllWords, loadErrorTagIndex } from '../../content/load';
import { deriveErrorStats } from '../../db/learning';
import { db } from '../../db/db';
import { buildReport } from '../../engine/report';
import { useFeedback } from '../../ui/feedback';
import { APP_VERSION } from '../settings/SettingsPage';

async function makeReport(): Promise<string> {
  const [profile, logs, progress, attempts, tagIndex, cards, reviews, writings, words] = await Promise.all([
    db.profile.get(1),
    db.daily_log.toArray(),
    db.lesson_progress.toArray(),
    db.exercise_attempts.toArray(),
    loadErrorTagIndex(),
    db.vocab_cards.toArray(),
    db.vocab_reviews.toArray(),
    db.writings.toArray(),
    loadAllWords(),
  ]);
  if (!profile) throw new Error('Profil belum ada.');
  const errorStats = deriveErrorStats(attempts, tagIndex);
  return buildReport({ profile, logs, progress, attempts, errorStats, cards, reviews, writings, words, appVersion: APP_VERSION });
}

/** Laporan untuk dianalisis Claude: salin, atau bagikan langsung ke aplikasi Claude. */
export function ReportCard() {
  const { notify, reportError } = useFeedback();
  const [text, setText] = useState<string | null>(null);

  async function get(): Promise<string | null> {
    try {
      const t = await makeReport();
      setText(t);
      return t;
    } catch (e) {
      reportError(e);
      return null;
    }
  }

  async function copy() {
    const t = text ?? (await get());
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      notify('info', 'Laporan disalin. Tempel (paste) ke chat Claude.');
    } catch {
      notify('warn', 'Tidak bisa menyalin otomatis. Buka "Lihat isi laporan", tekan lama, lalu salin.');
    }
  }

  async function share() {
    const t = text ?? (await get());
    if (!t) return;
    try {
      await navigator.share({ title: 'Laporan English Mastery', text: t });
    } catch (e) {
      if ((e as { name?: string }).name !== 'AbortError') void copy();
    }
  }

  return (
    <section className="card span-2">
      <h2>Laporan untuk Claude</h2>
      <p className="muted small">
        Data latihan Anda hanya ada di HP ini. Kirim laporan ini ke chat Claude agar Claude bisa menganalisis hasil Anda dan menyesuaikan materi berikutnya.
        Disarankan setiap akhir minggu (Hari 7, 14, 21, …).
      </p>
      <div className="row">
        {'share' in navigator && (
          <button className="btn" onClick={() => void share()}>
            Bagikan ke Claude
          </button>
        )}
        <button className={`btn ${'share' in navigator ? 'secondary' : ''}`} onClick={() => void copy()}>
          Salin laporan
        </button>
      </div>
      <details onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && !text && void get()}>
        <summary className="link-btn">Lihat isi laporan</summary>
        <pre className="report">{text ?? 'Menyusun…'}</pre>
      </details>
    </section>
  );
}
