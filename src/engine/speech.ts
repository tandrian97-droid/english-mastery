/**
 * Audio pengucapan memakai suara bahasa Inggris bawaan perangkat (Web Speech API).
 *
 * Di Android, Chrome memakai mesin suara Google. Suara bahasa Inggris biasanya sudah
 * terpasang dan bekerja offline. Jika perangkat tidak punya suara bahasa Inggris,
 * tombol suara disembunyikan dan petunjuk bunyi (IPA + ejaan Indonesia) tetap tampil.
 * Audio rekaman yang dibundel (bukan sintesis) direncanakan di Tahap 4.
 */

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang === 'en-US' ? 4 : v.lang === 'en-GB' ? 3 : 1) + (v.localService ? 2 : 0) + (/google|natural|neural/i.test(v.name) ? 1 : 0);
  return en.sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function speechSupported(): boolean {
  return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Menunggu daftar suara siap (di Chrome dimuat secara asinkron). */
export function whenVoicesReady(): Promise<boolean> {
  if (!speechSupported()) return Promise.resolve(false);
  if (window.speechSynthesis.getVoices().length) return Promise.resolve(!!pickVoice());
  return new Promise((resolve) => {
    const done = () => resolve(!!pickVoice());
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 2500);
  });
}

export function speak(text: string, rate = 1): Promise<void> {
  if (!speechSupported()) return Promise.reject(new Error('Perangkat tidak mendukung suara.'));
  if (cachedVoice === undefined || cachedVoice === null) cachedVoice = pickVoice();
  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = cachedVoice?.lang ?? 'en-US';
    if (cachedVoice) u.voice = cachedVoice;
    u.rate = Math.min(1.5, Math.max(0.5, rate));
    u.onend = () => resolve();
    u.onerror = (e) => (e.error === 'interrupted' || e.error === 'canceled' ? resolve() : reject(new Error(e.error)));
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
