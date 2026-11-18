import { useMemo, useState, type FormEvent } from 'react';
import type { Exercise, MatchExercise, OrderExercise } from '../../content/types';
import { recordAttempt, saveExplanation } from '../../db/learning';
import { checkOrder, checkTypedAnswer, type AnswerStatus } from '../../engine/answers';
import { freshSeed, rng, shuffle } from '../../engine/random';
import { useFeedback } from '../../ui/feedback';
import { RichText } from '../../ui/RichText';
import { SpeakButton } from '../../ui/SpeakButton';

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

/** Acak potongan kata, dijamin tidak sama dengan urutan benar. */
function shuffledTokens(ex: OrderExercise, rand: () => number): string[] {
  let out = shuffle(ex.tokens, rand);
  for (let i = 0; i < 5 && out.join(' ') === ex.tokens.join(' ') && out.length > 1; i++) out = shuffle(ex.tokens, rand);
  if (out.join(' ') === ex.tokens.join(' ') && out.length > 1) out.push(out.shift()!);
  return out;
}

export function ExerciseRunner({
  exercises,
  lessonId,
  onDone,
  doneLabel = 'Selesai',
  shuffleOrder = true,
}: {
  exercises: Exercise[];
  lessonId: string;
  onDone: (r: RunnerResult) => void;
  doneLabel?: string;
  /** Acak urutan soal (soal 'jelaskan' tetap di akhir). */
  shuffleOrder?: boolean;
}) {
  const { reportError } = useFeedback();
  const [seed] = useState(freshSeed);
  // Antrian: putaran pertama semua soal; soal yang salah diulang sekali di akhir.
  const [queue, setQueue] = useState<{ ex: Exercise; retry: boolean }[]>(() => {
    const rand = rng(seed);
    const main = exercises.filter((e) => e.type !== 'explain');
    const explain = exercises.filter((e) => e.type === 'explain');
    const ordered = shuffleOrder ? [...shuffle(main, rand), ...explain] : exercises;
    return ordered.map((ex) => ({ ex, retry: false }));
  });
  const [pos, setPos] = useState(0);
  const [firstTry, setFirstTry] = useState<Record<string, boolean>>({});
  const [correctTexts, setCorrectTexts] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  const current = queue[pos];
  const graded = exercises.filter((e) => e.type !== 'explain');
  // Urutan tampilan pilihan & potongan diacak per soal (dan berbeda saat soal diulang).
  const layout = useMemo(() => {
    if (!current) return { order: [] as number[], pool: [] as string[], right: [] as string[] };
    const rand = rng(seed + pos * 7919);
    const ex = current.ex;
    if (ex.type === 'mc' || ex.type === 'listen') return { order: shuffle(ex.options.map((_, i) => i), rand), pool: [], right: [] };
    if (ex.type === 'order') return { order: [], pool: shuffledTokens(ex, rand), right: [] };
    if (ex.type === 'match') return { order: [], pool: [], right: shuffle(ex.pairs.map((p) => p[1]), rand) };
    return { order: [], pool: [], right: [] };
  }, [current, seed, pos]);

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

  function chooseOption(i: number) {
    const ex = current.ex;
    if (feedback || (ex.type !== 'mc' && ex.type !== 'listen')) return;
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
              {score >= 80 ? ' Bagus sekali.' : score >= 60 ? ' Cukup baik; bagian yang salah akan muncul lagi di Latihan Pintar.' : ' Tidak apa-apa. Baca lagi penjelasannya; soal-soal ini akan diulang di Latihan Pintar.'}
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
  const typeBadge: Partial<Record<Exercise['type'], string>> = { explain: 'jelaskan sendiri', listen: 'dengarkan', match: 'cocokkan', order: 'susun kata', translate: 'terjemahkan' };

  return (
    <section className="card exercise" aria-live="polite">
      <div className="row between">
        <span className="muted small">
          Soal {Math.min(pos + 1, total)} dari {total}
          {current.retry && ' · ulangan'}
        </span>
        {typeBadge[ex.type] && <span className="badge teal">{typeBadge[ex.type]}</span>}
      </div>
      <div className="progress thin">
        <span style={{ width: `${(pos / total) * 100}%` }} />
      </div>
      <h3 className="prompt">
        <RichText text={ex.prompt} />
      </h3>

      {ex.type === 'listen' && (
        <div className="row">
          <SpeakButton text={ex.audio} label="Putar audio soal" />
          <SpeakButton text={ex.audio} slow label="Putar audio soal pelan" />
          {feedback && <span className="en">{ex.audio}</span>}
        </div>
      )}

      {(ex.type === 'mc' || ex.type === 'listen') && (
        <div className="options">
          {layout.order.map((i) => {
            const o = ex.options[i];
            const isChosen = chosen[0] === String(i);
            const cls = feedback ? (i === ex.answer ? 'opt right' : isChosen ? 'opt wrong' : 'opt') : 'opt';
            return (
              <button key={i} className={cls} onClick={() => chooseOption(i)} disabled={!!feedback}>
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
            {layout.pool.map((t, i) => {
              const usedCount = chosen.filter((c) => c === t).length;
              const before = layout.pool.slice(0, i).filter((p) => p === t).length;
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

      {ex.type === 'match' && !feedback && (
        <MatchBoard
          key={`${ex.id}-${pos}`}
          ex={ex}
          right={layout.right}
          onComplete={(mistakes) =>
            finishAnswer(mistakes === 0, `${mistakes} salah`, {
              status: mistakes === 0 ? 'correct' : 'wrong',
              expected: mistakes ? ex.pairs.map(([a, b]) => `${a} = ${b}`).join(' · ') : undefined,
            })
          }
        />
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
          {ex.explain && (
            <p className="small">
              <RichText text={ex.explain} />
            </p>
          )}
          <button className="btn block" onClick={next} autoFocus>
            Lanjut
          </button>
        </div>
      )}
    </section>
  );
}

/** Papan cocokkan: ketuk kata di kiri, lalu artinya di kanan. Pasangan benar terkunci hijau. */
function MatchBoard({ ex, right, onComplete }: { ex: MatchExercise; right: string[]; onComplete: (mistakes: number) => void }) {
  const [left, setLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Record<number, boolean>>({});
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);

  const [hint, setHint] = useState(false);
  function chooseRight(text: string) {
    if (left === null) {
      setHint(true);
      return;
    }
    setHint(false);
    if (ex.pairs[left][1] === text) {
      const m = { ...matched, [left]: true };
      setMatched(m);
      setLeft(null);
      if (Object.keys(m).length === ex.pairs.length) onComplete(mistakes);
    } else {
      setMistakes((n) => n + 1);
      setWrongFlash(text);
      window.setTimeout(() => setWrongFlash(null), 600);
    }
  }

  const matchedRight = new Set(Object.keys(matched).map((k) => ex.pairs[Number(k)][1]));
  return (
    <div className="match">
      <div className="match-col">
        {ex.pairs.map(([en], i) => (
          <button key={i} className={`chip${matched[i] ? ' matched' : left === i ? ' chosen' : ''}`} disabled={!!matched[i]} onClick={() => setLeft(i)}>
            {en}
          </button>
        ))}
      </div>
      <div className="match-col">
        {right.map((t) => (
          <button key={t} className={`chip${matchedRight.has(t) ? ' matched' : wrongFlash === t ? ' wrong' : ''}`} disabled={matchedRight.has(t)} onClick={() => chooseRight(t)}>
            {t}
          </button>
        ))}
      </div>
      <p className="muted small" style={{ gridColumn: '1 / -1' }}>
        {hint ? <b>Pilih kata di kiri dulu.</b> : 'Ketuk kata di kiri, lalu artinya di kanan.'} {mistakes > 0 && `Salah pasang: ${mistakes}`}
      </p>
    </div>
  );
}
