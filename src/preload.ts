import { contextBridge, ipcRenderer } from 'electron';
import type {
  AccountBridge,
  AccountCredentials,
  AccountRegistration,
  ActivityFeedCursor,
  EpisodeProgressInput,
  WatchLaterRemoteItem,
} from './types/account';
import type { AnimeArtworkBridge, AnimeRating } from './types/anime';

let pendingAnimeId: string | null = null;
const animeRouteListeners = new Set<(animeId: string) => void>();

ipcRenderer.on('app:open-anime', (_event, animeId: unknown) => {
  if (typeof animeId !== 'string' || !/^\d+$/.test(animeId)) return;
  pendingAnimeId = animeId;
  for (const listener of animeRouteListeners) listener(animeId);
  if (animeRouteListeners.size) pendingAnimeId = null;
});

contextBridge.exposeInMainWorld('animonkey', {
  platform: process.platform,
  onOpenAnime: (callback: (animeId: string) => void) => {
    animeRouteListeners.add(callback);
    if (pendingAnimeId) {
      callback(pendingAnimeId);
      pendingAnimeId = null;
    }
    return () => animeRouteListeners.delete(callback);
  },
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
    updateProfile: (name: string) =>
      ipcRenderer.invoke('account:profile:update', { name }),
    exportAccountData: () => ipcRenderer.invoke('account:export'),
    uploadAvatar: (contentType: string, base64: string) =>
      ipcRenderer.invoke('account:avatar:upload', { contentType, base64 }),
    removeAvatar: () => ipcRenderer.invoke('account:avatar:remove'),
    getActivityPrivacy: () => ipcRenderer.invoke('account:privacy:get'),
    setActivityPrivacy: (showActivity: boolean) =>
      ipcRenderer.invoke('account:privacy:set', { showActivity }),
    listActivity: (cursor: ActivityFeedCursor | null, limit: number) =>
      ipcRenderer.invoke('account:activity:list', { cursor, limit }),
    changePassword: (currentPassword: string, newPassword: string) =>
      ipcRenderer.invoke('account:password:change', {
        currentPassword,
        newPassword,
      }),
  } satisfies AccountBridge,
  artwork: {
    getClearLogo: (animeId: string, expectedTitles: string[]) =>
      ipcRenderer.invoke('anime:artwork:clear-logo', {
        animeId,
        expectedTitles,
      }),
  } satisfies AnimeArtworkBridge,
});
