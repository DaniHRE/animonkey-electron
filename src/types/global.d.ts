export {};

import type { AccountBridge } from './account';
import type { AnimeArtworkBridge } from './anime';
import type { AnivexaBridge } from './anivexa';
import type { AppUpdateBridge } from './updates';
import type { ScreenshotSearchBridge } from './screenshot-search';
import type { WindowControlsBridge } from './window-controls';

declare global {
  interface Window {
    animonkey: {
      platform: string;
      onOpenAnime: (callback: (animeId: string) => void) => () => void;
      account: AccountBridge;
      artwork: AnimeArtworkBridge;
      anivexa: AnivexaBridge;
      updates: AppUpdateBridge;
      screenshotSearch: ScreenshotSearchBridge;
      windowControls: WindowControlsBridge;
    };
  }
}
