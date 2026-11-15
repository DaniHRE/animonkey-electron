import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { useEffect } from 'react';
import { AnimePage } from '@/components/features/anime/anime-page';
import { WatchLaterPage } from '@/components/features/account/watch-later-page';
import { ContinueWatchingPage } from '@/components/features/account/continue-watching-page';
import { SettingsPage } from '@/components/features/account/settings-page';
import { ActivityPage } from '@/components/features/account/activity-page';
import { CatalogPage } from '@/components/features/catalog/catalog-page';
import { HomePage } from '@/components/features/home/home-page';
import { SchedulePage } from '@/components/features/schedule/schedule-page';
import { SearchPage } from '@/components/features/search/search-page';
import { WatchPage } from '@/components/features/player/watch-page';
import { AppShell } from '@/components/layout/app-shell';
import { AppErrorBoundary } from '@/components/shared/app-error-boundary';
import { WatchLaterProvider } from '@/context/watch-later-context';
import { AccountProvider } from '@/context/account-context';
import { TitleLanguageProvider } from '@/context/title-language-provider';

export function AppRoot() {
  return (
    <AppErrorBoundary>
      <TitleLanguageProvider>
        <AccountProvider>
          <WatchLaterProvider>
            <HashRouter>
              <DeepLinkRouteHandler />
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<HomePage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="anime/:id" element={<AnimePage />} />
                  <Route path="watch/:id" element={<WatchPage />} />
                  <Route path="schedule" element={<SchedulePage />} />
                  <Route path="watch-later" element={<WatchLaterPage />} />
                  <Route
                    path="continue-watching"
                    element={<ContinueWatchingPage />}
                  />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="activity" element={<ActivityPage />} />
                  <Route path="trending" element={<CatalogPage />} />
                  <Route path="updates" element={<CatalogPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </HashRouter>
          </WatchLaterProvider>
        </AccountProvider>
      </TitleLanguageProvider>
    </AppErrorBoundary>
  );
}

function DeepLinkRouteHandler() {
  const navigate = useNavigate();

  useEffect(
    () =>
      window.animonkey.onOpenAnime((animeId) => {
        if (/^\d+$/.test(animeId)) navigate(`/anime/${animeId}`);
      }),
    [navigate],
  );

  return null;
}
