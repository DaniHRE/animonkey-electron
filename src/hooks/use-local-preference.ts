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
    refresh();
    window.addEventListener('animonkey:local-data-imported', onImport);
    return () => {
      active = false;
      window.removeEventListener('animonkey:local-data-imported', onImport);
    };
  }, [key]);

  const update = useCallback(
    (next: T) => {
      changedByUser.current = true;
      setValue(next);
      void putPreference(key, next).catch(() => undefined);
    },
    [key],
  );

  return { value, update, loaded };
}
