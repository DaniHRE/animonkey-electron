export const APP_UPDATE_STATUSES = [
  'unsupported',
  'idle',
  'checking',
  'downloading',
  'ready',
  'current',
  'error',
] as const;

export type AppUpdateStatus = (typeof APP_UPDATE_STATUSES)[number];

export interface AppUpdateSnapshot {
  revision: number;
  status: AppUpdateStatus;
  currentVersion: string;
}

export function isAppUpdateSnapshot(
  value: unknown,
): value is AppUpdateSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(snapshot.revision) &&
    APP_UPDATE_STATUSES.includes(snapshot.status as AppUpdateStatus) &&
    typeof snapshot.currentVersion === 'string' &&
    snapshot.currentVersion.length <= 40
  );
}

export interface AppUpdateBridge {
  getState: () => Promise<AppUpdateSnapshot>;
  checkNow: () => Promise<void>;
  install: () => Promise<void>;
  onStateChanged: (
    callback: (snapshot: AppUpdateSnapshot) => void,
  ) => () => void;
}
