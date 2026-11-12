import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  Play,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimeCard } from '@/components/shared/anime-card';
import { HorizontalCarousel } from '@/components/shared/horizontal-carousel';
import {
  ContinueWatchingSection,
  WatchLaterSection,
} from '@/components/features/home/home-library-sections';
import { useTitleLanguage } from '@/hooks/use-title-language';
import { useWatchLater } from '@/hooks/use-watch-later';
import { getAnimeImage, resolveAnimeTitle, stripHtml } from '@/lib/anime';
import { AniListCatalog } from '@/services/anilist.service';
import type { AnimeResult } from '@/types/anime';

type HomeData = Awaited<ReturnType<typeof AniListCatalog.home>>;

export function HomePage() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [schedule, setSchedule] = useState<AnimeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeTab, setActiveTab] = useState<'completed' | 'new' | 'recent'>(
    'completed',
  );
  const { titleLanguage } = useTitleLanguage();
  const { isInList, toggle } = useWatchLater();

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

  useEffect(() => {
    if (!home || home.banner.length < 2) return;
    const interval = window.setInterval(
      () => setActiveSlide((index) => (index + 1) % home.banner.length),
      7000,
    );
    return () => window.clearInterval(interval);
  }, [home]);

  const featured = home?.banner[activeSlide] ?? home?.banner[0];
  const banner =
    featured?.banner ?? (featured ? getAnimeImage(featured) : undefined);
  const homeTabItems =
    activeTab === 'completed'
      ? home?.completed
      : activeTab === 'new'
        ? home?.newReleases
        : home?.recentlyAdded;

  return (
    <div>
      <section className="relative isolate -mt-[76px] h-[85vh] min-h-[560px] max-h-[920px] overflow-hidden border-b border-white/[0.05] bg-[#09090a]">
        {banner && (
          <img
            key={featured?.id}
            src={banner}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className={`home-banner-image absolute inset-0 -z-20 size-full object-cover ${featured?.banner ? 'object-[center_42%]' : 'object-[center_28%]'}`}
          />
        )}
        <div className="pointer-events-none absolute inset-0 -z-10 shadow-[inset_0_0_150px_rgba(0,0,0,0.36)]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#080809]/92 via-[#080809]/62 via-42% to-[#080809]/5" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#080809] via-[#080809]/35 via-40% to-[#080809]/20" />
        <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-center px-6 pb-2 2xl:px-10">
          <div className="max-w-2xl space-y-4 sm:space-y-5 [text-shadow:0_2px_18px_rgba(0,0,0,0.75)]">
            <div className="flex flex-wrap items-center gap-2">
              {(featured?.genres ?? []).slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur-sm"
                >
                  {genre}
                </span>
              ))}
            </div>
            <h1 className="line-clamp-2 max-w-[720px] text-3xl leading-tight font-bold tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
              {featured
                ? resolveAnimeTitle(featured.title, titleLanguage)
                : 'Descubra seu próximo anime'}
            </h1>
            <p className="line-clamp-2 max-w-[620px] text-sm leading-relaxed text-white/70 sm:line-clamp-3 sm:text-base">
              {featured
                ? stripHtml(featured.description) ||
                  'Explore os animes mais populares da temporada.'
                : 'Explore um catálogo completo de animes, temporadas e descobertas.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {featured && (
                <Link
                  to={`/anime/${featured.id}`}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#2caf57] px-7 text-sm font-semibold text-[#0d0d0d] shadow-lg shadow-black/25 transition hover:scale-[1.02] hover:bg-[#39bd65]"
                >
                  <Play size={18} fill="currentColor" /> Assistir Agora
                </Link>
              )}
              {featured && (
                <button
                  type="button"
                  onClick={() => void toggle(featured)}
                  aria-pressed={isInList(featured.id)}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  {isInList(featured.id) ? 'Na lista' : 'Assistir Depois'}
                </button>
              )}
              <Link
                to="/search"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 bg-black/20 px-5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                Explorar catálogo <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute right-8 bottom-8 flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setActiveSlide(
                (index) =>
                  (index - 1 + (home?.banner.length ?? 1)) %
                  (home?.banner.length ?? 1),
              )
            }
            aria-label="Anime em destaque anterior"
            className="grid size-9 place-items-center rounded-full border border-white/15 bg-black/30 text-white/80 backdrop-blur hover:bg-black/60"
          >
            <ChevronLeft size={18} />
          </button>
          {home?.banner.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveSlide(index)}
              aria-label={`Mostrar ${resolveAnimeTitle(slide.title, titleLanguage)}`}
              aria-current={activeSlide === index ? 'true' : undefined}
              className={`h-1 rounded-full transition-all ${activeSlide === index ? 'w-10 bg-[#2caf57]' : 'w-6 bg-white/35 hover:bg-white/70'}`}
            />
          ))}
          <button
            type="button"
            onClick={() =>
              setActiveSlide(
                (index) => (index + 1) % (home?.banner.length ?? 1),
              )
            }
            aria-label="Próximo anime em destaque"
            className="grid size-9 place-items-center rounded-full border border-white/15 bg-black/30 text-white/80 backdrop-blur hover:bg-black/60"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="m-8 rounded-xl border border-red-300/10 bg-red-400/[0.04] p-5 text-sm text-red-200/80"
        >
          {error}
        </div>
      ) : loading ? (
        <div className="mx-auto w-full max-w-[1440px] space-y-10 px-6 py-8 2xl:px-10">
          <div className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="h-60 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      ) : home ? (
        <main className="mx-auto w-full max-w-[1440px] px-6 py-8 2xl:px-10">
          <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-10">
              <ContinueWatchingSection />
              <WatchLaterSection />
              <AnimeRail
                title="Atualizados Recentemente"
                eyebrow="Temporada atual"
                items={home.newReleases.slice(0, 6)}
                link="/updates"
                icon="new"
              />
              <HomeTabs
                activeTab={activeTab}
                onChange={setActiveTab}
                items={homeTabItems ?? []}
              />
            </div>
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
                          {resolveAnimeTitle(anime.title, titleLanguage)}
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
        </main>
      ) : null}
    </div>
  );
}

interface AnimeRailProps {
  title: string;
  eyebrow: string;
  items: AnimeResult[];
  link: string;
  icon?: 'trending' | 'new';
}

function AnimeRail({ title, eyebrow, items, link, icon }: AnimeRailProps) {
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
      <HorizontalCarousel label={title}>
        {items.map((anime) => (
          <div
            key={anime.id}
            className="w-36 shrink-0 snap-start sm:w-40 xl:w-44"
          >
            <AnimeCard anime={anime} />
          </div>
        ))}
      </HorizontalCarousel>
    </section>
  );
}

function HomeTabs({
  activeTab,
  onChange,
  items,
}: {
  activeTab: 'completed' | 'new' | 'recent';
  onChange: (tab: 'completed' | 'new' | 'recent') => void;
  items: AnimeResult[];
}) {
  const tabs = [
    { id: 'completed', label: 'Completos' },
    { id: 'new', label: 'Novos Lançamentos' },
    { id: 'recent', label: 'Recém Adicionados' },
  ] as const;
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
            <Flame size={13} /> Para descobrir
          </p>
          <h2 className="text-xl font-bold tracking-tight">
            Explore o catálogo
          </h2>
        </div>
        <nav
          className="flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1"
          aria-label="Categorias da Home"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${activeTab === tab.id ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <HorizontalCarousel
        label={tabs.find((tab) => tab.id === activeTab)?.label ?? 'Catálogo'}
      >
        {items.slice(0, 20).map((anime, index) => (
          <div
            key={`${activeTab}-${anime.id}`}
            className="w-36 shrink-0 snap-start sm:w-40 xl:w-44"
          >
            <AnimeCard
              anime={anime}
              rank={activeTab === 'completed' ? undefined : index + 1}
            />
          </div>
        ))}
      </HorizontalCarousel>
    </section>
  );
}
