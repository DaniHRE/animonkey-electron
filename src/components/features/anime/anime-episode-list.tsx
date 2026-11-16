import { Captions, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EpisodeListControls,
  type EpisodeViewMode,
} from './episode-list-controls';
import { filterAndSortEpisodes } from '@/lib/episode-filter';
import { stripHtml } from '@/lib/anime';
import { getPaginationItems } from '@/lib/pagination';
import type { AnimeEpisode } from '@/types/player';

const PAGE_SIZE = 8;

interface AnimeEpisodeListProps {
  animeId: string;
  episodes: AnimeEpisode[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function AnimeEpisodeList({
  animeId,
  episodes,
  loading,
  error,
  onRetry,
}: AnimeEpisodeListProps) {
  const [search, setSearch] = useState('');
  const [ascending, setAscending] = useState(true);
  const [viewMode, setViewMode] = useState<EpisodeViewMode>('list');
  const [page, setPage] = useState(1);

  const filteredEpisodes = useMemo(
    () => filterAndSortEpisodes(episodes, search, ascending, true),
    [ascending, episodes, search],
  );
  const totalPages = Math.ceil(filteredEpisodes.length / PAGE_SIZE);
  const paginationItems = getPaginationItems(page, totalPages);
  const visibleEpisodes = filteredEpisodes.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function toggleOrder() {
    setAscending((current) => !current);
    setPage(1);
  }

  function changeViewMode(mode: EpisodeViewMode) {
    setViewMode(mode);
    setPage(1);
  }

  return (
    <div role="tabpanel" className="space-y-4">
      <EpisodeListControls
        search={search}
        onSearchChange={changeSearch}
        ascending={ascending}
        onToggleOrder={toggleOrder}
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
      />
      {loading ? (
        <div
          className="space-y-2"
          role="status"
          aria-label="Carregando episódios; a primeira busca de catálogos grandes pode demorar mais"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-lg bg-white/[0.035]"
            />
          ))}
          <p className="pt-2 text-xs text-white/45">
            Catálogos grandes podem demorar mais na primeira busca.
          </p>
        </div>
      ) : visibleEpisodes.length ? (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 gap-3 md:grid-cols-2'
              : 'flex flex-col gap-2'
          }
        >
          {visibleEpisodes.map((episode) => (
            <Link
              key={episode.id}
              to={`/watch/${animeId}?ep=${encodeURIComponent(episode.id)}`}
              className={`group flex min-w-0 items-center gap-4 rounded-md border border-white/[0.06] bg-white/[0.025] px-4 py-3 transition hover:bg-white/[0.06] ${viewMode === 'grid' ? 'min-h-20' : ''}`}
            >
              <span className="w-8 shrink-0 text-center text-sm font-semibold text-white/60">
                {episode.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white group-hover:text-white">
                  {episode.title ?? `Episódio ${episode.number}`}
                </span>
                {viewMode === 'grid' && episode.description && (
                  <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-white/40">
                    {stripHtml(episode.description)}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-white/40">
                {episode.isSubbed && (
                  <Captions size={16} aria-label="Episódio legendado" />
                )}
                <Heart size={16} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-white/[0.025] p-8 text-center text-sm text-white/50">
          {episodes.length === 0 && error ? (
            <div role="alert" className="space-y-3">
              <p>{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#49d77a]"
              >
                Tentar novamente
              </button>
            </div>
          ) : episodes.length === 0 ? (
            'Nenhum episódio disponível pela Anivexa.'
          ) : (
            'Nenhum episódio encontrado.'
          )}
        </div>
      )}
      {totalPages > 1 && (
        <nav
          aria-label="Paginação dos episódios"
          className="flex min-w-0 flex-wrap items-center justify-center gap-1 pt-1"
        >
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-xs font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
          >
            <ChevronLeft size={15} /> Anterior
          </button>
          {paginationItems.map((item, index) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                aria-hidden="true"
                className="grid h-8 min-w-4 place-items-center text-xs text-white/35"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-label={`Página ${item}`}
                aria-current={page === item ? 'page' : undefined}
                onClick={() => setPage(item)}
                className={`grid size-8 place-items-center rounded-md text-xs font-semibold transition ${page === item ? 'bg-[#49d77a] text-[#07110a]' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'}`}
              >
                {item}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={page === totalPages}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-xs font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
          >
            Próxima <ChevronRight size={15} />
          </button>
        </nav>
      )}
    </div>
  );
}
