import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  Play,
  Sparkles,
  Star,
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
import './home-page.css';

type HomeData = Awaited<ReturnType<typeof AniListCatalog.home>>;
const CLEARLOGO_IMAGE_TIMEOUT_MS = 10_000;

const HERO_FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV curta',
  MOVIE: 'Filme',
  SPECIAL: 'Especial',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Música',
};

function getHeroFormatLabel(format: string | undefined): string | undefined {
  if (!format) return undefined;
  return HERO_FORMAT_LABELS[format] ?? format.replaceAll('_', ' ');
}

export function HomePage() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [schedule, setSchedule] = useState<AnimeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [heroLogo, setHeroLogo] = useState<{
    key: string;
    url: string;
    status: 'preloading' | 'ready' | 'failed';
  } | null>(null);
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
  const featuredId = featured?.id;
  const featuredEnglishTitle = featured?.title.english;
  const featuredRomajiTitle = featured?.title.romaji;
  const featuredNativeTitle = featured?.title.native;
  const featuredArtworkKey = featuredId
    ? JSON.stringify([
        featuredId,
        featuredEnglishTitle ?? '',
        featuredRomajiTitle ?? '',
        featuredNativeTitle ?? '',
      ])
    : undefined;
  const featuredTitle = featured
    ? resolveAnimeTitle(featured.title, titleLanguage)
    : 'Descubra seu próximo anime';
  const currentHeroLogo =
    heroLogo?.key === featuredArtworkKey ? heroLogo : undefined;
  const featuredLogoUrl =
    currentHeroLogo && currentHeroLogo.status !== 'failed'
      ? currentHeroLogo.url
      : undefined;
  const isFeaturedLogoPreloading = currentHeroLogo?.status === 'preloading';
  const isFeaturedLogoLoaded = currentHeroLogo?.status === 'ready';
  const banner =
    featured?.banner ?? (featured ? getAnimeImage(featured) : undefined);
  const featuredRating =
    featured?.rating !== undefined &&
    Number.isFinite(featured.rating) &&
    featured.rating > 0
      ? featured.rating
      : undefined;
  const featuredYear =
    typeof featured?.releaseDate === 'number' &&
    Number.isInteger(featured.releaseDate) &&
    featured.releaseDate >= 1000 &&
    featured.releaseDate <= 9999
      ? featured.releaseDate
      : undefined;
  const featuredDetails = [
    getHeroFormatLabel(featured?.type),
    featuredYear?.toString(),
  ].filter((value): value is string => Boolean(value));
  const homeTabItems =
    activeTab === 'completed'
      ? home?.completed
      : activeTab === 'new'
        ? home?.newReleases
        : home?.recentlyAdded;

  useEffect(() => {
    if (!featuredId || !featuredArtworkKey) return;

    let isCurrent = true;
    const expectedTitles = [
      featuredEnglishTitle,
      featuredRomajiTitle,
      featuredNativeTitle,
    ].filter((title): title is string => Boolean(title));

    const artworkBridge = window.animonkey?.artwork;
    if (!artworkBridge) return;

    artworkBridge
      .getClearLogo(featuredId, expectedTitles)
      .then((url) => {
        if (isCurrent && url)
          setHeroLogo({
            key: featuredArtworkKey,
            url,
            status: 'preloading',
          });
      })
      .catch(() => {
        // AniZip is optional; the visible AniList title remains the fallback.
      });

    return () => {
      isCurrent = false;
    };
  }, [
    featuredEnglishTitle,
    featuredArtworkKey,
    featuredId,
    featuredNativeTitle,
    featuredRomajiTitle,
  ]);

  useEffect(() => {
    if (!isFeaturedLogoPreloading || !featuredArtworkKey) return;
    const timeout = window.setTimeout(() => {
      setHeroLogo((current) =>
        current?.key === featuredArtworkKey && current.status === 'preloading'
          ? { ...current, status: 'failed' }
          : current,
      );
    }, CLEARLOGO_IMAGE_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [featuredArtworkKey, isFeaturedLogoPreloading]);

  return (
    <div>
      {loading && !home ? (
        <HomeHeroSkeleton />
      ) : (
        <section className="relative isolate -mt-[76px] h-[70vh] min-h-[500px] max-h-[820px] overflow-hidden border-b border-white/[0.05] bg-[#09090a]">
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
          <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-end px-6 pb-16 sm:pb-20 2xl:px-10">
            <div className="max-w-2xl space-y-4 sm:space-y-5 [text-shadow:0_2px_18px_rgba(0,0,0,0.75)]">
              {(featuredRating !== undefined || featuredDetails.length > 0) && (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-white/85">
                  {featuredRating !== undefined && (
                    <span
                      className="inline-flex items-center gap-1.5"
                      aria-label={`Nota AniList ${featuredRating.toFixed(1)} de 10`}
                    >
                      <Star
                        size={14}
                        className="fill-current text-amber-300"
                        aria-hidden="true"
                      />
                      {featuredRating.toFixed(1)}
                    </span>
                  )}
                  {featuredDetails.map((detail, index) => (
                    <span
                      key={detail}
                      className="inline-flex items-center gap-2.5"
                    >
                      {(featuredRating !== undefined || index > 0) && (
                        <span className="text-white/40" aria-hidden="true">
                          ·
                        </span>
                      )}
                      {detail}
                    </span>
                  ))}
                </div>
              )}
              <h1
                aria-label={featuredTitle}
                aria-busy={isFeaturedLogoPreloading}
                className={`max-w-[720px] text-3xl leading-tight font-bold tracking-tight text-white sm:text-5xl lg:text-[3.25rem] ${featuredLogoUrl ? 'relative min-h-[4rem] sm:min-h-[5rem]' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className={`line-clamp-2 block transition-opacity duration-200 motion-reduce:transition-none ${isFeaturedLogoPreloading || isFeaturedLogoLoaded ? 'opacity-0' : 'opacity-100'}`}
                >
                  {featuredTitle}
                </span>
                {isFeaturedLogoPreloading && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 left-0 h-16 w-[min(420px,85vw)] overflow-hidden rounded-lg bg-white/[0.08] motion-safe:animate-pulse sm:h-20"
                  >
                    <span className="absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                  </span>
                )}
                {featuredLogoUrl && (
                  <img
                    key={featuredArtworkKey}
                    src={featuredLogoUrl}
                    alt=""
                    aria-hidden="true"
                    onLoad={() => {
                      if (featuredId)
                        setHeroLogo((current) =>
                          current && current.key === featuredArtworkKey
                            ? { ...current, status: 'ready' }
                            : current,
                        );
                    }}
                    onError={() => {
                      if (featuredId)
                        setHeroLogo((current) =>
                          current && current.key === featuredArtworkKey
                            ? { ...current, status: 'failed' }
                            : current,
                        );
                    }}
                    className={`home-hero-clear-logo absolute top-0 left-0 max-h-16 max-w-[min(560px,85vw)] object-contain object-left transition-opacity duration-300 motion-reduce:transition-none sm:max-h-20 ${isFeaturedLogoLoaded ? 'opacity-100' : 'opacity-0'}`}
                  />
                )}
              </h1>
              {isFeaturedLogoLoaded && (
                <p className="home-hero-title-label text-sm font-semibold text-[#d7ffe2] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] sm:text-base">
                  {featuredTitle}
                </p>
              )}
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
      )}

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
                  <p className="mb-1.5 flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-[#65e48e] uppercase">
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
                      <span className="grid size-9 place-items-center rounded-md bg-[#49d77a]/10 text-xs font-bold text-[#73e994]">
                        {new Intl.DateTimeFormat('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                          hour: '2-digit',
                          minute: '2-digit',
                          hourCycle: 'h23',
                        }).format(new Date((anime.airingAt ?? 0) * 1000))}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-white/75">
                          {resolveAnimeTitle(anime.title, titleLanguage)}
                        </span>
                        <span className="mt-1 block text-xs text-white/35">
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

function HomeHeroSkeleton() {
  return (
    <section
      aria-label="Carregando destaques da página inicial"
      aria-busy="true"
      className="relative isolate -mt-[76px] h-[70vh] min-h-[500px] max-h-[820px] overflow-hidden border-b border-white/[0.05] bg-[#09090a]"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#080809]/95 via-[#080809]/75 to-[#080809]/35"
        aria-hidden="true"
      />
      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col justify-end px-6 pb-16 sm:pb-20 2xl:px-10">
        <div className="max-w-2xl space-y-4 sm:space-y-5" aria-hidden="true">
          <div className="motion-safe:animate-pulse h-4 w-44 rounded-full bg-white/[0.1]" />
          <div className="motion-safe:animate-pulse h-12 w-full max-w-xl rounded-lg bg-white/[0.1] sm:h-16" />
          <div className="max-w-xl space-y-2">
            <div className="motion-safe:animate-pulse h-3 w-full rounded-full bg-white/[0.08]" />
            <div className="motion-safe:animate-pulse h-3 w-5/6 rounded-full bg-white/[0.08]" />
            <div className="motion-safe:animate-pulse h-3 w-2/3 rounded-full bg-white/[0.08]" />
          </div>
          <div className="flex gap-3 pt-2">
            <div className="motion-safe:animate-pulse h-11 w-40 rounded-lg bg-[#49d77a]/20" />
            <div className="motion-safe:animate-pulse h-11 w-40 rounded-lg bg-white/[0.08]" />
          </div>
        </div>
      </div>
    </section>
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
          <p className="mb-1.5 flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-[#65e48e] uppercase">
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
          <p className="mb-1.5 flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-[#65e48e] uppercase">
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
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeTab === tab.id ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white'}`}
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
