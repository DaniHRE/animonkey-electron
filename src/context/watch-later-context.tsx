import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  deleteWatchLater,
  getAllWatchLater,
  putWatchLater,
} from '@/services/cache/local-db';
import type { AnimeResult, WatchLaterItem } from '@/types/anime';
import { WatchLaterContext } from '@/context/watch-later-state';

export function WatchLaterProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchLaterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const ids = useMemo(
    () => new Set(items.map((item) => item.animeId)),
    [items],
  );

  useEffect(() => {
    let active = true;
    const refresh = () => {
      getAllWatchLater()
        .then((storedItems) => {
          if (active) setItems(storedItems);
        })
        .catch(() => {
          if (active) setItems([]);
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    };
    refresh();
    window.addEventListener('animonkey:local-data-imported', refresh);
    return () => {
      active = false;
      window.removeEventListener('animonkey:local-data-imported', refresh);
    };
  }, []);

  const isInList = useCallback((animeId: string) => ids.has(animeId), [ids]);

  const toggle = useCallback(
    async (anime: AnimeResult): Promise<boolean> => {
      if (ids.has(anime.id)) {
        await deleteWatchLater(anime.id);
        setItems((current) =>
          current.filter((item) => item.animeId !== anime.id),
        );
        return false;
      }
      const item: WatchLaterItem = {
        animeId: anime.id,
        title: anime.title,
        image: anime.image,
        type: anime.type,
        totalEpisodes: anime.totalEpisodes,
        genres: anime.genres,
        releaseDate: anime.releaseDate,
        addedAt: Date.now(),
      };
      await putWatchLater(item);
      setItems((current) => [
        item,
        ...current.filter((entry) => entry.animeId !== anime.id),
      ]);
      return true;
    },
    [ids],
  );

  const remove = useCallback(async (animeId: string): Promise<void> => {
    await deleteWatchLater(animeId);
    setItems((current) => current.filter((item) => item.animeId !== animeId));
  }, []);

  const value = useMemo(
    () => ({ items, isLoading, isInList, toggle, remove }),
    [items, isLoading, isInList, toggle, remove],
  );

  return (
    <WatchLaterContext.Provider value={value}>
      {children}
    </WatchLaterContext.Provider>
  );
}
