import { useContext } from 'react';
import type { WatchLaterContextValue } from '@/context/watch-later-state';
import { WatchLaterContext } from '@/context/watch-later-state';

export function useWatchLater(): WatchLaterContextValue {
  const context = useContext(WatchLaterContext);
  if (!context) {
    throw new Error('useWatchLater must be used inside WatchLaterProvider.');
  }
  return context;
}
