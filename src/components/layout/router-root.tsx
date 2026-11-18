import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';

export function RouterRootLayout() {
  return (
    <>
      <DeepLinkRouteHandler />
      <AppShell />
    </>
  );
}

function DeepLinkRouteHandler() {
  const navigate = useNavigate();

  useEffect(
    () =>
      window.animonkey.onOpenAnime((animeId) => {
        if (!/^\d+$/.test(animeId)) return;
        void navigate({ to: '/anime/$id', params: { id: animeId } });
      }),
    [navigate],
  );

  return null;
}
