import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { db, SCHEMA_VERSION } from '../../db/db';
import { BackupError, downloadBackup, importBackup, parseBackupText, type BackupFile } from '../../db/backup';
import { formatBytes, getStorageStatus, requestPersistentStorage, type StorageStatus } from '../../db/storage';
import { useFeedback } from '../../ui/feedback';

export const APP_VERSION = '0.1.1 (Tahap 1)';

export function SettingsPage() {
  const { notify, reportError } = useFeedback();
  const profile = useLiveQuery(() => db.profile.get(1));
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refreshStorage = () => void getStorageStatus().then(setStorage);
  useEffect(refreshStorage, []);

  useEffect(() => {
    if (pending) dialog.current?.showModal();
    else dialog.current?.close();
  }, [pending]);

  async function doBackup() {
    setBusy(true);
    try {
      const file = await downloadBackup();
      notify('info', `Backup diunduh: ${file}. Simpan juga ke Google Drive agar aman jika HP hilang.`);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPending(parseBackupText(await file.text()));
    } catch (err) {
      notify('bad', err instanceof BackupError ? err.message : `File tidak bisa dibaca: ${String(err)}`);
    }
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    try {
      // Jaring pengaman: data saat ini diunduh dulu sebelum diganti.
      if (await db.profile.get(1)) await downloadBackup();
      const counts = await importBackup(pending);
      setPending(null);
      notify('info', `Restore berhasil: ${counts.daily_log} hari belajar, ${counts.vocab_cards} kata, ${counts.writings} tulisan.`);
    } catch (e) {
      setPending(null);
      if (e instanceof BackupError) notify('bad', e.message);
      else reportError(e);
    } finally {
      setBusy(false);
    }
  }

  async function askPersist() {
    const ok = await requestPersistentStorage();
    notify(ok ? 'info' : 'warn', ok ? 'Penyimpanan permanen aktif.' : 'Browser belum memberi izin. Pasang aplikasi ke layar utama, lalu coba lagi.');
    refreshStorage();
  }

  const lastBackup = profile?.lastBackupAt ? new Date(profile.lastBackupAt).toLocaleString('id-ID') : 'belum pernah';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Pengaturan</h1>
          <p className="sub">Versi {APP_VERSION}</p>
        </div>
        <Link to="/" className="btn secondary">
          Kembali
        </Link>
      </header>

      <div className="grid two">
        {profile && <ProfileCard key={profile.name} initialName={profile.name} />}

        <section className="card">
          <h2>Backup & restore</h2>
          <p className="muted">
            Semua data hanya ada di HP ini. Backup = satu file .json berisi seluruh progres, kosakata, dan tulisan Anda.
          </p>
          <p className="small">Backup terakhir: {lastBackup}</p>
          <button className="btn block" onClick={doBackup} disabled={busy}>
            Unduh backup sekarang
          </button>
          <button className="btn secondary block" onClick={() => fileInput.current?.click()} disabled={busy}>
            Restore dari file backup
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={pickFile} />
        </section>

        <section className="card">
          <h2>Penyimpanan</h2>
          {storage ? (
            <table className="table">
              <tbody>
                <tr>
                  <td>Penyimpanan permanen</td>
                  <td>{storage.persisted ? <span className="badge ok">aktif</span> : <span className="badge warn">belum</span>}</td>
                </tr>
                <tr>
                  <td>Terpakai</td>
                  <td>{formatBytes(storage.usageBytes)}</td>
                </tr>
                <tr>
                  <td>Kuota</td>
                  <td>{formatBytes(storage.quotaBytes)}</td>
                </tr>
                <tr>
                  <td>Versi database</td>
                  <td>{SCHEMA_VERSION}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="muted">Memeriksa…</p>
          )}
          {storage && !storage.persisted && (
            <button className="btn secondary" onClick={askPersist}>
              Minta penyimpanan permanen
            </button>
          )}
          <p className="muted small">Permanen = browser tidak menghapus data saat memori HP menipis.</p>
        </section>
      </div>

      <dialog ref={dialog} className="sheet" onCancel={() => setPending(null)}>
        {pending && (
          <div className="stack" style={{ gap: 12 }}>
            <h2>Ganti semua data dengan backup ini?</h2>
            <p className="muted">
              Backup dibuat {new Date(pending.exportedAt).toLocaleString('id-ID')}, berisi {pending.counts?.daily_log ?? 0} hari belajar,{' '}
              {pending.counts?.vocab_cards ?? 0} kata, {pending.counts?.writings ?? 0} tulisan.
            </p>
            <p className="small">Sebelum diganti, data Anda saat ini otomatis diunduh dulu sebagai backup cadangan.</p>
            <div className="row">
              <button className="btn" onClick={confirmImport} disabled={busy}>
                Ya, restore
              </button>
              <button className="btn secondary" onClick={() => setPending(null)} disabled={busy}>
                Batal
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}

function ProfileCard({ initialName }: { initialName: string }) {
  const { notify, reportError } = useFeedback();
  const [name, setName] = useState(initialName);

  async function saveName() {
    const clean = name.trim();
    if (!clean || clean.length > 40) {
      notify('warn', 'Nama harus 1–40 karakter.');
      return;
    }
    try {
      await db.profile.update(1, { name: clean, updatedAt: Date.now() });
      notify('info', 'Nama disimpan.');
    } catch (e) {
      reportError(e);
    }
  }

  return (
    <section className="card">
      <h2>Profil</h2>
      <label className="stack">
        <span className="muted small">Nama panggilan</span>
        <input type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn secondary" onClick={saveName}>
        Simpan nama
      </button>
    </section>
  );
}
