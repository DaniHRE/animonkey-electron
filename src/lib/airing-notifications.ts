export const AIRING_NOTIFICATION_PREFERENCE_KEYS = {
  enabled: 'notifications.new-episodes-v1',
  followedAnime: 'notifications.followed-anime-v1',
} as const;

export const MAX_FOLLOWED_ANIME = 50;

export interface FollowedAnimeRecord {
  animeId: string;
  lastNotifiedEpisode: number;
}

export function isFollowedAnimeList(
  value: unknown,
): value is FollowedAnimeRecord[] {
  if (!Array.isArray(value) || value.length > MAX_FOLLOWED_ANIME) return false;
  const ids = new Set<string>();
  return value.every((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry))
      return false;
    const record = entry as Record<string, unknown>;
    if (
      Object.keys(record).length !== 2 ||
      typeof record.animeId !== 'string' ||
      !/^[1-9]\d{0,9}$/.test(record.animeId) ||
      !Number.isSafeInteger(Number(record.animeId)) ||
      ids.has(record.animeId) ||
      typeof record.lastNotifiedEpisode !== 'number' ||
      !Number.isSafeInteger(record.lastNotifiedEpisode) ||
      record.lastNotifiedEpisode < 0
    )
      return false;
    ids.add(record.animeId);
    return true;
  });
}

export function isAiringNotificationPreference(
  key: string,
  value: unknown,
): boolean {
  if (key === AIRING_NOTIFICATION_PREFERENCE_KEYS.enabled)
    return typeof value === 'boolean';
  if (key === AIRING_NOTIFICATION_PREFERENCE_KEYS.followedAnime)
    return isFollowedAnimeList(value);
  return false;
}
