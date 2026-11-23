import { useCallback, useEffect, useRef, useState } from 'react';
import { getPreference, putPreference } from '@/services/cache/local-db';

export function useLocalPreference<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  const changedByUser = useRef(false);

  useEffect(() => {
    let active = true;
    const refresh = (force = false) => {
      getPreference<T>(key)
        .then((stored) => {
          if (active && stored !== null && (force || !changedByUser.current)) {
            setValue(stored);
            if (force) changedByUser.current = false;
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setLoaded(true);
        });
    };
    const onImport = () => refresh(true);
    const onPreferenceUpdate = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail !== 'object' || detail === null) return;

      const preference = detail as Record<string, unknown>;
      if (preference.key !== key || !('value' in preference)) return;

      changedByUser.current = true;
      setValue(preference.value as T);
      setLoaded(true);
    };
    refresh();
    window.addEventListener('animonkey:local-data-imported', onImport);
    window.addEventListener(
      'animonkey:local-preference-updated',
      onPreferenceUpdate,
    );
    return () => {
      active = false;
      window.removeEventListener('animonkey:local-data-imported', onImport);
      window.removeEventListener(
        'animonkey:local-preference-updated',
        onPreferenceUpdate,
      );
    };
  }, [key]);

  const update = useCallback(
    (next: T) => {
      changedByUser.current = true;
      setValue(next);
      window.dispatchEvent(
        new CustomEvent('animonkey:local-preference-updated', {
          detail: { key, value: next },
        }),
      );
      void putPreference(key, next).catch(() => undefined);
    },
    [key],
  );

  return { value, update, loaded };
}
