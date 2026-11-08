import { useEffect, useState } from 'react';
import { getEpisodeProgress } from '@/services/cache/local-db';
import type { EpisodeProgressRecord } from '@/services/cache/local-db';

export function useEpisodeProgress(
  animeId: string,
  episodeNumber: number | undefined,
): EpisodeProgressRecord | null {
  const [state, setState] = useState<{
    key: string;
    value: EpisodeProgressRecord | null;
  }>({ key: '', value: null });
  const key =
    animeId && episodeNumber !== undefined ? `${animeId}:${episodeNumber}` : '';

  useEffect(() => {
    if (!key || episodeNumber === undefined) return;
    let active = true;
    getEpisodeProgress(animeId, episodeNumber)
      .then((value) => {
        if (active) setState({ key, value });
      })
      .catch(() => {
        if (active) setState({ key, value: null });
      });
    return () => {
      active = false;
    };
  }, [animeId, episodeNumber, key]);

  return state.key === key ? state.value : null;
}
