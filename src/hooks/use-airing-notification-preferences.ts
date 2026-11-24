import { useCallback } from 'react';
import { useLocalPreference } from '@/hooks/use-local-preference';
import {
  AIRING_NOTIFICATION_PREFERENCE_KEYS,
  isFollowedAnimeList,
  MAX_FOLLOWED_ANIME,
  type FollowedAnimeRecord,
} from '@/lib/airing-notifications';
import type { AnimeInfo } from '@/types/anime';

const EMPTY_FOLLOWED_ANIME: FollowedAnimeRecord[] = [];

export function useAiringNotificationPreferences() {
  const enabledPreference = useLocalPreference<unknown>(
    AIRING_NOTIFICATION_PREFERENCE_KEYS.enabled,
    false,
  );
  const {
    value: followedValue,
    updateAndWait: updateFollowedValue,
    loaded: followedAnimeLoaded,
  } = useLocalPreference<unknown>(
    AIRING_NOTIFICATION_PREFERENCE_KEYS.followedAnime,
    EMPTY_FOLLOWED_ANIME,
  );
  const followedAnime = isFollowedAnimeList(followedValue)
    ? followedValue
    : EMPTY_FOLLOWED_ANIME;

  const setFollowedAnime = useCallback(
    async (next: FollowedAnimeRecord[]) => {
      if (isFollowedAnimeList(next)) await updateFollowedValue(next);
    },
    [updateFollowedValue],
  );

  const toggleFollow = useCallback(
    async (anime: AnimeInfo): Promise<'added' | 'removed' | 'limit'> => {
      const existing = followedAnime.some((item) => item.animeId === anime.id);
      if (existing) {
        await setFollowedAnime(
          followedAnime.filter((item) => item.animeId !== anime.id),
        );
        return 'removed';
      }
      if (followedAnime.length >= MAX_FOLLOWED_ANIME) return 'limit';

      const nextAir = anime.nextAiringEpisode;
      const episode = nextAir?.episode ?? anime.airingEpisode ?? 0;
      const airingAt = nextAir?.airingAt ?? anime.airingAt;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const lastNotifiedEpisode =
        episode > 0 && airingAt !== undefined && airingAt > nowSeconds
          ? episode - 1
          : episode;
      await setFollowedAnime([
        ...followedAnime,
        { animeId: anime.id, lastNotifiedEpisode },
      ]);
      return 'added';
    },
    [followedAnime, setFollowedAnime],
  );

  return {
    notificationsEnabled: enabledPreference.value === true,
    notificationsLoaded: enabledPreference.loaded,
    setNotificationsEnabled: enabledPreference.update,
    followedAnime,
    followedAnimeLoaded,
    setNotificationsEnabledAndWait: enabledPreference.updateAndWait,
    setFollowedAnime,
    isFollowing: (animeId: string) =>
      followedAnime.some((item) => item.animeId === animeId),
    toggleFollow,
  };
}
