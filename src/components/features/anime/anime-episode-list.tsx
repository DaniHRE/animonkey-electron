import { Captions, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EpisodeListControls,
  type EpisodeViewMode,
} from './episode-list-controls';
import { filterAndSortEpisodes } from '@/lib/episode-filter';
import { stripHtml } from '@/lib/anime';
import type { AnimeEpisode } from '@/types/player';

const PAGE_SIZE = 8;

interface AnimeEpisodeListProps {
  animeId: string;
  episodes: AnimeEpisode[];
  loading: boolean;
  error: string | null;
}

export function AnimeEpisodeList({
  animeId,
  episodes,
  loading,
  error,
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
          aria-label="Carregando episódios"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-lg bg-white/[0.035]"
            />
          ))}
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
              className={`group flex min-w-0 items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] p-3 transition hover:bg-white/[0.06] ${viewMode === 'grid' ? 'min-h-20' : ''}`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/[0.06] text-xs font-bold tabular-nums text-white/65 transition group-hover:bg-white/[0.1]">
                {episode.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-white/85 group-hover:text-white">
                  {episode.number}.{' '}
                  {episode.title ?? `Episódio ${episode.number}`}
                </span>
                {viewMode === 'grid' && episode.description && (
                  <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-white/40">
                    {stripHtml(episode.description)}
                  </span>
                )}
              </span>
              {episode.isSubbed && (
                <Captions
                  size={15}
                  aria-label="Episódio legendado"
                  className="shrink-0 text-white/30"
                />
              )}
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-white/[0.025] p-8 text-center text-sm text-white/50">
          {episodes.length === 0 && error
            ? error
            : episodes.length === 0
              ? 'Nenhum episódio disponível pela Anivexa.'
              : 'Nenhum episódio encontrado.'}
        </p>
      )}
      {totalPages > 1 && (
        <nav
          aria-label="Paginação dos episódios"
          className="flex items-center justify-center gap-1.5 pt-1"
        >
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-xs font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:text-white/25"
          >
            <ChevronLeft size={15} /> Anterior
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map(
            (pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                aria-current={page === pageNumber ? 'page' : undefined}
                onClick={() => setPage(pageNumber)}
                className={`grid size-8 place-items-center rounded-md text-xs font-semibold transition ${page === pageNumber ? 'bg-[#49d77a] text-[#07110a]' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'}`}
              >
                {pageNumber}
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
