import { ArrowRight, CalendarDays, Flame, Play, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimeCard } from '@/components/shared/anime-card';
import { LoadingGrid } from '@/components/shared/loading-grid';
import { getAnimeImage, resolveAnimeTitle, stripHtml } from '@/lib/anime';
import { AniListCatalog } from '@/services/anilist.service';
import type { AnimeResult } from '@/types/anime';

type HomeData = Awaited<ReturnType<typeof AniListCatalog.home>>;

export function HomePage() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [schedule, setSchedule] = useState<AnimeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      AniListCatalog.home(controller.signal),
      AniListCatalog.schedule(new Date(), controller.signal),
    ])
      .then(([homeData, scheduleData]) => {
        setHome(homeData);
        setSchedule(scheduleData);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Falha ao carregar o catálogo.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const featured = home?.banner[0];
  const banner = featured ? getAnimeImage(featured) : undefined;

  return (
    <div className="space-y-10">
      <section className="relative isolate -mx-10 -mt-9 h-[370px] overflow-hidden border-b border-white/[0.05] bg-[#141416]">
        {banner && (
          <img
            src={banner}
            alt=""
            className="absolute inset-0 -z-20 size-full object-cover object-center opacity-40 blur-[1px]"
          />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b0b0c] via-[#0b0b0c]/85 to-[#0b0b0c]/30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b0b0c] via-transparent to-[#0b0b0c]/20" />
        <div className="flex h-full max-w-[760px] flex-col justify-center px-14 pb-2">
          <div className="mb-5 flex items-center gap-2 text-[10px] font-extrabold tracking-[0.2em] text-[#65e48e] uppercase">
            <Sparkles size={14} /> Anime em destaque
          </div>
          <h1 className="line-clamp-2 max-w-[670px] text-4xl leading-[1.1] font-extrabold tracking-tight text-white">
            {featured
              ? resolveAnimeTitle(featured.title)
              : 'Descubra seu próximo anime'}
          </h1>
          <p className="mt-4 line-clamp-3 max-w-[600px] text-sm leading-relaxed text-white/60">
            {featured
              ? stripHtml(featured.description) ||
                'Explore os animes mais populares da temporada.'
              : 'Explore um catálogo completo de animes, temporadas e descobertas.'}
          </p>
          <div className="mt-6 flex items-center gap-3">
            {featured && (
              <Link
                to={`/anime/${featured.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#49d77a] px-5 text-xs font-bold text-[#07110a] transition hover:bg-[#6ce995]"
              >
                <Play size={15} fill="currentColor" /> Ver detalhes
              </Link>
            )}
            <Link
              to="/search"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-5 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              Explorar catálogo <ArrowRight size={14} />
            </Link>
          </div>
        </div>
        <span className="absolute right-10 bottom-8 flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-semibold text-white/55 backdrop-blur">
          <span className="size-1.5 rounded-full bg-[#49d77a]" /> Dados do
          AniList
        </span>
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300/10 bg-red-400/[0.04] p-5 text-sm text-red-200/80"
        >
          {error}
        </div>
      ) : loading ? (
        <LoadingGrid />
      ) : home ? (
        <>
          <AnimeSection
            title="Em alta"
            eyebrow="Agora"
            icon="trending"
            items={home.trending.slice(0, 12)}
            link="/trending"
          />
          <AnimeSection
            title="Lançamentos"
            eyebrow="Temporada atual"
            icon="new"
            items={home.newReleases.slice(0, 6)}
            link="/updates"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-8">
            <AnimeSection
              title="Adicionados recentemente"
              eyebrow="Novidades no catálogo"
              items={home.recentlyAdded.slice(0, 6)}
              link="/recent"
            />
            <section>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <p className="mb-1.5 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
                    <CalendarDays size={13} /> Hoje
                  </p>
                  <h2 className="text-xl font-bold tracking-tight">Agenda</h2>
                </div>
                <Link
                  to="/schedule"
                  aria-label="Abrir agenda"
                  className="text-white/45 hover:text-white"
                >
                  <ArrowRight size={15} />
                </Link>
              </div>
              {schedule.length ? (
                <div className="space-y-2">
                  {schedule.slice(0, 5).map((anime) => (
                    <Link
                      key={`${anime.id}-${anime.airingEpisode}`}
                      to={`/anime/${anime.id}`}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 hover:bg-white/[0.04]"
                    >
                      <span className="grid size-9 place-items-center rounded-md bg-[#49d77a]/10 text-[10px] font-bold text-[#73e994]">
                        {new Intl.DateTimeFormat('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                          hour: '2-digit',
                          minute: '2-digit',
                          hourCycle: 'h23',
                        }).format(new Date((anime.airingAt ?? 0) * 1000))}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] font-semibold text-white/75">
                          {resolveAnimeTitle(anime.title)}
                        </span>
                        <span className="mt-1 block text-[9px] text-white/35">
                          Episódio {anime.airingEpisode}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-white/[0.06] p-4 text-xs text-white/40">
                  Sem episódios programados para hoje.
                </p>
              )}
            </section>
          </div>
          <AnimeSection
            title="Concluídos"
            eyebrow="Para maratonar"
            items={home.completed.slice(0, 6)}
            link="/completed"
          />
        </>
      ) : null}
    </div>
  );
}

interface AnimeSectionProps {
  title: string;
  eyebrow: string;
  items: AnimeResult[];
  link: string;
  icon?: 'trending' | 'new';
}

function AnimeSection({
  title,
  eyebrow,
  items,
  link,
  icon,
}: AnimeSectionProps) {
  if (!items.length) return null;
  return (
    <section>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
            {icon === 'trending' ? (
              <Flame size={13} />
            ) : icon === 'new' ? (
              <Sparkles size={13} />
            ) : null}
            {eyebrow}
          </p>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        </div>
        <Link
          to={link}
          className="flex items-center gap-1.5 text-xs font-semibold text-white/45 transition hover:text-white"
        >
          Ver todos <ArrowRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-6 gap-x-5 gap-y-8">
        {items.map((anime) => (
          <AnimeCard anime={anime} key={anime.id} />
        ))}
      </div>
    </section>
  );
}
