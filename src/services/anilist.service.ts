import type {
  AnimeResult,
  AnimeInfo,
  AnimeSearchFilters,
  AnimeSearchResponse,
  AnimeTitle,
} from '@/types/anime';
import { getCatalogCache, putCatalogCache } from '@/services/cache/local-db';

const ANILIST_URL = 'https://graphql.anilist.co';
const SIX_HOURS = 6 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const CARD_FIELDS = `id type isAdult title { english romaji native } coverImage { extraLarge large } bannerImage description(asHtml: false) genres averageScore seasonYear format status episodes`;
const PAGE_QUERY = `query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort], $status: MediaStatus, $type: MediaType, $genreIn: [String], $format: MediaFormat, $isAdult: Boolean) { Page(page: $page, perPage: $perPage) { pageInfo { currentPage hasNextPage lastPage total } media(type: $type, search: $search, sort: $sort, status: $status, genre_in: $genreIn, format: $format, isAdult: $isAdult) { ${CARD_FIELDS} } } }`;

interface AniListMedia {
  id: number;
  type?: string;
  isAdult?: boolean;
  title?: AnimeTitle;
  coverImage?: { extraLarge?: string | null; large?: string | null };
  bannerImage?: string | null;
  description?: string | null;
  genres?: string[];
  averageScore?: number | null;
  seasonYear?: number | null;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: number | null;
  trailer?: {
    id?: string | null;
    site?: string | null;
    thumbnail?: string | null;
  } | null;
  nextAiringEpisode?: {
    airingAt?: number | null;
    episode?: number | null;
  } | null;
  characters?: {
    edges?: Array<{
      role?: string | null;
      node?: {
        id?: number | null;
        name?: { userPreferred?: string | null; full?: string | null } | null;
        image?: { large?: string | null } | null;
      } | null;
    }>;
  } | null;
  relations?: {
    edges?: Array<{ relationType?: string | null; node?: AniListMedia | null }>;
  } | null;
  recommendations?: {
    nodes?: Array<{ mediaRecommendation?: AniListMedia | null }>;
  } | null;
}

interface AniListPage {
  pageInfo?: {
    currentPage?: number;
    hasNextPage?: boolean;
    lastPage?: number;
    total?: number;
  };
  media?: AniListMedia[];
  airingSchedules?: Array<{
    episode: number;
    airingAt: number;
    media: AniListMedia;
  }>;
}

interface AniListResponse {
  data?: { Page?: AniListPage; Media?: AniListMedia };
  errors?: Array<{ message?: string }>;
}

async function withCatalogCache<T>(
  key: string,
  ttlMs: number,
  signal: AbortSignal | undefined,
  load: () => Promise<T>,
): Promise<T> {
  let cached: Awaited<ReturnType<typeof getCatalogCache<T>>> = null;
  try {
    cached = await getCatalogCache<T>(key);
    if (cached?.isFresh) return cached.value;
  } catch {
    // IndexedDB is an optimization; public catalog calls still work without it.
  }

  try {
    const value = await load();
    try {
      await putCatalogCache(key, value, ttlMs);
    } catch {
      // A quota or storage error must not fail an otherwise successful request.
    }
    return value;
  } catch (error) {
    if (!signal?.aborted && cached) return cached.value;
    throw error;
  }
}

function mapMedia(media: AniListMedia): AnimeResult {
  return {
    id: String(media.id),
    mediaType: 'ANIME',
    isAdult: media.isAdult ?? false,
    title: media.title ?? {},
    image: media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined,
    banner: media.bannerImage ?? undefined,
    description: media.description ?? undefined,
    genres: media.genres ?? [],
    rating: media.averageScore ? media.averageScore / 10 : undefined,
    releaseDate: media.seasonYear ?? undefined,
    type: media.format ?? undefined,
    status: media.status ?? undefined,
    totalEpisodes: media.episodes ?? undefined,
  };
}

async function request(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<AniListResponse> {
  let response: Response;
  try {
    response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    if (cause instanceof DOMException && cause.name === 'TimeoutError')
      throw new Error('A busca demorou demais. Tente novamente.', { cause });
    throw new Error(
      'Não foi possível conectar ao catálogo. Verifique sua conexão e tente novamente.',
      { cause },
    );
  }

  if (!response.ok) {
    throw new Error(
      `Não foi possível consultar o AniList (${response.status}).`,
    );
  }

  const payload = (await response.json()) as AniListResponse;
  if (payload.errors?.length) {
    throw new Error(
      'O catálogo está temporariamente indisponível. Tente novamente.',
    );
  }
  return payload;
}

async function searchByAdultFlag(
  keyword: string,
  page: number,
  isAdult: boolean,
  signal?: AbortSignal,
  filters?: AnimeSearchFilters,
): Promise<AniListPage | undefined> {
  const response = await request(
    PAGE_QUERY,
    {
      page,
      perPage: 10,
      search: keyword || undefined,
      sort: keyword ? ['SEARCH_MATCH'] : ['TRENDING_DESC'],
      type: 'ANIME',
      isAdult,
      status: filters?.status,
      genreIn: filters?.genre ? [filters.genre] : undefined,
      format: filters?.format,
    },
    signal,
  );
  return response.data?.Page;
}

export const AniListCatalog = {
  async search(
    keyword: string,
    page = 1,
    signal?: AbortSignal,
    filters?: AnimeSearchFilters,
  ): Promise<AnimeSearchResponse> {
    const normalizedKeyword = keyword.trim();
    const cacheKey = `search:${JSON.stringify([normalizedKeyword, page, filters])}`;
    return withCatalogCache(cacheKey, SIX_HOURS, signal, async () => {
      const [regular, adult] = await Promise.all([
        searchByAdultFlag(normalizedKeyword, page, false, signal, filters),
        searchByAdultFlag(normalizedKeyword, page, true, signal, filters),
      ]);
      const regularResults = regular?.media ?? [];
      const adultResults = adult?.media ?? [];
      const combined: AniListMedia[] = [];
      for (let index = 0; index < 10; index += 1) {
        if (regularResults[index]) combined.push(regularResults[index]);
        if (adultResults[index]) combined.push(adultResults[index]);
      }

      return {
        currentPage: regular?.pageInfo?.currentPage ?? page,
        hasNextPage:
          (regular?.pageInfo?.hasNextPage ?? false) ||
          (adult?.pageInfo?.hasNextPage ?? false),
        totalPages: Math.max(
          regular?.pageInfo?.lastPage ?? 1,
          adult?.pageInfo?.lastPage ?? 1,
        ),
        totalResults:
          (regular?.pageInfo?.total ?? regularResults.length) +
          (adult?.pageInfo?.total ?? adultResults.length),
        results: combined.map(mapMedia),
      };
    });
  },

  async trending(signal?: AbortSignal): Promise<AnimeResult[]> {
    return withCatalogCache('trending', SIX_HOURS, signal, async () => {
      const response = await request(
        PAGE_QUERY,
        {
          page: 1,
          perPage: 24,
          sort: ['TRENDING_DESC'],
          type: 'ANIME',
          isAdult: false,
        },
        signal,
      );
      return (response.data?.Page?.media ?? []).map(mapMedia);
    });
  },

  async list(
    sort: string[],
    status?: 'FINISHED' | 'RELEASING',
    page = 1,
    signal?: AbortSignal,
  ): Promise<AnimeSearchResponse> {
    return withCatalogCache(
      `list:${JSON.stringify([sort, status, page])}`,
      SIX_HOURS,
      signal,
      async () => {
        const response = await request(
          PAGE_QUERY,
          { page, perPage: 24, sort, status, type: 'ANIME', isAdult: false },
          signal,
        );
        const data = response.data?.Page;
        const info = data?.pageInfo;
        const results = (data?.media ?? []).map(mapMedia);
        return {
          currentPage: info?.currentPage ?? page,
          hasNextPage: info?.hasNextPage ?? false,
          totalPages: info?.lastPage ?? 1,
          totalResults: info?.total ?? results.length,
          results,
        };
      },
    );
  },

  async home(signal?: AbortSignal) {
    const [trending, completed, newReleases, recentlyAdded, popular] =
      await Promise.all([
        AniListCatalog.list(['TRENDING_DESC'], undefined, 1, signal),
        AniListCatalog.list(
          ['END_DATE_DESC', 'POPULARITY_DESC'],
          'FINISHED',
          1,
          signal,
        ),
        AniListCatalog.list(
          ['START_DATE_DESC', 'POPULARITY_DESC'],
          'RELEASING',
          1,
          signal,
        ),
        AniListCatalog.list(['ID_DESC'], undefined, 1, signal),
        AniListCatalog.list(['POPULARITY_DESC'], undefined, 1, signal),
      ]);
    return {
      banner: trending.results.slice(0, 6),
      trending: trending.results,
      completed: completed.results,
      newReleases: newReleases.results,
      recentlyAdded: recentlyAdded.results,
      popular: popular.results,
    };
  },

  async schedule(date: Date, signal?: AbortSignal): Promise<AnimeResult[]> {
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    const [year, month, day] = dateKey.split('-').map(Number);
    const dayStart = new Date(Date.UTC(year, month - 1, day));
    const from = Math.floor(dayStart.getTime() / 1000) + 3 * 60 * 60;
    const to = from + 24 * 60 * 60;
    return withCatalogCache(
      `schedule:${dateKey}`,
      10 * 60 * 1000,
      signal,
      async () => {
        const query = `query ($from: Int, $to: Int, $page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) { episode airingAt media { ${CARD_FIELDS} } } } }`;
        const response = await request(
          query,
          { from, to, page: 1, perPage: 50 },
          signal,
        );
        return (response.data?.Page?.airingSchedules ?? []).map((item) => ({
          ...mapMedia(item.media),
          airingAt: item.airingAt,
          airingEpisode: item.episode,
        }));
      },
    );
  },

  async getAnime(id: string, signal?: AbortSignal): Promise<AnimeInfo | null> {
    const numericId = Number(id);
    if (!Number.isSafeInteger(numericId) || numericId < 1) return null;
    return withCatalogCache(`anime:${numericId}`, ONE_DAY, signal, async () => {
      const response = await request(
        `query ($id: Int) { Media(id: $id, type: ANIME) { ${CARD_FIELDS} duration trailer { id site thumbnail } nextAiringEpisode { airingAt episode } characters(sort: ROLE, perPage: 8) { edges { role node { id name { userPreferred full } image { large } } } } relations { edges { relationType node { ${CARD_FIELDS} } } } recommendations(perPage: 8, sort: RATING_DESC) { nodes { mediaRecommendation { ${CARD_FIELDS} } } } } }`,
        { id: numericId },
        signal,
      );
      const media = response.data?.Media;
      if (!media) return null;
      return {
        ...mapMedia(media),
        duration: media.duration ?? undefined,
        trailer:
          media.trailer?.id && media.trailer.site
            ? {
                id: media.trailer.id,
                site: media.trailer.site,
                thumbnail: media.trailer.thumbnail ?? undefined,
              }
            : undefined,
        nextAiringEpisode:
          media.nextAiringEpisode?.airingAt && media.nextAiringEpisode.episode
            ? {
                airingAt: media.nextAiringEpisode.airingAt,
                episode: media.nextAiringEpisode.episode,
              }
            : undefined,
        characters: (media.characters?.edges ?? []).flatMap((edge) =>
          edge.node?.id
            ? [
                {
                  id: edge.node.id,
                  name:
                    edge.node.name?.userPreferred ??
                    edge.node.name?.full ??
                    'Personagem',
                  image: edge.node.image?.large ?? undefined,
                  role: edge.role ?? 'SUPPORTING',
                },
              ]
            : [],
        ),
        relations: (media.relations?.edges ?? []).flatMap((edge) =>
          edge.node?.type === 'ANIME'
            ? [
                {
                  ...mapMedia(edge.node),
                  relationType: edge.relationType ?? 'RELATED',
                },
              ]
            : [],
        ),
        recommendations: (media.recommendations?.nodes ?? []).flatMap((node) =>
          node.mediaRecommendation?.type === 'ANIME'
            ? [mapMedia(node.mediaRecommendation)]
            : [],
        ),
      };
    });
  },
};
