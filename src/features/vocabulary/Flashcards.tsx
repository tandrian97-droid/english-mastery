import { useState } from 'react';
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
        <span className="badge">{['baru', 'belajar', 'review', 'ulang'][current.card.fsrs.state]}</span>
      </div>
      {!revealed ? (
        <div className="flash-front">
          <div className="word-title big">{word.word}</div>
          <SpeakButton text={word.word} />
          <p className="muted small">Ucapkan katanya, lalu coba ingat artinya sebelum membuka jawaban.</p>
          <button className="btn block" onClick={() => setRevealed(true)}>
            Lihat jawaban
          </button>
        </div>
      ) : (
        <>
          <WordDetails word={word} compact />
          <p className="muted small">Seberapa mudah Anda mengingatnya? Jawab jujur.</p>
          <div className="ratings">
            {([1, 2, 3, 4] as ReviewRating[]).map((r) => (
              <button key={r} className={`rate r${r}`} onClick={() => rate(r)} disabled={busy}>
                <strong>{RATING_LABELS[r].label}</strong>
                <span className="small">{intervals?.[r]}</span>
              </button>
            ))}
          </div>
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
