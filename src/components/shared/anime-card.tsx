import { Bookmark, BookmarkCheck, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useWatchLater } from '@/hooks/use-watch-later';
import { getAnimeImage, resolveAnimeTitle } from '@/lib/anime';
import { useTitleLanguage } from '@/hooks/use-title-language';
import type { AnimeResult } from '@/types/anime';

interface AnimeCardProps {
  anime: AnimeResult;
  rank?: number;
}

export function AnimeCard({ anime, rank }: AnimeCardProps) {
  const image = getAnimeImage(anime);
  const { titleLanguage } = useTitleLanguage();
  const { isInList, toggle } = useWatchLater();
  const [error, setError] = useState(false);
  const saved = isInList(anime.id);

  async function handleToggle(): Promise<void> {
    setError(false);
    try {
      await toggle(anime);
    } catch {
      setError(true);
    }
  }

  return (
    <article className="group relative min-w-0">
      <Link to="/anime/$id" params={{ id: anime.id }} className="block">
        <div className="relative aspect-[0.71] overflow-hidden rounded-xl border border-white/[0.06] bg-[#161618]">
          {image ? (
            <img
              src={image}
              alt={resolveAnimeTitle(anime.title, titleLanguage)}
              loading="lazy"
              className="size-full object-cover transition duration-500 group-hover:scale-[1.045]"
            />
          ) : (
            <div className="grid size-full place-items-center text-xs text-white/25">
              Sem imagem
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
          {rank !== undefined && (
            <span className="absolute top-2.5 left-2.5 rounded-md border border-white/10 bg-black/55 px-2 py-1 text-xs font-bold text-white backdrop-blur">
              #{rank}
            </span>
          )}
          {anime.isAdult && (
            <span className="absolute left-2.5 bottom-2.5 rounded-md border border-red-200/15 bg-red-950/75 px-2 py-1 text-xs font-bold tracking-wide text-red-100">
              18+
            </span>
          )}
          {anime.rating !== undefined && (
            <span className="absolute right-2.5 bottom-2.5 flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-xs font-bold backdrop-blur">
              <Star size={11} className="fill-[#ffc658] text-[#ffc658]" />
              {anime.rating.toFixed(1)}
            </span>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={() => void handleToggle()}
        aria-label={
          saved ? 'Remover de Assistir Depois' : 'Adicionar a Assistir Depois'
        }
        aria-pressed={saved}
        className={`absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-lg border border-white/10 bg-black/65 text-white backdrop-blur transition ${saved ? 'text-[#72e995]' : 'text-white/80 opacity-0 hover:text-[#72e995] group-hover:opacity-100 focus-visible:opacity-100'}`}
      >
        {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
      </button>

      <Link
        to="/anime/$id"
        params={{ id: anime.id }}
        className="block px-0.5 pt-3"
      >
        <h3 className="line-clamp-2 text-xs leading-[1.45] font-semibold text-white/85 transition group-hover:text-[#70e793]">
          {resolveAnimeTitle(anime.title, titleLanguage)}
        </h3>
        <p className="mt-1.5 text-xs font-medium tracking-wide text-white/35">
          {[
            anime.type,
            anime.releaseDate,
            anime.totalEpisodes ? `${anime.totalEpisodes} eps` : undefined,
          ]
            .filter(Boolean)
            .join(' · ') || 'Anime'}
        </p>
      </Link>
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-300">
          Não foi possível salvar localmente.
        </span>
      )}
    </article>
  );
}
