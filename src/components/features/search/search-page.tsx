import { ArrowLeft, ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimeCard } from '@/components/shared/anime-card';
import { LoadingGrid } from '@/components/shared/loading-grid';
import { AniListCatalog } from '@/services/anilist.service';
import type {
  AnimeFormat,
  AnimeMediaSort,
  AnimeResult,
  AnimeSearchFilters,
  AnimeSearchOptions,
  AnimeSearchResponse,
  AnimeSource,
} from '@/types/anime';

const formats: Array<[AnimeFormat, string]> = [
  ['TV', 'Série de TV'],
  ['TV_SHORT', 'TV curta'],
  ['MOVIE', 'Filme'],
  ['SPECIAL', 'Especial'],
  ['OVA', 'OVA'],
  ['ONA', 'ONA'],
  ['MUSIC', 'Música'],
];
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
  'h-9 min-w-32 rounded-lg border border-white/10 bg-[#151517] px-3 text-xs text-white/80 outline-none focus:border-[#49d77a]/60';
const labelClass = 'grid gap-1 text-[10px] font-semibold text-white/45';

function listParam(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
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
    const value = listParam(params.get(key));
    if (value.length)
      Object.assign(filters, {
        [key]:
          key.endsWith('IdIn') || key.startsWith('ids')
            ? value.map(Number).filter(Number.isSafeInteger)
            : value,
      });
  }
  const stringMap: Array<[keyof AnimeSearchFilters, string]> = [
    ['season', 'season'],
    ['startDateLike', 'startDateLike'],
    ['countryOfOrigin', 'countryOfOrigin'],
    ['source', 'source'],
    ['adultMode', 'adultMode'],
    ['sort', 'sort'],
  ];
  for (const [key, param] of stringMap) {
    const value = params.get(param);
    if (value) Object.assign(filters, { [key]: value });
  }
  const licensed = params.get('isLicensed');
  if (licensed === 'true' || licensed === 'false')
    filters.isLicensed = licensed === 'true';
  return filters;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const searchString = params.toString();
  const query = params.get('q') ?? '';
  const requestedPage = Number(params.get('page') ?? 1);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const filters = useMemo(
    () => filtersFromParams(new URLSearchParams(searchString)),
    [searchString],
  );
  const requestKey = JSON.stringify([query, page, filters]);
  const [state, setState] = useState<{
    key: string;
    result: AnimeSearchResponse | null;
    error: string | null;
  }>({ key: '', result: null, error: null });
  const [options, setOptions] = useState<AnimeSearchOptions>({
    genres: [],
    tags: [],
  });

  useEffect(() => {
    const controller = new AbortController();
    void AniListCatalog.searchOptions(controller.signal)
      .then(setOptions)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => {
        AniListCatalog.search(query, page, controller.signal, filters)
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
  }, [query, page, filters, requestKey]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  };
  const updateMulti = (key: string, values: string[]) =>
    update(key, values.join(','));
  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    setParams(next);
  };
  const clearFilters = () =>
    setParams(
      query ? new URLSearchParams({ q: query }) : new URLSearchParams(),
    );
  const loading = state.key !== requestKey;
  const result = loading ? null : state.result;
  const selected = (key: string) => listParam(params.get(key));
  const renderMulti = (
    title: string,
    key: string,
    values: Array<[string, string]>,
  ) => (
    <label className={labelClass}>
      {title}
      <select
        multiple
        value={selected(key)}
        onChange={(event) =>
          updateMulti(
            key,
            Array.from(
              event.currentTarget.selectedOptions,
              (option) => option.value,
            ),
          )
        }
        className={`${inputClass} h-24 min-w-40 py-1`}
      >
        {values.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <span className="font-normal text-white/25">
        Ctrl/⌘ + clique para selecionar vários
      </span>
    </label>
  );
  const renderText = (title: string, key: string, placeholder = '') => (
    <label className={labelClass}>
      {title}
      <input
        className={inputClass}
        value={params.get(key) ?? ''}
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
        value={params.get(key) ?? ''}
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

  return (
    <section>
      <div className="mb-6">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
          <Search size={13} /> Catálogo AniList
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {query ? `Resultados para “${query}”` : 'Buscar animes'}
        </h1>
        <p className="mt-2 text-xs text-white/40">
          Combine filtros avançados do catálogo de anime AniList. Os critérios
          ficam salvos na URL.
        </p>
      </div>
      <div className="mb-7 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-white/55">
            <SlidersHorizontal size={14} /> Filtros principais
          </div>
          <label className={labelClass}>
            Título
            <input
              className={`${inputClass} min-w-52`}
              value={query}
              placeholder="Nome do anime"
              onChange={(event) => update('q', event.target.value)}
            />
          </label>
          {renderMulti('Status incluídos', 'statusIn', statuses)}
          {renderMulti('Status excluídos', 'statusNotIn', statuses)}
          {renderMulti('Formatos incluídos', 'formatIn', formats)}
          {renderMulti('Formatos excluídos', 'formatNotIn', formats)}
          <label className={labelClass}>
            Ordenar por
            <select
              className={inputClass}
              value={
                params.get('sort') ?? (query ? 'SEARCH_MATCH' : 'TRENDING_DESC')
              }
              onChange={(event) => update('sort', event.target.value)}
            >
              {sortOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Conteúdo adulto
            <select
              className={inputClass}
              value={params.get('adultMode') ?? 'include'}
              onChange={(event) => update('adultMode', event.target.value)}
            >
              <option value="include">Incluir</option>
              <option value="exclude">Excluir</option>
              <option value="only">Somente adulto</option>
            </select>
          </label>
          <button
            type="button"
            onClick={clearFilters}
            className="h-9 px-2 text-xs font-semibold text-[#70e793] hover:text-white"
          >
            Limpar filtros
          </button>
        </div>
        <details className="border-t border-white/[0.07] pt-3">
          <summary className="cursor-pointer select-none text-xs font-semibold text-white/65">
            Mais filtros AniList
          </summary>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <label className={labelClass}>
              Temporada
              <select
                className={inputClass}
                value={params.get('season') ?? ''}
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
              'Ano da temporada',
              'seasonYear',
              1940,
              new Date().getFullYear() + 5,
            )}
            {renderText('Data inicial (YYYYMMDD)', 'startDateLike', '20250101')}
            {renderNumber('Data de início exata (YYYYMMDD)', 'startDate')}
            {renderNumber('Início após (YYYYMMDD)', 'startDateGreater')}
            {renderNumber('Início antes (YYYYMMDD)', 'startDateLesser')}
            {renderNumber('Fim após (YYYYMMDD)', 'endDateGreater')}
            {renderNumber('Fim antes (YYYYMMDD)', 'endDateLesser')}
            {renderNumber('Data de fim exata (YYYYMMDD)', 'endDate')}
            {renderNumber('Episódios: mínimo', 'episodesGreater', 0)}
            {renderNumber('Episódios: máximo', 'episodesLesser', 0)}
            {renderNumber('Duração (min): mínimo', 'durationGreater', 0)}
            {renderNumber('Duração (min): máximo', 'durationLesser', 0)}
            {renderNumber(
              'Nota AniList: mínimo (0–100)',
              'averageScoreGreater',
              0,
              100,
            )}
            {renderNumber(
              'Nota AniList: máximo (0–100)',
              'averageScoreLesser',
              0,
              100,
            )}
            {renderNumber('Popularidade: mínimo', 'popularityGreater', 0)}
            {renderNumber('Popularidade: máximo', 'popularityLesser', 0)}
            {renderText(
              'País de origem (ISO 3166-1 alpha-2)',
              'countryOfOrigin',
              'JP',
            )}
            {renderText(
              'Excluir países (ISO, vírgula)',
              'countryOfOriginNotIn',
              'JP,CN',
            )}
            <label className={labelClass}>
              Obra licenciada
              <select
                className={inputClass}
                value={params.get('isLicensed') ?? ''}
                onChange={(event) => update('isLicensed', event.target.value)}
              >
                <option value="">Qualquer</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </label>
            <label className={labelClass}>
              Obra original de
              <select
                className={inputClass}
                value={params.get('source') ?? ''}
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
            {renderText('Licenciado por (nome)', 'licensedBy')}
            {renderText('Licenciado por (IDs, vírgula)', 'licensedByIdIn')}
            {renderMulti('Gêneros incluídos', 'genreIn', genreOptions)}
            {renderMulti('Gêneros excluídos', 'genreNotIn', genreOptions)}
            {renderMulti('Tags incluídas', 'tagIn', tagOptions)}
            {renderMulti('Tags excluídas', 'tagNotIn', tagOptions)}
            {renderMulti(
              'Categorias de tags incluídas',
              'tagCategoryIn',
              categories,
            )}
            {renderMulti(
              'Categorias de tags excluídas',
              'tagCategoryNotIn',
              categories,
            )}
            {renderNumber(
              'Rank mínimo das tags (0–100)',
              'minimumTagRank',
              0,
              100,
            )}
            {renderText('IDs AniList incluídos (vírgula)', 'idsIn')}
            {renderText('IDs AniList excluídos (vírgula)', 'idsNotIn')}
            {renderText('IDs MyAnimeList incluídos', 'idsMalIn')}
            {renderText('IDs MyAnimeList excluídos', 'idsMalNotIn')}
          </div>
        </details>
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
          {state.error ? null : 'Nenhum anime encontrado com esses critérios.'}
        </div>
      )}
    </section>
  );
}
