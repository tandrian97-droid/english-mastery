import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { lastAvailableDay, loadAllWords, loadDay, loadErrorTagIndex } from '../../content/load';
import { deriveErrorStats } from '../../db/learning';
import { db } from '../../db/db';
import { tagInfo } from '../../engine/errorTags';
import { freshSeed } from '../../engine/random';
import { buildWarmup, type WarmupPlan } from '../../engine/warmup';
import { toLocalDate } from '../../engine/dates';
import { useFeedback } from '../../ui/feedback';
import { TimerChip } from '../../ui/TimerChip';
import { ExerciseRunner } from '../learn/ExerciseRunner';

type State = { kind: 'loading' } | { kind: 'empty' } | { kind: 'ready'; plan: WarmupPlan; words: Map<string, { word: string }> } | { kind: 'error'; message: string };

/** Menyusun Latihan Pintar dari data belajar Anda sendiri. */
async function preparePlan(): Promise<State> {
  const profile = await db.profile.get(1);
  const last = await lastAvailableDay();
  const doneThrough = Math.min((profile?.curriculumDay ?? 1) - 1, last);
  const cards = await db.vocab_cards.toArray();
  if (doneThrough < 1 && cards.length < 4) return { kind: 'empty' };
  const [days, wordsMap, tagIndex, wrong] = await Promise.all([
    Promise.all(Array.from({ length: Math.max(doneThrough, 0) }, (_, i) => loadDay(i + 1))),
    loadAllWords(),
    loadErrorTagIndex(),
    db.exercise_attempts.filter((a) => !a.isCorrect).toArray(),
  ]);
  const errorStats = deriveErrorStats(wrong, tagIndex);
  const plan = buildWarmup({
    days,
    words: [...wordsMap.values()],
    cards,
    errorStats,
    wrongIds: new Set(wrong.map((a) => a.exerciseId)),
    seed: freshSeed(),
  });
  if (!plan.exercises.length) return { kind: 'empty' };
  return { kind: 'ready', plan, words: wordsMap };
}

export function PracticePage() {
  const { reportError, notify } = useFeedback();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    preparePlan()
      .then((s) => alive && setState(s))
      .catch((e: unknown) => alive && setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [round]);

  async function done(score: number | null) {
    try {
      const key = `practice:${toLocalDate()}`;
      const prev = await db.lesson_progress.get(key);
      await db.lesson_progress.put({
        lessonId: key,
        status: 'completed',
        bestScore: score === null ? (prev?.bestScore ?? null) : Math.max(score, prev?.bestScore ?? 0),
        attempts: (prev?.attempts ?? 0) + 1,
        completedAt: prev?.completedAt ?? Date.now(),
        updatedAt: Date.now(),
      });
      notify('info', 'Latihan Pintar selesai. Sesi berikutnya akan berbeda dan menyesuaikan hasil barusan.');
      setStarted(false);
      setState({ kind: 'loading' });
      setRound((r) => r + 1);
    } catch (e) {
      reportError(e);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Latihan Pintar</h1>
          <p className="sub">Disusun otomatis dari kesalahan dan kata tersulit Anda</p>
        </div>
        {started && <TimerChip />}
      </header>

      {state.kind === 'loading' && <section className="card" aria-busy="true">Menyusun latihan…</section>}
      {state.kind === 'error' && <div className="banner bad">Latihan tidak bisa disusun: {state.message}</div>}
      {state.kind === 'empty' && (
        <section className="card">
          <h2>Belum ada bahan latihan</h2>
          <p className="muted">Latihan Pintar terbuka setelah Hari 1 selesai. Bahannya diambil dari hari-hari yang sudah Anda pelajari.</p>
          <Link to="/" className="btn">
            Ke pelajaran hari ini
          </Link>
        </section>
      )}

      {state.kind === 'ready' && !started && (
        <section className="card">
          <h2>{state.plan.exercises.length} soal · ±5–8 menit</h2>
          {state.plan.weakTags.length > 0 ? (
            <div className="stack">
              <strong className="small">Fokus kelemahan Anda saat ini:</strong>
              {state.plan.weakTags.map((t) => (
                <div key={t} className="small">
                  • <b>{tagInfo(t).label}</b> — {tagInfo(t).tip}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">Belum ada pola kesalahan yang menonjol. Latihan ini mencampur materi semua hari sebelumnya.</p>
          )}
          {state.plan.focusWords.length > 0 && (
            <p className="small">
              <b>Kata yang dilatih ulang:</b> {state.plan.focusWords.slice(0, 4).map((id) => state.words.get(id)?.word ?? id).join(', ')}
            </p>
          )}
          <p className="muted small">Isinya: soal kelemahan, kosakata (arti, kebalikan, dengar, cocokkan), dan campuran dari semua hari. Setiap sesi berbeda.</p>
          <button className="btn block" onClick={() => setStarted(true)}>
            Mulai Latihan Pintar
          </button>
        </section>
      )}

      {state.kind === 'ready' && started && (
        <ExerciseRunner key={round} exercises={state.plan.exercises} lessonId="practice" shuffleOrder={false} doneLabel="Selesai" onDone={(r) => void done(r.score)} />
      )}
    </div>
  );
}
