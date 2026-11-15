import {
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  Check,
  Clapperboard,
  Maximize2,
  Network,
  Play,
  Share2,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimeCard } from '@/components/shared/anime-card';
import { AnimeEpisodeList } from '@/components/features/anime/anime-episode-list';
import { AniListCatalog } from '@/services/anilist.service';
import type { AnimeInfo } from '@/types/anime';
import { getAnimeImage, resolveAnimeTitle, stripHtml } from '@/lib/anime';
import { useWatchLater } from '@/hooks/use-watch-later';
import { useAnimeRating } from '@/hooks/use-anime-rating';
import { AnivexaCatalog } from '@/services/anivexa.service';
import type { AnimeEpisode } from '@/types/player';
import { useTitleLanguage } from '@/hooks/use-title-language';

type DetailTab = 'episodes' | 'characters' | 'relations';

export function AnimePage() {
  const { titleLanguage } = useTitleLanguage();
  const { id = '' } = useParams();
  const [state, setState] = useState<{
    id: string;
    anime: AnimeInfo | null;
    error: string | null;
  }>({ id: '', anime: null, error: null });
  const { isInList, toggle } = useWatchLater();
  const userRating = useAnimeRating(id);
  const [reviewDraft, setReviewDraft] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [episodeState, setEpisodeState] = useState<{
    id: string;
    episodes: AnimeEpisode[];
    error: string | null;
  }>({ id: '', episodes: [], error: null });
  const [detailTab, setDetailTab] = useState<DetailTab>('episodes');

  const reviewValue = reviewDraft ?? userRating.rating?.review ?? '';

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    if (!posterOpen && !trailerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPosterOpen(false);
        setTrailerOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [posterOpen, trailerOpen]);

  useEffect(() => {
    const controller = new AbortController();
    AniListCatalog.getAnime(id, controller.signal)
      .then((anime) => setState({ id, anime, error: null }))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            id,
            anime: null,
            error:
              cause instanceof Error
                ? cause.message
                : 'Falha ao carregar anime.',
          });
        }
      });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    AnivexaCatalog.episodes(id, controller.signal)
      .then((episodes) => setEpisodeState({ id, episodes, error: null }))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setEpisodeState({
            id,
            episodes: [],
            error:
              cause instanceof Error
                ? cause.message
                : 'Não foi possível carregar os episódios.',
          });
      });
    return () => controller.abort();
  }, [id]);

  const loading = state.id !== id;
  const anime = loading ? null : state.anime;

  if (!loading && state.error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-300/10 bg-red-400/[0.04] p-5 text-sm text-red-200/80"
      >
        {state.error}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="h-[420px] animate-pulse rounded-2xl bg-white/[0.035]" />
    );
  }
  if (!anime) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-sm text-white/55">
        Anime não encontrado.{' '}
        <Link to="/search" className="text-[#70e793] underline">
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  const image = getAnimeImage(anime);
  const title = resolveAnimeTitle(anime.title, titleLanguage);
  const episodesLoading = episodeState.id !== id;
  const episodes = episodeState.id === id ? episodeState.episodes : [];
  const episodesError = episodeState.id === id ? episodeState.error : null;
  return (
    <article className="w-full bg-[#111113]">
      <section
        className="relative flex w-full flex-col gap-1"
        style={
          {
            '--anime-accent': anime.color ?? '#6366f1',
          } as React.CSSProperties
        }
      >
        <div className="relative min-h-[360px] overflow-hidden lg:min-h-[420px]">
          {anime.banner && (
            <img
              src={anime.banner}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-35 blur-[1px]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#111113] via-[#111113]/75 to-[#111113]/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-[#111113]/55 to-transparent" />
          <div className="relative mx-auto flex min-h-[360px] w-full max-w-[1440px] items-end gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:min-h-[420px] lg:px-8 lg:py-10">
            {image && (
              <button
                type="button"
                onClick={() => setPosterOpen(true)}
                aria-label={`Ampliar pôster de ${title}`}
                className="group relative aspect-[2/3] h-[250px] w-[167px] shrink-0 cursor-zoom-in overflow-hidden rounded-md shadow-2xl shadow-black/60 sm:h-[300px] sm:w-[200px]"
              >
                <img
                  src={image}
                  alt={title}
                  className="size-full object-cover"
                />
                <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100 group-focus-visible:bg-black/45 group-focus-visible:opacity-100">
                  <Maximize2 size={25} />
                </span>
              </button>
            )}
            <div className="max-w-2xl pb-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-black/90">
                {anime.totalEpisodes != null && (
                  <span className="rounded bg-[var(--anime-accent)] px-2.5 py-1">
                    {anime.totalEpisodes} EP
                  </span>
                )}
                <span className="rounded bg-[var(--anime-accent)] px-2.5 py-1">
                  ANIME
                </span>
                {anime.isAdult && (
                  <span className="rounded bg-red-500 px-2.5 py-1 text-white">
                    18+
                  </span>
                )}
                {anime.type && (
                  <span className="rounded bg-[var(--anime-accent)] px-2.5 py-1">
                    {anime.type}
                  </span>
                )}
                {anime.status && (
                  <span className="rounded bg-[var(--anime-accent)] px-2.5 py-1">
                    {anime.status.replaceAll('_', ' ')}
                  </span>
                )}
                {(anime.season || anime.releaseDate) && (
                  <span className="rounded bg-[var(--anime-accent)] px-2.5 py-1 capitalize">
                    {anime.season?.toLowerCase()}
                    {anime.season && anime.releaseDate ? ' ' : ''}
                    {anime.releaseDate}
                  </span>
                )}
                {anime.rating != null && (
                  <span className="rounded bg-white/80 px-2.5 py-1">
                    ★ {anime.rating.toFixed(1)}
                  </span>
                )}
                {anime.duration && (
                  <span className="rounded bg-[var(--anime-accent)] px-2.5 py-1">
                    {anime.duration} min
                  </span>
                )}
              </div>
              {anime.title.native && (
                <p className="mt-2 line-clamp-1 text-sm font-light text-white/60 md:text-base">
                  {anime.title.native}
                </p>
              )}
              <h1 className="mt-1 line-clamp-2 text-xl font-black leading-tight tracking-tight sm:text-3xl">
                {title}
              </h1>
              {anime.nextAiringEpisode && (
                <p className="mt-2 inline-flex w-fit items-center gap-2 rounded-md border border-sky-300/20 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100">
                  <CalendarClock size={15} className="shrink-0 text-sky-300" />
                  <span>
                    Próximo episódio {anime.nextAiringEpisode.episode}
                    {' · '}
                    {new Date(
                      anime.nextAiringEpisode.airingAt * 1000,
                    ).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: 'America/Sao_Paulo',
                    })}
                  </span>
                </p>
              )}
              {anime.genres.length > 0 && (
                <div className="mt-2 hidden flex-wrap gap-2 md:flex">
                  {anime.genres.map((genre) => (
                    <span
                      key={genre}
                      className="inline-flex h-7 items-center rounded-md bg-white/[0.1] px-3 text-xs font-medium text-white/85"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 line-clamp-3 max-w-3xl text-xs leading-relaxed text-white/60 sm:text-sm">
                {stripHtml(anime.description) || 'Sem sinopse disponível.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="inline-flex h-10 items-center overflow-hidden rounded-md">
                  <Link
                    to={`/watch/${anime.id}`}
                    className="inline-flex h-10 items-center gap-2 bg-[#49d77a] px-5 text-xs font-bold text-[#07110a] transition hover:bg-[#6ce995]"
                  >
                    <Play size={14} fill="currentColor" /> Assistir
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      void toggle(anime).catch(() =>
                        setFeedback(
                          'Não foi possível atualizar sua lista. Tente novamente.',
                        ),
                      )
                    }
                    aria-pressed={isInList(anime.id)}
                    aria-label={
                      isInList(anime.id)
                        ? 'Remover de Assistir Depois'
                        : 'Adicionar a Assistir Depois'
                    }
                    className="inline-flex h-10 w-11 items-center justify-center bg-white/75 text-black/80 transition hover:bg-white/90"
                  >
                    {isInList(anime.id) ? (
                      <BookmarkCheck size={17} />
                    ) : (
                      <Bookmark size={17} />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={
                    userRating.rating
                      ? `Sua nota: ${userRating.rating.score}/10`
                      : 'Avaliar este anime'
                  }
                  onClick={() => {
                    setRatingError(null);
                    if (!userRating.isAuthenticated) {
                      setFeedback(
                        'Entre para avaliar. Faça login nas configurações para salvar sua nota.',
                      );
                      return;
                    }
                    setRatingOpen(true);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white/80 transition hover:bg-white/[0.12]"
                >
                  <Star size={14} />
                  {userRating.rating
                    ? `${userRating.rating.score}/10`
                    : 'Avaliar'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const url = `app:run://anime/${encodeURIComponent(anime.id)}`;
                      if (navigator.share)
                        await navigator.share({ title, text: url });
                      else {
                        await navigator.clipboard.writeText(url);
                        setCopied(true);
                        setFeedback(
                          'Link copiado para a área de transferência.',
                        );
                      }
                    } catch (cause) {
                      if (
                        cause instanceof DOMException &&
                        cause.name === 'AbortError'
                      )
                        return;
                      setFeedback(
                        'Não foi possível compartilhar. Verifique a permissão da área de transferência.',
                      );
                    }
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white/80 transition hover:bg-white/[0.12]"
                >
                  {copied ? <Check size={14} /> : <Share2 size={14} />}
                  <span className="sr-only">
                    {copied ? 'Link copiado!' : 'Compartilhar'}
                  </span>
                </button>
                {anime.trailer?.site === 'youtube' &&
                /^[\w-]{11}$/.test(anime.trailer.id) ? (
                  <button
                    type="button"
                    onClick={() => setTrailerOpen(true)}
                    aria-label="Assistir trailer"
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white/80 transition hover:bg-white/[0.12]"
                  >
                    <Clapperboard size={14} />
                    <span className="sr-only">Assistir trailer</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-label="Trailer indisponível"
                    className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white/35"
                  >
                    <Clapperboard size={14} />
                    <span className="sr-only">Trailer indisponível</span>
                  </button>
                )}
              </div>
              {feedback && (
                <p role="status" className="mt-2 text-xs text-white/70">
                  {feedback}
                </p>
              )}
            </div>
          </div>
        </div>
        {anime.genres.length > 0 && (
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap gap-2 px-4 pb-5 md:hidden sm:px-6 lg:px-8">
            {anime.genres.map((genre) => (
              <span
                key={genre}
                className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/50"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
        <section className="border-t border-white/10">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
            <div
              role="tablist"
              aria-label="Informações do anime"
              className="mb-5 inline-flex gap-1 rounded-lg bg-white/[0.035] p-1"
            >
              {(
                [
                  ['episodes', 'Episódios'],
                  ['characters', 'Personagens'],
                  ['relations', 'Relações'],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={detailTab === tab}
                  onClick={() => setDetailTab(tab)}
                  className={`rounded-md px-4 py-2 text-xs font-semibold transition ${detailTab === tab ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/75'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {detailTab === 'episodes' && (
              <AnimeEpisodeList
                key={anime.id}
                animeId={anime.id}
                episodes={episodes}
                loading={episodesLoading}
                error={episodesError}
              />
            )}
            {detailTab === 'characters' && (
              <div
                role="tabpanel"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4"
              >
                {anime.characters.map((character) => (
                  <article
                    key={character.id}
                    className="group overflow-hidden rounded-xl bg-white/[0.035] transition-colors hover:bg-white/[0.06]"
                  >
                    <div className="relative h-36 overflow-hidden bg-[#1b1b20] sm:h-44">
                      {character.image ? (
                        <img
                          src={character.image}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-3xl font-bold text-white/25">
                          {character.name.slice(0, 1)}
                        </div>
                      )}
                      <span className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-3">
                      <p className="min-w-0 truncate text-xs font-semibold text-white/90 sm:text-sm">
                        {character.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-1 text-[9px] font-semibold text-white/55">
                        {character.role === 'MAIN'
                          ? 'Principal'
                          : 'Coadjuvante'}
                      </span>
                    </div>
                  </article>
                ))}
                {!anime.characters.length && (
                  <p className="col-span-full py-8 text-center text-sm text-white/50">
                    Sem personagens listados.
                  </p>
                )}
              </div>
            )}
            {detailTab === 'relations' && (
              <div
                role="tabpanel"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
              >
                {anime.relations.map((relation) => {
                  const relationTitle = resolveAnimeTitle(
                    relation.title,
                    titleLanguage,
                  );
                  const relationLabel = getRelationLabel(
                    relation.relationType,
                    relationTitle,
                  );

                  return (
                    <Link
                      key={`${relation.id}-${relation.relationType}`}
                      to={`/anime/${relation.id}`}
                      className="group flex min-w-0 items-center gap-3 rounded-lg bg-white/[0.035] p-2 transition-colors hover:bg-white/[0.07]"
                    >
                      {relation.image ? (
                        <img
                          src={relation.image}
                          alt=""
                          loading="lazy"
                          className="h-16 w-11 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="h-16 w-11 shrink-0 rounded bg-white/[0.06]" />
                      )}
                      <span className="min-w-0">
                        <span className="block text-[9px] font-bold tracking-wide text-white/45 uppercase">
                          {relationLabel}
                        </span>
                        <span className="mt-1 block line-clamp-2 text-xs font-semibold text-white/85 group-hover:text-white">
                          {relationTitle}
                        </span>
                      </span>
                    </Link>
                  );
                })}
                {!anime.relations.length && (
                  <div className="col-span-full flex min-h-48 flex-col items-center justify-center px-6 text-center">
                    <span className="mb-4 grid size-12 place-items-center rounded-full bg-white/[0.05] text-white/45">
                      <Network size={21} />
                    </span>
                    <p className="text-sm font-semibold text-white/75">
                      Não existem animes relacionados para esta obra.
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      Quando houver continuações, especiais ou adaptações, elas
                      aparecerão aqui.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        {anime.recommendations.length > 0 && (
          <section className="border-t border-white/[0.07]">
            <div className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
              <h2 className="mb-5 text-sm font-bold">
                Você também pode gostar
              </h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-6">
                {anime.recommendations.map((recommendation) => (
                  <AnimeCard key={recommendation.id} anime={recommendation} />
                ))}
              </div>
            </div>
          </section>
        )}
      </section>
      {posterOpen && image && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPosterOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Pôster de ${title}`}
            className="relative flex max-h-[92vh] max-w-[min(92vw,52rem)] items-center justify-center"
          >
            <button
              type="button"
              onClick={() => setPosterOpen(false)}
              aria-label="Fechar imagem ampliada"
              className="absolute -top-12 right-0 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <X size={19} />
            </button>
            <img
              src={image}
              alt={title}
              className="max-h-[88vh] max-w-full rounded-md object-contain shadow-2xl"
            />
          </section>
        </div>
      )}
      {trailerOpen && anime.trailer?.site === 'youtube' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTrailerOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Trailer de ${title}`}
            className="relative w-full max-w-5xl"
          >
            <button
              type="button"
              onClick={() => setTrailerOpen(false)}
              aria-label="Fechar trailer"
              className="absolute -top-12 right-0 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <X size={19} />
            </button>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black shadow-2xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(anime.trailer.id)}?autoplay=1&rel=0&modestbranding=1`}
                title={`Trailer de ${title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="size-full"
              />
            </div>
          </section>
        </div>
      )}
      {ratingOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRatingOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="rating-title"
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#151518] p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="rating-title" className="text-base font-bold">
                  Minha avaliação
                </h2>
                <p className="mt-1 text-xs text-white/45">
                  Sua nota e comentário ficam salvos na sua biblioteca.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRatingOpen(false)}
                aria-label="Fechar avaliação"
                className="text-xl leading-none text-white/50 hover:text-white"
              >
                ×
              </button>
            </div>
            {userRating.isAuthenticated ? (
              <>
                <div
                  className="grid grid-cols-5 gap-2 sm:grid-cols-10"
                  role="group"
                  aria-label="Nota de 1 a 10"
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map(
                    (score) => (
                      <button
                        key={score}
                        type="button"
                        disabled={userRating.busy}
                        aria-pressed={userRating.rating?.score === score}
                        onClick={() => {
                          setRatingError(null);
                          void userRating
                            .save(score, reviewValue)
                            .catch(() =>
                              setRatingError(
                                'Não foi possível salvar sua avaliação. Verifique a conexão e tente novamente.',
                              ),
                            );
                        }}
                        className={`h-10 rounded-lg text-sm font-bold transition ${userRating.rating?.score === score ? 'bg-[#49d77a] text-[#07110a]' : 'border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08]'}`}
                      >
                        {score}
                      </button>
                    ),
                  )}
                </div>
                <label className="mt-5 block text-xs font-semibold text-white/70">
                  Comentário{' '}
                  <span className="font-normal text-white/35">(opcional)</span>
                  <textarea
                    value={reviewValue}
                    maxLength={2000}
                    onChange={(event) => setReviewDraft(event.target.value)}
                    placeholder="O que achou deste anime?"
                    className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-sm font-normal text-white/80 outline-none placeholder:text-white/30 focus:border-[#49d77a]/40"
                  />
                </label>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!userRating.rating || userRating.busy}
                    onClick={() => {
                      setRatingError(null);
                      void userRating
                        .save(userRating.rating!.score, reviewValue)
                        .then(() => setRatingOpen(false))
                        .catch(() =>
                          setRatingError(
                            'Não foi possível salvar sua avaliação. Verifique a conexão e tente novamente.',
                          ),
                        );
                    }}
                    className="rounded-lg bg-[#49d77a] px-4 py-2 text-xs font-bold text-[#07110a] disabled:opacity-40"
                  >
                    Salvar avaliação
                  </button>
                  {userRating.rating && (
                    <button
                      type="button"
                      disabled={userRating.busy}
                      onClick={() => {
                        void userRating
                          .clear()
                          .then(() => {
                            setReviewDraft('');
                            setRatingOpen(false);
                          })
                          .catch(() =>
                            setRatingError(
                              'Não foi possível remover sua avaliação. Tente novamente.',
                            ),
                          );
                      }}
                      className="px-2 py-2 text-xs font-semibold text-white/45 hover:text-white/75"
                    >
                      Remover avaliação
                    </button>
                  )}
                  {ratingError && (
                    <p role="alert" className="text-xs text-red-300">
                      {ratingError}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="rounded-lg bg-white/[0.035] p-4 text-sm text-white/60">
                  Entre na conta nas configurações para avaliar e sincronizar.
                </p>
                <Link
                  to="/settings"
                  onClick={() => setRatingOpen(false)}
                  className="inline-flex rounded-lg bg-[#49d77a] px-4 py-2 text-xs font-bold text-[#07110a]"
                >
                  Abrir configurações
                </Link>
              </div>
            )}
          </section>
        </div>
      )}
    </article>
  );
}

function getRelationLabel(relationType: string, title: string): string {
  const seasonMatch = title.match(
    /(?:season\s+(\d+)(?:\s*part\s+(\d+))?|(?:(\d+)(?:st|nd|rd|th)\s+season)(?:\s*part\s+(\d+))?)/i,
  );
  const season = seasonMatch
    ? `Season ${seasonMatch[1] ?? seasonMatch[3]}${(seasonMatch[2] ?? seasonMatch[4]) ? ` Part ${seasonMatch[2] ?? seasonMatch[4]}` : ''}`
    : null;
  const readableType =
    relationType === 'SEQUEL'
      ? 'Direct Sequel'
      : relationType
          .toLowerCase()
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');

  return season ? `${season} · ${readableType}` : readableType;
}
