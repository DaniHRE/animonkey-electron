import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, LoaderCircle, Play, Star } from 'lucide-react';
import { useAccount } from '@/context/account-state';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import type { ActivityFeedItem, ActivityFeedPage } from '@/types/account';

const PAGE_SIZE = 30;

function relativeTime(timestamp: number): string {
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return 'agora';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} h`;
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)} d`;
  return new Date(timestamp).toLocaleDateString('pt-BR');
}

function ActivityCard({ item }: { item: ActivityFeedItem }) {
  const actor =
    item.actor.name?.trim() || `Usuário ${item.actor.id.slice(0, 6)}`;
  const activity = {
    started_watching: { verb: 'começou a assistir', Icon: Play },
    episode_completed: { verb: 'concluiu um episódio de', Icon: CheckCircle2 },
    rated_anime: { verb: 'avaliou', Icon: Star },
  }[item.type];

  return (
    <article className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
      <ProfileAvatar
        image={item.actor.image}
        name={actor}
        className="size-10 shrink-0 rounded-full object-cover text-sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="font-semibold text-white/85">{actor}</span>
          <span className="inline-flex items-center gap-1 text-white/50">
            <activity.Icon size={14} /> {activity.verb}
          </span>
          <time
            className="ml-auto text-xs text-white/35"
            dateTime={new Date(item.createdAt).toISOString()}
          >
            {relativeTime(item.createdAt)}
          </time>
        </div>
        <Link
          to={`/anime/${item.animeId}`}
          className="mt-2 inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm text-[#70e793] hover:underline"
        >
          Anime #{item.animeId}
        </Link>
        {item.type === 'rated_anime' &&
          typeof item.payload.score === 'number' && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#ffc658]">
              <Star size={13} fill="currentColor" /> {item.payload.score}/10
            </p>
          )}
        {item.type !== 'rated_anime' &&
          typeof item.payload.episode_number === 'number' && (
            <p className="mt-1 text-xs text-white/45">
              Episódio {item.payload.episode_number}
            </p>
          )}
      </div>
    </article>
  );
}

export function ActivityPage() {
  const { session } = useAccount();
  const userId = session?.user.id ?? null;
  const [page, setPage] = useState<
    (ActivityFeedPage & { userId: string }) | null
  >(null);
  const [error, setError] = useState<{
    userId: string;
    message: string;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const firstPage = await window.animonkey.account.listActivity(
        null,
        PAGE_SIZE,
      );
      setPage({ ...firstPage, userId });
      setError(null);
    } catch {
      setError({
        userId,
        message:
          'Não foi possível carregar o feed. Verifique a conexão e tente novamente.',
      });
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void window.animonkey.account
      .listActivity(null, PAGE_SIZE)
      .then((firstPage) => {
        if (active) {
          setPage({ ...firstPage, userId });
          setError(null);
        }
      })
      .catch(() => {
        if (active) {
          setError({
            userId,
            message:
              'Não foi possível carregar o feed. Verifique a conexão e tente novamente.',
          });
        }
      });
    const refreshOnFocus = () => void refresh();
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') refreshOnFocus();
    };
    window.addEventListener('focus', refreshOnFocus);
    window.addEventListener('animonkey:account-sync-applied', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshOnFocus);
      window.removeEventListener(
        'animonkey:account-sync-applied',
        refreshOnFocus,
      );
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [refresh, userId]);

  const loadMore = useCallback(async () => {
    if (!page?.nextCursor || page.userId !== userId || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await window.animonkey.account.listActivity(
        page.nextCursor,
        PAGE_SIZE,
      );
      if (page.userId === userId) {
        setPage((current) =>
          current?.userId === userId
            ? { ...next, userId, items: [...current.items, ...next.items] }
            : current,
        );
      }
    } catch {
      setError({
        userId: page.userId,
        message: 'Não foi possível carregar mais atividades.',
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, page, userId]);

  if (!session) {
    return (
      <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
        <h1 className="text-xl font-bold">Feed de atividade</h1>
        <p className="mt-2 text-sm text-white/50">
          Entre na sua conta para ver atividades compartilhadas.
        </p>
        <Link
          to="/settings"
          className="mt-4 inline-flex rounded-lg bg-[#49d77a] px-4 py-2 text-xs font-bold text-[#07110a]"
        >
          Abrir configurações
        </Link>
      </section>
    );
  }

  const currentPage = page?.userId === userId ? page : null;
  const currentError = error?.userId === userId ? error.message : null;
  return (
    <section className="mx-auto max-w-3xl">
      <p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-[#65e48e] uppercase">
        Comunidade
      </p>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Feed de atividade
          </h1>
          <p className="mt-2 text-xs text-white/45">
            Atividades de contas que escolheram compartilhá-las.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/65 hover:bg-white/[0.05] disabled:opacity-50"
        >
          {refreshing && <LoaderCircle size={13} className="animate-spin" />}
          Atualizar feed
        </button>
      </div>
      <div className="space-y-3">
        {!currentPage && !currentError && (
          <div className="flex justify-center py-12">
            <LoaderCircle className="animate-spin text-[#70e793]" />
          </div>
        )}
        {currentError && (
          <p
            role="alert"
            className="rounded-lg border border-red-300/10 p-4 text-sm text-red-200/80"
          >
            {currentError}
          </p>
        )}
        {currentPage?.items.map((item) => (
          <ActivityCard key={item.id} item={item} />
        ))}
        {currentPage?.items.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
            Ainda não há atividades compartilhadas.
          </p>
        )}
      </div>
      {currentPage?.nextCursor && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-semibold text-white/70 disabled:opacity-50"
          >
            {loadingMore && <LoaderCircle size={14} className="animate-spin" />}{' '}
            Carregar mais
          </button>
        </div>
      )}
    </section>
  );
}
