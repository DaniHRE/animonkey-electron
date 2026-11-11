import { useCallback, useEffect, useState } from 'react';
import { useAccount } from '@/context/account-state';
import {
  deleteAnimeRating,
  getAnimeRating,
  putAnimeRating,
} from '@/services/cache/local-db';
import type { AnimeRating } from '@/types/anime';

export function useAnimeRating(animeId: string) {
  const { session } = useAccount();
  const [rating, setRating] = useState<AnimeRating | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void getAnimeRating(animeId).then(setRating);
  }, [animeId]);

  useEffect(() => {
    refresh();
    window.addEventListener('animonkey:account-sync-applied', refresh);
    window.addEventListener('animonkey:local-scope-changed', refresh);
    return () => {
      window.removeEventListener('animonkey:account-sync-applied', refresh);
      window.removeEventListener('animonkey:local-scope-changed', refresh);
    };
  }, [refresh]);

  const save = async (score: number, review: string | null) => {
    setBusy(true);
    try {
      const next = {
        animeId,
        score,
        review: review?.trim() || null,
        updatedAt: Date.now(),
      };
      await putAnimeRating(next);
      setRating(next);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await deleteAnimeRating(animeId);
      setRating(null);
    } finally {
      setBusy(false);
    }
  };

  return { rating, busy, isAuthenticated: Boolean(session), save, clear };
}
