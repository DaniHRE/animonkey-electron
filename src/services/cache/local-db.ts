import type { AnimeRating, AnimeTitle, WatchLaterItem } from '@/types/anime';

const DATABASE_NAME = 'animonkey-desktop';
const DATABASE_VERSION = 6;
const WATCH_LATER_STORE = 'watch-later';
const CATALOG_CACHE_STORE = 'catalog-cache';
const EPISODE_PROGRESS_STORE = 'episode-progress';
const PREFERENCES_STORE = 'preferences';
const SYNC_TOMBSTONE_STORE = 'sync-tombstones';
const ANIME_RATING_STORE = 'anime-ratings';
const CATALOG_CACHE_STALE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const GUEST_SCOPE_ID = 'guest';

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

export type SyncEntity = 'watch-later' | 'episode-progress' | 'anime-rating';

export interface LocalSyncTombstone {
  entity: SyncEntity;
  recordKey: string;
  deletedAt: number;
}

interface ScopedRecord {
  scopeId: string;
}

type ScopedWatchLater = WatchLaterItem & ScopedRecord;
type ScopedEpisodeProgress = EpisodeProgressRecord & ScopedRecord;
type ScopedAnimeRating = AnimeRating & ScopedRecord;
type StoredSyncTombstone = LocalSyncTombstone & { scopeId: string };

function withoutScope<T extends ScopedRecord>(record: T): Omit<T, 'scopeId'> {
  const value = { ...record };
  Reflect.deleteProperty(value, 'scopeId');
  return value as Omit<T, 'scopeId'>;
}

export interface LocalPreference<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
}

export interface LocalBackup {
  schemaVersion: 2;
  exportedAt: string;
  watchLater: WatchLaterItem[];
  episodeProgress: EpisodeProgressRecord[];
  ratings: AnimeRating[];
  preferences: LocalPreference[];
}

let databasePromise: Promise<IDBDatabase> | null = null;
let activeScopeId = GUEST_SCOPE_ID;

export function setActiveLocalDataScope(scopeId: string | null): void {
  const nextScope = scopeId ?? GUEST_SCOPE_ID;
  if (activeScopeId === nextScope) return;
  activeScopeId = nextScope;
  window.dispatchEvent(new Event('animonkey:local-scope-changed'));
}

function notifyLocalDataChanged(entity?: SyncEntity): void {
  window.dispatchEvent(
    new CustomEvent('animonkey:local-data-changed', {
      detail: entity ? { entity } : undefined,
    }),
  );
}

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
    request.onupgradeneeded = (event) => {
      const database = request.result;
      const oldVersion = event.oldVersion;
      if (!database.objectStoreNames.contains(WATCH_LATER_STORE)) {
        database.createObjectStore(WATCH_LATER_STORE, {
          keyPath: ['scopeId', 'animeId'],
        });
      } else if (oldVersion < 5) {
        const legacyStore = request.transaction!.objectStore(WATCH_LATER_STORE);
        const readLegacyRecords = legacyStore.getAll();
        readLegacyRecords.onsuccess = () => {
          const records = readLegacyRecords.result as WatchLaterItem[];
          database.deleteObjectStore(WATCH_LATER_STORE);
          const scopedStore = database.createObjectStore(WATCH_LATER_STORE, {
            keyPath: ['scopeId', 'animeId'],
          });
          for (const record of records) {
            scopedStore.put({ ...record, scopeId: GUEST_SCOPE_ID });
          }
        };
      }
      if (!database.objectStoreNames.contains(CATALOG_CACHE_STORE)) {
        database.createObjectStore(CATALOG_CACHE_STORE, {
          keyPath: 'cacheKey',
        });
      }
      const catalogCache =
        request.transaction?.objectStore(CATALOG_CACHE_STORE);
      if (catalogCache && !catalogCache.indexNames.contains('expiresAt')) {
        catalogCache.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
      if (!database.objectStoreNames.contains(EPISODE_PROGRESS_STORE)) {
        const progress = database.createObjectStore(EPISODE_PROGRESS_STORE, {
          keyPath: ['scopeId', 'key'],
        });
        progress.createIndex('animeId', 'animeId', { unique: false });
        progress.createIndex('updatedAt', 'updatedAt', { unique: false });
      } else if (oldVersion < 5) {
        const legacyStore = request.transaction!.objectStore(
          EPISODE_PROGRESS_STORE,
        );
        const readLegacyRecords = legacyStore.getAll();
        readLegacyRecords.onsuccess = () => {
          const records = readLegacyRecords.result as EpisodeProgressRecord[];
          database.deleteObjectStore(EPISODE_PROGRESS_STORE);
          const scopedStore = database.createObjectStore(
            EPISODE_PROGRESS_STORE,
            { keyPath: ['scopeId', 'key'] },
          );
          scopedStore.createIndex('animeId', 'animeId', { unique: false });
          scopedStore.createIndex('updatedAt', 'updatedAt', {
            unique: false,
          });
          for (const record of records) {
            scopedStore.put({ ...record, scopeId: GUEST_SCOPE_ID });
          }
        };
      }
      if (!database.objectStoreNames.contains(PREFERENCES_STORE)) {
        database.createObjectStore(PREFERENCES_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(SYNC_TOMBSTONE_STORE)) {
        database.createObjectStore(SYNC_TOMBSTONE_STORE, {
          keyPath: ['scopeId', 'entity', 'recordKey'],
        });
      }
      if (!database.objectStoreNames.contains(ANIME_RATING_STORE)) {
        const ratings = database.createObjectStore(ANIME_RATING_STORE, {
          keyPath: ['scopeId', 'animeId'],
        });
        ratings.createIndex('updatedAt', 'updatedAt', { unique: false });
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
      .get([activeScopeId, `${animeId}:${episodeNumber}`]);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const record = request.result as ScopedEpisodeProgress | undefined;
      if (!record) resolve(null);
      else {
        resolve(withoutScope(record));
      }
    };
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
      [EPISODE_PROGRESS_STORE, SYNC_TOMBSTONE_STORE],
      'readwrite',
    );
    transaction.objectStore(EPISODE_PROGRESS_STORE).put({
      ...value,
      scopeId: activeScopeId,
    });
    transaction
      .objectStore(SYNC_TOMBSTONE_STORE)
      .delete([activeScopeId, 'episode-progress', record.animeId]);
    transaction.oncomplete = () => {
      notifyLocalDataChanged('episode-progress');
      resolve();
    };
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
      request.onsuccess = () =>
        resolve(
          (request.result as ScopedEpisodeProgress[])
            .filter((record) => record.scopeId === activeScopeId)
            .map(withoutScope),
        );
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
      [EPISODE_PROGRESS_STORE, SYNC_TOMBSTONE_STORE],
      'readwrite',
    );
    const index = transaction
      .objectStore(EPISODE_PROGRESS_STORE)
      .index('animeId');
    const request = index.openCursor(IDBKeyRange.only(animeId));
    const tombstones = transaction.objectStore(SYNC_TOMBSTONE_STORE);
    const tombstoneKey: IDBValidKey = [
      activeScopeId,
      'episode-progress',
      animeId,
    ];
    const existingRequest = tombstones.get(tombstoneKey);
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result as
        StoredSyncTombstone | undefined;
      tombstones.put({
        scopeId: activeScopeId,
        entity: 'episode-progress',
        recordKey: animeId,
        deletedAt: Math.max(Date.now(), existing?.deletedAt ?? 0),
      } satisfies StoredSyncTombstone);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const record = cursor.value as ScopedEpisodeProgress;
      if (record.scopeId === activeScopeId) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => {
      notifyLocalDataChanged('episode-progress');
      resolve();
    };
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
      request.onsuccess = () => {
        const records = request.result as (T & Partial<ScopedRecord>)[];
        resolve(
          records
            .filter(
              (record) =>
                !('scopeId' in record) || record.scopeId === activeScopeId,
            )
            .map((record) =>
              'scopeId' in record
                ? (withoutScope(record as T & ScopedRecord) as T)
                : (record as T),
            ),
        );
      };
    });
  const [watchLater, episodeProgress, ratings, preferences] = await Promise.all(
    [
      readStore<WatchLaterItem>(WATCH_LATER_STORE),
      readStore<EpisodeProgressRecord>(EPISODE_PROGRESS_STORE),
      readStore<AnimeRating>(ANIME_RATING_STORE),
      readStore<LocalPreference>(PREFERENCES_STORE),
    ],
  );
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    watchLater,
    episodeProgress,
    ratings,
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

function isAnimeRating(value: unknown): value is AnimeRating {
  return (
    isRecord(value) &&
    typeof value.animeId === 'string' &&
    /^\d+$/.test(value.animeId) &&
    typeof value.score === 'number' &&
    Number.isInteger(value.score) &&
    value.score >= 1 &&
    value.score <= 10 &&
    (value.review === null ||
      (typeof value.review === 'string' && value.review.length <= 2000)) &&
    typeof value.updatedAt === 'number' &&
    Number.isFinite(value.updatedAt)
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
    ![1, 2].includes(parsed.schemaVersion as number) ||
    typeof parsed.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(parsed.exportedAt))
  ) {
    throw new Error('A versão deste backup não é compatível.');
  }
  const watchLater = parsed.watchLater;
  const episodeProgress = parsed.episodeProgress;
  const ratings = parsed.ratings ?? [];
  const preferences = parsed.preferences;
  if (
    !Array.isArray(watchLater) ||
    !watchLater.every(isWatchLaterItem) ||
    !Array.isArray(episodeProgress) ||
    !episodeProgress.every(isEpisodeProgress) ||
    (parsed.schemaVersion === 2 && !Array.isArray(parsed.ratings)) ||
    !Array.isArray(ratings) ||
    !ratings.every(isAnimeRating) ||
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
      [
        WATCH_LATER_STORE,
        EPISODE_PROGRESS_STORE,
        ANIME_RATING_STORE,
        PREFERENCES_STORE,
      ],
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
    const ratingStore = transaction.objectStore(ANIME_RATING_STORE);
    const preferenceStore = transaction.objectStore(PREFERENCES_STORE);
    for (const item of watchLater) {
      mergeIfNewer(
        watchStore,
        { ...item, scopeId: activeScopeId },
        [activeScopeId, item.animeId],
        'addedAt',
      );
    }
    for (const item of episodeProgress) {
      mergeIfNewer(
        progressStore,
        { ...item, scopeId: activeScopeId },
        [activeScopeId, item.key],
        'updatedAt',
      );
    }
    for (const item of ratings as AnimeRating[]) {
      mergeIfNewer(
        ratingStore,
        { ...item, scopeId: activeScopeId },
        [activeScopeId, item.animeId],
        'updatedAt',
      );
    }
    for (const item of preferences as LocalPreference[]) {
      mergeIfNewer(preferenceStore, item, item.key, 'updatedAt');
    }
    transaction.oncomplete = () => {
      notifyLocalDataChanged();
      resolve(mergedCount);
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getCatalogCache<T>(
  cacheKey: string,
): Promise<{ value: T; isFresh: boolean; expiresAt: number } | null> {
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
          ? {
              value: record.value as T,
              isFresh: record.expiresAt > Date.now(),
              expiresAt: record.expiresAt,
            }
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
  return putCatalogCacheUntil(cacheKey, value, Date.now() + Math.max(0, ttlMs));
}

export async function putCatalogCacheUntil<T>(
  cacheKey: string,
  value: T,
  expiresAt: number,
): Promise<void> {
  if (!Number.isFinite(expiresAt)) {
    throw new Error('Cache expiration must be a finite timestamp.');
  }
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(CATALOG_CACHE_STORE, 'readwrite');
    const store = transaction.objectStore(CATALOG_CACHE_STORE);
    const staleCutoff = Date.now() - CATALOG_CACHE_STALE_RETENTION_MS;
    const cursorRequest = store
      .index('expiresAt')
      .openKeyCursor(IDBKeyRange.upperBound(staleCutoff));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      if (cursor.primaryKey !== cacheKey) cursor.delete();
      cursor.continue();
    };
    cursorRequest.onerror = () => transaction.abort();
    store.put({
      cacheKey,
      value,
      expiresAt,
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
        (request.result as ScopedWatchLater[])
          .filter((record) => record.scopeId === activeScopeId)
          .map(withoutScope)
          .sort((first, second) => second.addedAt - first.addedAt),
      );
  });
}

export async function getAllAnimeRatings(): Promise<AnimeRating[]> {
  const database = await openDatabase();
  return await new Promise((resolve, reject) => {
    const request = database
      .transaction(ANIME_RATING_STORE, 'readonly')
      .objectStore(ANIME_RATING_STORE)
      .getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(
        (request.result as ScopedAnimeRating[])
          .filter((record) => record.scopeId === activeScopeId)
          .map(withoutScope)
          .sort((a, b) => b.updatedAt - a.updatedAt),
      );
  });
}

export async function getAnimeRating(
  animeId: string,
): Promise<AnimeRating | null> {
  const database = await openDatabase();
  const request = database
    .transaction(ANIME_RATING_STORE, 'readonly')
    .objectStore(ANIME_RATING_STORE)
    .get([activeScopeId, animeId]);
  const record = (await requestResult(request)) as
    ScopedAnimeRating | undefined;
  return record ? withoutScope(record) : null;
}

export async function putAnimeRating(rating: AnimeRating): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [ANIME_RATING_STORE, SYNC_TOMBSTONE_STORE],
    'readwrite',
  );
  transaction
    .objectStore(ANIME_RATING_STORE)
    .put({ ...rating, scopeId: activeScopeId } satisfies ScopedAnimeRating);
  transaction
    .objectStore(SYNC_TOMBSTONE_STORE)
    .delete([activeScopeId, 'anime-rating', rating.animeId]);
  await transactionDone(transaction);
  notifyLocalDataChanged('anime-rating');
}

export async function deleteAnimeRating(animeId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [ANIME_RATING_STORE, SYNC_TOMBSTONE_STORE],
    'readwrite',
  );
  const tombstones = transaction.objectStore(SYNC_TOMBSTONE_STORE);
  const request = tombstones.get([activeScopeId, 'anime-rating', animeId]);
  request.onsuccess = () => {
    const current = request.result as StoredSyncTombstone | undefined;
    tombstones.put({
      scopeId: activeScopeId,
      entity: 'anime-rating',
      recordKey: animeId,
      deletedAt: Math.max(Date.now(), current?.deletedAt ?? 0),
    } satisfies StoredSyncTombstone);
  };
  transaction.objectStore(ANIME_RATING_STORE).delete([activeScopeId, animeId]);
  await transactionDone(transaction);
  notifyLocalDataChanged('anime-rating');
}

export async function getAnimeRatingsSyncData(): Promise<{
  ratings: AnimeRating[];
  tombstones: LocalSyncTombstone[];
}> {
  return {
    ratings: await getAllAnimeRatings(),
    tombstones: await getSyncTombstones('anime-rating'),
  };
}

export async function applyRemoteAnimeRating(
  rating: AnimeRating,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [ANIME_RATING_STORE, SYNC_TOMBSTONE_STORE],
    'readwrite',
  );
  transaction
    .objectStore(ANIME_RATING_STORE)
    .put({ ...rating, scopeId: activeScopeId } satisfies ScopedAnimeRating);
  transaction
    .objectStore(SYNC_TOMBSTONE_STORE)
    .delete([activeScopeId, 'anime-rating', rating.animeId]);
  await transactionDone(transaction);
}

export async function applyRemoteAnimeRatingDeletion(
  animeId: string,
  deletedAt: number,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [ANIME_RATING_STORE, SYNC_TOMBSTONE_STORE],
    'readwrite',
  );
  const ratings = transaction.objectStore(ANIME_RATING_STORE);
  const tombstones = transaction.objectStore(SYNC_TOMBSTONE_STORE);
  const tombstoneRequest = tombstones.get([
    activeScopeId,
    'anime-rating',
    animeId,
  ]);
  tombstoneRequest.onsuccess = () => {
    const current = tombstoneRequest.result as StoredSyncTombstone | undefined;
    tombstones.put({
      scopeId: activeScopeId,
      entity: 'anime-rating',
      recordKey: animeId,
      deletedAt: Math.max(deletedAt, current?.deletedAt ?? 0),
    } satisfies StoredSyncTombstone);
  };
  const ratingRequest = ratings.get([activeScopeId, animeId]);
  ratingRequest.onsuccess = () => {
    const existing = ratingRequest.result as ScopedAnimeRating | undefined;
    if (existing && existing.updatedAt <= deletedAt)
      ratings.delete([activeScopeId, animeId]);
  };
  await transactionDone(transaction);
}

export async function putWatchLater(item: WatchLaterItem): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [WATCH_LATER_STORE, SYNC_TOMBSTONE_STORE],
      'readwrite',
    );
    transaction.objectStore(WATCH_LATER_STORE).put({
      ...item,
      scopeId: activeScopeId,
    } satisfies ScopedWatchLater);
    transaction
      .objectStore(SYNC_TOMBSTONE_STORE)
      .delete([activeScopeId, 'watch-later', item.animeId]);
    transaction.oncomplete = () => {
      notifyLocalDataChanged('watch-later');
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function deleteWatchLater(animeId: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [WATCH_LATER_STORE, SYNC_TOMBSTONE_STORE],
      'readwrite',
    );
    const store = transaction.objectStore(WATCH_LATER_STORE);
    const tombstones = transaction.objectStore(SYNC_TOMBSTONE_STORE);
    const existingRequest = tombstones.get([
      activeScopeId,
      'watch-later',
      animeId,
    ]);
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result as
        StoredSyncTombstone | undefined;
      tombstones.put({
        scopeId: activeScopeId,
        entity: 'watch-later',
        recordKey: animeId,
        deletedAt: Math.max(Date.now(), existing?.deletedAt ?? 0),
      } satisfies StoredSyncTombstone);
    };
    store.delete([activeScopeId, animeId]);
    transaction.oncomplete = () => {
      notifyLocalDataChanged('watch-later');
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getWatchLaterSyncData(): Promise<{
  items: WatchLaterItem[];
  tombstones: LocalSyncTombstone[];
}> {
  const [items, tombstones] = await Promise.all([
    getAllWatchLater(),
    getSyncTombstones('watch-later'),
  ]);
  return { items, tombstones };
}

export async function getEpisodeProgressSyncData(): Promise<{
  records: EpisodeProgressRecord[];
  tombstones: LocalSyncTombstone[];
}> {
  const database = await openDatabase();
  const [records, tombstones] = await Promise.all([
    new Promise<EpisodeProgressRecord[]>((resolve, reject) => {
      const request = database
        .transaction(EPISODE_PROGRESS_STORE, 'readonly')
        .objectStore(EPISODE_PROGRESS_STORE)
        .getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () =>
        resolve(
          (request.result as ScopedEpisodeProgress[])
            .filter((record) => record.scopeId === activeScopeId)
            .map(withoutScope),
        );
    }),
    getSyncTombstones('episode-progress'),
  ]);
  return { records, tombstones };
}

export async function mergeGuestLibraryIntoActiveScope(): Promise<number> {
  if (activeScopeId === GUEST_SCOPE_ID) return 0;
  const database = await openDatabase();
  const readTransaction = database.transaction(
    [WATCH_LATER_STORE, EPISODE_PROGRESS_STORE, SYNC_TOMBSTONE_STORE],
    'readonly',
  );
  const readDone = transactionDone(readTransaction);
  const [allWatch, allProgress, allTombstones] = await Promise.all([
    requestResult(readTransaction.objectStore(WATCH_LATER_STORE).getAll()),
    requestResult(readTransaction.objectStore(EPISODE_PROGRESS_STORE).getAll()),
    requestResult(readTransaction.objectStore(SYNC_TOMBSTONE_STORE).getAll()),
  ]);
  await readDone;
  const transaction = database.transaction(
    [WATCH_LATER_STORE, EPISODE_PROGRESS_STORE, SYNC_TOMBSTONE_STORE],
    'readwrite',
  );
  const transactionComplete = transactionDone(transaction);
  const watchStore = transaction.objectStore(WATCH_LATER_STORE);
  const progressStore = transaction.objectStore(EPISODE_PROGRESS_STORE);
  const tombstoneStore = transaction.objectStore(SYNC_TOMBSTONE_STORE);
  const watchById = new Map(
    (allWatch as ScopedWatchLater[])
      .filter((record) => record.scopeId === activeScopeId)
      .map((record) => [record.animeId, record]),
  );
  const progressByKey = new Map(
    (allProgress as ScopedEpisodeProgress[])
      .filter((record) => record.scopeId === activeScopeId)
      .map((record) => [record.key, record]),
  );
  const tombstones = allTombstones as StoredSyncTombstone[];
  let merged = 0;

  for (const guestItem of (allWatch as ScopedWatchLater[]).filter(
    (record) => record.scopeId === GUEST_SCOPE_ID,
  )) {
    const existing = watchById.get(guestItem.animeId);
    const deletedAt = tombstones.find(
      (tombstone) =>
        tombstone.scopeId === activeScopeId &&
        tombstone.entity === 'watch-later' &&
        tombstone.recordKey === guestItem.animeId,
    )?.deletedAt;
    if (
      (!existing || guestItem.addedAt > existing.addedAt) &&
      (deletedAt === undefined || guestItem.addedAt > deletedAt)
    ) {
      watchStore.put({ ...guestItem, scopeId: activeScopeId });
      tombstoneStore.delete([activeScopeId, 'watch-later', guestItem.animeId]);
      watchById.set(guestItem.animeId, guestItem);
      merged += 1;
    }
  }

  for (const guestRecord of (allProgress as ScopedEpisodeProgress[]).filter(
    (record) => record.scopeId === GUEST_SCOPE_ID,
  )) {
    const existing = progressByKey.get(guestRecord.key);
    const deletedAt = tombstones.find(
      (tombstone) =>
        tombstone.scopeId === activeScopeId &&
        tombstone.entity === 'episode-progress' &&
        tombstone.recordKey === guestRecord.animeId,
    )?.deletedAt;
    if (
      (!existing || guestRecord.updatedAt > existing.updatedAt) &&
      (deletedAt === undefined || guestRecord.updatedAt > deletedAt)
    ) {
      progressStore.put({ ...guestRecord, scopeId: activeScopeId });
      tombstoneStore.delete([
        activeScopeId,
        'episode-progress',
        guestRecord.animeId,
      ]);
      progressByKey.set(guestRecord.key, guestRecord);
      merged += 1;
    }
  }

  await transactionComplete;
  return merged;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSyncTombstones(
  entity: SyncEntity,
): Promise<LocalSyncTombstone[]> {
  const database = await openDatabase();
  return await new Promise((resolve, reject) => {
    const request = database
      .transaction(SYNC_TOMBSTONE_STORE, 'readonly')
      .objectStore(SYNC_TOMBSTONE_STORE)
      .getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(
        (request.result as StoredSyncTombstone[])
          .filter(
            (tombstone) =>
              tombstone.scopeId === activeScopeId &&
              tombstone.entity === entity,
          )
          .map(withoutScope),
      );
  });
}

export async function applyRemoteWatchLater(
  item: WatchLaterItem,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [WATCH_LATER_STORE, SYNC_TOMBSTONE_STORE],
    'readwrite',
  );
  transaction.objectStore(WATCH_LATER_STORE).put({
    ...item,
    scopeId: activeScopeId,
  } satisfies ScopedWatchLater);
  transaction
    .objectStore(SYNC_TOMBSTONE_STORE)
    .delete([activeScopeId, 'watch-later', item.animeId]);
  await transactionDone(transaction);
}

export async function applyRemoteWatchLaterDeletion(
  animeId: string,
  deletedAt: number,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [WATCH_LATER_STORE, SYNC_TOMBSTONE_STORE],
    'readwrite',
  );
  const watchStore = transaction.objectStore(WATCH_LATER_STORE);
  const tombstones = transaction.objectStore(SYNC_TOMBSTONE_STORE);
  const getTombstone = tombstones.get([activeScopeId, 'watch-later', animeId]);
  getTombstone.onsuccess = () => {
    const existing = getTombstone.result as StoredSyncTombstone | undefined;
    tombstones.put({
      scopeId: activeScopeId,
      entity: 'watch-later',
      recordKey: animeId,
      deletedAt: Math.max(deletedAt, existing?.deletedAt ?? 0),
    } satisfies StoredSyncTombstone);
  };
  const getItem = watchStore.get([activeScopeId, animeId]);
  getItem.onsuccess = () => {
    const existing = getItem.result as ScopedWatchLater | undefined;
    if (existing && existing.addedAt <= deletedAt) {
      watchStore.delete([activeScopeId, animeId]);
    }
  };
  await transactionDone(transaction);
}

export async function applyRemoteEpisodeProgress(
  record: EpisodeProgressRecord,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [EPISODE_PROGRESS_STORE, SYNC_TOMBSTONE_STORE],
    'readwrite',
  );
  transaction.objectStore(EPISODE_PROGRESS_STORE).put({
    ...record,
    scopeId: activeScopeId,
  } satisfies ScopedEpisodeProgress);
  transaction
    .objectStore(SYNC_TOMBSTONE_STORE)
    .delete([activeScopeId, 'episode-progress', record.animeId]);
  await transactionDone(transaction);
}

export async function applyRemoteEpisodeProgressDeletion(
  animeId: string,
  deletedAt: number,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [EPISODE_PROGRESS_STORE, SYNC_TOMBSTONE_STORE],
    'readwrite',
  );
  const progress = transaction.objectStore(EPISODE_PROGRESS_STORE);
  const tombstones = transaction.objectStore(SYNC_TOMBSTONE_STORE);
  const getTombstone = tombstones.get([
    activeScopeId,
    'episode-progress',
    animeId,
  ]);
  getTombstone.onsuccess = () => {
    const existing = getTombstone.result as StoredSyncTombstone | undefined;
    tombstones.put({
      scopeId: activeScopeId,
      entity: 'episode-progress',
      recordKey: animeId,
      deletedAt: Math.max(deletedAt, existing?.deletedAt ?? 0),
    } satisfies StoredSyncTombstone);
  };
  const request = progress
    .index('animeId')
    .openCursor(IDBKeyRange.only(animeId));
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const record = cursor.value as ScopedEpisodeProgress;
    if (record.scopeId === activeScopeId && record.updatedAt <= deletedAt) {
      cursor.delete();
    }
    cursor.continue();
  };
  await transactionDone(transaction);
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
