import { useMemo, useState, type FormEvent } from 'react';
import type { Exercise, OrderExercise } from '../../content/types';
import { recordAttempt, saveExplanation } from '../../db/learning';
import { checkOrder, checkTypedAnswer, type AnswerStatus } from '../../engine/answers';
import { useFeedback } from '../../ui/feedback';
import { RichText } from '../../ui/RichText';

export interface RunnerResult {
  /** Persentase benar pada percobaan pertama (soal 'jelaskan' tidak dinilai). Null jika tidak ada soal bernilai. */
  score: number | null;
  /** Jawaban ketik yang benar, dipakai untuk menaikkan tingkat penguasaan kata. */
  correctTexts: string[];
}

interface Feedback {
  status: AnswerStatus | 'saved';
  expected?: string;
  why?: string;
}

/** Acak deterministik berdasarkan id soal, dan dijamin tidak sama dengan urutan benar. */
function shuffledTokens(ex: OrderExercise): string[] {
  const arr = ex.tokens.map((t, i) => ({ t, k: Math.sin((i + 1) * (ex.id.length + 7) * 9301) }));
  arr.sort((a, b) => a.k - b.k);
  const out = arr.map((x) => x.t);
  if (out.join(' ') === ex.tokens.join(' ') && out.length > 1) out.push(out.shift()!);
  return out;
}

export function ExerciseRunner({
  exercises,
  lessonId,
  onDone,
  doneLabel = 'Selesai',
}: {
  exercises: Exercise[];
  lessonId: string;
  onDone: (r: RunnerResult) => void;
  doneLabel?: string;
}) {
  const { reportError } = useFeedback();
  // Antrian: putaran pertama semua soal; soal yang salah diulang sekali di akhir.
  const [queue, setQueue] = useState<{ ex: Exercise; retry: boolean }[]>(() => exercises.map((ex) => ({ ex, retry: false })));
  const [pos, setPos] = useState(0);
  const [firstTry, setFirstTry] = useState<Record<string, boolean>>({});
  const [correctTexts, setCorrectTexts] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  const current = queue[pos];
  const graded = exercises.filter((e) => e.type !== 'explain');
  const pool = useMemo(() => (current?.ex.type === 'order' ? shuffledTokens(current.ex) : []), [current]);

  function finishAnswer(isCorrect: boolean, answer: string, fb: Feedback) {
    const ex = current.ex;
    setFeedback(fb);
    if (!current.retry) {
      setFirstTry((f) => ({ ...f, [ex.id]: isCorrect }));
      void recordAttempt(ex, lessonId, answer, isCorrect).catch(reportError);
      if (!isCorrect) setQueue((q) => [...q, { ex, retry: true }]);
    }
    if (isCorrect && (ex.type === 'translate' || ex.type === 'fill' || ex.type === 'order')) setCorrectTexts((c) => [...c, answer]);
  }

  function submitTyped(e?: FormEvent) {
    e?.preventDefault();
    const ex = current.ex;
    if (feedback || (ex.type !== 'fill' && ex.type !== 'translate')) return;
    if (!text.trim()) return;
    const r = checkTypedAnswer(text, ex.accept);
    finishAnswer(r.isCorrect, text, { status: r.status, expected: r.expected });
  }

  function chooseMc(i: number) {
    const ex = current.ex;
    if (feedback || ex.type !== 'mc') return;
    const ok = i === ex.answer;
    finishAnswer(ok, ex.options[i].text, { status: ok ? 'correct' : 'wrong', expected: ex.options[ex.answer].text, why: ok ? undefined : ex.options[i].why });
    setChosen([String(i)]);
  }

  function submitOrder() {
    const ex = current.ex;
    if (feedback || ex.type !== 'order' || chosen.length !== ex.tokens.length) return;
    const r = checkOrder(chosen, [ex.tokens, ...(ex.alsoAccept ?? [])]);
    finishAnswer(r.isCorrect, chosen.join(' '), { status: r.status, expected: ex.tokens.join(' ') });
  }

  async function submitExplain(e?: FormEvent) {
    e?.preventDefault();
    const ex = current.ex;
    if (feedback || ex.type !== 'explain' || !text.trim()) return;
    try {
      await saveExplanation(ex.id, ex.prompt, text.trim());
    } catch (err) {
      reportError(err);
    }
    setFeedback({ status: 'saved' });
  }

  function next() {
    setFeedback(null);
    setText('');
    setChosen([]);
    if (pos + 1 < queue.length) setPos(pos + 1);
    else setFinished(true);
  }

  if (finished || !current) {
    const right = graded.filter((e) => firstTry[e.id]).length;
    const score = graded.length ? Math.round((right / graded.length) * 100) : null;
    const wrong = graded.filter((e) => firstTry[e.id] === false);
    return (
      <section className="card">
        <h2>Hasil latihan</h2>
        {score !== null && (
          <>
            <div className="timer">{score}%</div>
            <p className="muted">
              {right} dari {graded.length} benar pada percobaan pertama.
              {score >= 80 ? ' Bagus sekali.' : score >= 60 ? ' Cukup baik; ulangi bagian yang salah besok.' : ' Tidak apa-apa. Baca lagi penjelasannya, lalu ulangi latihan ini.'}
            </p>
          </>
        )}
        {wrong.length > 0 && (
          <div className="stack">
            <strong className="small">Yang perlu diperhatikan:</strong>
            {wrong.map((e) => (
              <div key={e.id} className="small muted">
                • <RichText text={e.explain} />
              </div>
            ))}
          </div>
        )}
        <button className="btn block" onClick={() => onDone({ score, correctTexts })}>
          {doneLabel}
        </button>
      </section>
    );
  }

  const ex = current.ex;
  const total = queue.length;
  const statusText: Record<Feedback['status'], string> = {
    correct: 'Benar!',
    typo: 'Benar, tapi periksa ejaannya.',
    wrong: 'Belum tepat.',
    saved: 'Tersimpan. Bandingkan dengan contoh jawaban:',
  };

  return (
    <section className="card exercise" aria-live="polite">
      <div className="row between">
        <span className="muted small">
          Soal {Math.min(pos + 1, total)} dari {total}
          {current.retry && ' · ulangan'}
        </span>
        {ex.type === 'explain' && <span className="badge teal">jelaskan sendiri</span>}
      </div>
      <div className="progress thin">
        <span style={{ width: `${(pos / total) * 100}%` }} />
      </div>
      <h3 className="prompt">
        <RichText text={ex.prompt} />
      </h3>

      {ex.type === 'mc' && (
        <div className="options">
          {ex.options.map((o, i) => {
            const isChosen = chosen[0] === String(i);
            const cls = feedback ? (i === ex.answer ? 'opt right' : isChosen ? 'opt wrong' : 'opt') : 'opt';
            return (
              <button key={i} className={cls} onClick={() => chooseMc(i)} disabled={!!feedback}>
                <RichText text={o.text} />
              </button>
            );
          })}
        </div>
      )}

      {(ex.type === 'fill' || ex.type === 'translate') && (
        <form onSubmit={submitTyped} className="stack">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!!feedback}
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={ex.type === 'fill' ? 'Isi bagian yang kosong' : 'Tulis dalam bahasa Inggris'}
            aria-label="Jawaban"
          />
          {ex.hint && !feedback && <span className="muted small">Petunjuk: {ex.hint}</span>}
          {!feedback && (
            <button className="btn" type="submit" disabled={!text.trim()}>
              Periksa
            </button>
          )}
        </form>
      )}

      {ex.type === 'order' && (
        <div className="stack">
          <div className="order-answer" aria-label="Jawaban Anda">
            {chosen.length === 0 && <span className="muted small">Ketuk kata di bawah sesuai urutan</span>}
            {chosen.map((t, i) => (
              <button key={i} className="chip chosen" disabled={!!feedback} onClick={() => setChosen(chosen.filter((_, j) => j !== i))}>
                {t}
              </button>
            ))}
          </div>
          <div className="order-pool">
            {pool.map((t, i) => {
              const usedCount = chosen.filter((c) => c === t).length;
              const before = pool.slice(0, i).filter((p) => p === t).length;
              const used = before < usedCount;
              return (
                <button key={i} className="chip" disabled={used || !!feedback} onClick={() => setChosen([...chosen, t])}>
                  {t}
                </button>
              );
            })}
          </div>
          {!feedback && (
            <button className="btn" onClick={submitOrder} disabled={chosen.length !== ex.tokens.length}>
              Periksa
            </button>
          )}
        </div>
      )}

      {ex.type === 'explain' && (
        <form onSubmit={submitExplain} className="stack">
          <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={!!feedback} rows={4} placeholder="Tulis dengan kata-kata Anda sendiri (boleh Bahasa Indonesia)" aria-label="Penjelasan Anda" />
          {!feedback && (
            <button className="btn" type="submit" disabled={!text.trim()}>
              Simpan & lihat contoh
            </button>
          )}
        </form>
      )}

      {feedback && (
        <div className={`feedback ${feedback.status}`}>
          <strong>{statusText[feedback.status]}</strong>
          {feedback.status === 'saved' && ex.type === 'explain' && (
            <p>
              <RichText text={ex.model} />
            </p>
          )}
          {(feedback.status === 'wrong' || feedback.status === 'typo') && feedback.expected && (
            <p>
              Jawaban yang benar: <strong>{feedback.expected}</strong>
            </p>
          )}
          {feedback.why && (
            <p>
              <RichText text={feedback.why} />
            </p>
          )}
          <p className="small">
            <RichText text={ex.explain} />
          </p>
          <button className="btn block" onClick={next} autoFocus>
            Lanjut
          </button>
        </div>
      )}
    </section>
  );
}
