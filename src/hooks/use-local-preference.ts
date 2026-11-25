import { useCallback, useEffect, useRef, useState } from 'react';
import { getPreference, putPreference } from '@/services/cache/local-db';

export function useLocalPreference<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  const changedByUser = useRef(false);
  const currentValue = useRef(fallback);
  const writeRevision = useRef(0);

  useEffect(() => {
    let active = true;
    const refresh = (force = false) => {
      getPreference<T>(key)
        .then((stored) => {
          if (active && stored !== null && (force || !changedByUser.current)) {
            currentValue.current = stored;
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
      currentValue.current = preference.value as T;
      setValue(currentValue.current);
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

  const updateAndWait = useCallback(
    async (next: T): Promise<void> => {
      const previous = currentValue.current;
      const revision = ++writeRevision.current;
      changedByUser.current = true;
      currentValue.current = next;
      setValue(next);
      try {
        await putPreference(key, next);
        if (revision === writeRevision.current) {
          window.dispatchEvent(
            new CustomEvent('animonkey:local-preference-updated', {
              detail: { key, value: next },
            }),
          );
        }
      } catch (cause) {
        if (revision === writeRevision.current) {
          currentValue.current = previous;
          setValue(previous);
        }
        throw cause;
      }
    },
    [key],
  );

  const update = useCallback(
    (next: T) => {
      void updateAndWait(next).catch(() => undefined);
    },
    [updateAndWait],
  );

  return { value, update, updateAndWait, loaded };
}
