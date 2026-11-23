import {
  app,
  autoUpdater,
  BrowserWindow,
  ipcMain,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { installMediaProxy, registerMediaScheme } from './electron/media-proxy';
import { accountService } from './electron/account-service';
import { anivexaRuntime, registerAnivexaIpc } from './electron/anivexa-runtime';
import { getTaizenMetadata } from './electron/taizen-artwork';
import type {
  AccountCredentials,
  ActivityFeedCursor,
  AccountRegistration,
  EpisodeProgressInput,
  WatchLaterRemoteItem,
} from './types/account';
import type { AnimeRating, AnimeTitle } from './types/anime';
import type { WindowControlsState } from './types/window-controls';
import type { AppUpdateSnapshot, AppUpdateStatus } from './types/updates';

registerMediaScheme();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

if (process.platform === 'win32') {
  // MakerSquirrel normalizes the package name's hyphen to an underscore.
  app.setAppUserModelId('com.squirrel.animonkey_electron.Animonkey');
}

const appIconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'animonkey-app-icon.png')
  : path.join(
      app.getAppPath(),
      'src',
      'assets',
      'brand',
      'animonkey-app-icon.png',
    );

const EXTERNAL_LINK_HOSTS = new Set([
  'anilist.co',
  'youtube.com',
  'youtu.be',
  'dailymotion.com',
  'status.animonkey.app',
]);
const APP_PROTOCOL = 'app';
const ANIME_DEEP_LINK = /^app:run:\/\/anime\/(\d+)\/?$/i;

let mainWindow: BrowserWindow | null = null;
let pendingAnimeId: string | null = null;
let rendererReady = false;

const AUTO_UPDATE_START_DELAY_MS = 10_000;
const AUTO_UPDATE_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_FEED_BASE_URL =
  'https://update.electronjs.org/DaniHRE/animonkey-electron';
const supportsAutoUpdates =
  app.isPackaged && process.platform === 'win32' && process.arch === 'x64';
let updateSnapshot: AppUpdateSnapshot = {
  revision: 0,
  status: supportsAutoUpdates ? 'idle' : 'unsupported',
  currentVersion: app.getVersion(),
};

function publishUpdateStatus(status: AppUpdateStatus): void {
  updateSnapshot = {
    revision: updateSnapshot.revision + 1,
    status,
    currentVersion: app.getVersion(),
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:state', updateSnapshot);
  }
}

function checkForUpdates(): void {
  if (
    !supportsAutoUpdates ||
    ['checking', 'downloading', 'ready'].includes(updateSnapshot.status)
  ) {
    return;
  }

  publishUpdateStatus('checking');
  try {
    autoUpdater.checkForUpdates();
  } catch {
    publishUpdateStatus('error');
  }
}

function configureAutoUpdates(): void {
  if (!supportsAutoUpdates) return;

  autoUpdater.setFeedURL({
    url: `${UPDATE_FEED_BASE_URL}/win32-x64/${app.getVersion()}`,
  });

  autoUpdater.on('checking-for-update', () => publishUpdateStatus('checking'));
  autoUpdater.on('update-available', () => publishUpdateStatus('downloading'));
  autoUpdater.on('update-not-available', () => publishUpdateStatus('current'));
  autoUpdater.on('update-downloaded', () => publishUpdateStatus('ready'));
  autoUpdater.on('error', () => publishUpdateStatus('error'));

  // Squirrel holds a file lock briefly after first run, so defer the first check.
  setTimeout(checkForUpdates, AUTO_UPDATE_START_DELAY_MS);
  setInterval(checkForUpdates, AUTO_UPDATE_INTERVAL_MS);
}

function animeIdFromDeepLink(value: string): string | null {
  const match = ANIME_DEEP_LINK.exec(value);
  return match?.[1] ?? null;
}

const initialAnimeDeepLink = process.argv.find((argument) =>
  argument.toLowerCase().startsWith('app:'),
);
if (initialAnimeDeepLink)
  pendingAnimeId = animeIdFromDeepLink(initialAnimeDeepLink);

function openAnimeDeepLink(value: string): void {
  const animeId = animeIdFromDeepLink(value);
  if (!animeId) return;
  pendingAnimeId = animeId;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (rendererReady) {
      mainWindow.webContents.send('app:open-anime', animeId);
      pendingAnimeId = null;
    }
  }
}

if (process.defaultApp && process.argv[1]) {
  app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [
    path.resolve(process.argv[1]),
  ]);
} else {
  app.setAsDefaultProtocolClient(APP_PROTOCOL);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const deepLink = commandLine.find((argument) =>
      argument.toLowerCase().startsWith('app:'),
    );
    if (deepLink) openAnimeDeepLink(deepLink);
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    openAnimeDeepLink(url);
  });
}

function isTrustedIpcSender(event: IpcMainInvokeEvent | IpcMainEvent): boolean {
  return Boolean(
    mainWindow &&
    event.sender === mainWindow.webContents &&
    event.senderFrame === event.sender.mainFrame,
  );
}

function assertTrustedIpcSender(
  event: IpcMainInvokeEvent | IpcMainEvent,
): void {
  if (!isTrustedIpcSender(event)) {
    throw new Error('A solicitação do aplicativo não pôde ser autorizada.');
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Dados da conta inválidos.');
  }
  return value as Record<string, unknown>;
}

function isAnimeTitle(value: unknown): value is AnimeTitle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const title = value as Record<string, unknown>;
  return ['english', 'romaji', 'native'].every(
    (key) =>
      title[key] === undefined ||
      title[key] === null ||
      typeof title[key] === 'string',
  );
}

function isWatchLaterRemoteItem(value: unknown): value is WatchLaterRemoteItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.animeId === 'string' &&
    /^\d+$/.test(item.animeId) &&
    isAnimeTitle(item.title) &&
    ['image', 'type'].every(
      (key) => item[key] === undefined || typeof item[key] === 'string',
    ) &&
    (item.totalEpisodes === undefined ||
      (typeof item.totalEpisodes === 'number' &&
        Number.isSafeInteger(item.totalEpisodes) &&
        item.totalEpisodes >= 0)) &&
    (item.releaseDate === undefined ||
      (typeof item.releaseDate === 'number' &&
        Number.isFinite(item.releaseDate))) &&
    Array.isArray(item.genres) &&
    item.genres.every((genre) => typeof genre === 'string') &&
    typeof item.addedAt === 'number' &&
    Number.isFinite(item.addedAt)
  );
}

function isEpisodeProgressInput(value: unknown): value is EpisodeProgressInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.animeId === 'string' &&
    /^\d+$/.test(input.animeId) &&
    typeof input.episodeId === 'string' &&
    input.episodeId.length > 0 &&
    typeof input.episodeNumber === 'number' &&
    Number.isSafeInteger(input.episodeNumber) &&
    input.episodeNumber >= 0 &&
    typeof input.currentTime === 'number' &&
    Number.isFinite(input.currentTime) &&
    input.currentTime >= 0 &&
    typeof input.duration === 'number' &&
    Number.isFinite(input.duration) &&
    input.duration > 0 &&
    input.currentTime <= input.duration
  );
}

function registerUpdateIpc(): void {
  ipcMain.handle('updates:get-state', (event) => {
    assertTrustedIpcSender(event);
    return updateSnapshot;
  });
  ipcMain.handle('updates:check', (event) => {
    assertTrustedIpcSender(event);
    checkForUpdates();
  });
  ipcMain.handle('updates:install', (event) => {
    assertTrustedIpcSender(event);
    if (updateSnapshot.status === 'ready') autoUpdater.quitAndInstall();
  });
}

function getWindowControlsState(): WindowControlsState {
  return {
    isMaximized: Boolean(
      mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized(),
    ),
  };
}

function publishWindowControlsState(): void {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindow.webContents.isDestroyed()
  ) {
    return;
  }
  mainWindow.webContents.send(
    'window-controls:state',
    getWindowControlsState(),
  );
}

function registerWindowControlsIpc(): void {
  ipcMain.on('window-controls:minimize', (event) => {
    if (!isTrustedIpcSender(event)) return;
    mainWindow?.minimize();
  });
  ipcMain.on('window-controls:toggle-maximize', (event) => {
    if (!isTrustedIpcSender(event)) return;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window-controls:close', (event) => {
    if (!isTrustedIpcSender(event)) return;
    mainWindow?.close();
  });
  ipcMain.handle('window-controls:get-state', (event) => {
    assertTrustedIpcSender(event);
    return getWindowControlsState();
  });
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
    if (!isWatchLaterRemoteItem(value)) throw new Error('Anime inválido.');
    return accountService.upsertWatchLater(value);
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
    if (!isEpisodeProgressInput(value)) {
      throw new Error('Dados de progresso inválidos.');
    }
    return accountService.upsertEpisodeProgress(value);
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
  ipcMain.handle('account:avatar:upload', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    const input = asObject(value);
    if (
      typeof input.contentType !== 'string' ||
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
        input.contentType,
      ) ||
      typeof input.base64 !== 'string' ||
      input.base64.length > 2_800_000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64)
    )
      throw new Error('Arquivo de avatar inválido.');
    return accountService.uploadAvatar(input.contentType, input.base64);
  });
  ipcMain.handle('account:avatar:remove', (event) => {
    assertTrustedIpcSender(event);
    return accountService.removeAvatar();
  });
  ipcMain.handle('account:privacy:get', (event) => {
    assertTrustedIpcSender(event);
    return accountService.getActivityPrivacy();
  });
  ipcMain.handle('account:privacy:set', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    const input = asObject(value);
    if (typeof input.showActivity !== 'boolean')
      throw new Error('Preferência inválida.');
    return accountService.setActivityPrivacy(input.showActivity);
  });
  ipcMain.handle('account:activity:list', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    const input = asObject(value);
    let cursor: ActivityFeedCursor | null = null;
    if (input.cursor !== null && input.cursor !== undefined) {
      const value = asObject(input.cursor);
      if (
        typeof value.createdAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
          value.createdAt,
        ) ||
        !Number.isFinite(Date.parse(value.createdAt)) ||
        value.createdAt.length > 40 ||
        typeof value.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value.id,
        )
      )
        throw new Error('Cursor do feed inválido.');
      cursor = { createdAt: value.createdAt, id: value.id };
    }
    if (
      typeof input.limit !== 'number' ||
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 30
    )
      throw new Error('Parâmetros do feed inválidos.');
    return accountService.listActivity(cursor, input.limit);
  });
  ipcMain.handle('account:password:change', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    const input = asObject(value);
    const currentPassword = input.currentPassword;
    const newPassword = input.newPassword;
    if (
      typeof currentPassword !== 'string' ||
      new TextEncoder().encode(currentPassword).byteLength > 72 ||
      typeof newPassword !== 'string' ||
      newPassword.length < 8 ||
      new TextEncoder().encode(newPassword).byteLength > 72
    )
      throw new Error('A nova senha precisa ter entre 8 e 72 bytes.');
    return accountService.changePassword(currentPassword, newPassword);
  });
}

function registerAnimeArtworkIpc(): void {
  ipcMain.handle('anime:artwork:metadata', (event, value: unknown) => {
    assertTrustedIpcSender(event);
    if (!Array.isArray(value) || value.length > 6) return [];
    return getTaizenMetadata(value);
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
    resizable: true,
    backgroundColor: '#0b0b0c',
    icon: appIconPath,
    frame: process.platform !== 'win32',
    autoHideMenuBar: process.platform === 'win32',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.platform === 'win32') {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.removeMenu();
  }

  const devToolsWindow = mainWindow;
  if (devToolsWindow && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    devToolsWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const key = input.key.toLowerCase();
      const isDevToolsShortcut =
        key === 'f12' ||
        (key === 'i' &&
          ((input.control && input.shift) || (input.meta && input.alt)));
      if (!isDevToolsShortcut) return;

      event.preventDefault();
      if (devToolsWindow.webContents.isDevToolsOpened()) {
        devToolsWindow.webContents.closeDevTools();
      } else {
        devToolsWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });
  }

  mainWindow.on('maximize', publishWindowControlsState);
  mainWindow.on('unmaximize', publishWindowControlsState);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  rendererReady = false;
  mainWindow.webContents.once('did-finish-load', () => {
    rendererReady = true;
    if (pendingAnimeId) {
      mainWindow?.webContents.send('app:open-anime', pendingAnimeId);
      pendingAnimeId = null;
    }
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

registerUpdateIpc();
registerWindowControlsIpc();
registerAccountIpc();
registerAnimeArtworkIpc();
registerAnivexaIpc(assertTrustedIpcSender);

app.on('before-quit', () => {
  anivexaRuntime.stop();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  if (!hasSingleInstanceLock) return;
  if (process.argv.includes('--anivexa-smoke')) {
    void anivexaRuntime
      .smokeDependencies()
      .then((result) => {
        const passed = result.status === 200;
        const detail = passed ? '' : ' ' + result.body;
        process.stdout.write(
          passed
            ? 'ANIVEXA_SMOKE_OK\n'
            : 'ANIVEXA_SMOKE_FAILED' + detail + '\n',
        );
        app.exit(passed ? 0 : 1);
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? ' ' + error.message : '';
        process.stderr.write('ANIVEXA_SMOKE_FAILED' + detail + '\n');
        app.exit(1);
      });
    return;
  }
  installMediaProxy();
  void anivexaRuntime.start().catch(() => {});
  createWindow();
  configureAutoUpdates();
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
