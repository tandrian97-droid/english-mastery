import { useEffect } from 'react';
import { formatClock, useStudyTimer } from '../engine/useStudyTimer';
import { useFeedback } from './feedback';

/** Timer berjalan otomatis selama blok terbuka, berhenti saat keluar/jeda/layar mati. */
export function TimerChip() {
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

