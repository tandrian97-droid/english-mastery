import { useEffect, useRef, useState } from 'react';
import { scorePronunciation, type PronunciationResult } from '../../engine/pronunciation';
import { stopAudio } from '../../engine/audio';
import { useOnline } from '../../ui/hooks';

// Tipe minimal Web Speech API (pengenalan suara) — belum ada di tipe bawaan TypeScript.
interface RecAlternative {
  transcript: string;
}
interface RecResultEvent {
  results: ArrayLike<ArrayLike<RecAlternative> & { isFinal: boolean }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

const ERRORS: Record<string, string> = {
  'not-allowed': 'Izin mikrofon ditolak. Buka pengaturan situs di Chrome → Mikrofon → Izinkan.',
  'service-not-allowed': 'Pengenalan suara tidak diizinkan di perangkat ini.',
  network: 'Cek ucapan butuh internet. Anda tetap bisa memakai tombol Rekam.',
  'no-speech': 'Tidak terdengar suara. Coba lagi dan bicara lebih dekat ke HP.',
  'audio-capture': 'Mikrofon tidak ditemukan atau sedang dipakai aplikasi lain.',
  'language-not-supported': 'Bahasa Inggris belum tersedia untuk pengenalan suara di HP ini.',
};

/**
 * Latihan bicara untuk satu kalimat:
 *  - Cek ucapan: HP mendengarkan, lalu menandai kata yang belum terdengar jelas (butuh internet).
 *  - Rekam: rekam suara sendiri dan putar ulang untuk dibandingkan dengan contoh (offline).
 */
export function SpeakPractice({ text, onScore }: { text: string; onScore?: (r: PronunciationResult) => void }) {
  const online = useOnline();
  const Rec = getRecognition();
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);

  useEffect(
    () => () => {
      recRef.current?.abort();
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => () => void (clip && URL.revokeObjectURL(clip)), [clip]);

  function check() {
    if (!Rec) return;
    stopAudio();
    setError(null);
    setResult(null);
    const rec = new Rec();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.continuous = false;
    rec.onresult = (e) => {
      const alts: string[] = [];
      for (let i = 0; i < e.results.length; i++) for (let j = 0; j < e.results[i].length; j++) alts.push(e.results[i][j].transcript);
      const r = scorePronunciation(text, alts);
      setResult(r);
      onScore?.(r);
    };
    rec.onerror = (e) => setError(ERRORS[e.error] ?? `Pengenalan suara gagal (${e.error}).`);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setError('Pengenalan suara tidak bisa dimulai. Coba lagi.');
    }
  }

  async function toggleRecord() {
    if (recording) {
      mediaRef.current?.stop();
      return;
    }
    setError(null);
    try {
      stopAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      media.ondataavailable = (e) => chunks.push(e.data);
      media.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setClip(URL.createObjectURL(new Blob(chunks, { type: media.mimeType })));
      };
      mediaRef.current = media;
      media.start();
      setRecording(true);
      window.setTimeout(() => media.state === 'recording' && media.stop(), 15_000); // batas 15 detik
    } catch (e) {
      const name = (e as { name?: string }).name;
      setError(name === 'NotAllowedError' ? ERRORS['not-allowed'] : 'Mikrofon tidak bisa dipakai di perangkat ini.');
    }
  }

  const canCheck = !!Rec && online;

  return (
    <div className="speak-practice">
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className={`btn small-btn${listening ? ' live' : ''}`} onClick={check} disabled={!canCheck || listening}>
          <MicIcon /> {listening ? 'Mendengarkan…' : 'Cek ucapan'}
        </button>
        <button type="button" className={`btn secondary small-btn${recording ? ' live' : ''}`} onClick={toggleRecord}>
          {recording ? '■ Stop' : '● Rekam'}
        </button>
        {clip && !recording && (
          <button type="button" className="btn secondary small-btn" onClick={() => void new Audio(clip).play()}>
            ▶ Suara saya
          </button>
        )}
      </div>
      {!canCheck && <p className="muted small">{!Rec ? 'Cek ucapan tidak didukung browser ini. Gunakan Rekam lalu bandingkan.' : 'Cek ucapan butuh internet. Rekam tetap bisa dipakai offline.'}</p>}
      {error && <p className="small" style={{ color: 'var(--bad)' }}>{error}</p>}
      {result && (
        <div className={`speak-result ${result.score >= 80 ? 'good' : result.score >= 50 ? 'ok' : 'low'}`}>
          <div className="row between">
            <strong>{result.score >= 80 ? 'Jelas!' : result.score >= 50 ? 'Hampir.' : 'Belum jelas.'}</strong>
            <span className="badge">{result.score}%</span>
          </div>
          <p className="marks">
            {result.marks.map((m, i) => (
              <span key={i} className={m.name ? 'name' : m.heard ? 'heard' : 'missed'} title={m.name ? 'Nama tidak dinilai' : undefined}>
                {m.word}{' '}
              </span>
            ))}
          </p>
          <p className="muted small">Terdengar: “{result.heard || '—'}”</p>
          {result.marks.some((m) => m.name) && <p className="muted small">Nama orang (abu-abu) tidak dinilai: pengenal suara bahasa Inggris tidak mengenal nama Indonesia.</p>}
          {result.score < 80 && <p className="small">Kata merah belum terdengar jelas. Putar contoh versi pelan, perhatikan kata itu, lalu coba lagi.</p>}
        </div>
      )}
    </div>
  );
}
