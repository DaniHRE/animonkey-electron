import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router';
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
  Captions,
  Mic,
  Maximize2,
  Bookmark,
  Keyboard,
} from 'lucide-react';
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from 'motion/react';
import { VideoPlayer } from '@/components/features/player/video-player';
import { ServerSelector } from '@/components/features/player/server-selector';
import { WatchRelatedList } from '@/components/features/player/watch-related-list';
import type { EpisodeViewMode } from '@/components/features/anime/episode-list-controls';
import { PlayerErrorBoundary } from '@/components/features/player/player-error-boundary';
import { AniListCatalog } from '@/services/anilist.service';
import { AnivexaCatalog } from '@/services/anivexa.service';
import { useEpisodeProgress } from '@/hooks/use-episode-progress';
import { useSaveEpisodeProgress } from '@/hooks/use-save-episode-progress';
import { usePlaybackSessionStore } from '@/stores/playback-session-store';
import { getAnimeImage, resolveAnimeTitle, stripHtml } from '@/lib/anime';
import type { AnimeInfo } from '@/types/anime';
import type {
  AnimeEpisode,
  EpisodeServer,
  EpisodeSources,
} from '@/types/player';
import { useTitleLanguage } from '@/hooks/use-title-language';
import { getPaginationItems } from '@/lib/pagination';
import { EpisodeThumbnail } from '@/components/shared/episode-thumbnail';
import { useWatchLater } from '@/hooks/use-watch-later';
import './watch-page.css';

const GENRE_LABELS: Record<string, string> = {
  Action: 'Ação',
  Adventure: 'Aventura',
  Comedy: 'Comédia',
  Drama: 'Drama',
  Fantasy: 'Fantasia',
  Horror: 'Terror',
  Mystery: 'Mistério',
  Romance: 'Romance',
  'Sci-Fi': 'Ficção científica',
  'Slice of Life': 'Cotidiano',
  Sports: 'Esportes',
  Supernatural: 'Sobrenatural',
  Thriller: 'Suspense',
  Music: 'Música',
  Psychological: 'Psicológico',
  Mecha: 'Mecha',
  Ecchi: 'Ecchi',
  'Mahou Shoujo': 'Garotas mágicas',
};
const PLAYER_EPISODE_PAGE_SIZE = 50;
const watchRoute = getRouteApi('/watch/$id');
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
  const { id } = watchRoute.useParams();
  return <WatchPageContent key={id} />;
}

function WatchPageContent() {
  const { titleLanguage } = useTitleLanguage();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { id } = watchRoute.useParams();
  const { ep: requestedEpisodeId = '' } = watchRoute.useSearch();
  const navigate = useNavigate({ from: '/watch/$id' });
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
  const [theater, setTheater] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const { isInList, toggle, isLoading: libraryLoading } = useWatchLater();
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
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [
    currentEpisodeId,
    episodePage,
    episodeSearch,
    episodeViewMode,
    prefersReducedMotion,
  ]);

  useEffect(() => {
    if (!currentEpisodeId || currentEpisodeId === requestedEpisodeId) return;
    void navigate({
      search: (previous) => ({ ...previous, ep: currentEpisodeId }),
      replace: true,
    });
  }, [currentEpisodeId, navigate, requestedEpisodeId]);

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
  const selectEpisode = (
    episode: AnimeEpisode,
    audio: 'sub' | 'dub' = currentEpisodeAudio,
  ) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        ep: episodeIdForAudio(episode, audio),
      }),
    });
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
  const catalogReady = episodeState.id === anime.id;
  const subbedEpisodeCount = episodes.filter(
    (episode) => episode.isSubbed,
  ).length;
  const dubbedEpisodeCount = episodes.filter(
    (episode) => episode.isDubbed,
  ).length;
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
  const episodeIndex = episodes.findIndex((episode) =>
    episodeHasId(episode, currentEpisodeId),
  );
  const previousEpisode =
    episodeIndex > 0 ? episodes[episodeIndex - 1] : undefined;
  const nextEpisode =
    episodeIndex >= 0 ? episodes[episodeIndex + 1] : undefined;
  const playingServer = currentServerState.servers.find(
    (server) => server.id === activeServerId,
  );
  async function toggleLibrary() {
    if (!anime || saving || libraryLoading) return;
    setSaving(true);
    setLibraryError('');
    try {
      await toggle(anime);
    } catch {
      setLibraryError('Não foi possível atualizar sua lista. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }
  const preferredAudio: 'sub' | 'dub' =
    episodeAudioFilter === 'all' ? currentEpisodeAudio : episodeAudioFilter;
  return (
    <div className={`watch-page ${theater ? 'is-theater' : ''}`}>
      <div className="watch-page__layout">
        <aside className="watch-page__info">
          <div className="watch-page__info-card">
            <div className="watch-page__poster-stage">
              {poster && (
                <div
                  aria-hidden="true"
                  className="watch-page__poster-glow"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgb(8 10 12 / 12%), #080a0c 96%), url("${poster}")`,
                  }}
                />
              )}
              {poster ? (
                <img
                  src={poster}
                  alt={`Pôster de ${title}`}
                  className="watch-page__poster"
                />
              ) : (
                <div className="watch-page__poster-placeholder">Animonkey</div>
              )}
            </div>
            <div className="watch-page__summary-copy">
              <h1 className="watch-page__anime-title">{title}</h1>
              {anime.title.native && anime.title.native !== title && (
                <p className="watch-page__native-title">{anime.title.native}</p>
              )}
              <div
                className="watch-page__availability"
                aria-label="Disponibilidade"
              >
                {catalogReady ? (
                  <>
                    {subbedEpisodeCount > 0 && (
                      <span>
                        <Captions size={12} aria-hidden="true" />
                        SUB {subbedEpisodeCount}
                      </span>
                    )}
                    {dubbedEpisodeCount > 0 && (
                      <span>
                        <Mic size={12} aria-hidden="true" />
                        DUB {dubbedEpisodeCount}
                      </span>
                    )}
                  </>
                ) : (
                  anime.totalEpisodes !== undefined && (
                    <span>{anime.totalEpisodes} episódios</span>
                  )
                )}
                {anime.status && (
                  <span className="is-status">
                    {ANIME_STATUS_LABELS[anime.status] ??
                      anime.status.replaceAll('_', ' ')}
                  </span>
                )}
              </div>
              <div className="watch-page__metadata">
                {anime.type && <span>{anime.type}</span>}
                {anime.season && (
                  <span>
                    {ANIME_SEASON_LABELS[anime.season] ?? anime.season}
                    {anime.releaseDate ? ` ${anime.releaseDate}` : ''}
                  </span>
                )}
                {anime.duration !== undefined && (
                  <span>{anime.duration} min</span>
                )}
              </div>
              {anime.genres.length > 0 && (
                <div className="watch-page__genres" aria-label="Gêneros">
                  {anime.genres.slice(0, 8).map((genre) => (
                    <span key={genre}>{GENRE_LABELS[genre] ?? genre}</span>
                  ))}
                </div>
              )}
              {anime.description && (
                <div
                  className="watch-page__description-box"
                  role="region"
                  aria-label={`Sinopse de ${title}`}
                  tabIndex={0}
                >
                  <p className="watch-page__description">
                    {stripHtml(anime.description)}
                  </p>
                </div>
              )}
              {anime.rating !== undefined && (
                <a
                  href={`https://anilist.co/anime/${anime.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="watch-page__rating"
                  aria-label={`Nota AniList ${anime.rating.toFixed(1)} de 10${anime.ratingCount === undefined ? '' : `, ${anime.ratingCount.toLocaleString('pt-BR')} votos`}`}
                >
                  <Star size={14} fill="currentColor" aria-hidden="true" />
                  <strong>{anime.rating.toFixed(1)}</strong>
                  {anime.ratingCount !== undefined && (
                    <span>
                      · {anime.ratingCount.toLocaleString('pt-BR')} votos
                    </span>
                  )}
                </a>
              )}
              <a
                href={`https://anilist.co/anime/${anime.id}`}
                target="_blank"
                rel="noreferrer"
                className="watch-page__anilist-link"
              >
                Ver no AniList <ExternalLink size={13} />
              </a>
              <Link
                className="watch-page__details-link"
                to="/anime/$id"
                params={{ id: anime.id }}
              >
                Ver detalhes <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <WatchRelatedList
            variant="related"
            title="Animes relacionados"
            items={anime.relations}
            titleLanguage={titleLanguage}
          />
          <WatchRelatedList
            variant="recommendations"
            title="Recomendações"
            items={anime.recommendations}
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
              to="/anime/$id"
              params={{ id: anime.id }}
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
          <div
            className="watch-actions"
            role="group"
            aria-label="Ações de reprodução"
          >
            <button
              type="button"
              aria-pressed={theater}
              onClick={() => setTheater(!theater)}
            >
              <Maximize2 size={16} />
              Modo teatro
            </button>
            <button
              type="button"
              disabled={!previousEpisode}
              onClick={() => previousEpisode && selectEpisode(previousEpisode)}
            >
              <ArrowLeft size={16} />
              Anterior
            </button>
            <button
              type="button"
              disabled={!nextEpisode}
              onClick={() => nextEpisode && selectEpisode(nextEpisode)}
            >
              Próximo
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              aria-pressed={isInList(anime.id)}
              disabled={saving || libraryLoading}
              onClick={() => void toggleLibrary()}
            >
              <Bookmark size={16} />
              {isInList(anime.id) ? 'Na sua lista' : 'Assistir depois'}
            </button>
            <button
              type="button"
              aria-expanded={shortcutsOpen}
              aria-controls="watch-shortcuts"
              onClick={() => setShortcutsOpen(!shortcutsOpen)}
            >
              <Keyboard size={16} />
              Atalhos
            </button>
          </div>
          {shortcutsOpen && (
            <div id="watch-shortcuts" className="watch-shortcuts">
              Com o foco no player: <kbd>Espaço</kbd> reproduzir/pausar ·{' '}
              <kbd>←</kbd> <kbd>→</kbd> avançar/voltar · <kbd>F</kbd> tela
              cheia. Em fontes incorporadas, os atalhos dependem do servidor.
            </div>
          )}
          {libraryError && (
            <p role="alert" className="watch-library-error">
              {libraryError}
            </p>
          )}
          <section className="watch-page__servers">
            <div className="watch-page__servers-heading">
              <span>Fontes de reprodução</span>
              {loadingSources && <span role="status">Carregando…</span>}
            </div>
            {playingServer && (
              <p className="watch-playing-source" role="status">
                {loadingSources ? 'Preparando' : 'Fonte selecionada'}:{' '}
                <strong>
                  {playingServer.provider} · {playingServer.serverName}
                </strong>
                <span>
                  Idiomas de legenda:{' '}
                  {playingServer.subtitleLanguages
                    .map((language) => (language === 'en' ? 'EN' : 'PT-BR'))
                    .join(' / ')}
                </span>
              </p>
            )}
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
                  {filter === 'all' ? 'Todos' : filter.toUpperCase()}
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
            <MotionConfig reducedMotion="user">
              <motion.div
                layoutScroll
                className={`watch-page__episode-list ${episodeViewMode === 'grid' ? 'is-grid' : ''}`}
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {visibleEpisodes.map((episode) => {
                    const isCurrent = episodeHasId(episode, currentEpisodeId);
                    const isGrid = episodeViewMode === 'grid';
                    const title = episode.title ?? `Episódio ${episode.number}`;
                    const audioLabels = [
                      episode.isSubbed ? 'SUB' : null,
                      episode.isDubbed ? 'DUB' : null,
                    ].filter((label): label is string => label !== null);
                    const accessibleTitle = spoilersHidden
                      ? 'Título e descrição ocultos para evitar spoilers.'
                      : title;
                    return (
                      <motion.button
                        layout="position"
                        key={episode.id}
                        type="button"
                        ref={isCurrent ? activeEpisodeRef : undefined}
                        aria-current={isCurrent ? 'true' : undefined}
                        aria-label={`Episódio ${String(episode.number).padStart(2, '0')}: ${accessibleTitle}${audioLabels.length ? `. Áudio ${audioLabels.join(' e ')}` : ''}`}
                        onClick={() => selectEpisode(episode, preferredAudio)}
                        className={`watch-page__episode-card ${isGrid ? 'is-grid' : ''} ${isCurrent ? 'is-current' : ''} ${spoilersHidden ? 'spoilers-hidden' : ''}`}
                        initial={{
                          opacity: 0,
                          x: isGrid ? 0 : 8,
                          scale: isGrid ? 0.88 : 1,
                        }}
                        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: isGrid ? 0.94 : 1 }}
                        transition={{
                          layout: {
                            type: 'spring',
                            stiffness: 440,
                            damping: 38,
                            mass: 0.65,
                            delay: 0,
                          },
                          opacity: {
                            duration: 0.16,
                            ease: [0.16, 1, 0.3, 1],
                            delay: 0,
                          },
                          default: {
                            duration: 0.2,
                            ease: [0.16, 1, 0.3, 1],
                            delay: 0,
                          },
                        }}
                      >
                        <motion.span
                          layout="position"
                          className="watch-page__episode-grid-number"
                          aria-hidden="true"
                          animate={{
                            opacity: isGrid ? 1 : 0,
                            scale: isGrid ? 1 : 0.82,
                          }}
                          transition={{
                            duration: 0.16,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        >
                          {episode.number}
                        </motion.span>
                        <motion.span
                          layout="position"
                          className="watch-page__episode-image"
                        >
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
                        </motion.span>
                        <motion.span
                          layout
                          className="watch-page__episode-copy"
                        >
                          <span className="watch-page__episode-title">
                            <span className="watch-page__episode-number">
                              {String(episode.number).padStart(2, '0')}.
                            </span>{' '}
                            {title}
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
                        </motion.span>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </MotionConfig>
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
