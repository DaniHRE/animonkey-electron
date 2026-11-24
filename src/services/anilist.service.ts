import type {
  AnimeAiringInfo,
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
const SEASONAL_HERO_TTL = 30 * 60 * 1000;
const CARD_FIELDS = `id type isAdult title { english romaji native } coverImage { extraLarge large color } bannerImage description(asHtml: false) genres averageScore popularity trending favourites updatedAt season seasonYear format status episodes duration startDate { year month day } endDate { year month day }`;
const PAGE_QUERY = `query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort], $type: MediaType, $isAdult: Boolean, $status_in: [MediaStatus], $status_not_in: [MediaStatus], $format_in: [MediaFormat], $format_not_in: [MediaFormat], $season: MediaSeason, $seasonYear: Int, $startDate: FuzzyDateInt, $startDate_like: String, $startDate_greater: FuzzyDateInt, $startDate_lesser: FuzzyDateInt, $endDate: FuzzyDateInt, $endDate_greater: FuzzyDateInt, $endDate_lesser: FuzzyDateInt, $episodes_greater: Int, $episodes_lesser: Int, $duration_greater: Int, $duration_lesser: Int, $averageScore_greater: Int, $averageScore_lesser: Int, $popularity_greater: Int, $popularity_lesser: Int, $countryOfOrigin: CountryCode, $countryOfOrigin_not_in: [CountryCode], $source: MediaSource, $isLicensed: Boolean, $licensedBy: String, $licensedById_in: [Int], $genre_in: [String], $genre_not_in: [String], $tag_in: [String], $tag_not_in: [String], $tagCategory_in: [String], $tagCategory_not_in: [String], $minimumTagRank: Int, $id_in: [Int], $id_not_in: [Int], $idMal_in: [Int], $idMal_not_in: [Int]) { Page(page: $page, perPage: $perPage) { pageInfo { hasNextPage } media(type: $type, search: $search, sort: $sort, isAdult: $isAdult, status_in: $status_in, status_not_in: $status_not_in, format_in: $format_in, format_not_in: $format_not_in, season: $season, seasonYear: $seasonYear, startDate: $startDate, startDate_like: $startDate_like, startDate_greater: $startDate_greater, startDate_lesser: $startDate_lesser, endDate: $endDate, endDate_greater: $endDate_greater, endDate_lesser: $endDate_lesser, episodes_greater: $episodes_greater, episodes_lesser: $episodes_lesser, duration_greater: $duration_greater, duration_lesser: $duration_lesser, averageScore_greater: $averageScore_greater, averageScore_lesser: $averageScore_lesser, popularity_greater: $popularity_greater, popularity_lesser: $popularity_lesser, countryOfOrigin: $countryOfOrigin, countryOfOrigin_not_in: $countryOfOrigin_not_in, source: $source, isLicensed: $isLicensed, licensedBy: $licensedBy, licensedById_in: $licensedById_in, genre_in: $genre_in, genre_not_in: $genre_not_in, tag_in: $tag_in, tag_not_in: $tag_not_in, tagCategory_in: $tagCategory_in, tagCategory_not_in: $tagCategory_not_in, minimumTagRank: $minimumTagRank, id_in: $id_in, id_not_in: $id_not_in, idMal_in: $idMal_in, idMal_not_in: $idMal_not_in) { ${CARD_FIELDS} } } }`;

interface AniListMedia {
  id: number;
  type?: string;
  isAdult?: boolean;
  title?: AnimeTitle;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    color?: string | null;
  };
  bannerImage?: string | null;
  description?: string | null;
  genres?: string[];
  averageScore?: number | null;
  stats?: {
    scoreDistribution?: Array<{ amount?: number | null }> | null;
  } | null;
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
      voiceActors?: Array<{
        id?: number | null;
        languageV2?: string | null;
        name?: { userPreferred?: string | null; full?: string | null } | null;
        image?: { large?: string | null } | null;
      }>;
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
    hasNextPage?: boolean;
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
    color: media.coverImage?.color ?? undefined,
    description: media.description ?? undefined,
    genres: media.genres ?? [],
    rating: media.averageScore ? media.averageScore / 10 : undefined,
    ratingCount: media.stats?.scoreDistribution?.reduce(
      (total, bucket) => total + (bucket.amount ?? 0),
      0,
    ),
    releaseDate: media.seasonYear ?? undefined,
    season: media.season ?? undefined,
    type: media.format ?? undefined,
    status: media.status ?? undefined,
    totalEpisodes: media.episodes ?? undefined,
    duration: media.duration ?? undefined,
  };
}

function getCurrentSeason(): {
  season: NonNullable<AnimeResult['season']>;
  year: number;
} {
  const now = new Date();
  const month = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      month: 'numeric',
    }).format(now),
  );
  const year = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
    }).format(now),
  );
  if (month <= 3) return { season: 'WINTER', year };
  if (month <= 6) return { season: 'SPRING', year };
  if (month <= 9) return { season: 'SUMMER', year };
  return { season: 'FALL', year };
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
      'O catálogo está temporariamente indisponível. Aguarde alguns instantes e tente novamente.',
      { cause },
    );
  }

  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? 'O catálogo está recebendo muitas solicitações. Aguarde alguns instantes e tente novamente.'
        : 'O catálogo está temporariamente indisponível. Tente novamente em instantes.',
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

interface CatalogPageOptions {
  page: number;
  perPage: number;
  sort: string[];
  signal?: AbortSignal;
  includeAdult: boolean;
  statusIn?: string[];
  season?: AnimeResult['season'];
  seasonYear?: number;
}

async function requestCatalogPages({
  page,
  perPage,
  sort,
  signal,
  includeAdult,
  statusIn,
  season,
  seasonYear,
}: CatalogPageOptions): Promise<Array<AniListPage | undefined>> {
  const adultFlags = includeAdult ? [false, true] : [false];
  const perAdultPage = includeAdult
    ? Math.max(1, Math.ceil(perPage / 2))
    : perPage;
  return Promise.all(
    adultFlags.map(async (isAdult) => {
      const response = await request(
        PAGE_QUERY,
        {
          page,
          perPage: perAdultPage,
          sort,
          type: 'ANIME',
          isAdult,
          status_in: statusIn,
          season,
          seasonYear,
        },
        signal,
      );
      return response.data?.Page;
    }),
  );
}

function hasValidAnimeAdultFlag(media: AniListMedia): boolean {
  return media.type === 'ANIME' && typeof media.isAdult === 'boolean';
}

function mapCatalogResults(
  media: AniListMedia[],
  includeAdult: boolean,
): AnimeResult[] {
  return media.flatMap((item) => {
    if (!hasValidAnimeAdultFlag(item) || (!includeAdult && item.isAdult))
      return [];
    return [mapMedia(item)];
  });
}

function mapSearchResults(
  media: AniListMedia[],
  adultMode: NonNullable<AnimeSearchFilters['adultMode']>,
): AnimeResult[] {
  return media.flatMap((item) => {
    if (!hasValidAnimeAdultFlag(item)) return [];
    if (adultMode === 'exclude' && item.isAdult) return [];
    if (adultMode === 'only' && !item.isAdult) return [];
    return [mapMedia(item)];
  });
}

function valueForSort(media: AniListMedia, sort: string): number | string {
  const field = sort.replace(/_DESC$/, '');
  if (field === 'SCORE') return media.averageScore ?? 0;
  if (field === 'POPULARITY') return media.popularity ?? 0;
  if (field === 'TRENDING') return media.trending ?? 0;
  if (field === 'FAVOURITES') return media.favourites ?? 0;
  if (field === 'ID') return media.id;
  if (field === 'EPISODES') return media.episodes ?? 0;
  if (field === 'DURATION') return media.duration ?? 0;
  if (field === 'TITLE_ENGLISH') return media.title?.english ?? '';
  if (field === 'TITLE_NATIVE') return media.title?.native ?? '';
  if (field === 'TITLE_ROMAJI') return media.title?.romaji ?? '';
  if (field === 'START_DATE' || field === 'END_DATE') {
    const date = field === 'START_DATE' ? media.startDate : media.endDate;
    return (
      (date?.year ?? 0) * 10000 + (date?.month ?? 0) * 100 + (date?.day ?? 0)
    );
  }
  if (field === 'FORMAT') return media.format ?? '';
  if (field === 'STATUS') return media.status ?? '';
  if (field === 'TYPE') return media.type ?? '';
  if (field === 'UPDATED_AT') return media.updatedAt ?? 0;
  return media.id;
}

function sortMediaByFields(media: AniListMedia[], sorts: string[]): void {
  media.sort((first, second) => {
    for (const sort of sorts) {
      if (sort === 'SEARCH_MATCH') continue;
      const firstValue = valueForSort(first, sort);
      const secondValue = valueForSort(second, sort);
      const comparison =
        typeof firstValue === 'string' && typeof secondValue === 'string'
          ? firstValue.localeCompare(secondValue)
          : Number(firstValue) - Number(secondValue);
      if (comparison !== 0)
        return sort.endsWith('_DESC') ? -comparison : comparison;
    }
    return first.id - second.id;
  });
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
      const adultMode = filters?.adultMode ?? 'exclude';
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
      if (sort !== 'SEARCH_MATCH') sortMediaByFields(combined, [sort]);
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
        hasNextPage:
          (regular?.pageInfo?.hasNextPage ?? false) ||
          (adult?.pageInfo?.hasNextPage ?? false),
        results: mapSearchResults(combined, adultMode),
      };
    });
  },

  async searchOptions(
    signal?: AbortSignal,
    includeAdult = false,
  ): Promise<AnimeSearchOptions> {
    return withCatalogCache(
      `search:options:${includeAdult}`,
      ONE_DAY,
      signal,
      async () => {
        const response = await request(
          'query { GenreCollection MediaTagCollection { id name category isAdult } }',
          {},
          signal,
        );
        return {
          genres: response.data?.GenreCollection ?? [],
          tags: (response.data?.MediaTagCollection ?? []).filter((tag) =>
            includeAdult
              ? typeof tag.isAdult === 'boolean'
              : tag.isAdult === false,
          ),
        };
      },
    );
  },

  async trending(
    signal?: AbortSignal,
    includeAdult = false,
  ): Promise<AnimeResult[]> {
    const results = await AniListCatalog.list(
      ['TRENDING_DESC'],
      undefined,
      1,
      signal,
      includeAdult,
    );
    return results.results;
  },

  async seasonalTrending(
    signal?: AbortSignal,
    includeAdult = false,
  ): Promise<AnimeResult[]> {
    const { season, year } = getCurrentSeason();
    return withCatalogCache(
      `seasonal-hero:v2:${year}:${season}:${includeAdult}`,
      SEASONAL_HERO_TTL,
      signal,
      async () => {
        const pages = await requestCatalogPages({
          page: 1,
          perPage: 6,
          sort: ['TRENDING_DESC'],
          signal,
          includeAdult,
          season,
          seasonYear: year,
          statusIn: ['RELEASING', 'NOT_YET_RELEASED'],
        });
        const media = pages.flatMap((result) => result?.media ?? []);
        sortMediaByFields(media, ['TRENDING_DESC']);
        return mapCatalogResults(media, includeAdult);
      },
    );
  },

  async list(
    sort: string[],
    status?: 'FINISHED' | 'RELEASING',
    page = 1,
    signal?: AbortSignal,
    includeAdult = false,
  ): Promise<AnimeSearchResponse> {
    return withCatalogCache(
      `list:${JSON.stringify([sort, status, page, includeAdult])}`,
      SIX_HOURS,
      signal,
      async () => {
        const pages = await requestCatalogPages({
          page,
          perPage: 24,
          sort,
          signal,
          includeAdult,
          statusIn: status ? [status] : undefined,
        });
        const media = pages.flatMap((result) => result?.media ?? []);
        sortMediaByFields(media, sort);
        return {
          hasNextPage: pages.some((result) => result?.pageInfo?.hasNextPage),
          results: mapCatalogResults(media, includeAdult),
        };
      },
    );
  },

  async home(signal?: AbortSignal, includeAdult = false) {
    const [
      seasonalTrending,
      trending,
      completed,
      newReleases,
      recentlyAdded,
      popular,
    ] = await Promise.all([
      AniListCatalog.seasonalTrending(signal, includeAdult),
      AniListCatalog.list(
        ['TRENDING_DESC'],
        undefined,
        1,
        signal,
        includeAdult,
      ),
      AniListCatalog.list(
        ['END_DATE_DESC', 'POPULARITY_DESC'],
        'FINISHED',
        1,
        signal,
        includeAdult,
      ),
      AniListCatalog.list(
        ['START_DATE_DESC', 'POPULARITY_DESC'],
        'RELEASING',
        1,
        signal,
        includeAdult,
      ),
      AniListCatalog.list(['ID_DESC'], undefined, 1, signal, includeAdult),
      AniListCatalog.list(
        ['POPULARITY_DESC'],
        undefined,
        1,
        signal,
        includeAdult,
      ),
    ]);
    return {
      banner: seasonalTrending,
      trending: trending.results,
      completed: completed.results,
      newReleases: newReleases.results,
      recentlyAdded: recentlyAdded.results,
      popular: popular.results,
    };
  },

  async schedule(
    date: Date,
    signal?: AbortSignal,
    includeAdult = false,
  ): Promise<AnimeResult[]> {
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
      `schedule:${dateKey}:${includeAdult}`,
      5 * 60 * 1000,
      signal,
      async () => {
        const query = `query ($from: Int, $to: Int, $page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) { episode airingAt media { ${CARD_FIELDS} } } } }`;
        const response = await request(
          query,
          { from, to, page: 1, perPage: 50 },
          signal,
        );
        return (response.data?.Page?.airingSchedules ?? []).flatMap((item) => {
          const [anime] = mapCatalogResults([item.media], includeAdult);
          return anime
            ? [
                {
                  ...anime,
                  airingAt: item.airingAt,
                  airingEpisode: item.episode,
                },
              ]
            : [];
        });
      },
    );
  },

  async airingEpisodes(
    ids: string[],
    signal?: AbortSignal,
    includeAdult = false,
  ): Promise<AnimeAiringInfo[]> {
    const numericIds = [
      ...new Set(
        ids.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0),
      ),
    ].slice(0, 50);
    if (!numericIds.length) return [];
    return withCatalogCache(
      'airing-followed:' + includeAdult + ':' + numericIds.join(','),
      10 * 60 * 1000,
      signal,
      async () => {
        const adultFilter = includeAdult ? '' : ', isAdult: false';
        const query =
          'query ($ids: [Int], $page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { media(id_in: $ids, type: ANIME' +
          adultFilter +
          ') { ' +
          CARD_FIELDS +
          ' nextAiringEpisode { airingAt episode } } } }';
        const response = await request(
          query,
          { ids: numericIds, page: 1, perPage: 50 },
          signal,
        );
        return (response.data?.Page?.media ?? []).flatMap((media) => {
          const [anime] = mapCatalogResults([media], includeAdult);
          if (!anime) return [];
          const airing = media.nextAiringEpisode;
          return [
            {
              id: anime.id,
              title: anime.title,
              image: anime.image,
              nextAiringEpisode:
                typeof airing?.airingAt === 'number' &&
                Number.isSafeInteger(airing.airingAt) &&
                airing.airingAt > 0 &&
                typeof airing.episode === 'number' &&
                Number.isSafeInteger(airing.episode) &&
                airing.episode > 0
                  ? { airingAt: airing.airingAt, episode: airing.episode }
                  : undefined,
            },
          ];
        });
      },
    );
  },

  async getAnime(
    id: string,
    signal?: AbortSignal,
    includeAdult = false,
  ): Promise<AnimeInfo | null> {
    const numericId = Number(id);
    if (!Number.isSafeInteger(numericId) || numericId < 1) return null;
    return withCatalogCache(
      `anime:v7:${numericId}:${includeAdult}`,
      ONE_DAY,
      signal,
      async () => {
        const response = await request(
          `query ($id: Int) { Media(id: $id, type: ANIME) { ${CARD_FIELDS} stats { scoreDistribution { amount } } trailer { id site thumbnail } nextAiringEpisode { airingAt episode } characters(sort: [ROLE, RELEVANCE, ID], perPage: 50) { edges { role node { id name { userPreferred full } image { large } } voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id languageV2 name { userPreferred full } image { large } } } } relations { edges { relationType node { ${CARD_FIELDS} } } } recommendations(perPage: 8, sort: RATING_DESC) { nodes { mediaRecommendation { ${CARD_FIELDS} } } } } }`,
          { id: numericId },
          signal,
        );
        const media = response.data?.Media;
        if (!media || !hasValidAnimeAdultFlag(media)) return null;
        return {
          ...mapMedia(media),
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
          characters: (media.characters?.edges ?? []).flatMap((edge) => {
            if (!edge.node?.id) return [];
            const voiceActor = edge.voiceActors?.find(
              (actor) => actor.languageV2 === 'Japanese' && actor.id,
            );
            return [
              {
                id: edge.node.id,
                name:
                  edge.node.name?.userPreferred ??
                  edge.node.name?.full ??
                  'Personagem',
                image: edge.node.image?.large ?? undefined,
                role: edge.role ?? 'SUPPORTING',
                voiceActor:
                  voiceActor?.id != null
                    ? {
                        id: voiceActor.id,
                        name:
                          voiceActor.name?.userPreferred ??
                          voiceActor.name?.full ??
                          'Dublador japonês',
                        image: voiceActor.image?.large ?? undefined,
                      }
                    : undefined,
              },
            ];
          }),
          relations: (media.relations?.edges ?? []).flatMap((edge) =>
            edge.node &&
            hasValidAnimeAdultFlag(edge.node) &&
            (includeAdult || !edge.node.isAdult)
              ? [
                  {
                    ...mapMedia(edge.node),
                    relationType: edge.relationType ?? 'RELATED',
                  },
                ]
              : [],
          ),
          recommendations: (media.recommendations?.nodes ?? []).flatMap(
            (node) => {
              const recommendation = node.mediaRecommendation;
              return recommendation &&
                hasValidAnimeAdultFlag(recommendation) &&
                (includeAdult || !recommendation.isAdult)
                ? [mapMedia(recommendation)]
                : [];
            },
          ),
        };
      },
    );
  },
};
