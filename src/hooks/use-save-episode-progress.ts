import { useCallback } from 'react';
import { useRecordWatchProgressPreference } from '@/hooks/use-watch-history-preferences';
import { saveEpisodeProgress } from '@/services/cache/local-db';

export function useSaveEpisodeProgress(
  animeId: string,
  episodeId: string,
  episodeNumber: number | undefined,
) {
  const { enabled, loaded } = useRecordWatchProgressPreference();
  const save = useCallback(
    (currentTime: number, duration: number): void => {
      if (
        !loaded ||
        !enabled ||
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
    [animeId, enabled, episodeId, episodeNumber, loaded],
  );
  return { save };
}
