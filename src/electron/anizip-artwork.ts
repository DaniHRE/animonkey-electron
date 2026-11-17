const ANIZIP_MAPPINGS_URL = 'https://api.ani.zip/mappings';
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 48;
const LOGO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_RETRY_MS = 60 * 1000;
const STALE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_REQUESTS = 2;

interface ArtworkCacheEntry {
  url: string | null;
  expiresAt: number;
  staleUntil: number;
}

const artworkCache = new Map<string, ArtworkCacheEntry>();
const artworkRequests = new Map<string, Promise<string | null>>();
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

function sanitizeExpectedTitles(value: unknown): string[] {
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

function makeCacheKey(animeId: string, titles: string[]): string {
  const signature = [...new Set(titles.map(normalizeTitle))]
    .filter(Boolean)
    .sort()
    .join('|');
  return `${animeId}:${signature}`;
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
  if (!body) throw new Error('Resposta AniZip vazia.');

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    await body.cancel();
    throw new Error('Resposta AniZip acima do limite.');
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
        throw new Error('Resposta AniZip acima do limite.');
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

function getMatchingClearLogo(
  payload: unknown,
  expectedTitles: string[],
): string | null {
  if (!isRecord(payload) || !isRecord(payload.titles)) return null;
  const expected = new Set(expectedTitles.map(normalizeTitle).filter(Boolean));
  const hasMatchingTitle = Object.values(payload.titles).some(
    (value) => typeof value === 'string' && expected.has(normalizeTitle(value)),
  );
  if (!hasMatchingTitle || !Array.isArray(payload.images)) return null;

  for (const image of payload.images) {
    if (
      !isRecord(image) ||
      typeof image.coverType !== 'string' ||
      image.coverType.trim().toLowerCase() !== 'clearlogo' ||
      typeof image.url !== 'string'
    )
      continue;

    try {
      const url = new URL(image.url);
      if (
        url.protocol === 'https:' &&
        url.hostname === 'artworks.thetvdb.com' &&
        !url.port &&
        !url.username &&
        !url.password &&
        url.pathname.startsWith('/banners/') &&
        /\.(?:png|webp)$/i.test(url.pathname)
      )
        return url.toString();
    } catch {
      // A malformed URL from the provider is ignored.
    }
  }
  return null;
}

async function requestClearLogo(
  animeId: string,
  expectedTitles: string[],
): Promise<string | null> {
  const url = new URL(ANIZIP_MAPPINGS_URL);
  url.searchParams.set('anilist_id', animeId);

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(`AniZip respondeu HTTP ${response.status}.`);

  const payload = await readJsonWithLimit(response);
  return getMatchingClearLogo(payload, expectedTitles);
}

export function getAniZipClearLogo(
  animeId: unknown,
  expectedTitlesValue: unknown,
): Promise<string | null> {
  if (typeof animeId !== 'string' || !/^\d{1,10}$/.test(animeId))
    return Promise.resolve(null);

  const expectedTitles = sanitizeExpectedTitles(expectedTitlesValue);
  if (!expectedTitles.length) return Promise.resolve(null);

  const cacheKey = makeCacheKey(animeId, expectedTitles);
  const cached = getCachedEntry(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return Promise.resolve(cached.url);

  const staleUrl = cached && cached.staleUntil > now ? cached.url : null;
  const pending = artworkRequests.get(cacheKey);
  if (pending) return pending;
  if (activeRequests >= MAX_CONCURRENT_REQUESTS)
    return Promise.resolve(staleUrl);

  activeRequests += 1;
  const request = requestClearLogo(animeId, expectedTitles)
    .then((url) => {
      const fetchedAt = Date.now();
      setCachedEntry(cacheKey, {
        url,
        expiresAt: fetchedAt + (url ? LOGO_CACHE_TTL_MS : MISS_CACHE_TTL_MS),
        staleUntil: fetchedAt + (url ? STALE_CACHE_TTL_MS : MISS_CACHE_TTL_MS),
      });
      return url;
    })
    .catch(() => {
      const failedAt = Date.now();
      setCachedEntry(cacheKey, {
        url: staleUrl,
        expiresAt: failedAt + FAILURE_RETRY_MS,
        staleUntil: cached?.staleUntil ?? failedAt + FAILURE_RETRY_MS,
      });
      return staleUrl;
    })
    .finally(() => {
      artworkRequests.delete(cacheKey);
      activeRequests -= 1;
    });

  artworkRequests.set(cacheKey, request);
  return request;
}
