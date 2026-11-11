export {};

import type { AccountBridge } from './account';

declare global {
  interface Window {
    animonkey: {
      platform: string;
      account: AccountBridge;
    };
  }
}
