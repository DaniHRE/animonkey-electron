export const WATCH_HISTORY_PREFERENCE_KEYS = {
  recordProgress: 'privacy.local-watch-progress-v1',
  showContinueWatching: 'privacy.continue-watching-visible-v1',
  syncProgress: 'privacy.sync-watch-progress-v1',
} as const;

export function isWatchHistoryPreference(key: string, value: unknown): boolean {
  return (
    Object.values(WATCH_HISTORY_PREFERENCE_KEYS).includes(
      key as (typeof WATCH_HISTORY_PREFERENCE_KEYS)[keyof typeof WATCH_HISTORY_PREFERENCE_KEYS],
    ) && typeof value === 'boolean'
  );
}
