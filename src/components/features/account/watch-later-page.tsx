import { Bookmark, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useWatchLater } from '@/hooks/use-watch-later';
import { getAnimeImage, resolveAnimeTitle } from '@/lib/anime';
import type { AnimeResult, WatchLaterItem } from '@/types/anime';
import { Link } from 'react-router-dom';
import { useTitleLanguage } from '@/hooks/use-title-language';

function toAnime(item: WatchLaterItem): AnimeResult {
  return {
    id: item.animeId,
    mediaType: 'ANIME',
    isAdult: false,
    title: item.title,
    image: item.image,
    genres: item.genres,
    type: item.type,
    totalEpisodes: item.totalEpisodes,
    releaseDate: item.releaseDate,
  };
}

export function WatchLaterPage() {
  const { titleLanguage } = useTitleLanguage();
  const { items, isLoading, remove } = useWatchLater();
  const [error, setError] = useState<string | null>(null);

  async function removeItem(animeId: string): Promise<void> {
    setError(null);
    try {
      await remove(animeId);
    } catch {
      setError('Não foi possível remover este anime do armazenamento local.');
    }
  }

  return (
    <section>
      <div className="mb-7">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
          <Bookmark size={13} /> Biblioteca
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Assistir Depois</h1>
        <p className="mt-2 text-xs text-white/40">
          Sua lista fica salva neste dispositivo e funciona offline.
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-xs text-red-300">
          {error}
        </p>
      )}
      {isLoading ? (
        <div className="h-36 animate-pulse rounded-xl bg-white/[0.04]" />
      ) : items.length ? (
        <div className="grid grid-cols-6 gap-x-5 gap-y-8">
          {items.map((item) => {
            const anime = toAnime(item);
            const image = getAnimeImage(anime);
            return (
              <article key={item.animeId} className="group relative min-w-0">
                <Link to={`/anime/${item.animeId}`} className="block">
                  <div className="aspect-[0.71] overflow-hidden rounded-xl border border-white/[0.06] bg-[#161618]">
                    {image ? (
                      <img
                        src={image}
                        alt={resolveAnimeTitle(item.title, titleLanguage)}
                        loading="lazy"
                        className="size-full object-cover transition duration-500 group-hover:scale-[1.045]"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-xs text-white/25">
                        Sem imagem
                      </div>
                    )}
                  </div>
                  <h2 className="mt-3 line-clamp-2 text-[12px] leading-[1.45] font-semibold text-white/85">
                    {resolveAnimeTitle(item.title, titleLanguage)}
                  </h2>
                  <p className="mt-1.5 text-[10px] text-white/35">
                    {[
                      item.type,
                      item.releaseDate,
                      item.totalEpisodes
                        ? `${item.totalEpisodes} eps`
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => void removeItem(item.animeId)}
                  aria-label={`Remover ${resolveAnimeTitle(item.title, titleLanguage)} da lista`}
                  className="absolute top-2 right-2 grid size-8 place-items-center rounded-lg border border-white/10 bg-black/65 text-white/80 opacity-0 backdrop-blur transition hover:text-red-300 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-white/[0.04] text-white/35">
            <Bookmark size={20} />
          </span>
          <h2 className="text-sm font-bold">Sua lista está vazia</h2>
          <p className="mt-2 text-xs text-white/40">
            Adicione animes pelo ícone de marcador no catálogo.
          </p>
        </div>
      )}
    </section>
  );
}
