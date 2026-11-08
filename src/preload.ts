import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('animonkey', {
  platform: process.platform,
});
