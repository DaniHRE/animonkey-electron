import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdultContentPreference } from '@/hooks/use-adult-content-preference';
import { useAiringNotificationPreferences } from '@/hooks/use-airing-notification-preferences';
import { useTitleLanguage } from '@/hooks/use-title-language';
import { resolveAnimeTitle } from '@/lib/anime';
import { addAppNotification } from '@/services/cache/local-db';
import { animeQueries } from '@/services/anime-queries';

const AIRING_CHECK_INTERVAL_MS = 15 * 60 * 1000;

export function useAiringNotificationMonitor(): void {
  const queryClient = useQueryClient();
  const { includeAdult } = useAdultContentPreference();
  const { titleLanguage } = useTitleLanguage();
  const {
    notificationsEnabled,
    notificationsLoaded,
    followedAnime,
    followedAnimeLoaded,
    setFollowedAnime,
  } = useAiringNotificationPreferences();
  const checking = useRef(false);

  useEffect(() => {
    if (
      !notificationsLoaded ||
      !followedAnimeLoaded ||
      !notificationsEnabled ||
      followedAnime.length === 0
    )
      return;

    let active = true;
    const check = async () => {
      if (!navigator.onLine || checking.current) return;
      checking.current = true;
      try {
        const anime = await queryClient.fetchQuery({
          ...animeQueries.airingEpisodes(
            followedAnime.map((item) => item.animeId),
            includeAdult,
          ),
          staleTime: 0,
        });
        if (!active) return;

        const byId = new Map(anime.map((item) => [item.id, item] as const));
        const nextFollowed = [...followedAnime];
        let changed = false;
        const nowSeconds = Math.floor(Date.now() / 1000);

        for (const followed of followedAnime) {
          const item = byId.get(followed.animeId);
          const airing = item?.nextAiringEpisode;
          if (
            !item ||
            !airing ||
            airing.episode <= followed.lastNotifiedEpisode
          )
            continue;

          const episode =
            airing.airingAt <= nowSeconds
              ? airing.episode
              : airing.episode > followed.lastNotifiedEpisode + 1
                ? airing.episode - 1
                : null;
          if (episode === null || episode <= followed.lastNotifiedEpisode)
            continue;

          const shown = await window.animonkey.notifications.showNewEpisode({
            animeId: item.id,
            title: resolveAnimeTitle(item.title, titleLanguage),
            episode,
          });
          if (!active) return;
          if (!shown) continue;
          void addAppNotification({
            id: `episode-ready:${item.id}:${episode}`,
            kind: 'episode-ready',
            title:
              resolveAnimeTitle(item.title, titleLanguage).slice(0, 120) ||
              'Novo episódio',
            message: `Episódio ${episode} já foi lançado.`,
            animeId: item.id,
            episode,
            ...(item.image ? { posterUrl: item.image } : {}),
          }).catch(() => undefined);
          const index = nextFollowed.findIndex(
            (current) => current.animeId === followed.animeId,
          );
          if (index < 0) continue;
          nextFollowed[index] = {
            animeId: followed.animeId,
            lastNotifiedEpisode: episode,
          };
          changed = true;
        }
        if (changed && active) await setFollowedAnime(nextFollowed);
      } catch {
        // Keep the previous episode marker so a later check can retry.
      } finally {
        checking.current = false;
      }
    };

    void check();
    const interval = window.setInterval(
      () => void check(),
      AIRING_CHECK_INTERVAL_MS,
    );
    window.addEventListener('online', check);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('online', check);
    };
  }, [
    followedAnime,
    followedAnimeLoaded,
    includeAdult,
    notificationsEnabled,
    notificationsLoaded,
    queryClient,
    setFollowedAnime,
    titleLanguage,
  ]);
}
