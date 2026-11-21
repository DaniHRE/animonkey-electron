import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  AccountBridge,
  AccountCredentials,
  AccountRegistration,
  ActivityFeedCursor,
  EpisodeProgressInput,
  WatchLaterRemoteItem,
} from './types/account';
import type { AnimeArtworkBridge, AnimeRating } from './types/anime';
import {
  isAnivexaDiagnosticsSnapshot,
  type AnivexaBridge,
} from './types/anivexa';
import { isAppUpdateSnapshot, type AppUpdateBridge } from './types/updates';

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
    getMetadata: (identities) =>
      ipcRenderer.invoke('anime:artwork:metadata', identities),
  } satisfies AnimeArtworkBridge,
  anivexa: {
    request: (request, requestId) =>
      ipcRenderer.invoke('anivexa:request', { request, requestId }),
    cancel: (requestId) => ipcRenderer.send('anivexa:cancel', requestId),
    getDiagnostics: () => ipcRenderer.invoke('anivexa:diagnostics:get'),
    clearDiagnostics: () => ipcRenderer.invoke('anivexa:diagnostics:clear'),
    onDiagnosticsChanged: (callback) => {
      const listener = (_event: IpcRendererEvent, value: unknown) => {
        if (isAnivexaDiagnosticsSnapshot(value)) callback(value);
      };
      ipcRenderer.on('anivexa:diagnostics:updated', listener);
      return () =>
        ipcRenderer.removeListener('anivexa:diagnostics:updated', listener);
    },
  } satisfies AnivexaBridge,
  updates: {
    getState: () => ipcRenderer.invoke('updates:get-state'),
    checkNow: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install'),
    onStateChanged: (callback) => {
      const listener = (_event: IpcRendererEvent, value: unknown) => {
        if (isAppUpdateSnapshot(value)) callback(value);
      };
      ipcRenderer.on('updates:state', listener);
      return () => ipcRenderer.removeListener('updates:state', listener);
    },
  } satisfies AppUpdateBridge,
});
