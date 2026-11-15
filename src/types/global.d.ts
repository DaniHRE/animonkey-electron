export {};

import type { AccountBridge } from './account';

declare global {
  interface Window {
    animonkey: {
      platform: string;
      onOpenAnime: (callback: (animeId: string) => void) => () => void;
      account: AccountBridge;
    };
  }
}
