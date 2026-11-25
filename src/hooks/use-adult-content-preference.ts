import { useCallback } from 'react';
import { useLocalPreference } from '@/hooks/use-local-preference';

export const ADULT_CONTENT_PREFERENCE_KEY = 'adult-content-enabled-v1';

export function useAdultContentPreference() {
  const {
    value: storedValue,
    update,
    updateAndWait,
    loaded,
  } = useLocalPreference<unknown>(ADULT_CONTENT_PREFERENCE_KEY, false);
  const setIncludeAdult = useCallback(
    (includeAdult: boolean) => update(includeAdult),
    [update],
  );
  const setIncludeAdultAndWait = useCallback(
    (includeAdult: boolean) => updateAndWait(includeAdult),
    [updateAndWait],
  );

  return {
    includeAdult: storedValue === true,
    setIncludeAdult,
    setIncludeAdultAndWait,
    loaded,
  };
}
