import { useLocalPreference } from '@/hooks/use-local-preference';
import { WATCH_HISTORY_PREFERENCE_KEYS } from '@/lib/watch-history-preferences';

export function useRecordWatchProgressPreference() {
  const preference = useLocalPreference<unknown>(
    WATCH_HISTORY_PREFERENCE_KEYS.recordProgress,
    true,
  );
  return {
    enabled: preference.value !== false,
    setEnabled: preference.update,
    setEnabledAndWait: preference.updateAndWait,
    loaded: preference.loaded,
  };
}

export function useContinueWatchingVisibilityPreference() {
  const preference = useLocalPreference<unknown>(
    WATCH_HISTORY_PREFERENCE_KEYS.showContinueWatching,
    true,
  );
  return {
    enabled: preference.value !== false,
    setEnabled: preference.update,
    setEnabledAndWait: preference.updateAndWait,
    loaded: preference.loaded,
  };
}

export function useSyncWatchProgressPreference() {
  const preference = useLocalPreference<unknown>(
    WATCH_HISTORY_PREFERENCE_KEYS.syncProgress,
    true,
  );
  return {
    enabled: preference.value !== false,
    setEnabled: preference.update,
    setEnabledAndWait: preference.updateAndWait,
    loaded: preference.loaded,
  };
}
