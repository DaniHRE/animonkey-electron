import {
  app,
  ipcMain,
  utilityProcess,
  type IpcMainInvokeEvent,
  type UtilityProcess,
} from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type {
  AnivexaDesktopRequest,
  AnivexaDesktopResponse,
} from '@/types/anivexa';

const STARTUP_TIMEOUT_MS = 15_000;
const MAX_PENDING_REQUESTS = 24;
const REQUEST_ID_PATTERN = /^[0-9a-f-]{36}$/i;

interface PendingRequest {
  resolve: (response: AnivexaDesktopResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface WorkerMessage {
  type: 'ready' | 'startup-error' | 'response';
  requestId?: string;
  status?: number;
  body?: string;
  code?: string;
}

function apiRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'anivexa-runtime');
  }
  return path.join(app.getAppPath(), 'anivexa-runtime');
}

function requestRoute(request: AnivexaDesktopRequest): string {
  if (!/^[0-9]{1,12}$/.test(request.animeId)) {
    throw new Error('Identificador de anime inválido.');
  }
  if (request.kind === 'episodes') {
    return '/episodes/' + request.animeId;
  }
  if (
    !/^[a-z][a-z0-9_-]{0,39}$/i.test(request.provider) ||
    !/^[a-z0-9_-]{1,160}$/i.test(request.episodeId)
  ) {
    throw new Error('Identificador de fonte inválido.');
  }
  return (
    '/watch/' +
    encodeURIComponent(request.provider) +
    '/' +
    request.animeId +
    '/' +
    request.audio +
    '/' +
    encodeURIComponent(request.episodeId)
  );
}

function parseRequest(value: unknown): {
  requestId: string;
  request: AnivexaDesktopRequest;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Solicitação Anivexa inválida.');
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.requestId !== 'string' ||
    !REQUEST_ID_PATTERN.test(record.requestId)
  ) {
    throw new Error('Solicitação Anivexa inválida.');
  }
  const input = record.request;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Solicitação Anivexa inválida.');
  }
  const request = input as Record<string, unknown>;
  if (
    request.kind === 'episodes' &&
    typeof request.animeId === 'string' &&
    /^[0-9]{1,12}$/.test(request.animeId)
  ) {
    return {
      requestId: record.requestId,
      request: { kind: 'episodes', animeId: request.animeId },
    };
  }
  if (
    request.kind === 'watch' &&
    typeof request.provider === 'string' &&
    typeof request.animeId === 'string' &&
    (request.audio === 'sub' || request.audio === 'dub') &&
    typeof request.episodeId === 'string'
  ) {
    const parsed: AnivexaDesktopRequest = {
      kind: 'watch',
      provider: request.provider,
      animeId: request.animeId,
      audio: request.audio,
      episodeId: request.episodeId,
    };
    requestRoute(parsed);
    return { requestId: record.requestId, request: parsed };
  }
  throw new Error('Solicitação Anivexa inválida.');
}

class AnivexaRuntime {
  private child: UtilityProcess | null = null;
  private ready = false;
  private startPromise: Promise<void> | null = null;
  private resolveStart: (() => void) | null = null;
  private rejectStart: ((error: Error) => void) | null = null;
  private startTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly pending = new Map<string, PendingRequest>();

  async request(
    requestId: string,
    request: AnivexaDesktopRequest,
  ): Promise<AnivexaDesktopResponse> {
    if (!REQUEST_ID_PATTERN.test(requestId) || this.pending.has(requestId)) {
      throw new Error('Solicitação Anivexa inválida.');
    }
    if (this.pending.size >= MAX_PENDING_REQUESTS) {
      throw new Error('A Anivexa está ocupada. Tente novamente.');
    }
    const route = requestRoute(request);
    const timeoutMs = request.kind === 'episodes' ? 120_000 : 25_000;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cancel(requestId, new Error('Anivexa request timed out.'));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timeout });
      void this.ensureStarted()
        .then(() => {
          if (!this.pending.has(requestId)) return;
          this.child?.postMessage({ type: 'request', requestId, route });
        })
        .catch((error: unknown) => {
          this.finishRequest(
            requestId,
            undefined,
            error instanceof Error
              ? error
              : new Error('Anivexa could not start.'),
          );
        });
    });
  }

  async smokeDependencies(): Promise<AnivexaDesktopResponse> {
    const requestId = randomUUID();
    await this.ensureStarted();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cancel(requestId, new Error('Anivexa smoke check timed out.'));
      }, 15_000);
      this.pending.set(requestId, {
        resolve,
        reject,
        timeout,
      });
      this.child?.postMessage({ type: 'smoke', requestId });
    });
  }

  start(): Promise<void> {
    return this.ensureStarted();
  }

  cancel(
    requestId: string,
    reason = new Error('Anivexa request cancelled.'),
  ): void {
    if (!this.pending.has(requestId)) return;
    this.child?.postMessage({ type: 'cancel', requestId });
    this.finishRequest(requestId, undefined, reason);
  }

  stop(): void {
    this.child?.kill();
    this.child = null;
    this.ready = false;
    this.startPromise = null;
    this.rejectPending(new Error('Anivexa runtime stopped.'));
  }

  private ensureStarted(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    if (!app.isReady())
      return Promise.reject(new Error('Electron is not ready.'));

    this.startPromise = new Promise<void>((resolve, reject) => {
      this.resolveStart = resolve;
      this.rejectStart = reject;
      this.startTimeout = setTimeout(() => {
        this.failStart(new Error('Anivexa startup timed out.'));
      }, STARTUP_TIMEOUT_MS);

      const root = apiRoot();
      const workerPath = path.join(root, 'utility-worker.cjs');
      try {
        this.child = utilityProcess.fork(workerPath, [], {
          env: {
            ANIVEXA_API_ROOT: root,
            CACHE_ENABLED: 'false',
            NODE_ENV: app.isPackaged ? 'production' : 'development',
            PATH: process.env.PATH ?? '',
            SystemRoot: process.env.SystemRoot ?? '',
            TEMP: process.env.TEMP ?? '',
            TMP: process.env.TMP ?? '',
          },
          serviceName: 'Anivexa API',
          stdio: 'ignore',
        });
        this.child.on('message', (message) => this.onWorkerMessage(message));
        this.child.on('exit', () => this.onWorkerExit());
      } catch {
        this.failStart(new Error('Anivexa runtime could not be launched.'));
      }
    });
    return this.startPromise;
  }

  private onWorkerMessage(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const message = value as WorkerMessage;
    if (message.type === 'ready') {
      this.ready = true;
      if (this.startTimeout) clearTimeout(this.startTimeout);
      this.startTimeout = null;
      this.resolveStart?.();
      this.resolveStart = null;
      this.rejectStart = null;
      return;
    }
    if (message.type === 'startup-error') {
      const code = message.code ? ' (' + message.code + ')' : '';
      this.failStart(new Error('Anivexa runtime failed to load' + code + '.'));
      return;
    }
    if (
      message.type === 'response' &&
      typeof message.requestId === 'string' &&
      typeof message.status === 'number' &&
      Number.isInteger(message.status) &&
      typeof message.body === 'string'
    ) {
      this.finishRequest(message.requestId, {
        status: message.status,
        body: message.body,
      });
    }
  }

  private onWorkerExit(): void {
    if (!this.ready)
      this.failStart(new Error('Anivexa runtime exited during startup.'));
    this.child = null;
    this.ready = false;
    this.startPromise = null;
    this.rejectPending(new Error('Anivexa runtime stopped unexpectedly.'));
  }

  private failStart(error: Error): void {
    if (this.startTimeout) clearTimeout(this.startTimeout);
    this.startTimeout = null;
    this.rejectStart?.(error);
    this.resolveStart = null;
    this.rejectStart = null;
    this.startPromise = null;
    this.ready = false;
    this.child?.kill();
  }

  private finishRequest(
    requestId: string,
    response?: AnivexaDesktopResponse,
    error?: Error,
  ): void {
    const pending = this.pending.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(requestId);
    if (error) pending.reject(error);
    else if (response) pending.resolve(response);
    else pending.reject(new Error('Anivexa returned an invalid response.'));
  }

  private rejectPending(error: Error): void {
    for (const requestId of this.pending.keys()) {
      this.finishRequest(requestId, undefined, error);
    }
  }
}

export const anivexaRuntime = new AnivexaRuntime();

export function registerAnivexaIpc(
  assertTrustedSender: (event: IpcMainInvokeEvent) => void,
): void {
  ipcMain.handle('anivexa:request', (event, value: unknown) => {
    assertTrustedSender(event);
    const parsed = parseRequest(value);
    return anivexaRuntime.request(parsed.requestId, parsed.request);
  });
  ipcMain.on('anivexa:cancel', (event, requestId: unknown) => {
    try {
      assertTrustedSender(event);
    } catch {
      return;
    }
    if (typeof requestId === 'string' && REQUEST_ID_PATTERN.test(requestId)) {
      anivexaRuntime.cancel(requestId);
    }
  });
}
