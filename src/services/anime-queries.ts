import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { AnivexaCatalog } from '@/services/anivexa.service';
import { AniListCatalog } from '@/services/anilist.service';
import type {
  AnimeAiringInfo,
  AnimeArtworkIdentity,
  AnimeArtworkMetadataResponse,
  AnimeInfo,
  AnimeResult,
  AnimeSearchFilters,
  AnimeTaizenMetadata,
} from '@/types/anime';
import type { AnimeEpisode, EpisodeSources } from '@/types/player';
import {
  getCatalogCache,
  putCatalogCacheUntil,
} from '@/services/cache/local-db';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * 60 * MINUTE;
const WEEK = 7 * DAY;
const COMPLETED_EPISODE_CACHE_TTL = 30 * DAY;

interface CachedEpisodeList {
  episodes: AnimeEpisode[];
  expiresAt: number;
}

function episodeCacheKey(animeId: string): string {
  return `anivexa:episodes:${animeId}`;
}

function nextEpisodeListExpiration(
  anime: AnimeInfo | null,
  episodes: AnimeEpisode[],
  previousEpisodes: AnimeEpisode[] | null,
  now: number,
): number {
  const maxEpisode = episodes.reduce(
    (maximum, episode) => Math.max(maximum, episode.number),
    -1,
  );
  const hasCompleteList =
    anime?.totalEpisodes === undefined || maxEpisode >= anime.totalEpisodes;

  if (anime?.status === 'FINISHED' && hasCompleteList) {
    return now + COMPLETED_EPISODE_CACHE_TTL;
  }

  const nextAiring = anime?.nextAiringEpisode;
  if (
    nextAiring &&
    Number.isFinite(nextAiring.airingAt) &&
    Number.isSafeInteger(nextAiring.episode) &&
    nextAiring.episode > 0
  ) {
    const airingAt = nextAiring.airingAt * 1000;
    if (airingAt > now) return airingAt;

    const episodeIsAvailable = episodes.some(
      (episode) => episode.number === nextAiring.episode,
    );
    if (episodeIsAvailable) {
      const followingAiring = airingAt + WEEK;
      return followingAiring > now ? followingAiring : now + HOUR;
    }

    return now + HOUR;
  }

  const previousNumbers = new Set(
    previousEpisodes?.map((episode) => episode.number) ?? [],
  );
  const hasNewEpisode = episodes.some(
    (episode) => !previousNumbers.has(episode.number),
  );
  if (hasNewEpisode && anime?.status === 'RELEASING') return now + WEEK;

  return now + HOUR;
}

function cachedEpisodeList(data: unknown): data is CachedEpisodeList {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Partial<CachedEpisodeList>;
  return (
    Array.isArray(candidate.episodes) &&
    typeof candidate.expiresAt === 'number' &&
    Number.isFinite(candidate.expiresAt)
  );
}

function dateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function artworkIdentity(anime: AnimeResult): AnimeArtworkIdentity | null {
  const expectedTitles = [
    anime.title.english,
    anime.title.romaji,
    anime.title.native,
  ].filter((title): title is string => Boolean(title?.trim()));
  return expectedTitles.length ? { animeId: anime.id, expectedTitles } : null;
}

function mergeTaizen<T extends AnimeResult>(
  anime: T,
  metadata: Awaited<ReturnType<typeof loadTaizen>>,
): T {
  if (!metadata || metadata.animeId !== anime.id) return anime;
  return {
    ...anime,
    banner: metadata.background || anime.banner,
    logo: metadata.logo || anime.logo,
  };
}

async function loadTaizen(
  identity: AnimeArtworkIdentity,
): Promise<AnimeTaizenMetadata | null> {
  const bridge = window.animonkey?.artwork;
  if (!bridge) return null;
  try {
    const result = await bridge.getMetadata([identity]);
    return (
      result.items.find((item) => item.animeId === identity.animeId) ?? null
    );
  } catch {
    return null;
  }
}

export const animeQueryKeys = {
  home: (includeAdult = false) => ['catalog', 'home', includeAdult] as const,
  spotlight: (identities: AnimeArtworkIdentity[]) =>
    [
      'anime',
      'spotlight-v2',
      identities.map((identity) => [
        identity.animeId,
        ...identity.expectedTitles,
      ]),
    ] as const,
  schedule: (date: string, includeAdult = false) =>
    ['catalog', 'schedule', date, includeAdult] as const,
  list: (
    sort: string[],
    status: string | undefined,
    page: number,
    includeAdult = false,
  ) => ['catalog', 'list', sort, status ?? null, page, includeAdult] as const,
  searchOptions: (includeAdult = false) =>
    ['catalog', 'search-options', includeAdult] as const,
  search: (
    keyword: string,
    page: number,
    filters: AnimeSearchFilters | undefined,
  ) => ['catalog', 'search', keyword.trim(), page, filters ?? null] as const,
  detail: (id: string, includeAdult = false) =>
    ['anime', 'detail', id, includeAdult] as const,
  anilistDetail: (id: string, includeAdult = false) =>
    ['anime', 'anilist', id, includeAdult] as const,
  airingEpisodes: (ids: string[], includeAdult = false) =>
    ['catalog', 'airing-notifications', ids, includeAdult] as const,
  taizen: (id: string) => ['anime', 'taizen', id] as const,
  episodes: (id: string) => ['anivexa', 'episodes', id] as const,
  servers: (episodeId: string) => ['anivexa', 'servers', episodeId] as const,
  sources: (episodeId: string, serverId: string | undefined) =>
    ['anivexa', 'sources', episodeId, serverId ?? null] as const,
};

export const animeQueries = {
  home(includeAdult = false) {
    return queryOptions({
      queryKey: animeQueryKeys.home(includeAdult),
      staleTime: 30 * MINUTE,
      gcTime: 2 * DAY,
      queryFn: ({ signal }) => AniListCatalog.home(signal, includeAdult),
    });
  },
  spotlight(client: QueryClient, candidates: AnimeResult[]) {
    const identities = [
      ...new Map(
        candidates.slice(0, 6).flatMap((anime) => {
          const identity = artworkIdentity(anime);
          return identity ? [[identity.animeId, identity] as const] : [];
        }),
      ).values(),
    ];
    return queryOptions({
      queryKey: animeQueryKeys.spotlight(identities),
      staleTime: DAY,
      gcTime: 7 * DAY,
      queryFn: async (): Promise<AnimeArtworkMetadataResponse> => {
        const bridge = window.animonkey?.artwork;
        if (!identities.length) return { items: [], retryable: false };
        if (!bridge) return { items: [], retryable: true };
        const response = await bridge.getMetadata(identities);
        const byId = new Map(
          response.items.map((item) => [item.animeId, item] as const),
        );
        for (const identity of identities) {
          const metadata = byId.get(identity.animeId);
          if (metadata || !response.retryable)
            client.setQueryData(
              animeQueryKeys.taizen(identity.animeId),
              metadata ?? null,
            );
        }
        return {
          items: identities.flatMap((identity) => {
            const item = byId.get(identity.animeId);
            return item ? [item] : [];
          }),
          retryable: response.retryable,
        };
      },
      refetchInterval: (query) =>
        query.state.data?.retryable ? 65_000 : false,
      refetchIntervalInBackground: false,
    });
  },
  schedule(date: Date, includeAdult = false) {
    const key = dateKey(date);
    return queryOptions({
      queryKey: animeQueryKeys.schedule(key, includeAdult),
      staleTime: 5 * MINUTE,
      gcTime: DAY,
      queryFn: ({ signal }) =>
        AniListCatalog.schedule(date, signal, includeAdult),
    });
  },
  list(
    sort: string[],
    status: 'FINISHED' | 'RELEASING' | undefined,
    page: number,
    includeAdult = false,
  ) {
    return queryOptions({
      queryKey: animeQueryKeys.list(sort, status, page, includeAdult),
      staleTime: 6 * 60 * MINUTE,
      gcTime: DAY,
      queryFn: ({ signal }) =>
        AniListCatalog.list(sort, status, page, signal, includeAdult),
    });
  },
  searchOptions(includeAdult = false) {
    return queryOptions({
      queryKey: animeQueryKeys.searchOptions(includeAdult),
      staleTime: DAY,
      gcTime: 7 * DAY,
      queryFn: ({ signal }) =>
        AniListCatalog.searchOptions(signal, includeAdult),
    });
  },
  search(
    keyword: string,
    page: number,
    filters: AnimeSearchFilters,
    includeAdult = false,
  ) {
    const effectiveFilters = {
      ...filters,
      adultMode: filters.adultMode ?? (includeAdult ? 'include' : 'exclude'),
    } satisfies AnimeSearchFilters;
    return queryOptions({
      queryKey: animeQueryKeys.search(keyword, page, effectiveFilters),
      staleTime: 6 * 60 * MINUTE,
      gcTime: DAY,
      queryFn: ({ signal }) =>
        AniListCatalog.search(keyword, page, signal, effectiveFilters),
    });
  },
  taizen(identity: AnimeArtworkIdentity) {
    return queryOptions({
      queryKey: animeQueryKeys.taizen(identity.animeId),
      staleTime: DAY,
      gcTime: 7 * DAY,
      queryFn: () => loadTaizen(identity),
    });
  },
  anilistDetail(id: string, includeAdult = false) {
    return queryOptions({
      queryKey: animeQueryKeys.anilistDetail(id, includeAdult),
      staleTime: DAY,
      gcTime: 7 * DAY,
      retry: false,
      queryFn: ({ signal }) =>
        AniListCatalog.getAnime(id, signal, includeAdult),
    });
  },
  airingEpisodes(ids: string[], includeAdult = false) {
    const sortedIds = [...new Set(ids)].sort();
    return queryOptions({
      queryKey: animeQueryKeys.airingEpisodes(sortedIds, includeAdult),
      staleTime: 10 * MINUTE,
      gcTime: DAY,
      queryFn: ({ signal }): Promise<AnimeAiringInfo[]> =>
        AniListCatalog.airingEpisodes(sortedIds, signal, includeAdult),
    });
  },
  detail(client: QueryClient, id: string, includeAdult = false) {
    return queryOptions({
      queryKey: animeQueryKeys.detail(id, includeAdult),
      staleTime: DAY,
      gcTime: 7 * DAY,
      retry: false,
      queryFn: async ({ signal }): Promise<AnimeInfo | null> => {
        const anime = await client.fetchQuery({
          ...animeQueries.anilistDetail(id, includeAdult),
          queryFn: ({ signal: nestedSignal }) =>
            AniListCatalog.getAnime(
              id,
              AbortSignal.any([signal, nestedSignal]),
              includeAdult,
            ),
        });
        if (!anime) return null;
        const identity = artworkIdentity(anime);
        if (!identity) return anime;
        try {
          const home = client.getQueryData<
            Awaited<ReturnType<typeof AniListCatalog.home>>
          >(animeQueryKeys.home(includeAdult));
          const spotlight = home?.banner.slice(0, 6) ?? [];
          const isSpotlight = spotlight.some(
            (candidate) => candidate.id === anime.id,
          );
          let metadata: AnimeTaizenMetadata | null;
          if (isSpotlight) {
            await client.fetchQuery(animeQueries.spotlight(client, spotlight));
            metadata =
              client.getQueryData<AnimeTaizenMetadata | null>(
                animeQueryKeys.taizen(anime.id),
              ) ?? null;
          } else {
            metadata = await client.fetchQuery(animeQueries.taizen(identity));
          }
          return mergeTaizen(anime, metadata);
        } catch {
          return anime;
        }
      },
    });
  },
  episodes(id: string, anime: AnimeInfo | null = null) {
    const queryKey = animeQueryKeys.episodes(id);
    const cacheKey = episodeCacheKey(id);
    return queryOptions<CachedEpisodeList, Error, AnimeEpisode[]>({
      queryKey,
      staleTime: (query) => {
        const data = query.state.data;
        return cachedEpisodeList(data)
          ? Math.max(0, data.expiresAt - Date.now())
          : 0;
      },
      gcTime: DAY,
      select: (data) => data.episodes,
      queryFn: async ({ signal, client }): Promise<CachedEpisodeList> => {
        let cached: Awaited<
          ReturnType<typeof getCatalogCache<AnimeEpisode[]>>
        > = null;
        try {
          cached = await getCatalogCache<AnimeEpisode[]>(cacheKey);
        } catch {
          // Local persistence is an optimization; Anivexa remains available.
        }

        const isInvalidated = client.getQueryState(queryKey)?.isInvalidated;
        if (cached?.isFresh && !isInvalidated) {
          return { episodes: cached.value, expiresAt: cached.expiresAt };
        }

        try {
          const episodes = await AnivexaCatalog.episodes(id, signal);
          const now = Date.now();
          const expiresAt = nextEpisodeListExpiration(
            anime,
            episodes,
            cached?.value ?? null,
            now,
          );
          const result = { episodes, expiresAt };
          try {
            await putCatalogCacheUntil(cacheKey, episodes, expiresAt);
          } catch {
            // A storage failure must not fail a successful provider request.
          }
          return result;
        } catch (error) {
          if (signal.aborted || !cached) throw error;

          const expiresAt = Date.now() + HOUR;
          try {
            await putCatalogCacheUntil(cacheKey, cached.value, expiresAt);
          } catch {
            // Keep the current session usable even if offline data cannot save.
          }
          return { episodes: cached.value, expiresAt };
        }
      },
    });
  },
  servers(episodeId: string) {
    return queryOptions({
      queryKey: animeQueryKeys.servers(episodeId),
      staleTime: 2 * MINUTE,
      gcTime: 5 * MINUTE,
      queryFn: ({ signal }) => AnivexaCatalog.servers(episodeId, signal),
    });
  },
  sources(episodeId: string, serverId?: string) {
    return queryOptions<EpisodeSources>({
      queryKey: animeQueryKeys.sources(episodeId, serverId),
      staleTime: 10 * 1000,
      gcTime: 30 * 1000,
      queryFn: ({ signal }) =>
        AnivexaCatalog.sources(episodeId, serverId, signal),
    });
  },
};

export function mergeAnimeMetadata(
  anime: AnimeResult,
  metadata: Awaited<ReturnType<typeof loadTaizen>>,
): AnimeResult {
  return mergeTaizen(anime, metadata);
}
