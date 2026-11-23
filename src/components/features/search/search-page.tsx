import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimeCard } from '@/components/shared/anime-card';
import { LoadingGrid } from '@/components/shared/loading-grid';
import { useAdultContentPreference } from '@/hooks/use-adult-content-preference';
import { animeQueries } from '@/services/anime-queries';
import type {
  AnimeFormat,
  AnimeMediaSort,
  AnimeResult,
  AnimeSearchFilters,
  AnimeSource,
} from '@/types/anime';

const searchRoute = getRouteApi('/search');

const formats: Array<[AnimeFormat, string]> = [
  ['TV', 'Série de TV'],
  ['TV_SHORT', 'TV curta'],
  ['MOVIE', 'Filme'],
  ['SPECIAL', 'Especial'],
  ['OVA', 'OVA'],
  ['ONA', 'ONA'],
];
const supportedFormatValues = new Set<string>(
  formats.map(([format]) => format),
);
const statuses: Array<[string, string]> = [
  ['RELEASING', 'Em exibição'],
  ['FINISHED', 'Finalizado'],
  ['NOT_YET_RELEASED', 'A lançar'],
  ['CANCELLED', 'Cancelado'],
  ['HIATUS', 'Hiato'],
];
const sources: Array<[AnimeSource, string]> = [
  ['ORIGINAL', 'Original'],
  ['MANGA', 'Mangá'],
  ['LIGHT_NOVEL', 'Light novel'],
  ['VISUAL_NOVEL', 'Visual novel'],
  ['VIDEO_GAME', 'Jogo'],
  ['OTHER', 'Outro'],
  ['NOVEL', 'Novel'],
  ['DOUJINSHI', 'Doujinshi'],
  ['ANIME', 'Anime'],
  ['WEB_NOVEL', 'Web novel'],
  ['LIVE_ACTION', 'Live action'],
  ['GAME', 'Game'],
  ['COMIC', 'Quadrinho'],
  ['MULTIMEDIA_PROJECT', 'Multimídia'],
  ['PICTURE_BOOK', 'Livro ilustrado'],
];
const seasons: Array<[string, string]> = [
  ['WINTER', 'Inverno'],
  ['SPRING', 'Primavera'],
  ['SUMMER', 'Verão'],
  ['FALL', 'Outono'],
];
const sortOptions: Array<[AnimeMediaSort, string]> = [
  ['SEARCH_MATCH', 'Relevância'],
  ['TRENDING_DESC', 'Em alta'],
  ['POPULARITY_DESC', 'Popularidade: maior'],
  ['POPULARITY', 'Popularidade: menor'],
  ['SCORE_DESC', 'Nota: maior'],
  ['SCORE', 'Nota: menor'],
  ['FAVOURITES_DESC', 'Favoritos: maior'],
  ['FAVOURITES', 'Favoritos: menor'],
  ['START_DATE_DESC', 'Lançamento: recente'],
  ['START_DATE', 'Lançamento: antigo'],
  ['END_DATE_DESC', 'Conclusão: recente'],
  ['END_DATE', 'Conclusão: antiga'],
  ['ID_DESC', 'Adicionados: recentes'],
  ['ID', 'Adicionados: antigos'],
  ['TITLE_ROMAJI', 'Título A–Z'],
  ['TITLE_ROMAJI_DESC', 'Título Z–A'],
  ['EPISODES_DESC', 'Mais episódios'],
  ['EPISODES', 'Menos episódios'],
  ['DURATION_DESC', 'Maior duração'],
  ['DURATION', 'Menor duração'],
  ['TRENDING', 'Tendência: menor'],
  ['STATUS', 'Status'],
  ['STATUS_DESC', 'Status inverso'],
  ['FORMAT', 'Formato'],
  ['FORMAT_DESC', 'Formato inverso'],
  ['TYPE', 'Tipo'],
  ['TYPE_DESC', 'Tipo inverso'],
  ['TITLE_ENGLISH', 'Título em inglês A–Z'],
  ['TITLE_ENGLISH_DESC', 'Título em inglês Z–A'],
  ['TITLE_NATIVE', 'Título nativo A–Z'],
  ['TITLE_NATIVE_DESC', 'Título nativo Z–A'],
  ['UPDATED_AT_DESC', 'Atualizados recentemente'],
  ['UPDATED_AT', 'Atualizados há mais tempo'],
];

const multiKeys = new Set([
  'statusIn',
  'statusNotIn',
  'formatIn',
  'formatNotIn',
  'genreIn',
  'genreNotIn',
  'tagIn',
  'tagNotIn',
  'tagCategoryIn',
  'tagCategoryNotIn',
  'countryOfOriginNotIn',
  'licensedByIdIn',
  'idsIn',
  'idsNotIn',
  'idsMalIn',
  'idsMalNotIn',
]);
const inputClass =
  'h-10 min-w-32 rounded-xl border border-white/[0.09] bg-[#171719] px-3 text-[13px] text-white/80 outline-none transition placeholder:text-white/25 hover:border-white/[0.16] focus:border-[#49d77a]/55 focus:ring-2 focus:ring-[#49d77a]/10';
const labelClass = 'grid min-w-0 gap-2 text-xs font-semibold text-white/50';

interface MultiPickerProps {
  label: string;
  selected: string[];
  options: Array<[string, string]>;
  onChange: (values: string[]) => void;
}

function MultiPicker({ label, selected, options, onChange }: MultiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const visibleOptions = options
    .filter(([, name]) => name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 100);
  const selectedNames = selected.map(
    (value) => options.find(([option]) => option === value)?.[1] ?? value,
  );

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  };

  return (
    <div className="relative min-w-0">
      <span className="mb-2 block text-xs font-semibold text-white/50">
        {label}
      </span>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-10 w-full min-w-36 items-center justify-between gap-3 rounded-xl border px-3 text-left text-[13px] transition ${open ? 'border-[#49d77a]/50 bg-[#1b1d1b]' : 'border-white/[0.09] bg-[#171719] hover:border-white/[0.17]'}`}
      >
        <span className="truncate text-white/75">
          {selected.length
            ? `${selectedNames.slice(0, 2).join(', ')}${selected.length > 2 ? ` +${selected.length - 2}` : ''}`
            : 'Qualquer'}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-white/35 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.slice(0, 3).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => toggle(value)}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#49d77a]/20 bg-[#49d77a]/[0.08] px-2 py-1 text-xs text-[#a5f0bc] transition hover:border-[#49d77a]/45"
            >
              <span className="truncate">
                {options.find(([option]) => option === value)?.[1] ?? value}
              </span>
              <X size={11} className="shrink-0" />
            </button>
          ))}
          {selected.length > 3 && (
            <span className="self-center text-xs text-white/35">
              +{selected.length - 3}
            </span>
          )}
        </div>
      )}
      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar opções"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full z-40 mt-2 w-[min(19rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#18181a] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <div className="relative mb-2">
              <Search
                size={14}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-white/30"
              />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Buscar ${label.toLowerCase()}...`}
                className="h-9 w-full rounded-xl border border-white/[0.08] bg-black/20 pr-3 pl-9 text-xs text-white outline-none placeholder:text-white/30 focus:border-[#49d77a]/40"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {visibleOptions.map(([value, name]) => {
                const active = selected.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    onClick={() => toggle(value)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-white/70 transition hover:bg-white/[0.06]"
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded border ${active ? 'border-[#49d77a] bg-[#49d77a] text-[#101412]' : 'border-white/20 text-transparent'}`}
                    >
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span className="truncate">{name}</span>
                  </button>
                );
              })}
              {visibleOptions.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-white/35">
                  Nenhuma opção encontrada.
                </p>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-white/[0.07] px-1 pt-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="px-2 py-1.5 text-xs font-medium text-white/40 transition hover:text-white"
              >
                Limpar seleção
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-[#49d77a] px-3 py-1.5 text-xs font-bold text-[#101412] transition hover:bg-[#65e48e]"
              >
                Concluir
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function listParam(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatListParam(value: string | null): AnimeFormat[] {
  return listParam(value).filter((format): format is AnimeFormat =>
    supportedFormatValues.has(format),
  );
}

function filtersFromParams(params: URLSearchParams): AnimeSearchFilters {
  const filters: AnimeSearchFilters = {};
  const numericMap: Record<string, keyof AnimeSearchFilters> = {
    seasonYear: 'seasonYear',
    startDate: 'startDate',
    startDateGreater: 'startDateGreater',
    startDateLesser: 'startDateLesser',
    endDateGreater: 'endDateGreater',
    endDateLesser: 'endDateLesser',
    endDate: 'endDate',
    episodesGreater: 'episodesGreater',
    episodesLesser: 'episodesLesser',
    durationGreater: 'durationGreater',
    durationLesser: 'durationLesser',
    averageScoreGreater: 'averageScoreGreater',
    averageScoreLesser: 'averageScoreLesser',
    popularityGreater: 'popularityGreater',
    popularityLesser: 'popularityLesser',
    minimumTagRank: 'minimumTagRank',
  };
  for (const [param, key] of Object.entries(numericMap)) {
    const number = Number(params.get(param));
    if (params.has(param) && Number.isFinite(number))
      Object.assign(filters, { [key]: number });
  }
  for (const key of multiKeys) {
    const values =
      key === 'formatIn' || key === 'formatNotIn'
        ? formatListParam(params.get(key))
        : listParam(params.get(key));
    if (values.length)
      Object.assign(filters, {
        [key]:
          key.endsWith('IdIn') || key.startsWith('ids')
            ? values.map(Number).filter(Number.isSafeInteger)
            : values,
      });
  }
  const stringMap: Array<[keyof AnimeSearchFilters, string]> = [
    ['season', 'season'],
    ['startDateLike', 'startDateLike'],
    ['countryOfOrigin', 'countryOfOrigin'],
    ['source', 'source'],
    ['sort', 'sort'],
  ];
  for (const [key, param] of stringMap) {
    const value = params.get(param);
    if (value) Object.assign(filters, { [key]: value });
  }
  const adultMode = params.get('adultMode');
  if (
    adultMode === 'include' ||
    adultMode === 'exclude' ||
    adultMode === 'only'
  )
    filters.adultMode = adultMode;
  const licensed = params.get('isLicensed');
  if (licensed === 'true' || licensed === 'false')
    filters.isLicensed = licensed === 'true';
  return filters;
}

export function SearchPage() {
  const { includeAdult } = useAdultContentPreference();
  const params = searchRoute.useSearch();
  const navigate = useNavigate({ from: '/search' });
  const searchString = new URLSearchParams(params).toString();
  const query = params.q ?? '';
  const requestedPage = Number(params.page ?? 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const filters = useMemo(
    () => filtersFromParams(new URLSearchParams(searchString)),
    [searchString],
  );
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query),
      query ? 300 : 0,
    );
    return () => window.clearTimeout(timeout);
  }, [query]);
  const optionsQuery = useQuery(animeQueries.searchOptions(includeAdult));
  const searchQuery = useQuery({
    ...animeQueries.search(debouncedQuery, page, filters, includeAdult),
    enabled: debouncedQuery === query,
  });
  const options = optionsQuery.data ?? {
    genres: [],
    tags: [],
  };

  const update = (key: string, value: string) => {
    void navigate({
      search: (previous) => {
        const next = { ...previous };
        if (value) next[key] = value;
        else delete next[key];
        delete next.page;
        return next;
      },
    });
  };
  const updateMulti = (key: string, values: string[]) =>
    update(key, values.join(','));
  const goToPage = (nextPage: number) => {
    void navigate({
      resetScroll: false,
      search: (previous) => {
        const next = { ...previous };
        if (nextPage > 1) next.page = String(nextPage);
        else delete next.page;
        return next;
      },
    });
  };
  const clearFilters = () =>
    void navigate({ search: query ? { q: query } : {} });
  const loading = debouncedQuery !== query || searchQuery.isPending;
  const result = loading ? null : searchQuery.data;
  const error = searchQuery.error?.message;

  useEffect(() => {
    if (!result || page <= 1 || result.results.length > 0) return;
    void navigate({
      search: (previous) => {
        const next = { ...previous };
        delete next.page;
        return next;
      },
    });
  }, [navigate, page, result]);

  const selected = (key: string) =>
    key === 'formatIn' || key === 'formatNotIn'
      ? formatListParam(params[key] ?? null)
      : listParam(params[key] ?? null);
  const renderMulti = (
    title: string,
    key: string,
    values: Array<[string, string]>,
  ) => (
    <MultiPicker
      label={title}
      selected={selected(key)}
      options={values}
      onChange={(value) => updateMulti(key, value)}
    />
  );
  const renderText = (title: string, key: string, placeholder = '') => (
    <label className={labelClass}>
      {title}
      <input
        className={inputClass}
        value={params[key] ?? ''}
        placeholder={placeholder}
        onChange={(event) => update(key, event.target.value)}
      />
    </label>
  );
  const renderNumber = (
    title: string,
    key: string,
    min?: number,
    max?: number,
  ) => (
    <label className={labelClass}>
      {title}
      <input
        className={inputClass}
        type="number"
        min={min}
        max={max}
        value={params[key] ?? ''}
        onChange={(event) => update(key, event.target.value)}
      />
    </label>
  );
  const genreOptions = options.genres.map(
    (genre) => [genre, genre] as [string, string],
  );
  const tagOptions = options.tags.map(
    (tag) => [tag.name, `${tag.name} · ${tag.category}`] as [string, string],
  );
  const categories = [...new Set(options.tags.map((tag) => tag.category))]
    .sort()
    .map((category) => [category, category] as [string, string]);
  const activeFilterCount = Object.keys(params).filter((key) => {
    if (['q', 'page', 'sort'].includes(key)) return false;
    if (key === 'formatIn' || key === 'formatNotIn')
      return formatListParam(params[key] ?? null).length > 0;
    return true;
  }).length;

  return (
    <section>
      <div className="mb-6">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-[#65e48e] uppercase">
          <Search size={13} /> Catálogo AniList
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {query ? `Resultados para “${query}”` : 'Buscar animes'}
        </h1>
        <p className="mt-2 text-xs text-white/40">
          Combine filtros avançados para encontrar animes no catálogo AniList.
        </p>
      </div>
      <div className="mb-8 overflow-visible rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012)_55%)] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.18)] sm:p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
              <span className="grid size-8 place-items-center rounded-xl border border-[#49d77a]/20 bg-[#49d77a]/[0.08] text-[#72e995]">
                <SlidersHorizontal size={15} />
              </span>
              Refine sua busca
            </div>
            <p className="mt-1 text-xs text-white/40">
              Encontre o anime certo combinando os filtros do AniList.
            </p>
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-white/45 transition hover:bg-white/[0.05] hover:text-white/80"
            >
              <X size={13} /> Limpar {activeFilterCount} filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_minmax(155px,1fr)_minmax(155px,1fr)_minmax(150px,1fr)]">
          <label className={labelClass}>
            Título
            <span className="relative">
              <Search
                size={15}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-white/30"
              />
              <input
                className={`${inputClass} w-full pl-9`}
                data-app-shortcut-search="true"
                value={query}
                placeholder="Buscar anime..."
                onChange={(event) => update('q', event.target.value)}
              />
            </span>
          </label>
          {renderMulti('Status', 'statusIn', statuses)}
          {renderMulti('Formato', 'formatIn', formats)}
          <label className={labelClass}>
            Ordenar por
            <select
              className={`${inputClass} w-full`}
              value={params.sort ?? (query ? 'SEARCH_MATCH' : 'TRENDING_DESC')}
              onChange={(event) => update('sort', event.target.value)}
            >
              {sortOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.07] pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-white/40">
              Conteúdo:
            </span>
            {[
              ['include', 'Todos'],
              ['exclude', 'Sem adulto'],
              ['only', 'Adulto'],
            ].map(([value, label]) => {
              const active =
                (filters.adultMode ??
                  (includeAdult ? 'include' : 'exclude')) === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => update('adultMode', value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'border-[#49d77a]/35 bg-[#49d77a]/[0.11] text-[#91ecad]' : 'border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/75'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <details className="group mt-4 border-t border-white/[0.07] pt-1">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-2 py-3 transition hover:bg-white/[0.025] [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2 text-xs font-semibold text-white/65">
              <SlidersHorizontal size={14} className="text-[#69df8d]" />
              Filtros avançados
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs text-white/55">
                  {activeFilterCount} ativos
                </span>
              )}
            </span>
            <ChevronDown
              size={15}
              className="text-white/35 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="grid gap-3 pt-2 lg:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-black/[0.12] p-4">
              <h2 className="mb-3 text-xs font-bold tracking-wide text-white/70 uppercase">
                Temporada e lançamento
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <label className={labelClass}>
                  Temporada
                  <select
                    className={`${inputClass} w-full`}
                    value={params.season ?? ''}
                    onChange={(event) => update('season', event.target.value)}
                  >
                    <option value="">Qualquer</option>
                    {seasons.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {renderNumber(
                  'Ano',
                  'seasonYear',
                  1940,
                  new Date().getFullYear() + 5,
                )}
                {renderText(
                  'Data inicial (YYYYMMDD)',
                  'startDateLike',
                  '20250101',
                )}
                {renderNumber('Início exato', 'startDate')}
                {renderNumber('Início após', 'startDateGreater')}
                {renderNumber('Início antes', 'startDateLesser')}
                {renderNumber('Fim exato', 'endDate')}
                {renderNumber('Fim após', 'endDateGreater')}
                {renderNumber('Fim antes', 'endDateLesser')}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/[0.12] p-4">
              <h2 className="mb-3 text-xs font-bold tracking-wide text-white/70 uppercase">
                Formato da série
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {renderMulti('Excluir formatos', 'formatNotIn', formats)}
                {renderMulti('Excluir status', 'statusNotIn', statuses)}
                {renderNumber('Episódios: mínimo', 'episodesGreater', 0)}
                {renderNumber('Episódios: máximo', 'episodesLesser', 0)}
                {renderNumber('Duração (min): mínimo', 'durationGreater', 0)}
                {renderNumber('Duração (min): máximo', 'durationLesser', 0)}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/[0.12] p-4">
              <h2 className="mb-3 text-xs font-bold tracking-wide text-white/70 uppercase">
                Nota e popularidade
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {renderNumber(
                  'Nota mínima (0–100)',
                  'averageScoreGreater',
                  0,
                  100,
                )}
                {renderNumber(
                  'Nota máxima (0–100)',
                  'averageScoreLesser',
                  0,
                  100,
                )}
                {renderNumber('Popularidade mínima', 'popularityGreater', 0)}
                {renderNumber('Popularidade máxima', 'popularityLesser', 0)}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/[0.12] p-4">
              <h2 className="mb-3 text-xs font-bold tracking-wide text-white/70 uppercase">
                Gêneros e tags
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {renderMulti('Incluir gêneros', 'genreIn', genreOptions)}
                {renderMulti('Excluir gêneros', 'genreNotIn', genreOptions)}
                {renderMulti('Incluir tags', 'tagIn', tagOptions)}
                {renderMulti('Excluir tags', 'tagNotIn', tagOptions)}
                {renderMulti('Incluir categorias', 'tagCategoryIn', categories)}
                {renderMulti(
                  'Excluir categorias',
                  'tagCategoryNotIn',
                  categories,
                )}
                {renderNumber('Rank mínimo da tag', 'minimumTagRank', 0, 100)}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/[0.12] p-4 lg:col-span-2">
              <h2 className="mb-3 text-xs font-bold tracking-wide text-white/70 uppercase">
                Origem e identificadores
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {renderText('País (código ISO)', 'countryOfOrigin', 'JP')}
                {renderText(
                  'Excluir países (códigos)',
                  'countryOfOriginNotIn',
                  'JP,CN',
                )}
                <label className={labelClass}>
                  Fonte original
                  <select
                    className={`${inputClass} w-full`}
                    value={params.source ?? ''}
                    onChange={(event) => update('source', event.target.value)}
                  >
                    <option value="">Qualquer</option>
                    {sources.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Licenciada
                  <select
                    className={`${inputClass} w-full`}
                    value={params.isLicensed ?? ''}
                    onChange={(event) =>
                      update('isLicensed', event.target.value)
                    }
                  >
                    <option value="">Qualquer</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </label>
                {renderText('Licenciada por', 'licensedBy')}
                {renderText('IDs de licenciadores', 'licensedByIdIn')}
                {renderText('IDs AniList incluídos', 'idsIn')}
                {renderText('IDs AniList excluídos', 'idsNotIn')}
                {renderText('IDs MyAnimeList incluídos', 'idsMalIn')}
                {renderText('IDs MyAnimeList excluídos', 'idsMalNotIn')}
              </div>
            </div>
          </div>
        </details>
      </div>
      {loading ? (
        <LoadingGrid />
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300/10 bg-red-400/[0.04] p-5 text-sm text-red-200/80"
        >
          {error}
        </div>
      ) : result?.results.length ? (
        <>
          <div className="mb-4 text-xs text-white/35">
            {result.results.length} títulos nesta página
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
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
              Página {page}
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
          {error ? null : 'Nenhum anime encontrado com esses critérios.'}
        </div>
      )}
    </section>
  );
}
