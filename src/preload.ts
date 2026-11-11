import { contextBridge, ipcRenderer } from 'electron';
import type {
  AccountBridge,
  AccountCredentials,
  AccountRegistration,
  EpisodeProgressInput,
  WatchLaterRemoteItem,
} from './types/account';
import type { AnimeRating } from './types/anime';

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
    removeWatchLater: (animeId: string, deletedAt: number) =>
      ipcRenderer.invoke('account:watch-later:remove', { animeId, deletedAt }),
    listEpisodeProgress: () =>
      ipcRenderer.invoke('account:episode-progress:list'),
    upsertEpisodeProgress: (input: EpisodeProgressInput) =>
      ipcRenderer.invoke('account:episode-progress:upsert', input),
    removeEpisodeProgressForAnime: (animeId: string, deletedAt: number) =>
      ipcRenderer.invoke('account:episode-progress:remove-anime', {
        animeId,
        deletedAt,
      }),
    listAnimeRatings: () => ipcRenderer.invoke('account:anime-ratings:list'),
    upsertAnimeRating: (rating: AnimeRating) =>
      ipcRenderer.invoke('account:anime-ratings:upsert', rating),
    removeAnimeRating: (animeId: string, deletedAt: number) =>
      ipcRenderer.invoke('account:anime-ratings:remove', {
        animeId,
        deletedAt,
      }),
  } satisfies AccountBridge,
});
