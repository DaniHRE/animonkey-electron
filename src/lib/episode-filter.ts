import type { AnimeEpisode } from '@/types/player';

export function filterAndSortEpisodes(
  episodes: AnimeEpisode[],
  query: string,
  ascending: boolean,
  includeDescription = false,
): AnimeEpisode[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = episodes.filter((episode) => {
    if (!episode.isSubbed) return false;
    if (!normalizedQuery) return true;
    return (
      episode.title?.toLocaleLowerCase().includes(normalizedQuery) ||
      String(episode.number).includes(normalizedQuery) ||
      (includeDescription &&
        episode.description?.toLocaleLowerCase().includes(normalizedQuery))
    );
  });

  return ascending ? filtered : filtered.reverse();
}
