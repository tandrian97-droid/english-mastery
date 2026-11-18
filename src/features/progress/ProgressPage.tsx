import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { TOTAL_CURRICULUM_DAYS } from '../../db/repo';
import { SKILL_LABELS } from '../../db/schema';
import { formatMinutes } from '../../engine/dates';

export function ProgressPage() {
  const data = useLiveQuery(async () => {
    const [profile, logs, lessonsDone, writings, attempts, correct, assessments] = await Promise.all([
      db.profile.get(1),
      db.daily_log.toArray(),
      db.lesson_progress.where('status').equals('completed').count(),
      db.writings.count(),
      db.exercise_attempts.count(),
      db.exercise_attempts.filter((a) => a.isCorrect).count(),
      db.assessments.orderBy('date').reverse().toArray(),
    ]);
    return { profile, logs, lessonsDone, writings, attempts, correct, assessments };
  });
  if (!data?.profile) return <div className="page" aria-busy="true" />;

  const total = data.logs.reduce((s, l) => s + l.activeSeconds, 0);
  const accuracy = data.attempts ? Math.round((data.correct / data.attempts) * 100) : null;
  const programPct = Math.round(((data.profile.curriculumDay - 1) / TOTAL_CURRICULUM_DAYS) * 100);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Progres</h1>
          <p className="sub">Mulai {data.profile.startDate}</p>
        </div>
      </header>

      <div className="grid two">
        <section className="card span-2">
          <div className="row between">
            <h2>Program 300 hari</h2>
            <span className="muted small">
              Hari {data.profile.curriculumDay} · {programPct}%
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${programPct}%` }} />
          </div>
        </section>

        <section className="card span-2">
          <div className="stats">
            <div className="stat">
              <div className="label">Total jam</div>
              <div className="value">{formatMinutes(total)}</div>
              <div className="hint">target ±600 jam</div>
            </div>
            <div className="stat">
              <div className="label">Pelajaran selesai</div>
              <div className="value">{data.lessonsDone}</div>
            </div>
            <div className="stat">
              <div className="label">Akurasi latihan</div>
              <div className="value">{accuracy === null ? '—' : `${accuracy}%`}</div>
              <div className="hint">{data.attempts} jawaban</div>
            </div>
            <div className="stat">
              <div className="label">Tulisan</div>
              <div className="value">{data.writings}</div>
            </div>
          </div>
        </section>

        <section className="card span-2">
          <h2>Riwayat asesmen</h2>
          {data.assessments.length === 0 ? (
            <p className="muted">
              Belum ada. Asesmen pertama di bulan 3. Hasil tes online gratis (misalnya EF SET) juga dicatat di sini sebagai pembanding.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Tes</th>
                  <th>Skill</th>
                  <th>Hasil</th>
                </tr>
              </thead>
              <tbody>
                {data.assessments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.date}</td>
                    <td>{a.name}</td>
                    <td>{SKILL_LABELS[a.skill]}</td>
                    <td>{a.cefrEstimate ?? a.score ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted small">Skor otomatis aplikasi bukan sertifikasi CEFR resmi.</p>
        </section>
      </div>
    </div>
  );
}
