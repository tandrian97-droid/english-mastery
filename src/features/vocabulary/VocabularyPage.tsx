import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { loadAllWords } from '../../content/load';
import type { Word } from '../../content/types';
import { db } from '../../db/db';
import { getDueCards } from '../../db/learning';
import type { VocabCard } from '../../db/schema';
import { useFeedback } from '../../ui/feedback';
import { Flashcards } from './Flashcards';
import { WordDetails } from './WordDetails';

const LEVELS = [
  { level: 0, name: 'Dilihat', desc: 'Pernah muncul di pelajaran' },
  { level: 1, name: 'Dikenali', desc: 'Benar di flashcard' },
  { level: 2, name: 'Dipahami', desc: 'Dipahami saat muncul di bacaan' },
  { level: 3, name: 'Dipakai', desc: 'Dipakai benar di tulisan Anda' },
  { level: 4, name: 'Aktif stabil', desc: 'Dipakai benar berulang kali' },
] as const;

export function VocabularyPage() {
  const { reportError } = useFeedback();
  const [words, setWords] = useState<Map<string, Word> | null>(null);
  const [session, setSession] = useState<VocabCard[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const cards = useLiveQuery(() => db.vocab_cards.toArray());
  const due = useLiveQuery(() => db.vocab_cards.where('due').belowOrEqual(Date.now()).count());

  useEffect(() => {
    loadAllWords().then(setWords).catch(reportError);
  }, [reportError]);

  if (session && words) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Review kosakata</h1>
        </header>
        <Flashcards cards={session} words={words} onDone={() => setSession(null)} />
      </div>
    );
  }

  const counts = LEVELS.map((l) => cards?.filter((c) => c.mastery === l.level).length ?? 0);
  const known = (cards ?? []).map((c) => ({ c, w: words?.get(c.wordId) })).filter((x): x is { c: VocabCard; w: Word } => !!x.w);
  known.sort((a, b) => a.w.day - b.w.day || a.w.word.localeCompare(b.w.word));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Kosakata</h1>
          <p className="sub">{cards?.length ?? 0} kata dikenal · target 10 kata baru per hari belajar</p>
        </div>
      </header>

      <div className="grid two">
        <section className="card hero">
          <h2>Review hari ini</h2>
          <div className="timer">{due ?? 0} kartu</div>
          <p className="muted small">Jadwal diatur otomatis (FSRS): kata yang sulit muncul lebih sering, kata yang mudah makin jarang.</p>
          <button
            className="btn"
            disabled={!due || !words}
            onClick={() => {
              getDueCards(Date.now() + 1000).then(setSession).catch(reportError);
            }}
          >
            {due ? 'Mulai review' : 'Belum ada yang jatuh tempo'}
          </button>
        </section>

        <section className="card">
          <h2>Tingkat penguasaan</h2>
          <div className="list">
            {LEVELS.map((l, i) => (
              <div className="list-item" key={l.level}>
                <div>
                  <strong>{l.name}</strong>
                  <div className="muted small">{l.desc}</div>
                </div>
                <span className="badge">{counts[i]}</span>
              </div>
            ))}
          </div>
          <p className="muted small">Hanya tingkat "Dipakai" ke atas yang dihitung sebagai kosakata dikuasai.</p>
        </section>

        <section className="card span-2">
          <h2>Kata-kata Anda</h2>
          {known.length === 0 && <p className="muted">Kata muncul di sini setelah Anda menyelesaikan blok Kosakata di Hari 1.</p>}
          <div className="list">
            {known.map(({ c, w }) => (
              <div key={w.id}>
                <button className="list-item word-row" onClick={() => setOpen(open === w.id ? null : w.id)} aria-expanded={open === w.id}>
                  <span>
                    <strong>{w.word}</strong> <span className="muted small">· {w.meaning}</span>
                  </span>
                  <span className="badge">{LEVELS[c.mastery].name}</span>
                </button>
                {open === w.id && (
                  <div className="word-open">
                    <WordDetails word={w} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
