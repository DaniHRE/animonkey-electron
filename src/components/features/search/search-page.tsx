import { ArrowLeft, ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimeCard } from '@/components/shared/anime-card';
import { LoadingGrid } from '@/components/shared/loading-grid';
import { AniListCatalog } from '@/services/anilist.service';
import type {
  AnimeResult,
  AnimeSearchFilters,
  AnimeSearchResponse,
} from '@/types/anime';

const genres = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];
const formats = [
  ['TV', 'Série de TV'],
  ['TV_SHORT', 'TV curta'],
  ['MOVIE', 'Filme'],
  ['SPECIAL', 'Especial'],
  ['OVA', 'OVA'],
  ['ONA', 'ONA'],
  ['MUSIC', 'Música'],
] as const;
const statuses = [
  ['RELEASING', 'Em exibição'],
  ['FINISHED', 'Finalizado'],
  ['NOT_YET_RELEASED', 'A lançar'],
] as const;

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const requestedPage = Number(params.get('page') ?? 1);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const rawStatus = params.get('status');
  const status = statuses.some(([value]) => value === rawStatus)
    ? (rawStatus as AnimeSearchFilters['status'])
    : undefined;
  const rawFormat = params.get('format');
  const format = formats.some(([value]) => value === rawFormat)
    ? (rawFormat as AnimeSearchFilters['format'])
    : undefined;
  const rawGenre = params.get('genre');
  const genre = genres.includes(rawGenre ?? '')
    ? (rawGenre ?? undefined)
    : undefined;
  const [state, setState] = useState<{
    key: string;
    result: AnimeSearchResponse | null;
    error: string | null;
  }>({ key: '', result: null, error: null });
  const requestKey = `${query}:${page}:${status ?? ''}:${format ?? ''}:${genre ?? ''}`;

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => {
        AniListCatalog.search(query, page, controller.signal, {
          status,
          format,
          genre,
        })
          .then((result) => setState({ key: requestKey, result, error: null }))
          .catch((cause: unknown) => {
            if (!controller.signal.aborted)
              setState({
                key: requestKey,
                result: null,
                error:
                  cause instanceof Error
                    ? cause.message
                    : 'Falha ao buscar animes.',
              });
          });
      },
      query ? 300 : 0,
    );
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, page, status, format, genre, requestKey]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  };
  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    setParams(next);
  };
  const clearFilters = () => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    setParams(next);
  };
  const loading = state.key !== requestKey;
  const result = loading ? null : state.result;

  return (
    <section>
      <div className="mb-6">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
          <Search size={13} /> Catálogo
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {query ? `Resultados para “${query}”` : 'Buscar animes'}
        </h1>
        <p className="mt-2 text-xs text-white/40">
          Explore títulos, temporadas e gêneros.
        </p>
      </div>
      <div className="mb-7 flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-white/55">
          <SlidersHorizontal size={14} /> Filtros
        </div>
        <label className="grid gap-1 text-[10px] font-semibold text-white/40">
          Status
          <select
            value={status ?? ''}
            onChange={(event) => updateFilter('status', event.target.value)}
            className="h-9 min-w-36 rounded-lg border border-white/10 bg-[#151517] px-3 text-xs text-white/80 outline-none focus:border-[#49d77a]/60"
          >
            <option value="">Todos</option>
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] font-semibold text-white/40">
          Formato
          <select
            value={format ?? ''}
            onChange={(event) => updateFilter('format', event.target.value)}
            className="h-9 min-w-36 rounded-lg border border-white/10 bg-[#151517] px-3 text-xs text-white/80 outline-none focus:border-[#49d77a]/60"
          >
            <option value="">Todos</option>
            {formats.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] font-semibold text-white/40">
          Gênero
          <select
            value={genre ?? ''}
            onChange={(event) => updateFilter('genre', event.target.value)}
            className="h-9 min-w-40 rounded-lg border border-white/10 bg-[#151517] px-3 text-xs text-white/80 outline-none focus:border-[#49d77a]/60"
          >
            <option value="">Todos</option>
            {genres.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {(status || format || genre) && (
          <button
            type="button"
            onClick={clearFilters}
            className="h-9 px-2 text-xs font-semibold text-[#70e793] hover:text-white"
          >
            Limpar filtros
          </button>
        )}
      </div>
      {loading ? (
        <LoadingGrid />
      ) : state.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300/10 bg-red-400/[0.04] p-5 text-sm text-red-200/80"
        >
          {state.error}
        </div>
      ) : result?.results.length ? (
        <>
          <div className="mb-4 text-xs text-white/35">
            {result.totalResults.toLocaleString('pt-BR')} títulos
          </div>
          <div className="grid grid-cols-6 gap-x-5 gap-y-8">
            {result.results.map((anime: AnimeResult) => (
              <AnimeCard anime={anime} key={anime.id} />
            ))}
          </div>
          <div className="mt-9 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/65 transition hover:bg-white/[0.05] disabled:opacity-30"
            >
              <ArrowLeft size={14} /> Anterior
            </button>
            <span className="text-xs tabular-nums text-white/45">
              Página {page} de {result.totalPages}
            </span>
            <button
              type="button"
              disabled={!result.hasNextPage}
              onClick={() => goToPage(page + 1)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/65 transition hover:bg-white/[0.05] disabled:opacity-30"
            >
              Próxima <ArrowRight size={14} />
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
          Nenhum anime encontrado com esses critérios.
        </div>
      )}
    </section>
  );
}
