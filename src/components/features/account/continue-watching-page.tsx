import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, X } from 'lucide-react';
import { AnimeCard } from '@/components/shared/anime-card';
import { AniListCatalog } from '@/services/anilist.service';
import {
  getRecentlyWatched,
  removeAnimeFromWatching,
} from '@/services/cache/local-db';
import type { AnimeInfo } from '@/types/anime';
import type { EpisodeProgressRecord } from '@/services/cache/local-db';
import { resolveAnimeTitle } from '@/lib/anime';

interface ContinueItem {
  progress: EpisodeProgressRecord;
  anime: AnimeInfo;
}

export function ContinueWatchingPage() {
  const [items, setItems] = useState<ContinueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getRecentlyWatched()
      .then(async (records) => {
        const resolved = await Promise.allSettled(
          records.map(async (progress) => {
            const anime = await AniListCatalog.getAnime(progress.animeId);
            return anime ? { progress, anime } : null;
          }),
        );
        if (active)
          setItems(
            resolved.flatMap((result) =>
              result.status === 'fulfilled' && result.value
                ? [result.value]
                : [],
            ),
          );
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Falha ao carregar o histórico.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = async (animeId: string) => {
    await removeAnimeFromWatching(animeId);
    setItems((current) =>
      current.filter((item) => item.progress.animeId !== animeId),
    );
  };

  return (
    <section>
      <p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
        Minha biblioteca
      </p>
      <h1 className="text-2xl font-bold tracking-tight">
        Continuar assistindo
      </h1>
      <p className="mt-2 mb-7 text-xs text-white/40">
        Seu progresso fica neste dispositivo.
      </p>
      {loading ? (
        <div className="grid grid-cols-3 gap-5">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="aspect-[3/4] animate-pulse rounded-xl bg-white/[0.035]"
            />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300/10 bg-red-400/[0.04] p-5 text-sm text-red-200/80"
        >
          {error}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-6 gap-x-5 gap-y-8">
          {items.map(({ anime, progress }) => (
            <article key={anime.id} className="group relative">
              <AnimeCard anime={anime} />
              <div className="mt-2 flex items-center justify-between gap-2">
                <Link
                  to={`/watch/${anime.id}?ep=${encodeURIComponent(progress.episodeId)}`}
                  className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[#70e793] hover:text-white"
                >
                  <Play size={12} fill="currentColor" /> Ep.{' '}
                  {progress.episodeNumber} · {Math.floor(progress.percentage)}%
                </Link>
                <button
                  type="button"
                  aria-label={`Remover ${resolveAnimeTitle(anime.title)} do histórico`}
                  onClick={() => void dismiss(anime.id)}
                  className="rounded p-1 text-white/35 hover:bg-white/10 hover:text-white"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-[#49d77a]"
                  style={{ width: `${Math.min(100, progress.percentage)}%` }}
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
          Os episódios retomados aparecerão aqui.
        </div>
      )}
    </section>
  );
}
