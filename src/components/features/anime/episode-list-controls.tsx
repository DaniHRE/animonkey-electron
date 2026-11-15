import { ArrowDownUp, LayoutGrid, List, Search } from 'lucide-react';
import { useId } from 'react';

export type EpisodeViewMode = 'list' | 'grid';

interface EpisodeListControlsProps {
  search: string;
  onSearchChange: (value: string) => void;
  ascending: boolean;
  onToggleOrder: () => void;
  heading?: string;
  count?: number;
  viewMode?: EpisodeViewMode;
  onViewModeChange?: (mode: EpisodeViewMode) => void;
}

export function EpisodeListControls({
  search,
  onSearchChange,
  ascending,
  onToggleOrder,
  heading,
  count,
  viewMode,
  onViewModeChange,
}: EpisodeListControlsProps) {
  const searchId = useId();
  const hasViewMode = viewMode && onViewModeChange;

  return (
    <div className="shrink-0">
      {heading && (
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <h3 className="text-sm font-semibold tracking-tight text-white">
            {heading}{' '}
            {count !== undefined && (
              <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/50 tabular-nums">
                {count}
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={onToggleOrder}
            aria-label={
              ascending ? 'Ordenar do mais recente' : 'Ordenar do mais antigo'
            }
            title={ascending ? 'Ordem crescente' : 'Ordem decrescente'}
            className={`grid size-8 place-items-center rounded-md text-white/40 transition hover:bg-white/[0.06] hover:text-white ${!ascending ? 'text-[#49d77a]' : ''}`}
          >
            <ArrowDownUp size={15} />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={searchId} className="sr-only">
            Buscar episódio por nome, número ou descrição
          </label>
          <Search
            size={15}
            aria-hidden="true"
            className="absolute top-1/2 left-3 -translate-y-1/2 text-white/30"
          />
          <input
            id={searchId}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar episódio..."
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pr-3 pl-9 text-xs text-white/85 outline-none placeholder:text-white/30 focus:border-white/20"
          />
        </div>
        {!heading && (
          <button
            type="button"
            onClick={onToggleOrder}
            aria-label={
              ascending ? 'Ordenar do mais recente' : 'Ordenar do mais antigo'
            }
            title={ascending ? 'Ordem crescente' : 'Ordem decrescente'}
            className={`grid size-9 shrink-0 place-items-center rounded-md text-white/45 transition hover:bg-white/[0.06] hover:text-white ${!ascending ? 'text-[#49d77a]' : ''}`}
          >
            <ArrowDownUp size={16} />
          </button>
        )}
        {hasViewMode && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label="Visualização em lista"
              aria-pressed={viewMode === 'list'}
              onClick={() => onViewModeChange('list')}
              className={`grid size-9 place-items-center rounded-md transition ${viewMode === 'list' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white'}`}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              aria-label="Visualização em grade"
              aria-pressed={viewMode === 'grid'}
              onClick={() => onViewModeChange('grid')}
              className={`grid size-9 place-items-center rounded-md transition ${viewMode === 'grid' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white'}`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
