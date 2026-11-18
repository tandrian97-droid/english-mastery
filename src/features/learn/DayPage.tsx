import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import type { BlockKey } from '../../content/types';
import { db } from '../../db/db';
import { BLOCK_LABELS, BLOCK_ORDER, getDayProgress } from '../../db/learning';
import { RichText } from '../../ui/RichText';
import { useDayData } from './useDay';

export function DayPage() {
  const dayNumber = Number(useParams().day);
  const { data, error } = useDayData(dayNumber);
  const profile = useLiveQuery(() => db.profile.get(1));
  const progress = useLiveQuery(() => getDayProgress(dayNumber), [dayNumber]);

  if (error) return <div className="banner bad">Materi Hari {dayNumber} belum tersedia. ({error})</div>;
  if (!data || !progress || !profile) return <div className="page" aria-busy="true" />;

  const { day } = data;
  const doneCount = BLOCK_ORDER.filter((b) => progress[b]?.status === 'completed').length;
  const allDone = doneCount === BLOCK_ORDER.length;
  const nextBlock = BLOCK_ORDER.find((b) => progress[b]?.status !== 'completed');
  const locked = dayNumber > profile.curriculumDay;

  if (locked) {
    return (
      <div className="page">
        <div className="banner warn">Hari {dayNumber} terbuka setelah Hari {profile.curriculumDay} selesai.</div>
        <Link to={`/day/${profile.curriculumDay}`} className="btn">
          Ke Hari {profile.curriculumDay}
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted small">
            Bulan {day.month} · Hari {day.day}
          </p>
          <h1>{day.title}</h1>
        </div>
        <Link to="/learn" className="btn secondary">
          Kurikulum
        </Link>
      </header>

      {allDone && (
        <div className="banner info">
          <span>
            Hari {day.day} selesai. {data.lastDay > day.day ? 'Hari berikutnya sudah terbuka.' : 'Materi hari berikutnya sedang dibuat.'}
          </span>
          {data.lastDay > day.day && (
            <Link to={`/day/${day.day + 1}`} className="btn">
              Hari {day.day + 1}
            </Link>
          )}
        </div>
      )}

      <div className="grid two">
        <section className="card">
          <h2>Target hari ini</h2>
          <ul className="goals">
            {day.goals.map((g, i) => (
              <li key={i}>
                <RichText text={g} />
              </li>
            ))}
          </ul>
          <div className="row between">
            <span className="muted small">
              {doneCount} dari {BLOCK_ORDER.length} blok selesai
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${(doneCount / BLOCK_ORDER.length) * 100}%` }} />
          </div>
          {nextBlock && (
            <Link to={`/day/${day.day}/${nextBlock}`} className="btn block">
              {doneCount === 0 ? 'Mulai' : 'Lanjutkan'}: {BLOCK_LABELS[nextBlock].title}
            </Link>
          )}
        </section>

        <section className="card">
          <h2>Blok belajar</h2>
          <div className="list">
            {BLOCK_ORDER.map((b: BlockKey, i) => {
              const p = progress[b];
              const done = p?.status === 'completed';
              return (
                <Link key={b} to={`/day/${day.day}/${b}`} className="list-item block-link">
                  <div>
                    <strong>
                      {i + 1}. {BLOCK_LABELS[b].title}
                    </strong>
                    <div className="muted small">
                      {b === 'vocab' && day.newWords.length === 0 ? 'Review flashcard (tanpa kata baru)' : BLOCK_LABELS[b].desc} · ±{BLOCK_LABELS[b].minutes} mnt
                    </div>
                  </div>
                  {done ? <span className="badge ok">{p?.bestScore != null ? `${p.bestScore}%` : 'selesai'}</span> : <span className="badge">belum</span>}
                </Link>
              );
            })}
          </div>
          <p className="muted small">Boleh dikerjakan terpisah dan dijeda kapan saja. Urutan disarankan, tidak diwajibkan.</p>
        </section>
      </div>
    </div>
  );
}
