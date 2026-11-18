import { useState } from 'react';
import type { Listening } from '../../content/types';
import { SpeakButton } from '../../ui/SpeakButton';

/** Dengar lalu tirukan (shadowing). Selesai jika semua kalimat sudah ditirukan. */
export function ListeningView({ listening, onDone }: { listening: Listening; onDone: () => void }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [showId, setShowId] = useState<Record<number, boolean>>({});
  const count = Object.values(done).filter(Boolean).length;
  const all = count === listening.items.length;

  return (
    <div className="page">
      <section className="card">
        <h2>Dengar & tirukan</h2>
        <p className="muted small">{listening.intro}</p>
        <p className="small">
          Cara: putar → tirukan dengan keras → putar versi pelan → tirukan lagi → centang. Rekam-dan-bandingkan suara Anda hadir di Tahap 4.
        </p>
      </section>

      {listening.items.map((it, i) => (
        <section key={i} className={`card listen-item${done[i] ? ' done' : ''}`}>
          <div className="row" style={{ gap: 6 }}>
            <SpeakButton text={it.en} />
            <SpeakButton text={it.en} slow />
            <span className="en" style={{ flex: 1 }}>
              {it.en}
            </span>
          </div>
          {it.tip && <p className="small">💡 {it.tip}</p>}
          <div className="row between">
            <button className="link-btn" onClick={() => setShowId({ ...showId, [i]: !showId[i] })}>
              {showId[i] ? it.id : 'Arti'}
            </button>
            <label className="check">
              <input type="checkbox" checked={!!done[i]} onChange={(e) => setDone({ ...done, [i]: e.target.checked })} />
              Sudah saya tirukan
            </label>
          </div>
        </section>
      ))}

      <button className="btn block" disabled={!all} onClick={onDone}>
        {all ? 'Selesai' : `Tirukan semua kalimat (${count}/${listening.items.length})`}
      </button>
    </div>
  );
}
