import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AnimePage } from '@/components/features/anime/anime-page';
import { WatchLaterPage } from '@/components/features/account/watch-later-page';
import { ContinueWatchingPage } from '@/components/features/account/continue-watching-page';
import { SettingsPage } from '@/components/features/account/settings-page';
import { CatalogPage } from '@/components/features/catalog/catalog-page';
import { HomePage } from '@/components/features/home/home-page';
import { SchedulePage } from '@/components/features/schedule/schedule-page';
import { SearchPage } from '@/components/features/search/search-page';
import { WatchPage } from '@/components/features/player/watch-page';
import { AppShell } from '@/components/layout/app-shell';
import { AppErrorBoundary } from '@/components/shared/app-error-boundary';
import { WatchLaterProvider } from '@/context/watch-later-context';
import { AccountProvider } from '@/context/account-context';

export function AppRoot() {
  return (
    <AppErrorBoundary>
      <AccountProvider>
        <WatchLaterProvider>
          <HashRouter>
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
                <Route path="trending" element={<CatalogPage />} />
                <Route path="updates" element={<CatalogPage />} />
                <Route path="recent" element={<CatalogPage />} />
                <Route path="popular" element={<CatalogPage />} />
                <Route path="completed" element={<CatalogPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        </WatchLaterProvider>
      </AccountProvider>
    </AppErrorBoundary>
  );
}
