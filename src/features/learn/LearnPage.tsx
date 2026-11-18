import { useLiveQuery } from 'dexie-react-hooks';
import type { Curriculum } from '../../content/types';
import { db } from '../../db/db';
import { contentUrl, useJson } from '../../ui/hooks';

export function LearnPage() {
  const { data, error } = useJson<Curriculum>(contentUrl('curriculum.json'));
  const profile = useLiveQuery(() => db.profile.get(1));
  const day = profile?.curriculumDay ?? 1;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Belajar</h1>
          <p className="sub">Kurikulum 300 hari belajar · 10 bulan</p>
        </div>
      </header>

      <div className="banner info">
        Materi dibuat per bulan, sekitar 2 minggu sebelum Anda sampai di bulan itu, dan disesuaikan dengan kesalahan Anda. Materi bulan 1
        masuk di Tahap 2.
      </div>

      {error && <div className="banner bad">Kurikulum gagal dimuat ({error}). Buka aplikasi sekali saat online agar materi tersimpan.</div>}

      <div className="grid two">
        {data?.months.map((m) => {
          const current = day >= m.days[0] && day <= m.days[1];
          return (
            <section className="card" key={m.month}>
              <div className="row between">
                <h2>
                  Bulan {m.month} · {m.title}
                </h2>
                {current ? <span className="badge teal">Sekarang</span> : m.available ? <span className="badge ok">Tersedia</span> : <span className="badge">Segera</span>}
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
