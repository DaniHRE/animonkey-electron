import { ArrowLeft, ArrowRight, Flame, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimeCard } from '@/components/shared/anime-card';
import { LoadingGrid } from '@/components/shared/loading-grid';
import { AniListCatalog } from '@/services/anilist.service';
import type { AnimeResult, AnimeSearchResponse } from '@/types/anime';

const collections = {
  trending: {
    eyebrow: 'Popular agora',
    title: 'Em alta',
    description: 'Os animes que estão em destaque na comunidade.',
    sort: ['TRENDING_DESC'],
  },
  updates: {
    eyebrow: 'Temporada atual',
    title: 'Lançamentos',
    description: 'Séries atualmente em exibição, organizadas por estreia.',
    sort: ['START_DATE_DESC', 'POPULARITY_DESC'],
    status: 'RELEASING' as const,
  },
  recent: {
    eyebrow: 'Novidades no catálogo',
    title: 'Adicionados recentemente',
    description: 'Títulos adicionados mais recentemente ao AniList.',
    sort: ['ID_DESC'],
  },
  popular: {
    eyebrow: 'Mais assistidos',
    title: 'Populares',
    description: 'Animes populares entre os membros do AniList.',
    sort: ['POPULARITY_DESC'],
  },
  completed: {
    eyebrow: 'Para maratonar',
    title: 'Concluídos',
    description: 'Séries finalizadas, organizadas por data de conclusão.',
    sort: ['END_DATE_DESC', 'POPULARITY_DESC'],
    status: 'FINISHED' as const,
  },
} as const;

type CollectionKey = keyof typeof collections;

export function CatalogPage() {
  const { collection = 'trending' } = useParams();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get('page') ?? 1);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [state, setState] = useState<{
    key: string;
    result: AnimeSearchResponse | null;
    error: string | null;
  }>({ key: '', result: null, error: null });
  const config = collections[collection as CollectionKey];
  const requestKey = `${collection}:${page}`;

  useEffect(() => {
    if (!config) return;
    const controller = new AbortController();
    AniListCatalog.list(
      [...config.sort],
      'status' in config ? config.status : undefined,
      page,
      controller.signal,
    )
      .then((result) => setState({ key: requestKey, result, error: null }))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            key: requestKey,
            result: null,
            error:
              cause instanceof Error
                ? cause.message
                : 'Falha ao carregar animes.',
          });
        }
      });
    return () => controller.abort();
  }, [config, page, requestKey]);

  if (!config) return <Navigate to="/trending" replace />;

  const loading = state.key !== requestKey;
  const result = loading ? null : state.result;
  const error = loading ? null : state.error;

  return (
    <section>
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
            {collection === 'trending' ? (
              <Flame size={13} />
            ) : (
              <Sparkles size={13} />
            )}
            {config.eyebrow}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{config.title}</h1>
          <p className="mt-2 text-xs text-white/40">{config.description}</p>
        </div>
        {result && (
          <span className="text-xs text-white/35">
            {result.totalResults.toLocaleString('pt-BR')} títulos
          </span>
        )}
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
          <div className="grid grid-cols-6 gap-x-5 gap-y-8">
            {result.results.map((anime: AnimeResult) => (
              <AnimeCard anime={anime} key={anime.id} />
            ))}
          </div>
          <div className="mt-9 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() =>
                setParams(page > 2 ? { page: String(page - 1) } : {})
              }
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
              onClick={() => setParams({ page: String(page + 1) })}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/65 transition hover:bg-white/[0.05] disabled:opacity-30"
            >
              Próxima <ArrowRight size={14} />
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
          Nenhum título disponível nesta lista.
        </div>
      )}
    </section>
  );
}
