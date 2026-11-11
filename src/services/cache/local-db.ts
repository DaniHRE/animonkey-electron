import type { AnimeTitle, WatchLaterItem } from '@/types/anime';

const DATABASE_NAME = 'animonkey-desktop';
const DATABASE_VERSION = 3;
const WATCH_LATER_STORE = 'watch-later';
const CATALOG_CACHE_STORE = 'catalog-cache';
const EPISODE_PROGRESS_STORE = 'episode-progress';
const PREFERENCES_STORE = 'preferences';

interface CacheRecord {
  cacheKey: string;
  expiresAt: number;
  value: unknown;
}

export interface EpisodeProgressRecord {
  key: string;
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  currentTime: number;
  duration: number;
  percentage: number;
  completed: boolean;
  updatedAt: number;
}

export interface LocalPreference<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
}

export interface LocalBackup {
  schemaVersion: 1;
  exportedAt: string;
  watchLater: WatchLaterItem[];
  episodeProgress: EpisodeProgressRecord[];
  preferences: LocalPreference[];
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('O banco local está ocupado.'));
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WATCH_LATER_STORE)) {
        database.createObjectStore(WATCH_LATER_STORE, { keyPath: 'animeId' });
      }
      if (!database.objectStoreNames.contains(CATALOG_CACHE_STORE)) {
        database.createObjectStore(CATALOG_CACHE_STORE, {
          keyPath: 'cacheKey',
        });
      }
      if (!database.objectStoreNames.contains(EPISODE_PROGRESS_STORE)) {
        const progress = database.createObjectStore(EPISODE_PROGRESS_STORE, {
          keyPath: 'key',
        });
        progress.createIndex('animeId', 'animeId', { unique: false });
        progress.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!database.objectStoreNames.contains(PREFERENCES_STORE)) {
        database.createObjectStore(PREFERENCES_STORE, { keyPath: 'key' });
      }
    };
  });
  const cached = pending.catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  databasePromise = cached;
  return cached;
}

export async function getEpisodeProgress(
  animeId: string,
  episodeNumber: number,
): Promise<EpisodeProgressRecord | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(EPISODE_PROGRESS_STORE, 'readonly')
      .objectStore(EPISODE_PROGRESS_STORE)
      .get(`${animeId}:${episodeNumber}`);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? null);
  });
}

export async function saveEpisodeProgress(record: {
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  currentTime: number;
  duration: number;
}): Promise<void> {
  if (
    !/^\d+$/.test(record.animeId) ||
    !record.episodeId ||
    !Number.isSafeInteger(record.episodeNumber) ||
    record.episodeNumber < 0 ||
    !Number.isFinite(record.currentTime) ||
    !Number.isFinite(record.duration) ||
    record.duration <= 0
  ) {
    throw new Error('Dados de progresso inválidos.');
  }
  const currentTime = Math.max(
    0,
    Math.min(record.currentTime, record.duration),
  );
  const percentage = (currentTime / record.duration) * 100;
  const value: EpisodeProgressRecord = {
    ...record,
    key: `${record.animeId}:${record.episodeNumber}`,
    currentTime,
    percentage,
    completed: percentage >= 90,
    updatedAt: Date.now(),
  };
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      EPISODE_PROGRESS_STORE,
      'readwrite',
    );
    transaction.objectStore(EPISODE_PROGRESS_STORE).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getRecentlyWatched(
  limit = 20,
): Promise<EpisodeProgressRecord[]> {
  const database = await openDatabase();
  const records = await new Promise<EpisodeProgressRecord[]>(
    (resolve, reject) => {
      const request = database
        .transaction(EPISODE_PROGRESS_STORE, 'readonly')
        .objectStore(EPISODE_PROGRESS_STORE)
        .getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    },
  );
  const latestByAnime = new Map<string, EpisodeProgressRecord>();
  for (const record of records) {
    if (record.completed) continue;
    const existing = latestByAnime.get(record.animeId);
    if (!existing || existing.updatedAt < record.updatedAt) {
      latestByAnime.set(record.animeId, record);
    }
  }
  return [...latestByAnime.values()]
    .sort((first, second) => second.updatedAt - first.updatedAt)
    .slice(0, Math.max(0, limit));
}

export async function removeAnimeFromWatching(animeId: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      EPISODE_PROGRESS_STORE,
      'readwrite',
    );
    const index = transaction
      .objectStore(EPISODE_PROGRESS_STORE)
      .index('animeId');
    const request = index.openKeyCursor(IDBKeyRange.only(animeId));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getPreference<T>(key: string): Promise<T | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(PREFERENCES_STORE, 'readonly')
      .objectStore(PREFERENCES_STORE)
      .get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(
        (request.result as LocalPreference<T> | undefined)?.value ?? null,
      );
  });
}

export async function putPreference<T>(key: string, value: T): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PREFERENCES_STORE, 'readwrite');
    transaction.objectStore(PREFERENCES_STORE).put({
      key,
      value,
      updatedAt: Date.now(),
    } satisfies LocalPreference<T>);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function exportLocalBackup(): Promise<LocalBackup> {
  const database = await openDatabase();
  const readStore = <T>(storeName: string): Promise<T[]> =>
    new Promise((resolve, reject) => {
      const request = database
        .transaction(storeName, 'readonly')
        .objectStore(storeName)
        .getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as T[]);
    });
  const [watchLater, episodeProgress, preferences] = await Promise.all([
    readStore<WatchLaterItem>(WATCH_LATER_STORE),
    readStore<EpisodeProgressRecord>(EPISODE_PROGRESS_STORE),
    readStore<LocalPreference>(PREFERENCES_STORE),
  ]);
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    watchLater,
    episodeProgress,
    preferences,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAnimeTitle(value: unknown): value is AnimeTitle {
  return (
    isRecord(value) &&
    ['english', 'romaji', 'native'].every(
      (key) =>
        value[key] === undefined ||
        value[key] === null ||
        typeof value[key] === 'string',
    )
  );
}

function isWatchLaterItem(value: unknown): value is WatchLaterItem {
  return (
    isRecord(value) &&
    typeof value.animeId === 'string' &&
    /^\d+$/.test(value.animeId) &&
    isAnimeTitle(value.title) &&
    ['image', 'type'].every(
      (key) => value[key] === undefined || typeof value[key] === 'string',
    ) &&
    (value.totalEpisodes === undefined ||
      (typeof value.totalEpisodes === 'number' &&
        Number.isSafeInteger(value.totalEpisodes) &&
        value.totalEpisodes >= 0)) &&
    (value.releaseDate === undefined ||
      (typeof value.releaseDate === 'number' &&
        Number.isFinite(value.releaseDate))) &&
    Array.isArray(value.genres) &&
    value.genres.every((genre) => typeof genre === 'string') &&
    typeof value.addedAt === 'number' &&
    Number.isFinite(value.addedAt)
  );
}

function isEpisodeProgress(value: unknown): value is EpisodeProgressRecord {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.animeId === 'string' &&
    typeof value.episodeId === 'string' &&
    typeof value.episodeNumber === 'number' &&
    typeof value.currentTime === 'number' &&
    typeof value.duration === 'number' &&
    typeof value.percentage === 'number' &&
    typeof value.completed === 'boolean' &&
    typeof value.updatedAt === 'number' &&
    value.key === `${value.animeId}:${value.episodeNumber}` &&
    /^\d+$/.test(value.animeId) &&
    Number.isSafeInteger(value.episodeNumber) &&
    value.episodeNumber >= 0 &&
    [
      value.currentTime,
      value.duration,
      value.percentage,
      value.updatedAt,
    ].every(Number.isFinite) &&
    value.duration > 0 &&
    value.currentTime >= 0 &&
    value.currentTime <= value.duration &&
    value.percentage >= 0 &&
    value.percentage <= 100
  );
}

export async function importLocalBackup(text: string): Promise<number> {
  if (text.length > 5_000_000)
    throw new Error('O arquivo de backup excede 5 MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('O arquivo selecionado não contém JSON válido.');
  }
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== 1 ||
    typeof parsed.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(parsed.exportedAt))
  ) {
    throw new Error('A versão deste backup não é compatível.');
  }
  const watchLater = parsed.watchLater;
  const episodeProgress = parsed.episodeProgress;
  const preferences = parsed.preferences;
  if (
    !Array.isArray(watchLater) ||
    !watchLater.every(isWatchLaterItem) ||
    !Array.isArray(episodeProgress) ||
    !episodeProgress.every(isEpisodeProgress) ||
    !Array.isArray(preferences) ||
    !preferences.every(
      (item) =>
        isRecord(item) &&
        item.key === 'player.subtitle-size' &&
        ['small', 'medium', 'large', 'xlarge'].includes(String(item.value)) &&
        typeof item.updatedAt === 'number' &&
        Number.isFinite(item.updatedAt),
    )
  ) {
    throw new Error(
      'O backup contém registros inválidos. Nenhum dado foi importado.',
    );
  }

  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [WATCH_LATER_STORE, EPISODE_PROGRESS_STORE, PREFERENCES_STORE],
      'readwrite',
    );
    let mergedCount = 0;
    const mergeIfNewer = <T extends { updatedAt?: number; addedAt?: number }>(
      store: IDBObjectStore,
      item: T,
      key: IDBValidKey,
      timestamp: 'updatedAt' | 'addedAt',
    ) => {
      const request = store.get(key);
      request.onerror = () => transaction.abort();
      request.onsuccess = () => {
        const existing = request.result as T | undefined;
        const currentTime = existing?.[timestamp] ?? 0;
        const importedTime = item[timestamp] ?? 0;
        if (!existing || importedTime >= currentTime) {
          store.put(item);
          mergedCount += 1;
        }
      };
    };
    const watchStore = transaction.objectStore(WATCH_LATER_STORE);
    const progressStore = transaction.objectStore(EPISODE_PROGRESS_STORE);
    const preferenceStore = transaction.objectStore(PREFERENCES_STORE);
    for (const item of watchLater) {
      mergeIfNewer(watchStore, item, item.animeId, 'addedAt');
    }
    for (const item of episodeProgress) {
      mergeIfNewer(progressStore, item, item.key, 'updatedAt');
    }
    for (const item of preferences as LocalPreference[]) {
      mergeIfNewer(preferenceStore, item, item.key, 'updatedAt');
    }
    transaction.oncomplete = () => resolve(mergedCount);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getCatalogCache<T>(
  cacheKey: string,
): Promise<{ value: T; isFresh: boolean } | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(CATALOG_CACHE_STORE, 'readonly')
      .objectStore(CATALOG_CACHE_STORE)
      .get(cacheKey);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const record = request.result as CacheRecord | undefined;
      resolve(
        record
          ? { value: record.value as T, isFresh: record.expiresAt > Date.now() }
          : null,
      );
    };
  });
}

export async function putCatalogCache<T>(
  cacheKey: string,
  value: T,
  ttlMs: number,
): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CATALOG_CACHE_STORE, 'readwrite');
    transaction.objectStore(CATALOG_CACHE_STORE).put({
      cacheKey,
      value,
      expiresAt: Date.now() + ttlMs,
    } satisfies CacheRecord);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getAllWatchLater(): Promise<WatchLaterItem[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(WATCH_LATER_STORE, 'readonly')
      .objectStore(WATCH_LATER_STORE)
      .getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(
        (request.result as WatchLaterItem[]).sort(
          (first, second) => second.addedAt - first.addedAt,
        ),
      );
  });
}

export async function putWatchLater(item: WatchLaterItem): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WATCH_LATER_STORE, 'readwrite');
    transaction.objectStore(WATCH_LATER_STORE).put(item);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function deleteWatchLater(animeId: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(WATCH_LATER_STORE, 'readwrite');
    transaction.objectStore(WATCH_LATER_STORE).delete(animeId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
