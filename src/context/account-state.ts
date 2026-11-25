import { createContext, useContext } from 'react';
import type {
  AccountCredentials,
  AccountRegistration,
  AccountSession,
} from '@/types/account';

export type AccountSyncState = 'idle' | 'syncing' | 'synced' | 'offline';

export interface AccountContextValue {
  ready: boolean;
  session: AccountSession | null;
  syncState: AccountSyncState;
  syncError: string | null;
  login(input: AccountCredentials): Promise<void>;
  register(input: AccountRegistration): Promise<void>;
  logout(): Promise<void>;
  syncNow(): Promise<boolean>;
  importGuestLibrary(): Promise<number>;
  updateProfile(name: string): Promise<void>;
  uploadAvatar(contentType: string, base64: string): Promise<void>;
  removeAvatar(): Promise<void>;
}

export const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error('useAccount exige AccountProvider.');
  return context;
}
