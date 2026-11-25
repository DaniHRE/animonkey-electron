import { isAnivexaProviderId, type AnivexaProviderId } from '@/types/anivexa';
import type {
  RemoteNotificationCategory,
  RemoteNotificationSeverity,
} from '@/types/notifications';

export const APP_NOTIFICATIONS_CHANGED_EVENT =
  'animonkey:app-notifications-changed';
export const APP_NOTIFICATION_CENTER_OPEN_EVENT =
  'animonkey:open-app-notification-center';
export const APP_UPDATE_CENTER_OPEN_EVENT = 'animonkey:open-app-update-center';
export const APP_ACTION_FEEDBACK_EVENT = 'animonkey:action-feedback';
export const APP_NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const APP_NOTIFICATION_LIMIT = 100;

export type ActionFeedbackTone = 'success' | 'error' | 'warning' | 'info';

interface StoredAppNotificationBase {
  id: string;
  title: string;
  message: string;
  createdAt: number;
  readAt: number | null;
  dismissedAt: number | null;
}

export interface EpisodeAppNotification extends StoredAppNotificationBase {
  kind: 'episode-ready';
  animeId?: string;
  episode?: number;
  posterUrl?: string;
}

export interface UpdateAppNotification extends StoredAppNotificationBase {
  kind: 'update-ready' | 'update-installed';
  version?: string;
}

export interface ActionAppNotification extends StoredAppNotificationBase {
  kind: 'action-feedback';
  tone: ActionFeedbackTone;
  animeId?: string;
  posterUrl?: string;
}

export interface RemoteAppNotification extends StoredAppNotificationBase {
  kind: 'remote';
  category: RemoteNotificationCategory;
  severity: RemoteNotificationSeverity;
  priority: number;
  expiresAt: number;
  action: 'none' | 'anime';
  animeId?: string;
  providerId?: AnivexaProviderId;
}

export type AppNotification =
  | EpisodeAppNotification
  | UpdateAppNotification
  | ActionAppNotification
  | RemoteAppNotification;

type WithoutStoredTimestamps<T> = T extends AppNotification
  ? Omit<T, 'createdAt' | 'readAt' | 'dismissedAt'>
  : never;

type NewLocalAppNotification = WithoutStoredTimestamps<
  Exclude<AppNotification, RemoteAppNotification>
>;

export type NewRemoteAppNotification = Omit<
  RemoteAppNotification,
  'readAt' | 'dismissedAt'
>;

export type NewAppNotification = NewLocalAppNotification;

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

export function isAniListCoverUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 's4.anilist.co' &&
      url.port.length === 0 &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.pathname.startsWith('/file/anilistcdn/media/anime/cover/') &&
      url.search.length === 0 &&
      url.hash.length === 0
    );
  } catch {
    return false;
  }
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

  if (value.kind === 'action-feedback') {
    const actionKeys = new Set([
      'id',
      'kind',
      'title',
      'message',
      'createdAt',
      'readAt',
      'dismissedAt',
      'tone',
      'animeId',
      'posterUrl',
    ]);
    const hasAnimeId =
      typeof value.animeId === 'string' && /^[1-9]\d{0,9}$/.test(value.animeId);
    return (
      Object.keys(value).length >= 8 &&
      Object.keys(value).length <= 10 &&
      Object.keys(value).every((key) => actionKeys.has(key)) &&
      /^action-feedback:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value.id,
      ) &&
      ['success', 'error', 'warning', 'info'].includes(String(value.tone)) &&
      (value.animeId === undefined || hasAnimeId) &&
      (value.posterUrl === undefined ||
        (hasAnimeId && isAniListCoverUrl(value.posterUrl)))
    );
  }

  if (value.kind === 'episode-ready') {
    const episodeKeys = new Set([
      'id',
      'kind',
      'title',
      'message',
      'createdAt',
      'readAt',
      'dismissedAt',
      'animeId',
      'episode',
      'posterUrl',
    ]);
    return (
      (Object.keys(value).length === 9 || Object.keys(value).length === 10) &&
      Object.keys(value).every((key) => episodeKeys.has(key)) &&
      /^[1-9]\d{0,9}$/.test(String(value.animeId)) &&
      Number.isSafeInteger(Number(value.animeId)) &&
      typeof value.episode === 'number' &&
      Number.isSafeInteger(value.episode) &&
      value.episode > 0 &&
      (value.posterUrl === undefined || isAniListCoverUrl(value.posterUrl)) &&
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

  if (value.kind === 'remote') {
    const allowedKeys = new Set([
      'id',
      'kind',
      'title',
      'message',
      'createdAt',
      'readAt',
      'dismissedAt',
      'category',
      'severity',
      'priority',
      'expiresAt',
      'action',
      'animeId',
      'providerId',
    ]);
    const hasAnimeId =
      typeof value.animeId === 'string' && /^[1-9]\d{0,9}$/.test(value.animeId);
    const hasProviderId = isAnivexaProviderId(value.providerId);
    return (
      Object.keys(value).every((key) => allowedKeys.has(key)) &&
      Object.keys(value).length >= 12 &&
      Object.keys(value).length <= 14 &&
      /^remote:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value.id,
      ) &&
      [
        'maintenance',
        'provider_health',
        'moderation',
        'new_anime',
        'spotlight',
        'trending',
      ].includes(String(value.category)) &&
      ['info', 'warning', 'critical'].includes(String(value.severity)) &&
      typeof value.priority === 'number' &&
      Number.isSafeInteger(value.priority) &&
      value.priority >= 0 &&
      value.priority <= 100 &&
      isTimestamp(value.expiresAt) &&
      value.expiresAt > value.createdAt &&
      (value.action === 'none' || value.action === 'anime') &&
      (value.animeId === undefined || hasAnimeId) &&
      (value.providerId === undefined || hasProviderId) &&
      ['new_anime', 'spotlight', 'trending'].includes(
        String(value.category),
      ) === hasAnimeId &&
      (value.category === 'provider_health' || !hasProviderId) &&
      (value.action !== 'anime' || hasAnimeId)
    );
  }

  return false;
}
