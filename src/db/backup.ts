import { db, SCHEMA_VERSION, TABLE_NAMES, type EnglishMasteryDB, type TableName } from './db';

export const BACKUP_APP_ID = 'english-mastery';

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  /** Jumlah baris per tabel, untuk pengecekan cepat setelah impor. */
  counts: Record<TableName, number>;
  tables: Record<TableName, unknown[]>;
}

export class BackupError extends Error {}

/** Membaca seluruh data pengguna menjadi satu objek backup. */
export async function exportBackup(database: EnglishMasteryDB = db): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>;
  const counts = {} as Record<TableName, number>;
  await database.transaction('r', TABLE_NAMES.map((t) => database.table(t)), async () => {
    for (const name of TABLE_NAMES) {
      tables[name] = await database.table(name).toArray();
      counts[name] = tables[name].length;
    }
  });
  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts,
    tables,
  };
}

/**
 * Memeriksa apakah sebuah objek adalah file backup yang valid.
 * Melempar BackupError dengan pesan Bahasa Indonesia yang jelas jika tidak valid.
 */
export function validateBackup(data: unknown): BackupFile {
  if (typeof data !== 'object' || data === null) throw new BackupError('File bukan backup English Mastery (bukan objek JSON).');
  const b = data as Partial<BackupFile>;
  if (b.app !== BACKUP_APP_ID) throw new BackupError('File ini bukan backup English Mastery.');
  if (typeof b.schemaVersion !== 'number' || !Number.isInteger(b.schemaVersion) || b.schemaVersion < 1)
    throw new BackupError('Versi backup tidak dikenali.');
  if (b.schemaVersion > SCHEMA_VERSION)
    throw new BackupError(
      `Backup dibuat oleh versi aplikasi yang lebih baru (skema ${b.schemaVersion}). Perbarui aplikasi dulu, lalu impor lagi.`,
    );
  if (typeof b.tables !== 'object' || b.tables === null) throw new BackupError('Isi backup rusak: bagian "tables" tidak ada.');
  for (const name of TABLE_NAMES) {
    const rows = (b.tables as Record<string, unknown>)[name];
    if (rows === undefined) continue; // tabel baru boleh tidak ada di backup lama
    if (!Array.isArray(rows)) throw new BackupError(`Isi backup rusak: tabel "${name}" bukan daftar.`);
    for (const row of rows) {
      if (typeof row !== 'object' || row === null) throw new BackupError(`Isi backup rusak: ada baris tidak valid di "${name}".`);
    }
    const expected = b.counts?.[name];
    if (typeof expected === 'number' && expected !== rows.length)
      throw new BackupError(`Backup tidak lengkap: "${name}" seharusnya ${expected} baris, ditemukan ${rows.length}.`);
  }
  for (const name of Object.keys(b.tables)) {
    if (!(TABLE_NAMES as readonly string[]).includes(name)) throw new BackupError(`Tabel tidak dikenal di backup: "${name}".`);
  }
  return b as BackupFile;
}

export function parseBackupText(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('File tidak bisa dibaca sebagai JSON. Pastikan memilih file backup .json yang benar.');
  }
  return validateBackup(data);
}

/**
 * Mengganti SEMUA data dengan isi backup, dalam satu transaksi.
 * Jika ada satu saja yang gagal, tidak ada data yang berubah (rollback otomatis).
 */
export async function importBackup(backup: BackupFile, database: EnglishMasteryDB = db): Promise<Record<TableName, number>> {
  const valid = validateBackup(backup);
  const imported = {} as Record<TableName, number>;
  await database.transaction('rw', TABLE_NAMES.map((t) => database.table(t)), async () => {
    for (const name of TABLE_NAMES) {
      const rows = valid.tables[name] ?? [];
      await database.table(name).clear();
      if (rows.length) await database.table(name).bulkAdd(rows);
      imported[name] = rows.length;
    }
  });
  return imported;
}

export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `english-mastery-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}.json`;
}

/** Mengunduh backup sebagai file .json ke perangkat, lalu mencatat waktu backup. */
export async function downloadBackup(database: EnglishMasteryDB = db): Promise<string> {
  const backup = await exportBackup(database);
  // Catat waktu backup DI DALAM file juga, supaya setelah restore info "backup terakhir" tetap benar.
  const now = Date.now();
  const profileRow = backup.tables.profile[0] as { lastBackupAt?: number | null } | undefined;
  if (profileRow) profileRow.lastBackupAt = now;
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const name = backupFileName();
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  await database.profile.update(1, { lastBackupAt: now, updatedAt: now });
  return name;
}
