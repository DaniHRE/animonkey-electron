import type { QueryClient } from '@tanstack/react-query';
import {
  createHashHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Navigate,
} from '@tanstack/react-router';
import { ActivityPage } from '@/components/features/account/activity-page';
import { ContinueWatchingPage } from '@/components/features/account/continue-watching-page';
import { SettingsPage } from '@/components/features/account/settings-page';
import { WatchLaterPage } from '@/components/features/account/watch-later-page';
import { AnimePage } from '@/components/features/anime/anime-page';
import { CatalogPage } from '@/components/features/catalog/catalog-page';
import { HomePage } from '@/components/features/home/home-page';
import { WatchPage } from '@/components/features/player/watch-page';
import { SchedulePage } from '@/components/features/schedule/schedule-page';
import { SearchPage } from '@/components/features/search/search-page';
import { RouterRootLayout } from '@/components/layout/router-root';
import { queryClient } from '@/lib/query-client';
import { animeQueries } from '@/services/anime-queries';

interface RouterContext {
  queryClient: QueryClient;
}

export function validateStringSearch(
  search: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(search).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function parsePage(value: unknown): number {
  const page = Number(value ?? 1);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RouterRootLayout,
  notFoundComponent: () => <Navigate to="/" replace />,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(animeQueries.schedule(new Date()));
    return context.queryClient.ensureQueryData(animeQueries.home());
  },
  component: HomePage,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: validateStringSearch,
  loader: ({ context }) =>
    context.queryClient.prefetchQuery(animeQueries.searchOptions()),
  component: SearchPage,
});

const animeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/anime/$id',
  loader: async ({ context, params }) => {
    const anime = await context.queryClient.ensureQueryData(
      animeQueries.detail(context.queryClient, params.id),
    );
    if (anime)
      void context.queryClient.prefetchQuery(animeQueries.episodes(params.id));
    return anime;
  },
  component: AnimePage,
});

const watchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/watch/$id',
  validateSearch: validateStringSearch,
  loader: async ({ context, params }) => {
    const anime = await context.queryClient.ensureQueryData(
      animeQueries.detail(context.queryClient, params.id),
    );
    if (anime)
      void context.queryClient.prefetchQuery(animeQueries.episodes(params.id));
    return anime;
  },
  component: WatchPage,
});

const scheduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schedule',
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(animeQueries.schedule(new Date())),
  component: SchedulePage,
});

const watchLaterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/watch-later',
  component: WatchLaterPage,
});

const continueWatchingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/continue-watching',
  component: ContinueWatchingPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  component: ActivityPage,
});

const trendingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trending',
  validateSearch: validateStringSearch,
  loaderDeps: ({ search }) => ({ page: parsePage(search.page) }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      animeQueries.list(['TRENDING_DESC'], undefined, deps.page),
    ),
  component: CatalogPage,
});

const updatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/updates',
  validateSearch: validateStringSearch,
  loaderDeps: ({ search }) => ({ page: parsePage(search.page) }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      animeQueries.list(
        ['START_DATE_DESC', 'POPULARITY_DESC'],
        'RELEASING',
        deps.page,
      ),
    ),
  component: CatalogPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  searchRoute,
  animeRoute,
  watchRoute,
  scheduleRoute,
  watchLaterRoute,
  continueWatchingRoute,
  settingsRoute,
  activityRoute,
  trendingRoute,
  updatesRoute,
]);

const hashHistory = createHashHistory();

export const router = createRouter({
  routeTree,
  history: hashHistory,
  context: { queryClient },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
