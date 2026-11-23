import { ipcMain, Notification, type IpcMainInvokeEvent } from 'electron';
import type { NewEpisodeNotificationInput } from '../types/notifications';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInput(value: unknown): NewEpisodeNotificationInput | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.animeId !== 'string' ||
    !/^[1-9]\d{0,9}$/.test(value.animeId) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title.length > 200 ||
    typeof value.episode !== 'number' ||
    !Number.isSafeInteger(value.episode) ||
    value.episode < 1 ||
    value.episode > 10_000
  )
    return null;
  return {
    animeId: value.animeId,
    title: value.title.trim(),
    episode: value.episode,
  };
}

export function registerDesktopNotificationIpc(
  assertTrustedSender: (event: IpcMainInvokeEvent) => void,
): void {
  ipcMain.handle('notifications:is-supported', (event) => {
    assertTrustedSender(event);
    return Notification.isSupported();
  });
  ipcMain.handle('notifications:show-new-episode', (event, value: unknown) => {
    assertTrustedSender(event);
    const input = parseInput(value);
    if (!input || !Notification.isSupported()) return false;
    try {
      new Notification({
        title: 'Novo episódio disponível',
        body:
          input.title +
          ' · Episódio ' +
          String(input.episode) +
          ' já está no ar.',
      }).show();
      return true;
    } catch {
      return false;
    }
  });
}
