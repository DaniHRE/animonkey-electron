import { contextBridge, ipcRenderer } from 'electron';
import type {
  AccountBridge,
  AccountCredentials,
  AccountRegistration,
  EpisodeProgressInput,
  WatchLaterRemoteItem,
} from './types/account';

contextBridge.exposeInMainWorld('animonkey', {
  platform: process.platform,
  account: {
    register: (input: AccountRegistration) =>
      ipcRenderer.invoke('account:register', input),
    login: (input: AccountCredentials) =>
      ipcRenderer.invoke('account:login', input),
    logout: () => ipcRenderer.invoke('account:logout'),
    getSession: () => ipcRenderer.invoke('account:get-session'),
    listWatchLater: () => ipcRenderer.invoke('account:watch-later:list'),
    upsertWatchLater: (item: WatchLaterRemoteItem) =>
      ipcRenderer.invoke('account:watch-later:upsert', item),
    removeWatchLater: (animeId: string) =>
      ipcRenderer.invoke('account:watch-later:remove', animeId),
    listEpisodeProgress: () =>
      ipcRenderer.invoke('account:episode-progress:list'),
    upsertEpisodeProgress: (input: EpisodeProgressInput) =>
      ipcRenderer.invoke('account:episode-progress:upsert', input),
    removeEpisodeProgressForAnime: (animeId: string) =>
      ipcRenderer.invoke('account:episode-progress:remove-anime', animeId),
  } satisfies AccountBridge,
});
