import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { speak, whenVoicesReady } from '../engine/speech';

let voicesPromise: Promise<boolean> | null = null;
function voicesReady() {
  voicesPromise ??= whenVoicesReady();
  return voicesPromise;
}

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9Z" fill="currentColor" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);

/** Tombol putar suara. Tersembunyi jika perangkat tidak punya suara bahasa Inggris. */
export function SpeakButton({ text, slow = false, label }: { text: string; slow?: boolean; label?: string }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState(false);
  const settings = useLiveQuery(() => db.settings.get(1));
  const rate = (settings?.audioRate ?? 1) * (slow ? 0.7 : 1);

  useEffect(() => {
    let alive = true;
    void voicesReady().then((ok) => alive && setAvailable(ok));
    return () => {
      alive = false;
    };
  }, []);

  if (available === false) return null;

  return (
    <button
      type="button"
      className={`speak-btn${playing ? ' playing' : ''}`}
      aria-label={label ?? (slow ? `Putar pelan: ${text}` : `Putar: ${text}`)}
      disabled={available === null}
      onClick={() => {
        setPlaying(true);
        speak(text, rate)
          .catch(() => setAvailable(false))
          .finally(() => setPlaying(false));
      }}
    >
      <SpeakerIcon />
      {slow && <span className="small">pelan</span>}
    </button>
  );
}
