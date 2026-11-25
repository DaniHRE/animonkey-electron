import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  deleteWatchLater,
  getAllWatchLater,
  putWatchLater,
} from '@/services/cache/local-db';
import type { AnimeResult, WatchLaterItem } from '@/types/anime';
import { WatchLaterContext } from '@/context/watch-later-state';
import { notifyActionFeedback } from '@/lib/action-feedback';

export function WatchLaterProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchLaterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const ids = useMemo(
    () => new Set(items.map((item) => item.animeId)),
    [items],
  );

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const refresh = () => {
      const currentRequest = ++requestId;
      getAllWatchLater()
        .then((storedItems) => {
          if (active && currentRequest === requestId) setItems(storedItems);
        })
        .catch(() => {
          if (active && currentRequest === requestId) setItems([]);
        })
        .finally(() => {
          if (active && currentRequest === requestId) setIsLoading(false);
        });
    };
    const refreshForScope = () => {
      setItems([]);
      setIsLoading(true);
      refresh();
    };
    refresh();
    window.addEventListener('animonkey:local-data-imported', refresh);
    window.addEventListener('animonkey:local-scope-changed', refreshForScope);
    window.addEventListener('animonkey:account-sync-applied', refresh);
    return () => {
      active = false;
      window.removeEventListener('animonkey:local-data-imported', refresh);
      window.removeEventListener(
        'animonkey:local-scope-changed',
        refreshForScope,
      );
      window.removeEventListener('animonkey:account-sync-applied', refresh);
    };
  }, []);

  const isInList = useCallback((animeId: string) => ids.has(animeId), [ids]);

  const toggle = useCallback(
    async (anime: AnimeResult): Promise<boolean> => {
      const title = anime.title.english ?? anime.title.romaji ?? 'Anime';
      try {
        if (ids.has(anime.id)) {
          await deleteWatchLater(anime.id);
          setItems((current) =>
            current.filter((item) => item.animeId !== anime.id),
          );
          notifyActionFeedback({
            tone: 'success',
            title: 'Removido de Assistir Depois',
            message: `${title} saiu da sua lista.`,
            animeId: anime.id,
            posterUrl: anime.image,
          });
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
        notifyActionFeedback({
          tone: 'success',
          title: 'Adicionado a Assistir Depois',
          message: `${title} foi salvo na sua lista.`,
          animeId: anime.id,
          posterUrl: anime.image,
        });
        return true;
      } catch {
        notifyActionFeedback({
          tone: 'error',
          title: 'Não foi possível atualizar a lista',
          message: `A lista de ${title} não foi alterada. Tente novamente.`,
          animeId: anime.id,
          posterUrl: anime.image,
        });
        throw new Error('Não foi possível atualizar a lista Assistir Depois.');
      }
    },
    [ids],
  );

  const remove = useCallback(async (animeId: string): Promise<void> => {
    try {
      await deleteWatchLater(animeId);
      setItems((current) => current.filter((item) => item.animeId !== animeId));
      notifyActionFeedback({
        tone: 'success',
        title: 'Anime removido',
        message: 'O anime saiu de Assistir Depois.',
        animeId,
      });
    } catch {
      notifyActionFeedback({
        tone: 'error',
        title: 'Não foi possível remover o anime',
        message: 'Sua lista não foi alterada. Tente novamente.',
        animeId,
      });
      throw new Error('Não foi possível remover o anime da lista.');
    }
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
