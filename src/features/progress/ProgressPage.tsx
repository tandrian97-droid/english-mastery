import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { TOTAL_CURRICULUM_DAYS } from '../../db/repo';
import { SKILL_LABELS } from '../../db/schema';
import { formatMinutes } from '../../engine/dates';
import { tagInfo } from '../../engine/errorTags';
import { Link } from 'react-router-dom';
import { ReportCard } from './ReportCard';
import { deriveErrorStats } from '../../db/learning';
import { loadErrorTagIndex } from '../../content/load';
import { AccuracyBars, MinutesChart, VocabGrowth } from './Charts';
import { AssessmentForm } from './AssessmentCard';
import { lastNDays, toLocalDate } from '../../engine/dates';
import type { ExerciseAttempt, VocabCard } from '../../db/schema';

/** Mengelompokkan jawaban per bagian untuk grafik akurasi. */
function skillOf(a: ExerciseAttempt): string {
  if (a.exerciseId.includes(':speak-')) return 'Speaking';
  if (a.exerciseId.includes(':dictation-')) return 'Listening (dikte)';
  if (a.lessonId === 'practice') return 'Latihan Pintar';
  if (a.lessonId === 'writing-studio') return '';
  const part = a.lessonId.split(':')[1];
  return ({ grammar: 'Grammar', reading: 'Reading', writing: 'Writing' } as Record<string, string>)[part] ?? '';
}

function vocabSeries(cards: VocabCard[]): { date: string; known: number; mastered: number }[] {
  if (!cards.length) return [];
  const first = Math.min(...cards.map((c) => c.firstSeenAt));
  const days = Math.min(120, Math.ceil((Date.now() - first) / 86_400_000) + 1);
  const dates = lastNDays(days);
  return dates.map((d) => {
    const endOfDay = new Date(`${d}T23:59:59`).getTime();
    return {
      date: d,
      known: cards.filter((c) => c.firstSeenAt <= endOfDay).length,
      // tanggal penguasaan diperkirakan dari pembaruan terakhir kartu
      mastered: cards.filter((c) => c.mastery >= 3 && c.updatedAt <= endOfDay).length,
    };
  });
}

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
    const wrongAttempts = await db.exercise_attempts.filter((a) => !a.isCorrect).toArray();
    const weak = deriveErrorStats(wrongAttempts, await loadErrorTagIndex()).slice(0, 5);
    const allAttempts = await db.exercise_attempts.toArray();
    const cards = await db.vocab_cards.toArray();
    return { profile, logs, lessonsDone, writings, attempts, correct, assessments, weak, allAttempts, cards };
  });
  if (!data?.profile) return <div className="page" aria-busy="true" />;

  const total = data.logs.reduce((s, l) => s + l.activeSeconds, 0);
  const accuracy = data.attempts ? Math.round((data.correct / data.attempts) * 100) : null;
  const programPct = Math.round(((data.profile.curriculumDay - 1) / TOTAL_CURRICULUM_DAYS) * 100);
  const byDate = new Map(data.logs.map((l) => [l.date, l.activeSeconds]));
  const minutes30 = lastNDays(30, toLocalDate()).map((date) => ({ date, minutes: Math.round((byDate.get(date) ?? 0) / 60) }));
  const groups = new Map<string, { ok: number; n: number }>();
  for (const a of data.allAttempts) {
    const k = skillOf(a);
    if (!k) continue;
    const g = groups.get(k) ?? { ok: 0, n: 0 };
    g.n++;
    if (a.isCorrect) g.ok++;
    groups.set(k, g);
  }
  const accItems = ['Grammar', 'Reading', 'Writing', 'Listening (dikte)', 'Speaking', 'Latihan Pintar'].map((label) => {
    const g = groups.get(label);
    return { label, pct: g ? Math.round((g.ok / g.n) * 100) : null, n: g?.n ?? 0 };
  });

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
          <h2>Menit belajar · 30 hari terakhir</h2>
          <MinutesChart days={minutes30} target={data.profile.dailyTargetMinutes} />
        </section>

        <section className="card">
          <h2>Akurasi per bagian</h2>
          <AccuracyBars items={accItems} />
        </section>

        <section className="card">
          <h2>Pertumbuhan kosakata</h2>
          <VocabGrowth points={vocabSeries(data.cards)} />
        </section>

        <section className="card span-2">
          <h2>Peta kelemahan</h2>
          {data.weak.length === 0 ? (
            <p className="muted">Belum ada pola kesalahan. Kesalahan dari latihan akan dikumpulkan di sini, dan Latihan Pintar akan fokus ke sana.</p>
          ) : (
            <div className="list">
              {data.weak.map((w) => {
                const info = tagInfo(w.errorTag);
                return (
                  <div className="list-item" key={w.errorTag}>
                    <div>
                      <strong>{info.label}</strong>
                      <div className="muted small">{info.tip}</div>
                      {info.day > 0 && (
                        <Link className="small" to={`/day/${info.day}/grammar`}>
                          Baca ulang pelajaran Hari {info.day}
                        </Link>
                      )}
                    </div>
                    <span className="badge warn">{w.count}×</span>
                  </div>
                );
              })}
            </div>
          )}
          <Link to="/practice" className="btn secondary">
            Latihan Pintar
          </Link>
        </section>

        <ReportCard />

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
          <p className="muted small">Skor otomatis aplikasi bukan sertifikasi CEFR resmi. Disarankan tes gratis EF SET di bulan 3, 6, dan 10, lalu catat hasilnya di sini. Level di Beranda hanya berubah dari catatan ini.</p>
          <AssessmentForm />
        </section>
      </div>
    </div>
  );
}
