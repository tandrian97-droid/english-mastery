import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { BlockKey } from '../../content/types';
import { BLOCK_LABELS, BLOCK_ORDER, blockKey, completeBlock, getDueCards, introduceWords, raiseMastery, wordsInText } from '../../db/learning';
import type { VocabCard } from '../../db/schema';
import { formatClock, useStudyTimer } from '../../engine/useStudyTimer';
import { useFeedback } from '../../ui/feedback';
import { Flashcards, WordIntro } from '../vocabulary/Flashcards';
import { ExerciseRunner, type RunnerResult } from './ExerciseRunner';
import { LessonView } from './LessonView';
import { ListeningView } from './ListeningView';
import { ReadingView } from './ReadingView';
import { useDayData, type DayData } from './useDay';

/** Timer berjalan otomatis selama blok terbuka, berhenti saat keluar/jeda/layar mati. */
function TimerChip() {
  const { reportError } = useFeedback();
  const timer = useStudyTimer(reportError);
  const { start, stop } = timer;
  useEffect(() => {
    start();
    return () => stop('user');
  }, [start, stop]);
  return (
    <button className={`timer-chip${timer.running ? ' on' : ''}`} onClick={() => (timer.running ? stop('user') : start())} aria-label={timer.running ? 'Jeda timer' : 'Lanjutkan timer'}>
      {timer.running ? '⏸' : '▶'} {formatClock(timer.sessionSeconds)}
    </button>
  );
}

export function BlockPage() {
  const params = useParams();
  const dayNumber = Number(params.day);
  const block = params.block as BlockKey;
  const { data, error } = useDayData(dayNumber);

  if (!BLOCK_ORDER.includes(block)) return <div className="banner bad">Blok tidak dikenal.</div>;
  if (error) return <div className="banner bad">Materi tidak bisa dimuat: {error}</div>;
  if (!data) return <div className="page" aria-busy="true" />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted small">
            <Link to={`/day/${dayNumber}`}>Hari {dayNumber}</Link> · Blok {BLOCK_ORDER.indexOf(block) + 1}/5
          </p>
          <h1>{BLOCK_LABELS[block].title}</h1>
        </div>
        <TimerChip />
      </header>
      <BlockBody key={`${dayNumber}-${block}`} data={data} dayNumber={dayNumber} block={block} />
    </div>
  );
}

function BlockBody({ data, dayNumber, block }: { data: DayData; dayNumber: number; block: BlockKey }) {
  const navigate = useNavigate();
  const { reportError, notify } = useFeedback();
  const { day, words, lastDay } = data;
  const [phase, setPhase] = useState<'learn' | 'practice'>('learn');
  const [dueCards, setDueCards] = useState<VocabCard[] | null>(null);

  async function finish(score: number | null) {
    try {
      const dayFinished = await completeBlock(dayNumber, block, score, lastDay);
      if (dayFinished) notify('info', `Hari ${dayNumber} selesai! ${lastDay > dayNumber ? `Hari ${dayNumber + 1} sudah terbuka.` : ''}`);
      const next = BLOCK_ORDER[BLOCK_ORDER.indexOf(block) + 1];
      navigate(next && !dayFinished ? `/day/${dayNumber}/${next}` : `/day/${dayNumber}`);
    } catch (e) {
      reportError(e);
    }
  }

  async function startReview() {
    try {
      if (day.newWords.length) await introduceWords(day.newWords);
      setDueCards(await getDueCards(Date.now() + 1000));
      setPhase('practice');
    } catch (e) {
      reportError(e);
    }
  }

  switch (block) {
    case 'vocab':
      if (phase === 'learn' && day.newWords.length > 0) return <WordIntro wordIds={day.newWords} words={words} onDone={startReview} />;
      if (!dueCards) {
        return (
          <section className="card">
            <h2>{day.newWords.length ? 'Kata baru' : 'Review kosakata'}</h2>
            <p className="muted">{day.newWords.length ? '' : 'Hari ini tanpa kata baru. Kita ulang kata-kata yang jadwal review-nya sudah tiba.'}</p>
            <button className="btn block" onClick={startReview}>
              Mulai review
            </button>
          </section>
        );
      }
      return <Flashcards cards={dueCards} words={words} onDone={() => void finish(null)} />;

    case 'grammar':
      return phase === 'learn' ? (
        <LessonView lesson={day.lesson} onStartExercises={() => setPhase('practice')} />
      ) : (
        <ExerciseRunner exercises={day.lesson.exercises} lessonId={blockKey(dayNumber, 'grammar')} onDone={(r) => void finish(r.score)} doneLabel="Selesai & lanjut" />
      );

    case 'reading':
      return phase === 'learn' ? (
        <ReadingView reading={day.reading} words={words} onStartQuestions={() => setPhase('practice')} />
      ) : (
        <ExerciseRunner
          exercises={day.reading.questions}
          lessonId={blockKey(dayNumber, 'reading')}
          doneLabel="Selesai & lanjut"
          onDone={async (r: RunnerResult) => {
            // Paham bacaan (≥ 60%) = kata-kata di dalamnya terbukti "dipahami dalam konteks".
            if ((r.score ?? 0) >= 60) {
              const ids = wordsInText(day.reading.paragraphs.map((p) => p.en).join(' '), words);
              await raiseMastery(ids, 2).catch(reportError);
            }
            void finish(r.score);
          }}
        />
      );

    case 'listening':
      return <ListeningView listening={day.listening} lessonId={blockKey(dayNumber, 'listening')} onDone={(score) => void finish(score)} />;

    case 'writing':
      return (
        <div className="page">
          <section className="card">
            <h2>Menulis</h2>
            <p className="muted small">{day.writing.intro}</p>
          </section>
          <ExerciseRunner
            exercises={day.writing.exercises}
            lessonId={blockKey(dayNumber, 'writing')}
            doneLabel="Selesai"
            onDone={async (r: RunnerResult) => {
              // Kata yang Anda tulis sendiri dengan benar = "dipakai dalam tulisan".
              const ids = wordsInText(r.correctTexts.join(' '), words);
              await raiseMastery(ids, 3).catch(reportError);
              void finish(r.score);
            }}
          />
        </div>
      );
  }
}
