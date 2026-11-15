import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { VideoPlayer } from '@/components/features/player/video-player';
import { ServerSelector } from '@/components/features/player/server-selector';
import { EpisodeListControls } from '@/components/features/anime/episode-list-controls';
import { PlayerErrorBoundary } from '@/components/features/player/player-error-boundary';
import { AniListCatalog } from '@/services/anilist.service';
import { AnivexaCatalog } from '@/services/anivexa.service';
import { useEpisodeProgress } from '@/hooks/use-episode-progress';
import { useSaveEpisodeProgress } from '@/hooks/use-save-episode-progress';
import { usePlaybackSessionStore } from '@/stores/playback-session-store';
import { getAnimeImage, resolveAnimeTitle, stripHtml } from '@/lib/anime';
import type { AnimeInfo, AnimeResult } from '@/types/anime';
import type {
  AnimeEpisode,
  EpisodeServer,
  EpisodeSources,
} from '@/types/player';
import { useTitleLanguage } from '@/hooks/use-title-language';
import { filterAndSortEpisodes } from '@/lib/episode-filter';

const PLAYER_EPISODE_PAGE_SIZE = 50;

export function WatchPage() {
  const { id = '' } = useParams();
  return <WatchPageContent key={id} />;
}

function WatchPageContent() {
  const { titleLanguage } = useTitleLanguage();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const requestedEpisodeId = params.get('ep') ?? '';
  const [animeState, setAnimeState] = useState<{
    id: string;
    anime: AnimeInfo | null;
    error: string | null;
  }>({ id: '', anime: null, error: null });
  const [episodeState, setEpisodeState] = useState<{
    id: string;
    episodes: AnimeEpisode[];
    error: string | null;
  }>({ id: '', episodes: [], error: null });
  const [serverState, setServerState] = useState<{
    episodeId: string;
    servers: EpisodeServer[];
    error: string | null;
  }>({ episodeId: '', servers: [], error: null });
  const [sourceState, setSourceState] = useState<{
    key: string;
    sources: EpisodeSources | null;
    error: string | null;
  }>({ key: '', sources: null, error: null });
  const [retryVersion, setRetryVersion] = useState(0);
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [episodesAscending, setEpisodesAscending] = useState(true);
  const [episodePage, setEpisodePage] = useState(0);
  const activeEpisodeRef = useRef<HTMLButtonElement | null>(null);
  const selection = usePlaybackSessionStore((state) => state.selection);
  const selectServer = usePlaybackSessionStore((state) => state.selectServer);
  const clearSelection = usePlaybackSessionStore(
    (state) => state.clearSelection,
  );

  useEffect(() => {
    const controller = new AbortController();
    AniListCatalog.getAnime(id, controller.signal)
      .then((anime) =>
        setAnimeState({
          id,
          anime,
          error: anime ? null : 'Anime não encontrado.',
        }),
      )
      .catch(() => {
        if (!controller.signal.aborted)
          setAnimeState({
            id,
            anime: null,
            error:
              'Não foi possível carregar os dados deste anime. Tente novamente.',
          });
      });
    return () => controller.abort();
  }, [id, retryVersion]);
  const anime = animeState.id === id ? animeState.anime : null;

  useEffect(() => {
    if (!anime) return;
    const animeId = anime.id;
    const controller = new AbortController();
    AnivexaCatalog.episodes(animeId, controller.signal)
      .then((episodes) =>
        setEpisodeState({ id: animeId, episodes, error: null }),
      )
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setEpisodeState({
            id: animeId,
            episodes: [],
            error:
              cause instanceof Error
                ? cause.message
                : 'Não foi possível carregar os episódios. Tente novamente.',
          });
      });
    return () => controller.abort();
  }, [anime, retryVersion]);

  const episodes = useMemo(
    () => (episodeState.id === anime?.id ? episodeState.episodes : []),
    [anime?.id, episodeState.episodes, episodeState.id],
  );
  const filteredEpisodes = useMemo(
    () => filterAndSortEpisodes(episodes, episodeSearch, episodesAscending),
    [episodeSearch, episodes, episodesAscending],
  );
  const episodePageCount = Math.ceil(
    filteredEpisodes.length / PLAYER_EPISODE_PAGE_SIZE,
  );
  const visibleEpisodes = filteredEpisodes.slice(
    episodePage * PLAYER_EPISODE_PAGE_SIZE,
    (episodePage + 1) * PLAYER_EPISODE_PAGE_SIZE,
  );
  const currentEpisodeId = episodes.some(
    (episode) => episode.id === requestedEpisodeId,
  )
    ? requestedEpisodeId
    : (episodes[0]?.id ?? '');
  const currentEpisode = useMemo(
    () => episodes.find((episode) => episode.id === currentEpisodeId) ?? null,
    [currentEpisodeId, episodes],
  );

  useEffect(() => {
    activeEpisodeRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [currentEpisodeId, episodePage, episodeSearch]);

  useEffect(() => {
    if (!currentEpisodeId || currentEpisodeId === requestedEpisodeId) return;
    const next = new URLSearchParams(params);
    next.set('ep', currentEpisodeId);
    setParams(next, { replace: true });
  }, [currentEpisodeId, params, requestedEpisodeId, setParams]);

  useEffect(() => {
    if (!currentEpisodeId) return;
    const controller = new AbortController();
    AnivexaCatalog.servers(currentEpisodeId, controller.signal)
      .then((servers) => {
        setServerState({
          episodeId: currentEpisodeId,
          servers,
          error: servers.length
            ? null
            : 'Nenhum servidor compatível encontrado.',
        });
        const currentSelection = usePlaybackSessionStore.getState().selection;
        const selectedServerId =
          currentSelection?.episodeId === currentEpisodeId &&
          servers.some((server) => server.id === currentSelection.serverId)
            ? currentSelection.serverId
            : (servers[0]?.id ?? '');
        if (selectedServerId) selectServer(currentEpisodeId, selectedServerId);
        else clearSelection();
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setServerState({
            episodeId: currentEpisodeId,
            servers: [],
            error:
              cause instanceof Error
                ? cause.message
                : 'Não foi possível consultar os servidores. Tente novamente.',
          });
      });
    return () => controller.abort();
  }, [clearSelection, currentEpisodeId, retryVersion, selectServer]);

  const currentServerState =
    serverState.episodeId === currentEpisodeId
      ? serverState
      : { episodeId: currentEpisodeId, servers: [], error: null };
  const activeServerId =
    selection?.episodeId === currentEpisodeId &&
    currentServerState.servers.some(
      (server) => server.id === selection.serverId,
    )
      ? selection.serverId
      : (currentServerState.servers[0]?.id ?? '');
  const activeServerIndex = currentServerState.servers.findIndex(
    (server) => server.id === activeServerId,
  );
  const nextServerId = currentServerState.servers
    .slice(Math.max(activeServerIndex + 1, 0))
    .find((server) => server.id !== activeServerId)?.id;
  const advanceServer = useCallback(() => {
    if (!nextServerId) return false;
    selectServer(currentEpisodeId, nextServerId);
    return true;
  }, [currentEpisodeId, nextServerId, selectServer]);
  const requestKey = `${currentEpisodeId}:${activeServerId}`;
  useEffect(() => {
    if (!currentEpisodeId || !activeServerId) return;
    const controller = new AbortController();
    AnivexaCatalog.sources(currentEpisodeId, activeServerId, controller.signal)
      .then((sources) =>
        setSourceState({ key: requestKey, sources, error: null }),
      )
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setSourceState({
            key: requestKey,
            sources: null,
            error:
              cause instanceof Error
                ? cause.message
                : 'Não foi possível preparar a transmissão. Tente novamente.',
          });
      });
    return () => controller.abort();
  }, [activeServerId, currentEpisodeId, requestKey, retryVersion]);

  const progress = useEpisodeProgress(id, currentEpisode?.number);
  const { save } = useSaveEpisodeProgress(
    id,
    currentEpisodeId,
    currentEpisode?.number,
  );
  const activeIndex = episodes.findIndex(
    (episode) => episode.id === currentEpisodeId,
  );
  const selectEpisode = (episodeId: string) => {
    const next = new URLSearchParams(params);
    next.set('ep', episodeId);
    setParams(next);
  };
  const retryPlayer = () => {
    setEpisodeState({ id: '', episodes: [], error: null });
    setServerState({
      episodeId: '',
      servers: [],
      error: null,
    });
    clearSelection();
    setSourceState({ key: '', sources: null, error: null });
    setRetryVersion((version) => version + 1);
  };

  if (animeState.id !== id)
    return <div className="h-96 animate-pulse rounded-2xl bg-white/[0.035]" />;
  if (!anime)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-300/10 bg-red-400/[0.04] p-5 text-sm text-red-200/80"
      >
        {animeState.error ?? 'Anime não encontrado.'}
      </div>
    );
  const title = resolveAnimeTitle(anime.title, titleLanguage);
  const poster = getAnimeImage(anime);
  const loadingEpisodes = episodeState.id !== anime.id;
  const loadingServers =
    Boolean(currentEpisodeId) && serverState.episodeId !== currentEpisodeId;
  const loadingSources =
    Boolean(activeServerId) && sourceState.key !== requestKey;
  const sources = sourceState.key === requestKey ? sourceState.sources : null;
  const streamError = sourceState.key === requestKey ? sourceState.error : null;

  return (
    <div className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link
        to={`/anime/${anime.id}`}
        className="inline-flex items-center gap-2 text-xs font-semibold text-white/50 hover:text-white"
      >
        <ArrowLeft size={14} /> Voltar aos detalhes
      </Link>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <PlayerErrorBoundary
            key={`${currentEpisodeId}:${activeServerId}`}
            onRetry={retryPlayer}
          >
            <VideoPlayer
              sources={sources}
              sourceId={requestKey}
              title={`${title}${currentEpisode ? ` · Episódio ${currentEpisode.number}` : ''}`}
              poster={anime.banner ?? poster}
              loading={loadingEpisodes || loadingServers || loadingSources}
              loadingLabel={
                loadingEpisodes
                  ? 'Carregando episódios…'
                  : loadingServers
                    ? 'Buscando servidores…'
                    : sourceState.key.startsWith(`${currentEpisodeId}:`) &&
                        sourceState.sources
                      ? 'Alternando servidor…'
                      : 'Preparando transmissão…'
              }
              error={
                streamError ??
                currentServerState.error ??
                (episodeState.id === anime.id ? episodeState.error : null)
              }
              onRetry={retryPlayer}
              onSourceFailure={advanceServer}
              initialTime={
                progress && !progress.completed
                  ? progress.currentTime
                  : undefined
              }
              onProgress={save}
            />
          </PlayerErrorBoundary>
          <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <button
              type="button"
              disabled={activeIndex <= 0}
              onClick={() => selectEpisode(episodes[activeIndex - 1]?.id ?? '')}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-white/70 hover:bg-white/[0.06] disabled:opacity-30"
            >
              <ArrowLeft size={14} /> Anterior
            </button>
            <span className="text-xs font-semibold text-white/65">
              {currentEpisode
                ? `Episódio ${currentEpisode.number}${currentEpisode.title ? ` · ${currentEpisode.title}` : ''}`
                : 'Carregando episódios'}
            </span>
            <button
              type="button"
              disabled={activeIndex < 0 || activeIndex >= episodes.length - 1}
              onClick={() => selectEpisode(episodes[activeIndex + 1]?.id ?? '')}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-white/70 hover:bg-white/[0.06] disabled:opacity-30"
            >
              Próximo <ArrowRight size={14} />
            </button>
          </div>
          <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-base font-bold">{title}</h1>
                <p className="mt-1 text-xs text-white/45">
                  {currentEpisode
                    ? `Episódio ${currentEpisode.number}`
                    : 'Selecione um episódio'}
                </p>
              </div>
              {poster && (
                <img
                  src={poster}
                  alt=""
                  className="h-20 w-14 rounded-lg object-cover"
                />
              )}
            </div>
            <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-white/45">
              {stripHtml(anime.description)}
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                  Servidores de reprodução
                </span>
                {loadingSources && (
                  <span role="status" className="text-[10px] text-white/40">
                    Carregando…
                  </span>
                )}
              </div>
              <ServerSelector
                servers={currentServerState.servers}
                activeId={activeServerId}
                disabled={loadingSources}
                onSelect={(serverId) =>
                  selectServer(currentEpisodeId, serverId)
                }
              />
              <a
                href="https://anilist.co"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-semibold text-white/50 hover:text-white"
              >
                AniList <ExternalLink size={12} />
              </a>
            </div>
          </section>
        </div>
        <div className="self-start space-y-6 xl:sticky xl:top-24">
          <aside className="flex max-h-[75vh] flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <EpisodeListControls
              heading="Episódios"
              count={filteredEpisodes.length}
              search={episodeSearch}
              onSearchChange={(value) => {
                setEpisodeSearch(value);
                setEpisodePage(0);
              }}
              ascending={episodesAscending}
              onToggleOrder={() => {
                setEpisodesAscending((current) => !current);
                setEpisodePage(0);
              }}
            />
            {episodePageCount > 1 && (
              <div className="flex shrink-0 flex-wrap gap-1 border-b border-white/[0.05] px-1 py-2">
                {Array.from({ length: episodePageCount }, (_, index) => {
                  const first = index * PLAYER_EPISODE_PAGE_SIZE + 1;
                  const last = Math.min(
                    (index + 1) * PLAYER_EPISODE_PAGE_SIZE,
                    filteredEpisodes.length,
                  );
                  return (
                    <button
                      key={index}
                      type="button"
                      aria-current={episodePage === index ? 'page' : undefined}
                      onClick={() => setEpisodePage(index)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${episodePage === index ? 'bg-[#49d77a] text-[#07110a]' : 'bg-white/[0.04] text-white/45 hover:bg-white/[0.08] hover:text-white'}`}
                    >
                      {first}–{last}
                    </button>
                  );
                })}
              </div>
            )}
            {loadingEpisodes ? (
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    key={index}
                    className="h-14 animate-pulse rounded-lg bg-white/[0.04]"
                  />
                ))}
              </div>
            ) : visibleEpisodes.length ? (
              <div className="min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto pt-2">
                {visibleEpisodes.map((episode) => (
                  <button
                    key={episode.id}
                    type="button"
                    ref={
                      episode.id === currentEpisodeId
                        ? activeEpisodeRef
                        : undefined
                    }
                    aria-current={
                      episode.id === currentEpisodeId ? 'true' : undefined
                    }
                    onClick={() => selectEpisode(episode.id)}
                    className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${episode.id === currentEpisodeId ? 'bg-[#49d77a]/10 text-[#70e793]' : 'text-white/60 hover:bg-white/[0.05]'}`}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/[0.05] text-xs font-bold">
                      {episode.number}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold">
                        Episódio {episode.number}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-white/35">
                        {episode.title ?? 'Anime'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : episodes.length > 0 ? (
              <p className="flex min-h-36 flex-1 items-center justify-center px-4 text-center text-xs leading-relaxed text-white/40">
                Nenhum episódio encontrado para “{episodeSearch}”.
              </p>
            ) : (
              <p className="p-3 text-xs leading-relaxed text-white/40">
                {episodeState.error ??
                  'Nenhum episódio disponível pela Anivexa.'}
              </p>
            )}
          </aside>
          <WatchRelatedList
            title="Animes relacionados"
            items={anime.relations}
            titleLanguage={titleLanguage}
          />
          <WatchRelatedList
            title="Recomendações"
            items={anime.recommendations}
            label="Recomendado"
            titleLanguage={titleLanguage}
          />
        </div>
      </div>
    </div>
  );
}

function WatchRelatedList({
  title,
  items,
  label,
  titleLanguage,
}: {
  title: string;
  items: Array<AnimeResult & { relationType?: string }>;
  label?: string;
  titleLanguage: 'en' | 'jp';
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="h-5 w-1 rounded-full bg-[#49d77a]" />
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      <div className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.07] bg-white/[0.02] px-2 py-1">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/anime/${item.id}`}
            className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-white/[0.04]"
          >
            <div className="size-16 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <span className="grid size-full place-items-center text-xs text-white/30">
                  ?
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium text-white/85 group-hover:text-white">
                {resolveAnimeTitle(item.title, titleLanguage)}
              </p>
              <p className="mt-1 truncate text-[10px] font-semibold tracking-wide text-white/40 uppercase">
                {label ?? item.relationType ?? 'Relacionado'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
