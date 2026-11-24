import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  isRemoteNotificationFeed,
  type RemoteNotificationRefreshResult,
} from '../types/notifications';

declare const __DESKTOP_API_URL__: string;

const FEED_PATH =
  '/storage/v1/object/public/desktop-notifications/v1/feed.json';
const STATE_FILE_NAME = 'remote-notification-feed-state.json';
const REQUEST_INTERVAL_MS = 6 * 60 * 60 * 1000;
const QUOTA_BACKOFF_MS = 24 * 60 * 60 * 1000;
const MAX_RESPONSE_BYTES = 4 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

interface PollState {
  version: 1;
  nextAttemptAt: number;
}

let activeRefresh: Promise<RemoteNotificationRefreshResult> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getFeedUrl(): URL | null {
  try {
    const apiUrl = new URL(__DESKTOP_API_URL__);
    if (
      apiUrl.protocol !== 'https:' ||
      !apiUrl.pathname.endsWith('/desktop-api') ||
      apiUrl.username ||
      apiUrl.password ||
      apiUrl.search ||
      apiUrl.hash
    )
      return null;
    return new URL(FEED_PATH, apiUrl.origin);
  } catch {
    return null;
  }
}

function statePath(): string {
  return path.join(app.getPath('userData'), STATE_FILE_NAME);
}

async function readPollState(): Promise<PollState | 'missing' | null> {
  try {
    const value: unknown = JSON.parse(await readFile(statePath(), 'utf8'));
    if (
      !isRecord(value) ||
      Object.keys(value).length !== 2 ||
      value.version !== 1 ||
      typeof value.nextAttemptAt !== 'number' ||
      !Number.isSafeInteger(value.nextAttemptAt) ||
      value.nextAttemptAt < 0
    )
      return null;
    return { version: 1, nextAttemptAt: value.nextAttemptAt };
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return 'missing';
    return null;
  }
}

async function writePollState(nextAttemptAt: number): Promise<boolean> {
  const filename = statePath();
  const temporaryFilename = `${filename}.tmp`;
  try {
    await writeFile(
      temporaryFilename,
      JSON.stringify({ version: 1, nextAttemptAt } satisfies PollState),
      { encoding: 'utf8', mode: 0o600 },
    );
    await rename(temporaryFilename, filename);
    return true;
  } catch {
    await rm(temporaryFilename, { force: true }).catch(() => undefined);
    return false;
  }
}

function boundedRetryDelay(nextAttemptAt: number): number {
  return Math.min(
    MAX_RETRY_AFTER_MS,
    Math.max(0, Math.ceil(nextAttemptAt - Date.now())),
  );
}

function nextScheduledAttempt(now: number): number {
  const jitterMs = Math.floor(Math.random() * (30 * 60 * 1000 + 1));
  return now + REQUEST_INTERVAL_MS + jitterMs;
}

async function readBoundedResponse(response: Response): Promise<string | null> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return null;
  }
}

async function requestFeed(): Promise<RemoteNotificationRefreshResult> {
  const feedUrl = getFeedUrl();
  if (!feedUrl) return { status: 'disabled' };

  const now = Date.now();
  const state = await readPollState();
  if (state === null) return { status: 'disabled' };
  if (state !== 'missing' && state.nextAttemptAt > now) {
    return {
      status: 'not-due',
      retryAfterMs: boundedRetryDelay(state.nextAttemptAt),
    };
  }

  // Reserve a full day before the request; quota responses and process crashes
  // therefore cannot cause a rapid retry if the follow-up write fails.
  if (!(await writePollState(now + QUOTA_BACKOFF_MS)))
    return { status: 'disabled' };

  let response: Response;
  try {
    response = await fetch(feedUrl, {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    const nextAttemptAt = nextScheduledAttempt(Date.now());
    await writePollState(nextAttemptAt);
    return {
      status: 'unavailable',
      retryAfterMs: boundedRetryDelay(nextAttemptAt),
    };
  }

  if (response.status === 402 || response.status === 429) {
    const nextAttemptAt = Date.now() + QUOTA_BACKOFF_MS;
    await writePollState(nextAttemptAt);
    return {
      status: 'quota-limited',
      retryAfterMs: boundedRetryDelay(nextAttemptAt),
    };
  }

  if (!response.ok) {
    const nextAttemptAt = nextScheduledAttempt(Date.now());
    await writePollState(nextAttemptAt);
    return {
      status: 'unavailable',
      retryAfterMs: boundedRetryDelay(nextAttemptAt),
    };
  }

  if (
    !response.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  ) {
    const nextAttemptAt = nextScheduledAttempt(Date.now());
    await writePollState(nextAttemptAt);
    return {
      status: 'unavailable',
      retryAfterMs: boundedRetryDelay(nextAttemptAt),
    };
  }

  let feed: unknown;
  try {
    const body = await readBoundedResponse(response);
    if (body === null) throw new Error('The response exceeded the size limit.');
    feed = JSON.parse(body);
  } catch {
    const nextAttemptAt = nextScheduledAttempt(Date.now());
    await writePollState(nextAttemptAt);
    return {
      status: 'unavailable',
      retryAfterMs: boundedRetryDelay(nextAttemptAt),
    };
  }

  if (!isRemoteNotificationFeed(feed)) {
    const nextAttemptAt = nextScheduledAttempt(Date.now());
    await writePollState(nextAttemptAt);
    return {
      status: 'unavailable',
      retryAfterMs: boundedRetryDelay(nextAttemptAt),
    };
  }

  const nextAttemptAt = nextScheduledAttempt(Date.now());
  if (!(await writePollState(nextAttemptAt))) return { status: 'disabled' };
  return {
    status: 'updated',
    feed,
    retryAfterMs: boundedRetryDelay(nextAttemptAt),
  };
}

export function registerRemoteNotificationFeedIpc(
  assertTrustedSender: (event: IpcMainInvokeEvent) => void,
): void {
  ipcMain.handle('notifications:remote-feed:refresh', async (event) => {
    assertTrustedSender(event);
    if (!activeRefresh) {
      activeRefresh = requestFeed().finally(() => {
        activeRefresh = null;
      });
    }
    return activeRefresh;
  });
}
