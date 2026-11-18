import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { DEFAULT_AI_TUTOR_URL } from '../../db/repo';
import { useOnline } from '../../ui/hooks';

export function TutorPage() {
  const online = useOnline();
  const settings = useLiveQuery(() => db.settings.get(1));
  const url = settings?.aiTutorUrl || DEFAULT_AI_TUTOR_URL;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>AI Tutor</h1>
          <p className="sub">Guru pendamping Anda, memakai Claude Pro</p>
        </div>
      </header>

      {!online && (
        <div className="banner warn">
          Anda sedang offline. AI Tutor (Claude) butuh internet. Latihan, kosakata, dan pemeriksa tulisan dasar tetap bisa dipakai offline.
        </div>
      )}

      <div className="grid two">
        <section className="card hero">
          <h2>Buka AI Tutor</h2>
          <p className="muted">
            Koreksi tulisan lengkap, tanya "kenapa?", jelaskan foto halaman buku/manga/press release, dan latihan bicara dengan suara.
          </p>
          <a className="btn" href={url} target="_blank" rel="noopener noreferrer" aria-disabled={!online}>
            Buka di Claude
          </a>
          <p className="muted small">Saat ini tombol ini membuka halaman uji fitur AI. AI Tutor lengkap dibangun di Tahap 3.</p>
        </section>

        <section className="card">
          <h2>Tiga lapis bantuan</h2>
          <div className="list">
            <div className="list-item">
              <div>
                <strong>Pemeriksa dasar</strong>
                <div className="muted small">Kunci jawaban + kesalahan khas orang Indonesia</div>
              </div>
              <span className="badge ok">offline</span>
            </div>
            <div className="list-item">
              <div>
                <strong>AI lokal di Fold 7</strong>
                <div className="muted small">Penjelasan cepat saat tidak ada internet (Tahap 4)</div>
              </div>
              <span className="badge">offline</span>
            </div>
            <div className="list-item">
              <div>
                <strong>Claude</strong>
                <div className="muted small">Guru utama: koreksi lengkap, foto, suara</div>
              </div>
              <span className="badge teal">online</span>
            </div>
          </div>
          <p className="muted small">Setiap koreksi diberi label sumbernya, supaya Anda tahu seberapa bisa dipercaya.</p>
        </section>
      </div>
    </div>
  );
}
