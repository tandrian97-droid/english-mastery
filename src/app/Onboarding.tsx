import { useRef, useState, type FormEvent } from 'react';
import { BackupError, importBackup, parseBackupText } from '../db/backup';
import { createProfile } from '../db/repo';
import { requestPersistentStorage } from '../db/storage';
import { useFeedback } from '../ui/feedback';

export function Onboarding() {
  const { notify, reportError } = useFeedback();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createProfile(name);
      void requestPersistentStorage();
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  }

  async function restore(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      await importBackup(parseBackupText(await f.text()));
      void requestPersistentStorage();
    } catch (err) {
      if (err instanceof BackupError) notify('bad', err.message);
      else reportError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="onboard" onSubmit={submit}>
        <img className="logo" src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
        <div className="stack">
          <h1>English Mastery</h1>
          <p className="muted">Your Personal English Learning System.</p>
        </div>
        <div className="card">
          <p>
            Program 300 hari dari nol menuju bahasa Inggris kerja dan percakapan sehari-hari. Setiap aturan dijelaskan sampai Anda paham{' '}
            <b>kenapa</b>, bukan sekadar hafal.
          </p>
          <label className="stack">
            <span className="muted small">Mau dipanggil siapa?</span>
            <input type="text" value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Nama panggilan" />
          </label>
          <button className="btn block" type="submit" disabled={busy || !name.trim()}>
            Mulai
          </button>
        </div>
        <button type="button" className="btn secondary" onClick={() => file.current?.click()} disabled={busy}>
          Sudah punya backup? Restore di sini
        </button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
      </form>
    </div>
  );
}
