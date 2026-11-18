import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { AnivexaCatalog } from '@/services/anivexa.service';
import { AniListCatalog } from '@/services/anilist.service';
import type {
  AnimeArtworkIdentity,
  AnimeArtworkMetadataResponse,
  AnimeInfo,
  AnimeResult,
  AnimeSearchFilters,
  AnimeTaizenMetadata,
} from '@/types/anime';
import type { EpisodeSources } from '@/types/player';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

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
    banner: metadata.banner || anime.banner,
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
  home: ['catalog', 'home'] as const,
  spotlight: (identities: AnimeArtworkIdentity[]) =>
    [
      'anime',
      'spotlight-v2',
      identities.map((identity) => [
        identity.animeId,
        ...identity.expectedTitles,
      ]),
    ] as const,
  schedule: (date: string) => ['catalog', 'schedule', date] as const,
  list: (sort: string[], status: string | undefined, page: number) =>
    ['catalog', 'list', sort, status ?? null, page] as const,
  searchOptions: ['catalog', 'search-options'] as const,
  search: (
    keyword: string,
    page: number,
    filters: AnimeSearchFilters | undefined,
  ) => ['catalog', 'search', keyword.trim(), page, filters ?? null] as const,
  detail: (id: string) => ['anime', 'detail', id] as const,
  anilistDetail: (id: string) => ['anime', 'anilist', id] as const,
  taizen: (id: string) => ['anime', 'taizen', id] as const,
  episodes: (id: string) => ['anivexa', 'episodes', id] as const,
  servers: (episodeId: string) => ['anivexa', 'servers', episodeId] as const,
  sources: (episodeId: string, serverId: string | undefined) =>
    ['anivexa', 'sources', episodeId, serverId ?? null] as const,
};

export const animeQueries = {
  home() {
    return queryOptions({
      queryKey: animeQueryKeys.home,
      staleTime: 30 * MINUTE,
      gcTime: 2 * DAY,
      queryFn: ({ signal }) => AniListCatalog.home(signal),
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
  schedule(date: Date) {
    const key = dateKey(date);
    return queryOptions({
      queryKey: animeQueryKeys.schedule(key),
      staleTime: 5 * MINUTE,
      gcTime: DAY,
      queryFn: ({ signal }) => AniListCatalog.schedule(date, signal),
    });
  },
  list(
    sort: string[],
    status: 'FINISHED' | 'RELEASING' | undefined,
    page: number,
  ) {
    return queryOptions({
      queryKey: animeQueryKeys.list(sort, status, page),
      staleTime: 6 * 60 * MINUTE,
      gcTime: DAY,
      queryFn: ({ signal }) => AniListCatalog.list(sort, status, page, signal),
    });
  },
  searchOptions() {
    return queryOptions({
      queryKey: animeQueryKeys.searchOptions,
      staleTime: DAY,
      gcTime: 7 * DAY,
      queryFn: ({ signal }) => AniListCatalog.searchOptions(signal),
    });
  },
  search(keyword: string, page: number, filters: AnimeSearchFilters) {
    return queryOptions({
      queryKey: animeQueryKeys.search(keyword, page, filters),
      staleTime: 6 * 60 * MINUTE,
      gcTime: DAY,
      queryFn: ({ signal }) =>
        AniListCatalog.search(keyword, page, signal, filters),
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
  anilistDetail(id: string) {
    return queryOptions({
      queryKey: animeQueryKeys.anilistDetail(id),
      staleTime: DAY,
      gcTime: 7 * DAY,
      retry: false,
      queryFn: ({ signal }) => AniListCatalog.getAnime(id, signal),
    });
  },
  detail(client: QueryClient, id: string) {
    return queryOptions({
      queryKey: animeQueryKeys.detail(id),
      staleTime: DAY,
      gcTime: 7 * DAY,
      retry: false,
      queryFn: async ({ signal }): Promise<AnimeInfo | null> => {
        const anime = await client.fetchQuery({
          ...animeQueries.anilistDetail(id),
          queryFn: ({ signal: nestedSignal }) =>
            AniListCatalog.getAnime(
              id,
              AbortSignal.any([signal, nestedSignal]),
            ),
        });
        if (!anime) return null;
        const identity = artworkIdentity(anime);
        if (!identity) return anime;
        try {
          const home = client.getQueryData<
            Awaited<ReturnType<typeof AniListCatalog.home>>
          >(animeQueryKeys.home);
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
  episodes(id: string) {
    return queryOptions({
      queryKey: animeQueryKeys.episodes(id),
      staleTime: 30 * MINUTE,
      gcTime: DAY,
      queryFn: ({ signal }) => AnivexaCatalog.episodes(id, signal),
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
