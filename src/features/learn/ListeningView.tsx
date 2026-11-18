import { useState, type FormEvent } from 'react';
import type { Exercise, Listening } from '../../content/types';
import { recordAttempt } from '../../db/learning';
import { checkTypedAnswer, type AnswerCheck } from '../../engine/answers';
import { useFeedback } from '../../ui/feedback';
import { SpeakButton } from '../../ui/SpeakButton';
import { SpeakPractice } from './SpeakPractice';

/** Ucapan dianggap lulus jika ≥ 70% kata terdengar jelas oleh pengenal suara. */
const SPEAK_PASS = 70;

/**
 * Blok Listening & Speaking:
 *  Tahap 1 — Dengar & ucapkan: putar contoh, tirukan, lalu cek ucapan atau rekam suara sendiri.
 *  Tahap 2 — Dikte: dengar tanpa melihat tulisan, ketik yang Anda dengar. Dinilai otomatis.
 */
export function ListeningView({ listening, lessonId, onDone }: { listening: Listening; lessonId: string; onDone: (score: number | null) => void }) {
  const [phase, setPhase] = useState<'speak' | 'dictation'>('speak');
  return phase === 'speak' ? (
    <SpeakPhase listening={listening} lessonId={lessonId} onNext={() => setPhase('dictation')} />
  ) : (
    <DictationPhase listening={listening} lessonId={lessonId} onDone={onDone} />
  );
}

function SpeakPhase({ listening, lessonId, onNext }: { listening: Listening; lessonId: string; onNext: () => void }) {
  const { reportError } = useFeedback();
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [best, setBest] = useState<Record<number, number>>({});
  const [showId, setShowId] = useState<Record<number, boolean>>({});
  const count = listening.items.filter((_, i) => done[i]).length;
  const all = count === listening.items.length;

  return (
    <div className="page">
      <section className="card">
        <h2>Tahap 1 · Dengar & ucapkan</h2>
        <p className="muted small">{listening.intro}</p>
        <ol className="steps small">
          <li>Tekan 🔊 dan dengarkan. Ulangi dengan versi <b>pelan</b> jika perlu.</li>
          <li>Tirukan dengan keras, sama persis iramanya.</li>
          <li>
            Tekan <b>Cek ucapan</b> lalu ucapkan kalimatnya. HP akan menandai kata yang belum jelas (butuh internet). Tanpa internet, pakai <b>Rekam</b> lalu
            bandingkan suara Anda dengan contoh.
          </li>
        </ol>
      </section>

      {listening.items.map((it, i) => (
        <section key={i} className={`card listen-item${done[i] ? ' done' : ''}`}>
          <div className="row" style={{ gap: 6 }}>
            <SpeakButton text={it.en} />
            <SpeakButton text={it.en} slow />
            <span className="en" style={{ flex: 1 }}>
              {it.en}
            </span>
            {best[i] !== undefined && <span className={`badge ${best[i] >= SPEAK_PASS ? 'ok' : 'warn'}`}>{best[i]}%</span>}
          </div>
          {it.tip && <p className="small">💡 {it.tip}</p>}
          <SpeakPractice
            text={it.en}
            onScore={(r) => {
              setBest((b) => ({ ...b, [i]: Math.max(b[i] ?? 0, r.score) }));
              if (r.score >= SPEAK_PASS) setDone((d) => ({ ...d, [i]: true }));
              const ex: Exercise = { id: `${lessonId}:speak-${i}`, type: 'translate', prompt: it.en, accept: [it.en], explain: '', errorTag: 'pronunciation' };
              void recordAttempt(ex, lessonId, `${r.score}% | ${r.heard}`, r.score >= SPEAK_PASS).catch(reportError);
            }}
          />
          <div className="row between">
            <button className="link-btn" onClick={() => setShowId({ ...showId, [i]: !showId[i] })}>
              {showId[i] ? it.id : 'Arti'}
            </button>
            <label className="check">
              <input type="checkbox" checked={!!done[i]} onChange={(e) => setDone({ ...done, [i]: e.target.checked })} />
              Sudah saya ucapkan
            </label>
          </div>
        </section>
      ))}

      <button className="btn block" disabled={!all} onClick={onNext}>
        {all ? 'Lanjut ke dikte' : `Ucapkan semua kalimat (${count}/${listening.items.length})`}
      </button>
    </div>
  );
}

function DictationPhase({ listening, lessonId, onDone }: { listening: Listening; lessonId: string; onDone: (score: number | null) => void }) {
  const { reportError } = useFeedback();
  const items = listening.items;
  const [pos, setPos] = useState(0);
  const [text, setText] = useState('');
  const [check, setCheck] = useState<AnswerCheck | null>(null);
  const [right, setRight] = useState(0);
  const [finished, setFinished] = useState(false);

  if (finished) {
    const score = Math.round((right / items.length) * 100);
    return (
      <section className="card">
        <h2>Hasil dikte</h2>
        <div className="timer">{score}%</div>
        <p className="muted">
          {right} dari {items.length} kalimat ditulis benar hanya dari mendengar.
          {score >= 80 ? ' Telinga Anda makin terlatih.' : ' Dikte memang sulit di awal. Latihan ini yang paling cepat melatih telinga.'}
        </p>
        <button className="btn block" onClick={() => onDone(score)}>
          Selesai & lanjut
        </button>
      </section>
    );
  }

  const it = items[pos];
  function submit(e: FormEvent) {
    e.preventDefault();
    if (check || !text.trim()) return;
    const r = checkTypedAnswer(text, [it.en]);
    setCheck(r);
    if (r.isCorrect) setRight((n) => n + 1);
    const ex: Exercise = { id: `${lessonId}:dictation-${pos}`, type: 'translate', prompt: it.en, accept: [it.en], explain: '', errorTag: 'listening' };
    void recordAttempt(ex, lessonId, text, r.isCorrect).catch(reportError);
  }
  function next() {
    setCheck(null);
    setText('');
    if (pos + 1 < items.length) setPos(pos + 1);
    else setFinished(true);
  }

  return (
    <section className="card exercise">
      <div className="row between">
        <span className="muted small">
          Dikte {pos + 1} dari {items.length}
        </span>
        <span className="badge teal">tanpa melihat tulisan</span>
      </div>
      <div className="progress thin">
        <span style={{ width: `${(pos / items.length) * 100}%` }} />
      </div>
      <h3 className="prompt">Dengarkan, lalu tulis apa yang Anda dengar.</h3>
      <div className="row">
        <SpeakButton text={it.en} label="Putar kalimat" />
        <SpeakButton text={it.en} slow label="Putar kalimat pelan" />
        <span className="muted small">Boleh diputar berkali-kali.</span>
      </div>
      <form onSubmit={submit} className="stack">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!!check}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Ketik dalam bahasa Inggris"
          aria-label="Yang Anda dengar"
        />
        {!check && (
          <button className="btn" type="submit" disabled={!text.trim()}>
            Periksa
          </button>
        )}
      </form>
      {check && (
        <div className={`feedback ${check.status}`}>
          <strong>{check.status === 'correct' ? 'Benar!' : check.status === 'typo' ? 'Benar, tapi periksa ejaannya.' : 'Belum tepat.'}</strong>
          <p>
            Kalimatnya: <strong>{it.en}</strong>
          </p>
          <p className="muted small">{it.id}</p>
          {it.tip && <p className="small">💡 {it.tip}</p>}
          <button className="btn block" onClick={next} autoFocus>
            Lanjut
          </button>
        </div>
      )}
    </section>
  );
}
