import type {
  AnimeResult,
  AnimeInfo,
  AnimeSearchFilters,
  AnimeSearchOptions,
  AnimeSearchResponse,
  AnimeTitle,
} from '@/types/anime';
import { getCatalogCache, putCatalogCache } from '@/services/cache/local-db';

const ANILIST_URL = 'https://graphql.anilist.co';
const SIX_HOURS = 6 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const CARD_FIELDS = `id type isAdult title { english romaji native } coverImage { extraLarge large } bannerImage description(asHtml: false) genres averageScore popularity trending favourites updatedAt season seasonYear format status episodes duration startDate { year month day } endDate { year month day }`;
const PAGE_QUERY = `query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort], $type: MediaType, $isAdult: Boolean, $status_in: [MediaStatus], $status_not_in: [MediaStatus], $format_in: [MediaFormat], $format_not_in: [MediaFormat], $season: MediaSeason, $seasonYear: Int, $startDate: FuzzyDateInt, $startDate_like: String, $startDate_greater: FuzzyDateInt, $startDate_lesser: FuzzyDateInt, $endDate: FuzzyDateInt, $endDate_greater: FuzzyDateInt, $endDate_lesser: FuzzyDateInt, $episodes_greater: Int, $episodes_lesser: Int, $duration_greater: Int, $duration_lesser: Int, $averageScore_greater: Int, $averageScore_lesser: Int, $popularity_greater: Int, $popularity_lesser: Int, $countryOfOrigin: CountryCode, $countryOfOrigin_not_in: [CountryCode], $source: MediaSource, $isLicensed: Boolean, $licensedBy: String, $licensedById_in: [Int], $genre_in: [String], $genre_not_in: [String], $tag_in: [String], $tag_not_in: [String], $tagCategory_in: [String], $tagCategory_not_in: [String], $minimumTagRank: Int, $id_in: [Int], $id_not_in: [Int], $idMal_in: [Int], $idMal_not_in: [Int]) { Page(page: $page, perPage: $perPage) { pageInfo { currentPage hasNextPage lastPage total } media(type: $type, search: $search, sort: $sort, isAdult: $isAdult, status_in: $status_in, status_not_in: $status_not_in, format_in: $format_in, format_not_in: $format_not_in, season: $season, seasonYear: $seasonYear, startDate: $startDate, startDate_like: $startDate_like, startDate_greater: $startDate_greater, startDate_lesser: $startDate_lesser, endDate: $endDate, endDate_greater: $endDate_greater, endDate_lesser: $endDate_lesser, episodes_greater: $episodes_greater, episodes_lesser: $episodes_lesser, duration_greater: $duration_greater, duration_lesser: $duration_lesser, averageScore_greater: $averageScore_greater, averageScore_lesser: $averageScore_lesser, popularity_greater: $popularity_greater, popularity_lesser: $popularity_lesser, countryOfOrigin: $countryOfOrigin, countryOfOrigin_not_in: $countryOfOrigin_not_in, source: $source, isLicensed: $isLicensed, licensedBy: $licensedBy, licensedById_in: $licensedById_in, genre_in: $genre_in, genre_not_in: $genre_not_in, tag_in: $tag_in, tag_not_in: $tag_not_in, tagCategory_in: $tagCategory_in, tagCategory_not_in: $tagCategory_not_in, minimumTagRank: $minimumTagRank, id_in: $id_in, id_not_in: $id_not_in, idMal_in: $idMal_in, idMal_not_in: $idMal_not_in) { ${CARD_FIELDS} } } }`;

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
  popularity?: number | null;
  trending?: number | null;
  favourites?: number | null;
  updatedAt?: number | null;
  seasonYear?: number | null;
  season?: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL' | null;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: number | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  endDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
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
  data?: {
    Page?: AniListPage;
    Media?: AniListMedia;
    GenreCollection?: string[];
    MediaTagCollection?: Array<{
      id: number;
      name: string;
      category: string;
      isAdult: boolean;
    }>;
  };
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
    season: media.season ?? undefined,
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
      sort: [filters?.sort ?? (keyword ? 'SEARCH_MATCH' : 'TRENDING_DESC')],
      type: 'ANIME',
      isAdult,
      status_in: filters?.statusIn,
      status_not_in: filters?.statusNotIn,
      format_in: filters?.formatIn,
      format_not_in: filters?.formatNotIn,
      season: filters?.season,
      seasonYear: filters?.seasonYear,
      startDate_like: filters?.startDateLike,
      startDate: filters?.startDate,
      startDate_greater: filters?.startDateGreater,
      startDate_lesser: filters?.startDateLesser,
      endDate_greater: filters?.endDateGreater,
      endDate_lesser: filters?.endDateLesser,
      endDate: filters?.endDate,
      episodes_greater: filters?.episodesGreater,
      episodes_lesser: filters?.episodesLesser,
      duration_greater: filters?.durationGreater,
      duration_lesser: filters?.durationLesser,
      averageScore_greater: filters?.averageScoreGreater,
      averageScore_lesser: filters?.averageScoreLesser,
      popularity_greater: filters?.popularityGreater,
      popularity_lesser: filters?.popularityLesser,
      countryOfOrigin: filters?.countryOfOrigin,
      countryOfOrigin_not_in: filters?.countryOfOriginNotIn,
      source: filters?.source,
      isLicensed: filters?.isLicensed,
      licensedBy: filters?.licensedBy,
      licensedById_in: filters?.licensedByIdIn,
      genre_in: filters?.genreIn,
      genre_not_in: filters?.genreNotIn,
      tag_in: filters?.tagIn,
      tag_not_in: filters?.tagNotIn,
      tagCategory_in: filters?.tagCategoryIn,
      tagCategory_not_in: filters?.tagCategoryNotIn,
      minimumTagRank: filters?.minimumTagRank,
      id_in: filters?.idsIn,
      id_not_in: filters?.idsNotIn,
      idMal_in: filters?.idsMalIn,
      idMal_not_in: filters?.idsMalNotIn,
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
      const adultMode = filters?.adultMode ?? 'include';
      const requests =
        adultMode === 'include' ? [false, true] : [adultMode === 'only'];
      const pages = await Promise.all(
        requests.map((isAdult) =>
          searchByAdultFlag(normalizedKeyword, page, isAdult, signal, filters),
        ),
      );
      const regular = adultMode === 'only' ? undefined : pages[0];
      const adult =
        adultMode === 'include'
          ? pages[1]
          : adultMode === 'only'
            ? pages[0]
            : undefined;
      const regularResults = regular?.media ?? [];
      const adultResults = adult?.media ?? [];
      const combined: AniListMedia[] = [];
      combined.push(...regularResults, ...adultResults);
      const sort =
        filters?.sort ?? (normalizedKeyword ? 'SEARCH_MATCH' : 'TRENDING_DESC');
      const sortField = sort.replace(/_DESC$/, '');
      const descending = sort.endsWith('_DESC') || sort === 'SEARCH_MATCH';
      const valueFor = (media: AniListMedia): number | string => {
        if (sortField === 'SCORE') return media.averageScore ?? 0;
        if (sortField === 'POPULARITY') return media.popularity ?? 0;
        if (sortField === 'TRENDING') return media.trending ?? 0;
        if (sortField === 'FAVOURITES') return media.favourites ?? 0;
        if (sortField === 'ID') return media.id;
        if (sortField === 'EPISODES') return media.episodes ?? 0;
        if (sortField === 'DURATION') return media.duration ?? 0;
        if (sortField === 'TITLE_ENGLISH') return media.title?.english ?? '';
        if (sortField === 'TITLE_NATIVE') return media.title?.native ?? '';
        if (sortField === 'TITLE_ROMAJI') return media.title?.romaji ?? '';
        if (sortField === 'START_DATE' || sortField === 'END_DATE') {
          const date =
            sortField === 'START_DATE' ? media.startDate : media.endDate;
          return (
            (date?.year ?? 0) * 10000 +
            (date?.month ?? 0) * 100 +
            (date?.day ?? 0)
          );
        }
        if (sortField === 'FORMAT') return media.format ?? '';
        if (sortField === 'STATUS') return media.status ?? '';
        if (sortField === 'TYPE') return media.type ?? '';
        if (sortField === 'UPDATED_AT') return media.updatedAt ?? 0;
        return media.id;
      };
      if (sort !== 'SEARCH_MATCH')
        combined.sort((a, b) => {
          const left = valueFor(a);
          const right = valueFor(b);
          const compare =
            typeof left === 'string' && typeof right === 'string'
              ? left.localeCompare(right)
              : Number(left) - Number(right);
          return descending ? -compare : compare;
        });
      else {
        const ranked: AniListMedia[] = [];
        for (
          let index = 0;
          index < Math.max(regularResults.length, adultResults.length);
          index += 1
        ) {
          if (regularResults[index]) ranked.push(regularResults[index]);
          if (adultResults[index]) ranked.push(adultResults[index]);
        }
        combined.splice(0, combined.length, ...ranked);
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

  async searchOptions(signal?: AbortSignal): Promise<AnimeSearchOptions> {
    return withCatalogCache('search:options', ONE_DAY, signal, async () => {
      const response = await request(
        'query { GenreCollection MediaTagCollection { id name category isAdult } }',
        {},
        signal,
      );
      return {
        genres: response.data?.GenreCollection ?? [],
        tags: (response.data?.MediaTagCollection ?? []).filter(
          (tag) => !tag.isAdult,
        ),
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
          {
            page,
            perPage: 24,
            sort,
            status_in: status ? [status] : undefined,
            type: 'ANIME',
            isAdult: false,
          },
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
