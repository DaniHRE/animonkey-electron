export {};

import type { AccountBridge } from './account';
import type { AnimeArtworkBridge } from './anime';
import type { AnivexaBridge } from './anivexa';
import type { AppUpdateBridge } from './updates';

declare global {
  interface Window {
    animonkey: {
      platform: string;
      onOpenAnime: (callback: (animeId: string) => void) => () => void;
      account: AccountBridge;
      artwork: AnimeArtworkBridge;
      anivexa: AnivexaBridge;
      updates: AppUpdateBridge;
    };
  }
}
