/**
 * Pemutar audio pengucapan.
 *
 * Urutan sumber:
 *  1. File audio terpasang (public/audio/<hash>.ogg), dibuat dengan Piper TTS
 *     dan ikut tersimpan untuk offline. Ini sumber utama.
 *  2. Suara bahasa Inggris bawaan perangkat (Web Speech API), hanya jika file tidak ada.
 *
 * Nama file = hash FNV-1a dari teks yang dinormalisasi. HARUS identik dengan
 * scripts/generate-audio.py (diuji di tests/audio.test.ts).
 */
import { speak as speakTts, speechSupported } from './speech';

export function normalizeForAudio(text: string): string {
  return text
    .replace(/[*~]/g, '')
    .replace(/^[A-Z][a-z]+:\s/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(text)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function audioUrl(text: string): string {
  return `${import.meta.env.BASE_URL}audio/${fnv1a(normalizeForAudio(text))}.ogg`;
}

let current: HTMLAudioElement | null = null;

export function stopAudio(): void {
  if (current) {
    current.pause();
    current = null;
  }
}

/** Memutar teks. rate 0.7 = pelan (nada suara tetap). Menyelesaikan promise saat audio selesai. */
export async function playText(text: string, rate = 1): Promise<'file' | 'tts'> {
  stopAudio();
  const audio = new Audio(audioUrl(text));
  audio.playbackRate = rate;
  audio.preservesPitch = true;
  current = audio;
  try {
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('file audio tidak ada'));
      audio.play().catch(reject);
    });
    return 'file';
  } catch {
    if (current !== audio) return 'file'; // dihentikan oleh pemutaran lain
    if (!speechSupported()) throw new Error('Audio tidak tersedia.');
    await speakTts(normalizeForAudio(text), rate);
    return 'tts';
  } finally {
    if (current === audio) current = null;
  }
}
