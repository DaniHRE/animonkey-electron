import { ArrowLeft, ArrowRight, Flame, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AnimeCard } from '@/components/shared/anime-card';
import { LoadingGrid } from '@/components/shared/loading-grid';
import { useAdultContentPreference } from '@/hooks/use-adult-content-preference';
import { animeQueries } from '@/services/anime-queries';
import type { AnimeResult } from '@/types/anime';

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
} as const;

type CollectionKey = keyof typeof collections;

export function CatalogPage() {
  const { includeAdult } = useAdultContentPreference();
  const { pathname, search } = useRouterState({
    select: (state) => state.location,
  });
  const collection: CollectionKey =
    pathname === '/updates' ? 'updates' : 'trending';
  const params = search as Record<string, string>;
  const navigate = useNavigate();
  const requestedPage = Number(params.page ?? 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const config = collections[collection as CollectionKey];
  const query = useQuery(
    animeQueries.list(
      [...config.sort],
      'status' in config ? config.status : undefined,
      page,
      includeAdult,
    ),
  );
  const loading = query.isPending;
  const result = query.data;
  const error = query.error?.message ?? null;

  useEffect(() => {
    if (!result || page <= 1 || result.results.length > 0) return;
    void navigate({
      to: collection === 'trending' ? '/trending' : '/updates',
      search: (previous) => {
        const next = { ...previous };
        delete next.page;
        return next as Record<string, string>;
      },
    });
  }, [collection, navigate, page, result]);

  return (
    <section>
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-[#65e48e] uppercase">
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
            {result.results.length} títulos nesta página
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
                void navigate({
                  to: collection === 'trending' ? '/trending' : '/updates',
                  search: (previous) => {
                    const next = { ...previous };
                    if (page > 2) next.page = String(page - 1);
                    else delete next.page;
                    return next as Record<string, string>;
                  },
                })
              }
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
              onClick={() =>
                void navigate({
                  to: collection === 'trending' ? '/trending' : '/updates',
                  search: (previous) => ({
                    ...previous,
                    page: String(page + 1),
                  }),
                })
              }
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
