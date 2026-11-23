export const APP_NOTIFICATIONS_CHANGED_EVENT =
  'animonkey:app-notifications-changed';
export const APP_UPDATE_CENTER_OPEN_EVENT = 'animonkey:open-app-update-center';
export const APP_NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const APP_NOTIFICATION_LIMIT = 100;

export type AppNotificationKind =
  'episode-ready' | 'update-ready' | 'update-installed';

export interface AppNotification {
  id: string;
  kind: AppNotificationKind;
  title: string;
  message: string;
  createdAt: number;
  readAt: number | null;
  dismissedAt: number | null;
  animeId?: string;
  episode?: number;
  version?: string;
}

export type NewAppNotification = Omit<
  AppNotification,
  'createdAt' | 'readAt' | 'dismissedAt'
> &
  (
    | {
        kind: 'episode-ready';
        animeId: string;
        episode: number;
        version?: never;
      }
    | {
        kind: 'update-ready' | 'update-installed';
        animeId?: never;
        episode?: never;
        version: string;
      }
  );

function isTimestamp(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) > 0 &&
    Number(value) <= 8_640_000_000_000_000
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAppNotification(value: unknown): value is AppNotification {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    value.id.length > 160 ||
    typeof value.title !== 'string' ||
    value.title.length === 0 ||
    value.title.length > 120 ||
    typeof value.message !== 'string' ||
    value.message.length === 0 ||
    value.message.length > 300 ||
    !isTimestamp(value.createdAt) ||
    !(value.readAt === null || isTimestamp(value.readAt)) ||
    !(value.dismissedAt === null || isTimestamp(value.dismissedAt))
  )
    return false;

  if (value.kind === 'episode-ready') {
    return (
      Object.keys(value).length === 9 &&
      /^[1-9]\d{0,9}$/.test(String(value.animeId)) &&
      Number.isSafeInteger(Number(value.animeId)) &&
      typeof value.episode === 'number' &&
      Number.isSafeInteger(value.episode) &&
      value.episode > 0 &&
      value.id === `episode-ready:${value.animeId}:${value.episode}`
    );
  }

  if (value.kind === 'update-ready' || value.kind === 'update-installed') {
    return (
      Object.keys(value).length === 8 &&
      typeof value.version === 'string' &&
      value.version.length > 0 &&
      value.version.length <= 40 &&
      value.id === `${value.kind}:${value.version}`
    );
  }

  return false;
}
