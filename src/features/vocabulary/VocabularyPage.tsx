import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

const LEVELS = [
  { level: 0, name: 'Dilihat', desc: 'Pernah muncul di pelajaran' },
  { level: 1, name: 'Dikenali', desc: 'Benar di flashcard' },
  { level: 2, name: 'Dipahami', desc: 'Benar saat muncul di bacaan' },
  { level: 3, name: 'Dipakai', desc: 'Dipakai benar di tulisan Anda' },
  { level: 4, name: 'Aktif stabil', desc: 'Dipakai benar berulang kali' },
] as const;

export function VocabularyPage() {
  const counts = useLiveQuery(async () => Promise.all(LEVELS.map((l) => db.vocab_cards.where('mastery').equals(l.level).count())));
  const due = useLiveQuery(() => db.vocab_cards.where('due').belowOrEqual(Date.now()).count());

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Kosakata</h1>
          <p className="sub">Target: 10 kata baru per hari belajar · NGSL + kosakata bidang Anda</p>
        </div>
      </header>

      <div className="grid two">
        <section className="card hero">
          <h2>Review hari ini</h2>
          <div className="timer">{due ?? 0} kartu</div>
          <p className="muted small">Flashcard dengan jadwal FSRS (Again / Hard / Good / Easy) aktif di Tahap 2.</p>
        </section>

        <section className="card">
          <h2>Tingkat penguasaan</h2>
          <div className="list">
            {LEVELS.map((l, i) => (
              <div className="list-item" key={l.level}>
                <div>
                  <strong>{l.name}</strong>
                  <div className="muted small">{l.desc}</div>
                </div>
                <span className="badge">{counts?.[i] ?? 0}</span>
              </div>
            ))}
          </div>
          <p className="muted small">Hanya tingkat "Dipakai" ke atas yang dihitung sebagai kosakata dikuasai.</p>
        </section>
      </div>
    </div>
  );
}
