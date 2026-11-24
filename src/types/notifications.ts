import { isAnivexaProviderId, type AnivexaProviderId } from './anivexa';

export interface NewEpisodeNotificationInput {
  animeId: string;
  title: string;
  episode: number;
}

export interface DesktopNotificationsBridge {
  isSupported(): Promise<boolean>;
  showNewEpisode(input: NewEpisodeNotificationInput): Promise<boolean>;
  refreshRemoteFeed(): Promise<RemoteNotificationRefreshResult>;
}

export const REMOTE_NOTIFICATION_CATEGORIES = [
  'maintenance',
  'provider_health',
  'moderation',
  'new_anime',
  'spotlight',
  'trending',
] as const;

export type RemoteNotificationCategory =
  (typeof REMOTE_NOTIFICATION_CATEGORIES)[number];
export type RemoteNotificationSeverity = 'info' | 'warning' | 'critical';

export interface RemoteNotificationFeedItem {
  id: string;
  category: RemoteNotificationCategory;
  severity: RemoteNotificationSeverity;
  title: string;
  message: string;
  priority: number;
  startsAt: string;
  expiresAt: string;
  providerId?: AnivexaProviderId | null;
  animeId?: string | null;
  action: { type: 'none' } | { type: 'anime' };
}

export interface RemoteNotificationFeed {
  schemaVersion: 1;
  generatedAt: string;
  notifications: RemoteNotificationFeedItem[];
}

export type RemoteNotificationRefreshResult =
  | {
      status: 'updated';
      retryAfterMs: number;
      feed: RemoteNotificationFeed;
    }
  | {
      status: 'not-due' | 'quota-limited' | 'unavailable';
      retryAfterMs: number;
    }
  | { status: 'disabled' };

const ISO_UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const ANIME_ID_PATTERN = /^[1-9]\d{0,9}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_UTC_TIMESTAMP_PATTERN.test(value))
    return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const normalized = value.replace(
    /(?:\.(\d{1,3}))?Z$/,
    (_match, fraction: string | undefined) =>
      `.${(fraction ?? '').padEnd(3, '0')}Z`,
  );
  return new Date(timestamp).toISOString() === normalized;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isRemoteNotificationFeedItem(
  value: unknown,
): value is RemoteNotificationFeedItem {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'id',
      'category',
      'severity',
      'title',
      'message',
      'priority',
      'startsAt',
      'expiresAt',
      'providerId',
      'animeId',
      'action',
    ]) ||
    typeof value.id !== 'string' ||
    !UUID_PATTERN.test(value.id) ||
    !REMOTE_NOTIFICATION_CATEGORIES.some(
      (category) => category === value.category,
    ) ||
    !['info', 'warning', 'critical'].includes(String(value.severity)) ||
    typeof value.title !== 'string' ||
    value.title.trim().length === 0 ||
    value.title.length > 120 ||
    typeof value.message !== 'string' ||
    value.message.trim().length === 0 ||
    value.message.length > 300 ||
    typeof value.priority !== 'number' ||
    !Number.isSafeInteger(value.priority) ||
    value.priority < 0 ||
    value.priority > 100 ||
    !isIsoUtcTimestamp(value.startsAt) ||
    !isIsoUtcTimestamp(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.startsAt) ||
    !isRecord(value.action) ||
    !hasOnlyKeys(value.action, ['type']) ||
    !['none', 'anime'].includes(String(value.action.type))
  )
    return false;

  const hasAnimeId =
    typeof value.animeId === 'string' && ANIME_ID_PATTERN.test(value.animeId);
  if (value.animeId !== undefined && value.animeId !== null && !hasAnimeId)
    return false;

  const hasProviderId = isAnivexaProviderId(value.providerId);
  if (
    value.providerId !== undefined &&
    value.providerId !== null &&
    !hasProviderId
  )
    return false;

  const animeCategory = ['new_anime', 'spotlight', 'trending'].includes(
    String(value.category),
  );
  if (animeCategory !== hasAnimeId) return false;
  if (value.category !== 'provider_health' && hasProviderId) return false;
  if (value.action.type === 'anime' && !hasAnimeId) return false;

  return true;
}

export function isRemoteNotificationFeed(
  value: unknown,
): value is RemoteNotificationFeed {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 3 ||
    value.schemaVersion !== 1 ||
    !isIsoUtcTimestamp(value.generatedAt) ||
    !Array.isArray(value.notifications) ||
    value.notifications.length > 8 ||
    !value.notifications.every(isRemoteNotificationFeedItem)
  )
    return false;

  return (
    new Set(value.notifications.map((item) => item.id.toLowerCase())).size ===
    value.notifications.length
  );
}

export function isRemoteNotificationRefreshResult(
  value: unknown,
): value is RemoteNotificationRefreshResult {
  if (!isRecord(value) || typeof value.status !== 'string') return false;
  if (value.status === 'disabled') return Object.keys(value).length === 1;
  if (
    !['not-due', 'quota-limited', 'unavailable', 'updated'].includes(
      value.status,
    ) ||
    typeof value.retryAfterMs !== 'number' ||
    !Number.isSafeInteger(value.retryAfterMs) ||
    value.retryAfterMs < 0 ||
    value.retryAfterMs > 7 * 24 * 60 * 60 * 1000
  )
    return false;
  if (value.status === 'updated')
    return (
      Object.keys(value).length === 3 && isRemoteNotificationFeed(value.feed)
    );
  return Object.keys(value).length === 2;
}
