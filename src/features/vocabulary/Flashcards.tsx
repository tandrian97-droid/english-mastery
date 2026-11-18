import { useState, type FormEvent } from 'react';
import { checkTypedAnswer, type AnswerCheck } from '../../engine/answers';
import { freshSeed, rng } from '../../engine/random';
import type { Word } from '../../content/types';
import { saveReview } from '../../db/learning';
import type { ReviewRating, VocabCard } from '../../db/schema';
import { previewIntervals, RATING_LABELS } from '../../engine/srs';
import { useFeedback } from '../../ui/feedback';
import { SpeakButton } from '../../ui/SpeakButton';
import { WordDetails } from './WordDetails';

/** Kartu yang dijadwalkan kembali dalam waktu ini diulang di sesi yang sama. */
const SAME_SESSION_MS = 20 * 60 * 1000;
const MAX_REPEATS = 3;

/**
 * Tiga arah latihan kata:
 *  - recognize: lihat kata Inggris → ingat artinya (paling mudah)
 *  - listen: dengar saja → kenali kata & artinya (melatih telinga)
 *  - produce: lihat arti Indonesia → TULIS kata Inggrisnya (paling sulit, paling kuat untuk ingatan)
 * Kata yang benar-benar baru selalu mulai dari 'recognize'.
 */
export type CardMode = 'recognize' | 'listen' | 'produce';
export function chooseMode(card: VocabCard, r: number): CardMode {
  if (card.fsrs.reps < 2 && card.mastery === 0) return 'recognize';
  if (r < 0.4) return 'recognize';
  if (r < 0.75) return 'produce';
  return 'listen';
}
const MODE_LABEL: Record<CardMode, string> = { recognize: 'kenali arti', listen: 'dengarkan', produce: 'tulis katanya' };

/**
 * Sesi flashcard: lihat kata → coba ingat artinya → buka jawaban → nilai diri sendiri dengan jujur.
 * Kejujuran penting: "Bisa" padahal ragu membuat kata itu muncul terlalu jarang.
 */
export function Flashcards({ cards, words, onDone }: { cards: VocabCard[]; words: Map<string, Word>; onDone: (reviewed: number) => void }) {
  const { reportError } = useFeedback();
  const [queue, setQueue] = useState(() => cards.filter((c) => words.has(c.wordId)).map((c) => ({ card: c, repeats: 0 })));
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [seed] = useState(freshSeed);
  const [typed, setTyped] = useState('');
  const [typedCheck, setTypedCheck] = useState<AnswerCheck | null>(null);

  const current = queue[pos];
  if (!current) {
    return (
      <section className="card">
        <h2>Review selesai</h2>
        <p className="muted">{reviewed ? `${reviewed} kartu direview. Jadwal berikutnya sudah diatur otomatis.` : 'Tidak ada kartu yang jatuh tempo saat ini.'}</p>
        <button className="btn block" onClick={() => onDone(reviewed)}>
          Lanjut
        </button>
      </section>
    );
  }

  const word = words.get(current.card.wordId)!;
  const intervals = revealed ? previewIntervals(current.card) : null;
  const mode = chooseMode(current.card, rng(seed + pos * 104729)());

  function submitTyped(e: FormEvent) {
    e.preventDefault();
    if (typedCheck || !typed.trim()) return;
    setTypedCheck(checkTypedAnswer(typed, [word.word]));
    setRevealed(true);
  }

  async function rate(r: ReviewRating) {
    if (busy) return;
    setBusy(true);
    try {
      const next = await saveReview(current.card, r);
      setReviewed((n) => n + 1);
      if (next.due - Date.now() < SAME_SESSION_MS && current.repeats < MAX_REPEATS) {
        setQueue((q) => [...q, { card: next, repeats: current.repeats + 1 }]);
      }
      setRevealed(false);
      setTyped('');
      setTypedCheck(null);
      setPos((p) => p + 1);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card flashcard">
      <div className="row between">
        <span className="muted small">
          Kartu {pos + 1} dari {queue.length}
        </span>
        <span className="badge teal">{MODE_LABEL[mode]}</span>
      </div>
      {!revealed && mode === 'recognize' && (
        <div className="flash-front">
          <div className="word-title big">{word.word}</div>
          <SpeakButton text={word.word} />
          <p className="muted small">Ucapkan katanya, lalu coba ingat artinya sebelum membuka jawaban.</p>
          <button className="btn block" onClick={() => setRevealed(true)}>
            Lihat jawaban
          </button>
        </div>
      )}
      {!revealed && mode === 'listen' && (
        <div className="flash-front">
          <p className="prompt-big">Dengarkan. Kata apa ini, dan apa artinya?</p>
          <div className="row">
            <SpeakButton text={word.word} label="Putar kata" />
            <SpeakButton text={word.word} slow label="Putar kata pelan" />
          </div>
          <button className="btn block" onClick={() => setRevealed(true)}>
            Lihat jawaban
          </button>
        </div>
      )}
      {mode === 'produce' && (
        <form className="flash-front" onSubmit={submitTyped}>
          <div className="meaning big">{word.meaning}</div>
          <p className="muted small">{word.pos} · Tulis kata bahasa Inggrisnya</p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={!!typedCheck}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Kata dalam bahasa Inggris"
            placeholder="Ketik kata Inggrisnya"
          />
          {!typedCheck && (
            <div className="row" style={{ width: '100%' }}>
              <button type="button" className="btn secondary" onClick={() => { setTypedCheck({ status: 'wrong', isCorrect: false, expected: word.word }); setRevealed(true); }}>
                Tidak tahu
              </button>
              <button className="btn" style={{ flex: 1 }} type="submit" disabled={!typed.trim()}>
                Periksa
              </button>
            </div>
          )}
          {typedCheck && (
            <div className={`feedback ${typedCheck.status}`} style={{ width: '100%' }}>
              <strong>{typedCheck.status === 'correct' ? 'Benar!' : typedCheck.status === 'typo' ? `Hampir! Ejaannya: ${word.word}` : `Jawabannya: ${word.word}`}</strong>
            </div>
          )}
        </form>
      )}
      {revealed && (
        <>
          <WordDetails word={word} compact />
          {mode === 'produce' && typedCheck && !typedCheck.isCorrect ? (
            <button className="btn block" onClick={() => rate(1)} disabled={busy}>
              Lanjut (kata ini akan diulang sebentar lagi)
            </button>
          ) : (
            <>
              <p className="muted small">Seberapa mudah Anda mengingatnya? Jawab jujur.</p>
              <div className="ratings">
                {([1, 2, 3, 4] as ReviewRating[])
                  .filter((r) => !(mode === 'produce' && r === 1))
                  .map((r) => (
                    <button key={r} className={`rate r${r}`} onClick={() => rate(r)} disabled={busy}>
                      <strong>{RATING_LABELS[r].label}</strong>
                      <span className="small">{intervals?.[r]}</span>
                    </button>
                  ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

export function WordIntro({ wordIds, words, onDone }: { wordIds: string[]; words: Map<string, Word>; onDone: () => void }) {
  const [i, setI] = useState(0);
  const list = wordIds.map((id) => words.get(id)).filter((w): w is Word => !!w);
  const w = list[i];
  if (!w) return null;
  return (
    <section className="card">
      <div className="row between">
        <span className="muted small">
          Kata baru {i + 1} dari {list.length}
        </span>
        <div className="row" style={{ gap: 4 }}>
          <SpeakButton text={w.example} label="Putar contoh kalimat" />
        </div>
      </div>
      <div className="progress thin">
        <span style={{ width: `${((i + 1) / list.length) * 100}%` }} />
      </div>
      <WordDetails word={w} />
      <p className="muted small">Ucapkan kata dan contoh kalimatnya dengan keras 2 kali.</p>
      <div className="row">
        {i > 0 && (
          <button className="btn secondary" onClick={() => setI(i - 1)}>
            Sebelumnya
          </button>
        )}
        <button className="btn" style={{ flex: 1 }} onClick={() => (i + 1 < list.length ? setI(i + 1) : onDone())}>
          {i + 1 < list.length ? 'Kata berikutnya' : 'Latih dengan flashcard'}
        </button>
      </div>
    </section>
  );
}
