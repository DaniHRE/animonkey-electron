import { createContext } from 'react';
import type { AnimeResult, WatchLaterItem } from '@/types/anime';

export interface WatchLaterContextValue {
  items: WatchLaterItem[];
  isLoading: boolean;
  isInList: (animeId: string) => boolean;
  toggle: (anime: AnimeResult) => Promise<boolean>;
  remove: (animeId: string) => Promise<void>;
}

export const WatchLaterContext = createContext<WatchLaterContextValue | null>(
  null,
);
