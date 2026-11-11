import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AccountContext } from '@/context/account-state';
import type { AccountSyncState } from '@/context/account-state';
import type {
  AccountCredentials,
  AccountRegistration,
  AccountSession,
} from '@/types/account';
import { reconcileAccountData } from '@/services/account-sync';
import {
  setActiveLocalDataScope,
  mergeGuestLibraryIntoActiveScope,
} from '@/services/cache/local-db';

export function AccountProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AccountSession | null>(null);
  const [syncState, setSyncState] = useState<AccountSyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const sessionRef = useRef<AccountSession | null>(null);
  const syncInFlight = useRef<Promise<void> | null>(null);

  const syncNow = useCallback(async (): Promise<void> => {
    const activeSession = sessionRef.current;
    if (!activeSession) return;
    if (syncInFlight.current) return await syncInFlight.current;

    const userId = activeSession.user.id;
    setSyncState('syncing');
    setSyncError(null);
    const task = reconcileAccountData()
      .then(() => {
        if (sessionRef.current?.user.id === userId) setSyncState('synced');
      })
      .catch((error: unknown) => {
        if (sessionRef.current?.user.id !== userId) return;
        if (
          error instanceof Error &&
          (error.message === 'Entre na sua conta para sincronizar.' ||
            error.message ===
              'Sua sessão expirou. Entre novamente para sincronizar.')
        ) {
          void window.animonkey.account.getSession().then((current) => {
            if (sessionRef.current?.user.id !== userId || current) return;
            sessionRef.current = null;
            setSession(null);
            setActiveLocalDataScope(null);
            setSyncState('idle');
            setSyncError('A sessão expirou. Entre novamente para sincronizar.');
            window.dispatchEvent(new Event('animonkey:account-sync-applied'));
          });
          return;
        }
        setSyncState('offline');
        setSyncError(
          error instanceof Error
            ? error.message
            : 'A sincronização falhou. Os dados locais foram preservados.',
        );
      })
      .finally(() => {
        syncInFlight.current = null;
      });
    syncInFlight.current = task;
    await task;
  }, []);

  const waitForSync = useCallback(async () => {
    await syncInFlight.current?.catch(() => undefined);
  }, []);

  const activateSession = useCallback(
    async (nextSession: AccountSession) => {
      await waitForSync();
      setActiveLocalDataScope(nextSession.user.id);
      sessionRef.current = nextSession;
      setSession(nextSession);
      window.dispatchEvent(new Event('animonkey:account-sync-applied'));
      await syncNow();
    },
    [syncNow, waitForSync],
  );

  useEffect(() => {
    let active = true;
    window.animonkey.account
      .getSession()
      .then((restored) => {
        if (!active) return;
        if (restored) {
          setActiveLocalDataScope(restored.user.id);
          sessionRef.current = restored;
          setSession(restored);
        } else {
          setActiveLocalDataScope(null);
        }
        setReady(true);
        if (restored) void syncNow();
      })
      .catch(() => {
        if (!active) return;
        setActiveLocalDataScope(null);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [syncNow]);

  useEffect(() => {
    if (!session) return;
    let timer: number | undefined;
    let maxTimer: number | undefined;
    const scheduleSync = (event: Event) => {
      window.clearTimeout(timer);
      if (
        event instanceof CustomEvent &&
        event.detail?.entity === 'episode-progress'
      ) {
        timer = window.setTimeout(() => {
          window.clearTimeout(maxTimer);
          maxTimer = undefined;
          void syncNow();
        }, 10_000);
        if (maxTimer === undefined) {
          maxTimer = window.setTimeout(() => {
            window.clearTimeout(timer);
            timer = undefined;
            maxTimer = undefined;
            void syncNow();
          }, 30_000);
        }
      } else {
        window.clearTimeout(maxTimer);
        maxTimer = undefined;
        timer = window.setTimeout(() => void syncNow(), 900);
      }
    };
    window.addEventListener('animonkey:local-data-changed', scheduleSync);
    window.addEventListener('animonkey:local-data-imported', scheduleSync);
    window.addEventListener('online', scheduleSync);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(maxTimer);
      window.removeEventListener('animonkey:local-data-changed', scheduleSync);
      window.removeEventListener('animonkey:local-data-imported', scheduleSync);
      window.removeEventListener('online', scheduleSync);
    };
  }, [session, syncNow]);

  const login = useCallback(
    async (input: AccountCredentials) => {
      await waitForSync();
      const nextSession = await window.animonkey.account.login(input);
      await activateSession(nextSession);
    },
    [activateSession, waitForSync],
  );

  const register = useCallback(
    async (input: AccountRegistration) => {
      await waitForSync();
      const nextSession = await window.animonkey.account.register(input);
      await activateSession(nextSession);
    },
    [activateSession, waitForSync],
  );

  const logout = useCallback(async () => {
    await waitForSync();
    await window.animonkey.account.logout();
    sessionRef.current = null;
    setSession(null);
    setSyncState('idle');
    setSyncError(null);
    setActiveLocalDataScope(null);
    window.dispatchEvent(new Event('animonkey:account-sync-applied'));
  }, [waitForSync]);

  const updateProfile = useCallback(async (name: string) => {
    const updatedUser = await window.animonkey.account.updateProfile(name);
    const current = sessionRef.current;
    if (!current || current.user.id !== updatedUser.id) return;
    const updatedSession = { ...current, user: updatedUser };
    sessionRef.current = updatedSession;
    setSession(updatedSession);
  }, []);

  const importGuestLibrary = useCallback(async () => {
    if (!sessionRef.current) return 0;
    await waitForSync();
    const count = await mergeGuestLibraryIntoActiveScope();
    if (count > 0) await syncNow();
    return count;
  }, [syncNow, waitForSync]);

  return (
    <AccountContext.Provider
      value={{
        ready,
        session,
        syncState,
        syncError,
        login,
        register,
        logout,
        syncNow,
        importGuestLibrary,
        updateProfile,
      }}
    >
      {ready ? children : null}
    </AccountContext.Provider>
  );
}
