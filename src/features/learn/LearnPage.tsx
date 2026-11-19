import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import type { Curriculum } from '../../content/types';
import { db } from '../../db/db';
import { BLOCK_ORDER } from '../../db/learning';
import { contentUrl, useJson } from '../../ui/hooks';

export function LearnPage() {
  const { data, error } = useJson<Curriculum>(contentUrl('curriculum.json'));
  const profile = useLiveQuery(() => db.profile.get(1));
  const doneByDay = useLiveQuery(async () => {
    const rows = await db.lesson_progress.where('status').equals('completed').toArray();
    const m = new Map<number, number>();
    for (const r of rows) {
      const d = Number(r.lessonId.slice(4, 7));
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  });
  const day = profile?.curriculumDay ?? 1;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Belajar</h1>
          <p className="sub">Kurikulum 300 hari belajar · 10 bulan</p>
        </div>
      </header>

      <div className="grid two">
        <Link to="/writing" className="card block-link">
          <h2>Writing Studio</h2>
          <p className="muted small">Menulis bebas: perkenalan, proyek, email klien, laporan. Diperiksa offline, bisa disalin ke Claude.</p>
        </Link>
        <Link to="/practice" className="card block-link">
          <h2>Latihan Pintar</h2>
          <p className="muted small">±10 soal dari kelemahan dan kata tersulit Anda. Setiap sesi berbeda.</p>
        </Link>
      </div>

      {error && <div className="banner bad">Kurikulum gagal dimuat ({error}). Buka aplikasi sekali saat online agar materi tersimpan.</div>}

      {data?.months
        .filter((m) => m.availableThroughDay > 0)
        .map((m) => (
          <section className="card" key={`days-${m.month}`}>
            <div className="row between">
              <h2>
                Bulan {m.month} · {m.title}
              </h2>
              <span className="muted small">
                Tersedia s.d. Hari {m.availableThroughDay} dari {m.days[1]}
              </span>
            </div>
            <div className="day-grid">
              {Array.from({ length: m.days[1] - m.days[0] + 1 }, (_, i) => m.days[0] + i).map((d) => {
                const available = d <= m.availableThroughDay;
                const done = (doneByDay?.get(d) ?? 0) >= BLOCK_ORDER.length;
                const current = d === day;
                const locked = d > day;
                const cls = `day-cell${done ? ' done' : ''}${current ? ' current' : ''}${!available || locked ? ' locked' : ''}`;
                return available && !locked ? (
                  <Link key={d} to={`/day/${d}`} className={cls} aria-label={`Hari ${d}${done ? ', selesai' : ''}`}>
                    {d}
                  </Link>
                ) : (
                  <span key={d} className={cls} aria-label={`Hari ${d}, ${available ? 'terkunci' : 'segera'}`}>
                    {d}
                  </span>
                );
              })}
            </div>
            <p className="muted small">Hari berikutnya terbuka setelah kelima blok hari ini selesai. Materi hari 8–30 sedang dibuat.</p>
          </section>
        ))}

      <div className="grid two">
        {data?.months.map((m) => {
          const current = day >= m.days[0] && day <= m.days[1];
          return (
            <section className="card" key={m.month}>
              <div className="row between">
                <h2>
                  Bulan {m.month} · {m.title}
                </h2>
                {current ? <span className="badge teal">Sekarang</span> : m.availableThroughDay > 0 ? <span className="badge ok">Tersedia</span> : <span className="badge">Segera</span>}
              </div>
              <p className="muted small">
                Hari {m.days[0]}–{m.days[1]}
              </p>
              <p>{m.focus}</p>
              <p className="muted small">Target: {m.target}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
