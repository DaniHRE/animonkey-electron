import { Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveAnimeTitle } from '@/lib/anime';
import { AniListCatalog } from '@/services/anilist.service';
import {
  getRecentlyWatched,
  removeAnimeFromWatching,
} from '@/services/cache/local-db';
import { useWatchLater } from '@/hooks/use-watch-later';
import type { AnimeInfo, WatchLaterItem } from '@/types/anime';
import type { EpisodeProgressRecord } from '@/services/cache/local-db';
import { useTitleLanguage } from '@/hooks/use-title-language';

interface ContinueItem {
  progress: EpisodeProgressRecord;
  anime: AnimeInfo | null;
}

export function ContinueWatchingSection() {
  const [items, setItems] = useState<ContinueItem[]>([]);
  const { titleLanguage } = useTitleLanguage();

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const refresh = () => {
      const currentRequest = ++requestId;
      getRecentlyWatched(8)
        .then(async (records) => {
          const resolved = await Promise.all(
            records.map(async (progress) => ({
              progress,
              anime: await AniListCatalog.getAnime(progress.animeId),
            })),
          );
          if (active && currentRequest === requestId) setItems(resolved);
        })
        .catch(() => {
          if (active && currentRequest === requestId) setItems([]);
        });
    };

    refresh();
    window.addEventListener('animonkey:local-scope-changed', refresh);
    window.addEventListener('animonkey:account-sync-applied', refresh);
    window.addEventListener('animonkey:local-data-changed', refresh);
    return () => {
      active = false;
      window.removeEventListener('animonkey:local-scope-changed', refresh);
      window.removeEventListener('animonkey:account-sync-applied', refresh);
      window.removeEventListener('animonkey:local-data-changed', refresh);
    };
  }, []);

  if (!items.length) return null;

  async function dismiss(animeId: string) {
    await removeAnimeFromWatching(animeId);
    setItems((current) =>
      current.filter((item) => item.progress.animeId !== animeId),
    );
  }

  return (
    <section className="min-w-0 overflow-hidden">
      <HomeSectionHeading title="Continuar Assistindo" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map(({ progress, anime }) => {
          const title = anime
            ? resolveAnimeTitle(anime.title, titleLanguage)
            : `Anime ${progress.animeId}`;
          return (
            <article
              key={progress.key}
              className="group relative w-36 shrink-0"
            >
              <Link
                to={`/watch/${progress.animeId}?ep=${encodeURIComponent(progress.episodeId)}`}
                className="block"
              >
                <div className="relative aspect-[0.71] overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                  {anime?.image && (
                    <img
                      src={anime.image}
                      alt={title}
                      loading="lazy"
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  )}
                  {!anime?.image && (
                    <div className="grid size-full place-items-center text-white/30">
                      <Play size={22} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                    <div
                      className="h-full bg-[#49d77a]"
                      style={{
                        width: `${Math.min(100, progress.percentage)}%`,
                      }}
                    />
                  </div>
                  <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Ep. {progress.episodeNumber}
                  </span>
                </div>
                <h3 className="mt-2 line-clamp-2 text-xs font-semibold text-white/85">
                  {title}
                </h3>
                <p className="mt-1 text-[10px] text-white/40">
                  {Math.round(progress.percentage)}% assistido
                </p>
              </Link>
              <button
                type="button"
                aria-label={`Remover ${title} do histórico`}
                onClick={() => {
                  void dismiss(progress.animeId).catch(() => undefined);
                }}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/75 text-white/75 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X size={13} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function WatchLaterSection() {
  const { items, isLoading, remove } = useWatchLater();
  const { titleLanguage } = useTitleLanguage();
  if (isLoading || !items.length) return null;

  return (
    <section className="min-w-0 overflow-hidden">
      <HomeSectionHeading title="Assistir Depois" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.slice(0, 10).map((item) => (
          <WatchLaterCard
            key={item.animeId}
            item={item}
            titleLanguage={titleLanguage}
            onRemove={() => {
              void remove(item.animeId).catch(() => undefined);
            }}
          />
        ))}
      </div>
    </section>
  );
}

function WatchLaterCard({
  item,
  titleLanguage,
  onRemove,
}: {
  item: WatchLaterItem;
  titleLanguage: 'en' | 'jp';
  onRemove: () => void;
}) {
  const title = resolveAnimeTitle(item.title, titleLanguage);
  return (
    <article className="group relative w-36 shrink-0">
      <Link to={`/anime/${item.animeId}`} className="block">
        <div className="aspect-[0.71] overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
          {item.image && (
            <img
              src={item.image}
              alt={title}
              loading="lazy"
              className="size-full object-cover transition duration-300 group-hover:scale-105"
            />
          )}
        </div>
        <h3 className="mt-2 line-clamp-2 text-xs font-semibold text-white/85">
          {title}
        </h3>
        <p className="mt-1 text-[10px] text-white/40">
          {[item.type, item.releaseDate].filter(Boolean).join(' · ')}
        </p>
      </Link>
      <button
        type="button"
        aria-label={`Remover ${title} de Assistir Depois`}
        onClick={onRemove}
        className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/75 text-white/75 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X size={13} />
      </button>
    </article>
  );
}

function HomeSectionHeading({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="h-6 w-1 rounded-full bg-[#2caf57]" />
      <h2 className="text-lg font-semibold text-white">{title}</h2>
    </div>
  );
}
