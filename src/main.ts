import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
} from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { installMediaProxy, registerMediaScheme } from './electron/media-proxy';
import { accountService } from './electron/account-service';
import type {
  AccountCredentials,
  AccountRegistration,
  EpisodeProgressInput,
  WatchLaterRemoteItem,
} from './types/account';
import type { AnimeRating } from './types/anime';

registerMediaScheme();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const EXTERNAL_LINK_HOSTS = new Set([
  'anilist.co',
  'youtube.com',
  'youtu.be',
  'dailymotion.com',
  'status.animonkey.app',
]);

let mainWindow: BrowserWindow | null = null;

function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  if (
    !mainWindow ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== event.sender.mainFrame
  ) {
    throw new Error('A solicitação do aplicativo não pôde ser autorizada.');
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Dados da conta inválidos.');
  }
  return value as Record<string, unknown>;
}

function parseCredentials(value: unknown): AccountCredentials {
  const input = asObject(value);
  if (typeof input.email !== 'string' || typeof input.password !== 'string') {
    throw new Error('Informe e-mail e senha.');
  }
  return { email: input.email, password: input.password };
}

function parseRegistration(value: unknown): AccountRegistration {
  const input = asObject(value);
  const credentials = parseCredentials(input);
  if (input.name !== undefined && typeof input.name !== 'string') {
    throw new Error('Nome inválido.');
  }
  return { ...credentials, name: input.name as string | undefined };
}

function registerAccountIpc(): void {
  ipcMain.handle('account:register', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    return accountService.register(parseRegistration(value));
  });
  ipcMain.handle('account:login', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    return accountService.login(parseCredentials(value));
  });
  ipcMain.handle('account:logout', (event) => {
    assertTrustedIpcSender(event);
    return accountService.logout();
  });
  ipcMain.handle('account:get-session', (event) => {
    assertTrustedIpcSender(event);
    return accountService.getSession();
  });
  ipcMain.handle('account:watch-later:list', (event) => {
    assertTrustedIpcSender(event);
    return accountService.listWatchLater();
  });
  ipcMain.handle('account:watch-later:upsert', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    return accountService.upsertWatchLater(
      asObject(value) as unknown as WatchLaterRemoteItem,
    );
  });
  ipcMain.handle('account:watch-later:remove', (event, animeId: unknown) => {
    assertTrustedIpcSender(event);
    const input = asObject(animeId);
    if (
      typeof input.animeId !== 'string' ||
      typeof input.deletedAt !== 'number'
    ) {
      throw new Error('Anime inválido.');
    }
    return accountService.removeWatchLater(input.animeId, input.deletedAt);
  });
  ipcMain.handle('account:episode-progress:list', (event) => {
    assertTrustedIpcSender(event);
    return accountService.listEpisodeProgress();
  });
  ipcMain.handle('account:episode-progress:upsert', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    return accountService.upsertEpisodeProgress(
      asObject(value) as EpisodeProgressInput,
    );
  });
  ipcMain.handle(
    'account:episode-progress:remove-anime',
    (event, value: unknown) => {
      assertTrustedIpcSender(event);
      const input = asObject(value);
      if (
        typeof input.animeId !== 'string' ||
        typeof input.deletedAt !== 'number'
      ) {
        throw new Error('Anime inválido.');
      }
      return accountService.removeEpisodeProgressForAnime(
        input.animeId,
        input.deletedAt,
      );
    },
  );
  ipcMain.handle('account:anime-ratings:list', (event) => {
    assertTrustedIpcSender(event);
    return accountService.listAnimeRatings();
  });
  ipcMain.handle('account:anime-ratings:upsert', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    const input = asObject(value);
    if (
      typeof input.animeId !== 'string' ||
      !/^\d+$/.test(input.animeId) ||
      typeof input.score !== 'number' ||
      !Number.isInteger(input.score) ||
      input.score < 1 ||
      input.score > 10 ||
      (input.review !== null && typeof input.review !== 'string') ||
      (typeof input.review === 'string' && input.review.length > 2000) ||
      typeof input.updatedAt !== 'number' ||
      !Number.isFinite(input.updatedAt)
    )
      throw new Error('Avaliação inválida.');
    return accountService.upsertAnimeRating(input as unknown as AnimeRating);
  });
  ipcMain.handle('account:anime-ratings:remove', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    const input = asObject(value);
    if (
      typeof input.animeId !== 'string' ||
      !/^\d+$/.test(input.animeId) ||
      typeof input.deletedAt !== 'number'
    )
      throw new Error('Anime inválido.');
    return accountService.removeAnimeRating(input.animeId, input.deletedAt);
  });
  ipcMain.handle('account:profile:update', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    const input = asObject(value);
    if (typeof input.name !== 'string' || input.name.length > 60)
      throw new Error('Nome inválido.');
    return accountService.updateProfile(input.name);
  });
  ipcMain.handle('account:export', (event) => {
    assertTrustedIpcSender(event);
    return accountService.exportAccountData();
  });
}

function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      [...EXTERNAL_LINK_HOSTS].some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#0b0b0c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const trustedUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL;
    if (trustedUrl && new URL(url).origin === new URL(trustedUrl).origin)
      return;
    event.preventDefault();
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

registerAccountIpc();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  installMediaProxy();
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
