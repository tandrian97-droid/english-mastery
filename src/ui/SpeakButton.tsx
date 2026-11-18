import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db/db';
import { playText } from '../engine/audio';

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9Z" fill="currentColor" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);

/** Tombol putar suara: memakai audio terpasang (offline), cadangan: suara perangkat. */
export function SpeakButton({ text, slow = false, label }: { text: string; slow?: boolean; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const settings = useLiveQuery(() => db.settings.get(1));
  const rate = (settings?.audioRate ?? 1) * (slow ? 0.7 : 1);

  return (
    <button
      type="button"
      className={`speak-btn${playing ? ' playing' : ''}${failed ? ' failed' : ''}`}
      aria-label={label ?? (slow ? `Putar pelan: ${text}` : `Putar: ${text}`)}
      title={failed ? 'Audio tidak tersedia untuk teks ini' : undefined}
      onClick={() => {
        setPlaying(true);
        setFailed(false);
        playText(text, rate)
          .catch(() => setFailed(true))
          .finally(() => setPlaying(false));
      }}
    >
      <SpeakerIcon />
      {slow && <span className="small">pelan</span>}
    </button>
  );
}
