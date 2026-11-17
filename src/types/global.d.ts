export {};

import type { AccountBridge } from './account';
import type { AnimeArtworkBridge } from './anime';

declare global {
  interface Window {
    animonkey: {
      platform: string;
      onOpenAnime: (callback: (animeId: string) => void) => () => void;
      account: AccountBridge;
      artwork: AnimeArtworkBridge;
    };
  }
}
