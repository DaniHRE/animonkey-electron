import { useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import {
  getPersistableRoute,
  readLastVisitedRoute,
  saveLastVisitedRoute,
} from '@/lib/last-visited-route';
import { router } from '@/router';

let deepLinkWasReceived = false;

export function RouterRootLayout() {
  return (
    <>
      <RoutePersistenceHandler />
      <AppShell />
    </>
  );
}

function RoutePersistenceHandler() {
  useEffect(() => {
    let receivedDeepLink = false;
    const initialLocation = router.state.location;
    const initialRoute = getPersistableRoute(
      initialLocation.pathname,
      initialLocation.search,
    );
    const savedRoute = initialRoute === '/' ? readLastVisitedRoute() : null;

    const unsubscribeDeepLinks = window.animonkey.onOpenAnime((animeId) => {
      if (!/^\d+$/.test(animeId)) return;
      receivedDeepLink = true;
      deepLinkWasReceived = true;
      void router.navigate({ to: '/anime/$id', params: { id: animeId } });
    });
    const unsubscribeRouter = router.subscribe('onResolved', () => {
      saveLastVisitedRoute(
        getPersistableRoute(
          router.state.location.pathname,
          router.state.location.search,
        ),
      );
    });
    const cleanup = () => {
      unsubscribeDeepLinks();
      unsubscribeRouter();
    };

    if (receivedDeepLink || deepLinkWasReceived) return cleanup;
    if (initialRoute === '/') {
      if (savedRoute) router.history.replace(savedRoute);
      else saveLastVisitedRoute(initialRoute);
    } else {
      saveLastVisitedRoute(initialRoute);
    }

    return cleanup;
  }, []);

  return null;
}
