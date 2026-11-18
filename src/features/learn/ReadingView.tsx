import { Fragment, useState } from 'react';
import type { Reading, Word } from '../../content/types';
import { SpeakButton } from '../../ui/SpeakButton';

interface Lookup {
  token: string;
  meaning: string;
  extra?: string;
}

/** Mencari arti kata yang diketuk: dari daftar kata yang dipelajari, lalu glosarium bacaan. */
export function lookupWord(raw: string, words: Map<string, Word>, glossary: Record<string, string>): Lookup {
  const t = raw.toLowerCase().replace(/^'+|'+$/g, '');
  const candidates = [t, t.replace(/es$/, ''), t.replace(/s$/, ''), t.replace(/ies$/, 'y')];
  for (const c of candidates) {
    for (const w of words.values()) {
      if (w.word.toLowerCase() === c) return { token: raw, meaning: w.meaning, extra: `${w.say} · ${w.pos}${c !== t ? ' · bentuk jamak/–s' : ''}` };
    }
    if (glossary[c]) return { token: raw, meaning: glossary[c] };
  }
  return { token: raw, meaning: 'Nama orang/tempat, atau belum ada di kamus aplikasi.' };
}

/**
 * Bacaan: terjemahan disembunyikan secara default (pahami dulu sendiri).
 * Ketuk kata untuk melihat artinya; ketuk "Terjemahan" untuk satu kalimat.
 */
export function ReadingView({ reading, words, onStartQuestions }: { reading: Reading; words: Map<string, Word>; onStartQuestions: () => void }) {
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [translated, setTranslated] = useState<Record<number, boolean>>({});
  const wordCount = reading.paragraphs.reduce((n, p) => n + (p.en.match(/[A-Za-z']+/g)?.length ?? 0), 0);

  return (
    <div className="page">
      <section className="card">
        <div className="row between">
          <h2>{reading.title}</h2>
          <span className="badge teal">
            {reading.cefr} · {wordCount} kata
          </span>
        </div>
        <p className="muted small">{reading.intro}</p>
      </section>

      {lookup && (
        <div className="lookup" role="status">
          <div>
            <strong>{lookup.token}</strong> = {lookup.meaning}
            {lookup.extra && <div className="muted small">{lookup.extra}</div>}
          </div>
          <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
            <SpeakButton text={lookup.token} />
            <button className="icon-btn" aria-label="Tutup" onClick={() => setLookup(null)}>
              ✕
            </button>
          </div>
        </div>
      )}

      <section className="card reading">
        {reading.paragraphs.map((p, i) => (
          <div key={i} className="para">
            <p className="en-text">
              {p.en.split(/(\s+)/).map((part, j) => {
                const m = part.match(/^([^A-Za-z']*)([A-Za-z']+)([^A-Za-z']*)$/);
                if (!m) return <Fragment key={j}>{part}</Fragment>;
                return (
                  <Fragment key={j}>
                    {m[1]}
                    <button className="tap-word" onClick={() => setLookup(lookupWord(m[2], words, reading.glossary))}>
                      {m[2]}
                    </button>
                    {m[3]}
                  </Fragment>
                );
              })}
            </p>
            <div className="row" style={{ gap: 6 }}>
              <SpeakButton text={p.en.replace(/^[A-Z][a-z]+:\s/, '')} label="Dengarkan kalimat" />
              <button className="link-btn" onClick={() => setTranslated({ ...translated, [i]: !translated[i] })}>
                {translated[i] ? 'Sembunyikan terjemahan' : 'Terjemahan'}
              </button>
            </div>
            {translated[i] && <p className="muted small translation">{p.id}</p>}
          </div>
        ))}
      </section>

      <button className="btn block" onClick={onStartQuestions}>
        Jawab pertanyaan ({reading.questions.length})
      </button>
    </div>
  );
}
