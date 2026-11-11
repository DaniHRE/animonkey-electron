import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Play,
  Star,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimeCard } from '@/components/shared/anime-card';
import { AniListCatalog } from '@/services/anilist.service';
import type { AnimeInfo } from '@/types/anime';
import { getAnimeImage, resolveAnimeTitle, stripHtml } from '@/lib/anime';
import { useWatchLater } from '@/hooks/use-watch-later';
import { useAnimeRating } from '@/hooks/use-anime-rating';
import { AnivexaCatalog } from '@/services/anivexa.service';
import type { AnimeEpisode } from '@/types/player';

type DetailTab = 'episodes' | 'characters' | 'relations';

export function AnimePage() {
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
  const [episodeState, setEpisodeState] = useState<{
    id: string;
    episodes: AnimeEpisode[];
    error: string | null;
  }>({ id: '', episodes: [], error: null });
  const [detailTab, setDetailTab] = useState<DetailTab>('episodes');

  const reviewValue = reviewDraft ?? userRating.rating?.review ?? '';

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
  const episodesLoading = episodeState.id !== id;
  const episodes = episodeState.id === id ? episodeState.episodes : [];
  const episodesError = episodeState.id === id ? episodeState.error : null;
  return (
    <article className="w-full bg-[#111113]">
      <div className="relative min-h-[360px] overflow-hidden lg:min-h-[420px]">
        {image && (
          <img
            src={anime.banner ?? image}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-35 blur-[1px]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#111113] via-[#111113]/75 to-[#111113]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111113] to-transparent" />
        <div className="relative flex min-h-[360px] items-end gap-6 p-6 sm:gap-8 sm:p-8 lg:min-h-[420px] lg:px-12 lg:py-10">
          {image && (
            <img
              src={image}
              alt=""
              className="h-[240px] w-[170px] rounded-xl object-cover shadow-2xl shadow-black/60"
            />
          )}
          <div className="max-w-2xl pb-2">
            <Link
              to="/search"
              className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-white/45 hover:text-white"
            >
              <ArrowLeft size={14} /> Voltar ao catálogo
            </Link>
            <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
              {resolveAnimeTitle(anime.title)}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-white/55">
              {anime.rating !== undefined && (
                <span className="flex items-center gap-1 rounded-md bg-white/[0.07] px-2.5 py-1.5">
                  <Star size={12} className="fill-[#ffc658] text-[#ffc658]" />
                  {anime.rating.toFixed(1)}
                </span>
              )}
              {anime.releaseDate && (
                <span className="flex items-center gap-1 rounded-md bg-white/[0.07] px-2.5 py-1.5">
                  <CalendarDays size={12} />
                  {anime.releaseDate}
                </span>
              )}
              {anime.type && (
                <span className="rounded-md bg-white/[0.07] px-2.5 py-1.5">
                  {anime.type}
                </span>
              )}
              {anime.totalEpisodes && (
                <span className="rounded-md bg-white/[0.07] px-2.5 py-1.5">
                  {anime.totalEpisodes} episódios
                </span>
              )}
              {anime.duration && (
                <span className="rounded-md bg-white/[0.07] px-2.5 py-1.5">
                  {anime.duration} min por episódio
                </span>
              )}
              {anime.nextAiringEpisode && (
                <span className="rounded-md bg-white/[0.07] px-2.5 py-1.5">
                  Episódio {anime.nextAiringEpisode.episode} em{' '}
                  {new Date(
                    anime.nextAiringEpisode.airingAt * 1000,
                  ).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'America/Sao_Paulo',
                  })}
                </span>
              )}
            </div>
            <p className="mt-4 line-clamp-4 text-[13px] leading-relaxed text-white/55">
              {stripHtml(anime.description) || 'Sem sinopse disponível.'}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Link
                to={`/watch/${anime.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#49d77a] px-5 text-xs font-bold text-[#07110a] transition hover:bg-[#6ce995]"
              >
                <Play size={14} fill="currentColor" /> Assistir
              </Link>
              <button
                type="button"
                onClick={() => void toggle(anime)}
                aria-pressed={isInList(anime.id)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-xs font-semibold text-white/75 transition hover:bg-white/[0.08]"
              >
                {isInList(anime.id) ? (
                  <BookmarkCheck size={14} />
                ) : (
                  <Bookmark size={14} />
                )}
                {isInList(anime.id) ? 'Na lista' : 'Assistir depois'}
              </button>
              {anime.trailer?.site === 'youtube' && (
                <a
                  href={`https://www.youtube.com/watch?v=${encodeURIComponent(anime.trailer.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-xs font-semibold text-white/75 transition hover:bg-white/[0.08]"
                >
                  Ver trailer
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
      {anime.genres.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 pb-8 sm:px-8 lg:px-12">
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
      <section className="border-t border-white/[0.07] px-6 py-7 sm:px-8 lg:px-12">
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
          <div role="tabpanel" className="space-y-2">
            {episodes.map((episode) => (
              <Link
                key={episode.id}
                to={`/watch/${anime.id}?ep=${encodeURIComponent(episode.id)}`}
                className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.025] p-3 transition hover:bg-white/[0.06]"
              >
                {episode.image ? (
                  <img
                    src={episode.image}
                    alt=""
                    className="h-12 w-20 rounded-md object-cover"
                  />
                ) : (
                  <span className="grid h-12 w-20 shrink-0 place-items-center rounded-md bg-white/[0.05] text-xs font-bold text-white/60">
                    {episode.number}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-white/85">
                    {episode.number}
                    {' · '}
                    {episode.title ?? `Episódio ${episode.number}`}
                  </span>
                  {episode.description && (
                    <span className="mt-1 block truncate text-[11px] text-white/40">
                      {stripHtml(episode.description)}
                    </span>
                  )}
                </span>
              </Link>
            ))}
            {!episodes.length && (
              <p className="rounded-lg bg-white/[0.025] p-5 text-sm text-white/45">
                {episodesError ??
                  (episodesLoading
                    ? 'Carregando episódios…'
                    : 'Nenhum episódio disponível pela Anivexa.')}
              </p>
            )}
          </div>
        )}
        {detailTab === 'characters' && (
          <div role="tabpanel" className="flex flex-wrap gap-3">
            {anime.characters.map((character) => (
              <div
                key={character.id}
                className="flex w-48 items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2"
              >
                {character.image ? (
                  <img
                    src={character.image}
                    alt=""
                    className="size-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="size-12 rounded-lg bg-white/[0.06]" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white/80">
                    {character.name}
                  </p>
                  <p className="mt-1 text-[10px] text-white/40">
                    {character.role === 'MAIN' ? 'Principal' : 'Coadjuvante'}
                  </p>
                </div>
              </div>
            ))}
            {!anime.characters.length && (
              <p className="text-sm text-white/45">Sem personagens listados.</p>
            )}
          </div>
        )}
        {detailTab === 'relations' && (
          <div role="tabpanel" className="flex flex-wrap gap-2">
            {anime.relations.map((relation) => (
              <Link
                key={`${relation.id}-${relation.relationType}`}
                to={`/anime/${relation.id}`}
                className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/60 transition hover:border-[#49d77a]/40 hover:text-white"
              >
                {relation.relationType.replaceAll('_', ' ')} ·{' '}
                {resolveAnimeTitle(relation.title)}
              </Link>
            ))}
            {!anime.relations.length && (
              <p className="text-sm text-white/45">Sem obras relacionadas.</p>
            )}
          </div>
        )}
      </section>
      {anime.recommendations.length > 0 && (
        <section className="border-t border-white/[0.07] px-6 py-7 sm:px-8 lg:px-12">
          <h2 className="mb-5 text-sm font-bold">Você também pode gostar</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-6">
            {anime.recommendations.map((recommendation) => (
              <AnimeCard key={recommendation.id} anime={recommendation} />
            ))}
          </div>
        </section>
      )}
      <section
        className="border-t border-white/[0.07] bg-white/[0.015] px-6 py-8 sm:px-8 lg:px-12"
        aria-label="Minha avaliação"
      >
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/[0.08] bg-[#0d0d0f] p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold">Minha avaliação</h2>
              <p className="mt-1 text-xs text-white/45">
                Sua nota e comentário ficam salvos na sua biblioteca.
              </p>
            </div>
            {userRating.rating && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#ffc658]/10 px-2.5 py-1 text-xs font-bold text-[#ffc658]">
                <Star size={13} fill="currentColor" />
                {userRating.rating.score}/10
              </span>
            )}
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
                              'Não foi possível salvar a avaliação local.',
                            ),
                          );
                      }}
                      className={`h-10 rounded-lg text-sm font-bold transition ${userRating.rating?.score === score ? 'bg-[#49d77a] text-[#07110a]' : 'border border-white/[0.08] bg-white/[0.04] text-white/70 hover:border-white/20 hover:bg-white/[0.08]'}`}
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
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!userRating.rating || userRating.busy}
                  onClick={() => {
                    setRatingError(null);
                    void userRating
                      .save(userRating.rating!.score, reviewValue)
                      .catch(() =>
                        setRatingError(
                          'Não foi possível salvar a avaliação local.',
                        ),
                      );
                  }}
                  className="rounded-lg bg-[#49d77a] px-4 py-2 text-xs font-bold text-[#07110a] transition hover:bg-[#6ce995] disabled:cursor-not-allowed disabled:opacity-40"
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
                        .then(() => setReviewDraft(''))
                        .catch(() =>
                          setRatingError(
                            'Não foi possível remover a avaliação local.',
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
            <p className="rounded-lg bg-white/[0.035] p-4 text-sm text-white/50">
              Entre na conta nas configurações para avaliar e sincronizar.
            </p>
          )}
        </div>
      </section>
    </article>
  );
}
