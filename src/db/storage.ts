/**
 * Penyimpanan persisten: meminta browser agar data aplikasi TIDAK dihapus otomatis
 * saat memori perangkat menipis. Aplikasi PWA yang terpasang biasanya diberi izin ini.
 */
export interface StorageStatus {
  supported: boolean;
  persisted: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const supported = !!navigator.storage?.estimate;
  if (!supported) return { supported, persisted: false, usageBytes: null, quotaBytes: null };
  try {
    const [estimate, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
    ]);
    return { supported, persisted, usageBytes: estimate.usage ?? null, quotaBytes: estimate.quota ?? null };
  } catch {
    return { supported, persisted: false, usageBytes: null, quotaBytes: null };
  }
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'tidak diketahui';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/** Mengenali error "penyimpanan penuh" dari IndexedDB/Dexie. */
export function isQuotaError(e: unknown): boolean {
  const err = e as { name?: string; inner?: { name?: string } } | null;
  const name = err?.name ?? '';
  const inner = err?.inner?.name ?? '';
  return name === 'QuotaExceededError' || inner === 'QuotaExceededError' || name === 'QuotaExceeded';
}
