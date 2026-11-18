import type {
  AnimeArtworkMetadataResponse,
  AnimeTaizenMetadata,
} from '../types/anime';

const TAIZEN_GRAPHQL_URL = 'https://taizen.moe/api/graphql';
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 48;
const ARTWORK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_RETRY_MS = 60 * 1000;
const STALE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_REQUESTS = 2;
const MAX_BATCH_SIZE = 6;
const MAX_ANILIST_ID = 2_147_483_647;

export interface ClearLogoIdentity {
  animeId: string;
  expectedTitles: string[];
}

interface ArtworkCacheEntry {
  metadata: AnimeTaizenMetadata | null;
  expiresAt: number;
  staleUntil: number;
  retryable: boolean;
}

interface ArtworkRequestResult {
  metadataByKey: Map<string, AnimeTaizenMetadata | null>;
  retryable: boolean;
}

/** Untrusted subset of Taizen's raw GraphQL response; validate before mapping. */
interface TaizenAnime {
  id?: unknown;
  title?: unknown;
  art?: unknown;
  clearlogos?: unknown;
  hdtvlogos?: unknown;
}

interface CacheRead {
  entry?: ArtworkCacheEntry;
  key: string;
  identity: ClearLogoIdentity;
}

const artworkCache = new Map<string, ArtworkCacheEntry>();
const artworkRequests = new Map<string, Promise<ArtworkRequestResult>>();
let activeRequests = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTitle(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

function sanitizeTitles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 8))]
    .filter(
      (title): title is string =>
        typeof title === 'string' &&
        title.trim().length > 0 &&
        title.length <= 180,
    )
    .map((title) => title.trim());
}

function sanitizeIdentity(value: unknown): ClearLogoIdentity | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.animeId !== 'string' ||
    !/^\d{1,10}$/.test(value.animeId) ||
    Number(value.animeId) > MAX_ANILIST_ID
  )
    return null;

  const expectedTitles = sanitizeTitles(value.expectedTitles);
  if (!expectedTitles.length) return null;
  return { animeId: value.animeId, expectedTitles };
}

function sanitizeIdentities(value: unknown): ClearLogoIdentity[] {
  if (!Array.isArray(value)) return [];
  const identities = value
    .slice(0, MAX_BATCH_SIZE)
    .map(sanitizeIdentity)
    .filter((identity): identity is ClearLogoIdentity => identity !== null);
  const seen = new Set<string>();
  return identities.filter((identity) => {
    const key = makeCacheKey(identity);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeCacheKey(identity: ClearLogoIdentity): string {
  const signature = [...new Set(identity.expectedTitles.map(normalizeTitle))]
    .filter(Boolean)
    .sort()
    .join('|');
  return `${identity.animeId}:${signature}`;
}

function getCachedEntry(key: string): ArtworkCacheEntry | undefined {
  const entry = artworkCache.get(key);
  if (!entry) return undefined;
  artworkCache.delete(key);
  artworkCache.set(key, entry);
  return entry;
}

function setCachedEntry(key: string, entry: ArtworkCacheEntry): void {
  artworkCache.delete(key);
  artworkCache.set(key, entry);
  while (artworkCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = artworkCache.keys().next().value;
    if (!oldestKey) break;
    artworkCache.delete(oldestKey);
  }
}

async function readJsonWithLimit(response: Response): Promise<unknown> {
  const body = response.body;
  if (!body) throw new Error('Resposta Taizen vazia.');

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    await body.cancel();
    throw new Error('Resposta Taizen acima do limite.');
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Resposta Taizen acima do limite.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function hasExactTitleMatch(
  titleValue: unknown,
  expectedTitles: string[],
): boolean {
  if (!isRecord(titleValue)) return false;
  const expected = new Set(expectedTitles.map(normalizeTitle).filter(Boolean));
  return ['english', 'romaji', 'native'].some((field) => {
    const value = titleValue[field];
    return typeof value === 'string' && expected.has(normalizeTitle(value));
  });
}

function getEnglishLogo(anime: TaizenAnime): string | null {
  const artworks = [
    ...(Array.isArray(anime.clearlogos) ? anime.clearlogos : []),
    ...(Array.isArray(anime.hdtvlogos) ? anime.hdtvlogos : []),
  ];
  for (const artwork of artworks) {
    if (
      !isRecord(artwork) ||
      typeof artwork.type !== 'string' ||
      !['CLEARLOGO', 'HDTVLOGO'].includes(artwork.type.toUpperCase()) ||
      artwork.lang !== 'en' ||
      typeof artwork.url !== 'string'
    )
      continue;

    try {
      const url = new URL(artwork.url);
      if (
        url.protocol === 'https:' &&
        url.hostname === 'taizen.moe' &&
        !url.port &&
        !url.username &&
        !url.password &&
        /^\/i\/art\/\d+$/.test(url.pathname) &&
        !url.search &&
        !url.hash
      )
        return url.toString();
    } catch {
      // Ignore malformed URLs from the external artwork catalog.
    }
  }
  return null;
}

function safeTaizenBackground(
  value: unknown,
  animeId: unknown,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (typeof animeId !== 'number' || !Number.isSafeInteger(animeId))
    return undefined;
  try {
    const url = new URL(value);
    const validVersion = !url.search || /^\?v=[a-f\d]{8}$/i.test(url.search);
    if (
      url.protocol === 'https:' &&
      url.hostname === 'taizen.moe' &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname === `/i/a/${animeId}/art` &&
      validVersion &&
      !url.hash
    )
      return url.toString();
  } catch {
    // Ignore malformed URLs from the external catalogue.
  }
  return undefined;
}

function mapTaizenMetadata(anime: TaizenAnime): AnimeTaizenMetadata | null {
  const metadata: AnimeTaizenMetadata = {
    animeId: String(anime.id),
    background: safeTaizenBackground(anime.art, anime.id),
    logo: getEnglishLogo(anime) ?? undefined,
  };
  return metadata.background || metadata.logo ? metadata : null;
}

async function requestTaizenMetadata(
  identities: ClearLogoIdentity[],
): Promise<Map<string, AnimeTaizenMetadata | null>> {
  const ids = [
    ...new Set(identities.map((identity) => Number(identity.animeId))),
  ];
  // Taizen's gallery also stores genuine English logos as HDTVLOGO.
  const query = `{
    animePage(filter: { ids: [${ids.join(', ')}] }, perPage: ${ids.length}) {
      items {
        id
        title { english romaji native }
        art
        clearlogos: artwork(type: CLEARLOGO, limit: 100) { type url lang }
        hdtvlogos: artwork(type: HDTVLOGO, limit: 100) { type url lang }
      }
    }
  }`;
  const url = new URL(TAIZEN_GRAPHQL_URL);
  url.searchParams.set('query', query);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(`Taizen respondeu HTTP ${response.status}.`);

  const payload = await readJsonWithLimit(response);
  if (
    !isRecord(payload) ||
    (Array.isArray(payload.errors) && payload.errors.length > 0) ||
    !isRecord(payload.data) ||
    !isRecord(payload.data.animePage) ||
    !Array.isArray(payload.data.animePage.items)
  )
    throw new Error('Resposta GraphQL Taizen inválida.');

  const items = new Map<number, TaizenAnime>();
  for (const item of payload.data.animePage.items) {
    if (
      isRecord(item) &&
      typeof item.id === 'number' &&
      Number.isSafeInteger(item.id)
    )
      items.set(item.id, item as TaizenAnime);
  }

  return new Map(
    identities.map((identity) => {
      const item = items.get(Number(identity.animeId));
      const metadata =
        item && hasExactTitleMatch(item.title, identity.expectedTitles)
          ? mapTaizenMetadata(item)
          : null;
      return [makeCacheKey(identity), metadata];
    }),
  );
}

function getStaleMetadata(
  entry: ArtworkCacheEntry | undefined,
  now: number,
): AnimeTaizenMetadata | null {
  return entry?.metadata && entry.staleUntil > now ? entry.metadata : null;
}

export async function getTaizenMetadata(
  identitiesValue: unknown,
): Promise<AnimeArtworkMetadataResponse> {
  const identities = sanitizeIdentities(identitiesValue);
  if (!identities.length) return { items: [], retryable: false };

  const now = Date.now();
  const resolved = new Map<string, AnimeTaizenMetadata | null>();
  let retryable = false;
  const cacheReads: CacheRead[] = identities.map((identity) => {
    const key = makeCacheKey(identity);
    const entry = getCachedEntry(key);
    if (entry && entry.expiresAt > now) {
      resolved.set(key, entry.metadata);
      retryable ||= entry.retryable;
    }
    return { entry, identity, key };
  });
  const misses = cacheReads.filter(({ key }) => !resolved.has(key));

  if (misses.length) {
    const requestedIdentities = misses.map(({ identity }) => identity);
    const requestKey = misses
      .map(({ key }) => key)
      .sort()
      .join('\n');
    let request = artworkRequests.get(requestKey);

    if (!request && activeRequests < MAX_CONCURRENT_REQUESTS) {
      activeRequests += 1;
      request = requestTaizenMetadata(requestedIdentities)
        .then((metadataByKey) => {
          const fetchedAt = Date.now();
          for (const { key } of misses) {
            const metadata = metadataByKey.get(key) ?? null;
            setCachedEntry(key, {
              metadata,
              expiresAt:
                fetchedAt +
                (metadata ? ARTWORK_CACHE_TTL_MS : MISS_CACHE_TTL_MS),
              staleUntil: fetchedAt + STALE_CACHE_TTL_MS,
              retryable: false,
            });
          }
          return { metadataByKey, retryable: false };
        })
        .catch(() => {
          const failedAt = Date.now();
          for (const { entry, key } of misses) {
            setCachedEntry(key, {
              metadata: getStaleMetadata(entry, failedAt),
              expiresAt: failedAt + FAILURE_RETRY_MS,
              staleUntil:
                entry?.metadata && entry.staleUntil > failedAt
                  ? entry.staleUntil
                  : failedAt + FAILURE_RETRY_MS,
              retryable: true,
            });
          }
          return {
            metadataByKey: new Map(
              misses.map(({ entry, key }) => [
                key,
                getStaleMetadata(entry, failedAt),
              ]),
            ),
            retryable: true,
          };
        })
        .finally(() => {
          artworkRequests.delete(requestKey);
          activeRequests -= 1;
        });
      artworkRequests.set(requestKey, request);
    }

    if (request) {
      const result = await request;
      retryable ||= result.retryable;
      for (const [key, metadata] of result.metadataByKey)
        resolved.set(key, metadata);
    } else {
      retryable = true;
      for (const { entry, key } of misses)
        resolved.set(key, getStaleMetadata(entry, now));
    }
  }

  return {
    items: identities.flatMap((identity) => {
      const metadata = resolved.get(makeCacheKey(identity));
      return metadata ? [metadata] : [];
    }),
    retryable,
  };
}
