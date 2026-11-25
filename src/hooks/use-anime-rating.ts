import { useCallback, useEffect, useState } from 'react';
import { useAccount } from '@/context/account-state';
import {
  deleteAnimeRating,
  getAnimeRating,
  putAnimeRating,
} from '@/services/cache/local-db';
import type { AnimeRating } from '@/types/anime';
import { notifyActionFeedback } from '@/lib/action-feedback';

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
      notifyActionFeedback({
        tone: 'success',
        title: 'Avaliação salva',
        message: 'Sua nota e seu comentário foram atualizados.',
        animeId,
      });
    } catch {
      notifyActionFeedback({
        tone: 'error',
        title: 'Não foi possível salvar a avaliação',
        message:
          'Sua nota não foi alterada. Verifique a conexão e tente novamente.',
        animeId,
      });
      throw new Error('Não foi possível salvar a avaliação.');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await deleteAnimeRating(animeId);
      setRating(null);
      notifyActionFeedback({
        tone: 'success',
        title: 'Avaliação removida',
        message: 'Sua avaliação saiu da biblioteca.',
        animeId,
      });
    } catch {
      notifyActionFeedback({
        tone: 'error',
        title: 'Não foi possível remover a avaliação',
        message: 'Sua avaliação foi mantida. Tente novamente.',
        animeId,
      });
      throw new Error('Não foi possível remover a avaliação.');
    } finally {
      setBusy(false);
    }
  };

  return { rating, busy, isAuthenticated: Boolean(session), save, clear };
}
