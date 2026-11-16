import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  ExternalLink,
  LayoutGrid,
  List,
  Play,
  Search,
  Star,
} from 'lucide-react';
import { VideoPlayer } from '@/components/features/player/video-player';
import { ServerSelector } from '@/components/features/player/server-selector';
import type { EpisodeViewMode } from '@/components/features/anime/episode-list-controls';
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
import { getPaginationItems } from '@/lib/pagination';
import { EpisodeThumbnail } from '@/components/shared/episode-thumbnail';
import './watch-page.css';

const PLAYER_EPISODE_PAGE_SIZE = 50;
type EpisodeAudioFilter = 'all' | 'sub' | 'dub';
const ANIME_STATUS_LABELS: Record<string, string> = {
  FINISHED: 'Concluído',
  RELEASING: 'Em lançamento',
  NOT_YET_RELEASED: 'Em breve',
  CANCELLED: 'Cancelado',
  HIATUS: 'Em pausa',
};
const ANIME_SEASON_LABELS: Record<string, string> = {
  WINTER: 'Inverno',
  SPRING: 'Primavera',
  SUMMER: 'Verão',
  FALL: 'Outono',
};

function episodeIdForAudio(
  episode: AnimeEpisode,
  audio: 'sub' | 'dub',
): string {
  return audio === 'dub'
    ? (episode.dubEpisodeId ?? episode.subEpisodeId ?? episode.id)
    : (episode.subEpisodeId ?? episode.dubEpisodeId ?? episode.id);
}

function episodeHasId(episode: AnimeEpisode, episodeId: string): boolean {
  return (
    episode.id === episodeId ||
    episode.subEpisodeId === episodeId ||
    episode.dubEpisodeId === episodeId
  );
}

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
  const [episodeAudioFilter, setEpisodeAudioFilter] =
    useState<EpisodeAudioFilter>('all');
  const [episodeViewMode, setEpisodeViewMode] =
    useState<EpisodeViewMode>('list');
  const [spoilersHidden, setSpoilersHidden] = useState(false);
  const [manualEpisodePage, setManualEpisodePage] = useState<{
    episodeId: string;
    page: number;
  } | null>(null);
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
  const filteredEpisodes = useMemo(() => {
    const query = episodeSearch.trim().toLocaleLowerCase();
    const filtered = episodes.filter((episode) => {
      if (episodeAudioFilter === 'sub' && !episode.isSubbed) return false;
      if (episodeAudioFilter === 'dub' && !episode.isDubbed) return false;
      if (!query) return true;
      return (
        episode.title?.toLocaleLowerCase().includes(query) ||
        String(episode.number).includes(query) ||
        episode.description?.toLocaleLowerCase().includes(query)
      );
    });
    return filtered.sort((first, second) =>
      episodesAscending
        ? first.number - second.number
        : second.number - first.number,
    );
  }, [episodeAudioFilter, episodeSearch, episodes, episodesAscending]);
  const currentEpisodeId = episodes.some((episode) =>
    episodeHasId(episode, requestedEpisodeId),
  )
    ? requestedEpisodeId
    : (episodes[0]?.id ?? '');
  const currentEpisode = useMemo(
    () =>
      episodes.find((episode) => episodeHasId(episode, currentEpisodeId)) ??
      null,
    [currentEpisodeId, episodes],
  );
  const currentEpisodeAudio: 'sub' | 'dub' =
    currentEpisode?.dubEpisodeId === currentEpisodeId ? 'dub' : 'sub';
  const currentEpisodeDisplayIndex = filteredEpisodes.findIndex((episode) =>
    episodeHasId(episode, currentEpisodeId),
  );
  const episodePage =
    manualEpisodePage?.episodeId === currentEpisodeId
      ? manualEpisodePage.page
      : currentEpisodeDisplayIndex >= 0
        ? Math.floor(currentEpisodeDisplayIndex / PLAYER_EPISODE_PAGE_SIZE)
        : 0;
  const episodePageCount = Math.ceil(
    filteredEpisodes.length / PLAYER_EPISODE_PAGE_SIZE,
  );
  const episodePageItems = getPaginationItems(
    episodePage + 1,
    episodePageCount,
  );
  const visibleEpisodes = filteredEpisodes.slice(
    episodePage * PLAYER_EPISODE_PAGE_SIZE,
    (episodePage + 1) * PLAYER_EPISODE_PAGE_SIZE,
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
  const activeIndex = episodes.findIndex((episode) =>
    episodeHasId(episode, currentEpisodeId),
  );
  const selectEpisode = (
    episode: AnimeEpisode,
    audio: 'sub' | 'dub' = currentEpisodeAudio,
  ) => {
    const next = new URLSearchParams(params);
    next.set('ep', episodeIdForAudio(episode, audio));
    setParams(next);
  };
  const retryPlayer = () => {
    setManualEpisodePage(null);
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
  const pageStart = episodePage * PLAYER_EPISODE_PAGE_SIZE + 1;
  const pageEnd = Math.min(
    (episodePage + 1) * PLAYER_EPISODE_PAGE_SIZE,
    filteredEpisodes.length,
  );
  const preferredAudio: 'sub' | 'dub' =
    episodeAudioFilter === 'all' ? currentEpisodeAudio : episodeAudioFilter;
  return (
    <div className="watch-page">
      <div className="watch-page__layout">
        <aside className="watch-page__info">
          <div className="watch-page__info-card">
            {poster ? (
              <img
                src={poster}
                alt={`Pôster de ${title}`}
                className="watch-page__poster"
              />
            ) : (
              <div className="watch-page__poster-placeholder">Animonkey</div>
            )}
            <h1 className="watch-page__anime-title">{title}</h1>
            {anime.title.native && anime.title.native !== title && (
              <p className="watch-page__native-title">{anime.title.native}</p>
            )}
            <div className="watch-page__metadata">
              {anime.rating !== undefined && (
                <span className="watch-page__metadata-highlight">
                  <Star size={11} fill="currentColor" aria-hidden="true" />{' '}
                  {anime.rating.toFixed(1)} / 10
                </span>
              )}
              {anime.type && <span>{anime.type}</span>}
              {anime.status && (
                <span>
                  {ANIME_STATUS_LABELS[anime.status] ??
                    anime.status.replaceAll('_', ' ')}
                </span>
              )}
              {anime.totalEpisodes !== undefined && (
                <span>{anime.totalEpisodes} episódios</span>
              )}
              {anime.duration !== undefined && (
                <span>{anime.duration} min</span>
              )}
              {anime.season && (
                <span>
                  {ANIME_SEASON_LABELS[anime.season] ?? anime.season}
                  {anime.releaseDate ? ` ${anime.releaseDate}` : ''}
                </span>
              )}
            </div>
            {anime.genres.length > 0 && (
              <div className="watch-page__genres" aria-label="Gêneros">
                {anime.genres.slice(0, 8).map((genre) => (
                  <span key={genre}>{genre}</span>
                ))}
              </div>
            )}
            {anime.description && (
              <p className="watch-page__description">
                {stripHtml(anime.description)}
              </p>
            )}
            <a
              href={`https://anilist.co/anime/${anime.id}`}
              target="_blank"
              rel="noreferrer"
              className="watch-page__anilist-link"
            >
              Ver no AniList <ExternalLink size={13} />
            </a>
          </div>
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
        </aside>

        <section className="watch-page__center" aria-label="Reprodução">
          <nav
            className="watch-page__breadcrumb"
            aria-label="Navegação estrutural"
          >
            <Link to="/">Início</Link>
            <span aria-hidden="true">›</span>
            <Link
              to={`/anime/${anime.id}`}
              className="watch-page__breadcrumb-title"
            >
              {title}
            </Link>
            <span aria-hidden="true">›</span>
            <span className="watch-page__breadcrumb-current">
              {currentEpisode
                ? `Episódio ${currentEpisode.number}`
                : 'Carregando'}
            </span>
          </nav>
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
          <div className="watch-page__episode-heading">
            <div className="min-w-0">
              <h2 className="truncate">
                {currentEpisode?.title ??
                  (currentEpisode
                    ? `Episódio ${currentEpisode.number}`
                    : 'Selecione um episódio')}
              </h2>
              <p>
                {title}
                {currentEpisode ? ` · Episódio ${currentEpisode.number}` : ''}
              </p>
            </div>
            <button
              type="button"
              disabled={activeIndex <= 0}
              onClick={() => {
                const previous = episodes[activeIndex - 1];
                if (previous) selectEpisode(previous, preferredAudio);
              }}
              aria-label="Reproduzir episódio anterior"
              className="watch-page__step-button"
            >
              <ArrowLeft size={15} />
            </button>
            <button
              type="button"
              disabled={activeIndex < 0 || activeIndex >= episodes.length - 1}
              onClick={() => {
                const next = episodes[activeIndex + 1];
                if (next) selectEpisode(next, preferredAudio);
              }}
              aria-label="Reproduzir próximo episódio"
              className="watch-page__step-button"
            >
              <ArrowRight size={15} />
            </button>
          </div>

          <section className="watch-page__servers">
            <div className="watch-page__servers-heading">
              <span>Servidores de reprodução</span>
              {loadingSources && <span role="status">Carregando…</span>}
            </div>
            <ServerSelector
              servers={currentServerState.servers}
              activeId={activeServerId}
              disabled={loadingSources}
              onSelect={(serverId) => selectServer(currentEpisodeId, serverId)}
            />
          </section>
        </section>

        <aside className="watch-page__episodes" aria-label="Episódios">
          <div className="watch-page__episodes-header">
            <h2>
              Episódios <span>{filteredEpisodes.length}</span>
            </h2>
            <div className="watch-page__header-controls">
              {(['all', 'sub', 'dub'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={episodeAudioFilter === filter}
                  onClick={() => {
                    setEpisodeAudioFilter(filter);
                    setManualEpisodePage(null);
                  }}
                  className={episodeAudioFilter === filter ? 'is-active' : ''}
                >
                  {filter === 'all' ? 'ALL' : filter.toUpperCase()}
                </button>
              ))}
              <span
                className="watch-page__control-divider"
                aria-hidden="true"
              />
              <button
                type="button"
                aria-label="Visualização em lista"
                aria-pressed={episodeViewMode === 'list'}
                onClick={() => setEpisodeViewMode('list')}
                className={episodeViewMode === 'list' ? 'is-active' : ''}
              >
                <List size={15} />
              </button>
              <button
                type="button"
                aria-label="Visualização em grade"
                aria-pressed={episodeViewMode === 'grid'}
                onClick={() => setEpisodeViewMode('grid')}
                className={episodeViewMode === 'grid' ? 'is-active' : ''}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                aria-label={
                  spoilersHidden ? 'Mostrar spoilers' : 'Ocultar spoilers'
                }
                aria-pressed={spoilersHidden}
                onClick={() => setSpoilersHidden((hidden) => !hidden)}
                className={spoilersHidden ? 'is-active' : ''}
              >
                {spoilersHidden ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="watch-page__episode-toolbar">
            <label className="watch-page__episode-search">
              <Search size={15} aria-hidden="true" />
              <input
                value={episodeSearch}
                onChange={(event) => {
                  setEpisodeSearch(event.target.value);
                  setManualEpisodePage(null);
                }}
                placeholder="Buscar episódios..."
                aria-label="Buscar episódios por nome, número ou descrição"
              />
            </label>
            <button
              type="button"
              aria-label={
                episodesAscending
                  ? 'Ordenar do mais recente'
                  : 'Ordenar do mais antigo'
              }
              title={
                episodesAscending ? 'Ordem crescente' : 'Ordem decrescente'
              }
              onClick={() => {
                setEpisodesAscending((ascending) => !ascending);
                setManualEpisodePage(null);
              }}
              className="watch-page__sort-button"
            >
              <ArrowDownUp size={15} aria-hidden="true" />
            </button>
          </div>
          {episodePageCount > 1 && (
            <nav
              aria-label="Páginas de episódios"
              className="watch-page__pagination"
            >
              <span>
                {pageStart}–{pageEnd} de {filteredEpisodes.length}
              </span>
              <div className="watch-page__page-buttons">
                <button
                  type="button"
                  aria-label="Página anterior"
                  disabled={episodePage <= 0}
                  onClick={() =>
                    setManualEpisodePage({
                      episodeId: currentEpisodeId,
                      page: Math.max(0, episodePage - 1),
                    })
                  }
                >
                  <ArrowLeft size={12} />
                </button>
                {episodePageItems.map((item, index) => {
                  if (item === 'ellipsis')
                    return (
                      <span key={`ellipsis-${index}`} aria-hidden="true">
                        …
                      </span>
                    );
                  const pageIndex = item - 1;
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-label={`Página ${item}, episódios ${pageIndex * PLAYER_EPISODE_PAGE_SIZE + 1} a ${Math.min((pageIndex + 1) * PLAYER_EPISODE_PAGE_SIZE, filteredEpisodes.length)}`}
                      aria-current={
                        episodePage === pageIndex ? 'page' : undefined
                      }
                      onClick={() =>
                        setManualEpisodePage({
                          episodeId: currentEpisodeId,
                          page: pageIndex,
                        })
                      }
                    >
                      {item}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-label="Próxima página"
                  disabled={episodePage >= episodePageCount - 1}
                  onClick={() =>
                    setManualEpisodePage({
                      episodeId: currentEpisodeId,
                      page: Math.min(episodePageCount - 1, episodePage + 1),
                    })
                  }
                >
                  <ArrowRight size={12} />
                </button>
              </div>
            </nav>
          )}
          {loadingEpisodes ? (
            <div
              className="watch-page__episode-list"
              role="status"
              aria-label="Carregando episódios"
            >
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  className="h-[82px] animate-pulse rounded-lg bg-white/[0.04]"
                />
              ))}
            </div>
          ) : visibleEpisodes.length ? (
            <div
              className={`watch-page__episode-list ${episodeViewMode === 'grid' ? 'is-grid' : ''}`}
            >
              {visibleEpisodes.map((episode) => {
                const isCurrent = episodeHasId(episode, currentEpisodeId);
                const isGrid = episodeViewMode === 'grid';
                return (
                  <button
                    key={episode.id}
                    type="button"
                    ref={isCurrent ? activeEpisodeRef : undefined}
                    aria-current={isCurrent ? 'true' : undefined}
                    onClick={() => selectEpisode(episode, preferredAudio)}
                    className={`watch-page__episode-card ${isGrid ? 'is-grid' : ''} ${isCurrent ? 'is-current' : ''} ${spoilersHidden ? 'spoilers-hidden' : ''}`}
                  >
                    <span className="watch-page__episode-image">
                      <EpisodeThumbnail
                        image={episode.image}
                        className="w-full"
                      />
                      <span
                        aria-hidden="true"
                        className="watch-page__play-overlay"
                      >
                        <Play size={18} fill="currentColor" />
                      </span>
                      <span className="watch-page__episode-number">
                        {String(episode.number).padStart(2, '0')}
                      </span>
                    </span>
                    <span className="watch-page__episode-copy">
                      <span className="watch-page__episode-title">
                        {episode.title ?? `Episódio ${episode.number}`}
                      </span>
                      {episode.description && (
                        <span className="watch-page__episode-description">
                          {stripHtml(episode.description)}
                        </span>
                      )}
                      <span className="watch-page__episode-audio">
                        {episode.isSubbed && <span>SUB</span>}
                        {episode.isDubbed && <span>DUB</span>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : episodes.length > 0 ? (
            <p className="flex min-h-36 flex-1 items-center justify-center px-4 text-center text-xs leading-relaxed text-white/40">
              Nenhum episódio encontrado para “{episodeSearch}”.
            </p>
          ) : (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-3 p-3 text-center text-xs leading-relaxed text-white/40"
              role={episodeState.error ? 'alert' : undefined}
            >
              <p>
                {episodeState.error ??
                  'Nenhum episódio disponível pela Anivexa.'}
              </p>
              {episodeState.error && (
                <button
                  type="button"
                  onClick={retryPlayer}
                  className="rounded-md border border-white/10 px-3 py-2 font-semibold text-white/75 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49d77a]"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}
        </aside>
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
