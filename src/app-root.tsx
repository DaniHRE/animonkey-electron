import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { AppErrorBoundary } from '@/components/shared/app-error-boundary';
import { AppActionToastViewport } from '@/components/shared/app-action-toast-viewport';
import { WatchLaterProvider } from '@/context/watch-later-context';
import { AccountProvider } from '@/context/account-context';
import { TitleLanguageProvider } from '@/context/title-language-provider';
import { queryClient } from '@/lib/query-client';
import { router } from '@/router';
import { MotionConfig } from 'motion/react';

export function AppRoot() {
  return (
    <MotionConfig reducedMotion="user">
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TitleLanguageProvider>
            <AccountProvider>
              <WatchLaterProvider>
                <RouterProvider router={router} />
                <AppActionToastViewport />
              </WatchLaterProvider>
            </AccountProvider>
          </TitleLanguageProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </MotionConfig>
  );
}
