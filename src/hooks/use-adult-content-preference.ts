import { useCallback } from 'react';
import { useLocalPreference } from '@/hooks/use-local-preference';

export const ADULT_CONTENT_PREFERENCE_KEY = 'adult-content-enabled-v1';

export function useAdultContentPreference() {
  const {
    value: storedValue,
    update,
    loaded,
  } = useLocalPreference<unknown>(ADULT_CONTENT_PREFERENCE_KEY, false);
  const setIncludeAdult = useCallback(
    (includeAdult: boolean) => update(includeAdult),
    [update],
  );

  return {
    includeAdult: storedValue === true,
    setIncludeAdult,
    loaded,
  };
}
