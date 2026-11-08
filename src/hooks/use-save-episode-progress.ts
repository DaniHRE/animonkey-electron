import { useCallback } from 'react';
import { saveEpisodeProgress } from '@/services/cache/local-db';

export function useSaveEpisodeProgress(
  animeId: string,
  episodeId: string,
  episodeNumber: number | undefined,
) {
  const save = useCallback(
    (currentTime: number, duration: number): void => {
      if (
        episodeNumber === undefined ||
        !Number.isFinite(duration) ||
        duration <= 0
      )
        return;
      void saveEpisodeProgress({
        animeId,
        episodeId,
        episodeNumber,
        currentTime,
        duration,
      }).catch(() => {
        // Keep video playback available if local storage is unavailable.
      });
    },
    [animeId, episodeId, episodeNumber],
  );
  return { save };
}
