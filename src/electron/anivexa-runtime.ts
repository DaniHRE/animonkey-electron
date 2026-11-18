import {
  BrowserWindow,
  app,
  ipcMain,
  utilityProcess,
  type IpcMainInvokeEvent,
  type UtilityProcess,
} from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type {
  AnivexaDiagnosticEntry,
  AnivexaDiagnosticLevel,
  AnivexaDiagnosticsSnapshot,
  AnivexaDesktopRequest,
  AnivexaDesktopResponse,
  AnivexaRuntimeStatus,
} from '@/types/anivexa';

const STARTUP_TIMEOUT_MS = 15_000;
const MAX_PENDING_REQUESTS = 24;
const MAX_DIAGNOSTIC_ENTRIES = 100;
const REQUEST_ID_PATTERN = /^[0-9a-f-]{36}$/i;

interface PendingRequest {
  resolve: (response: AnivexaDesktopResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  summary: string;
  startedAt: number;
}

interface WorkerMessage {
  type: 'ready' | 'startup-error' | 'response' | 'diagnostic';
  requestId?: string;
  status?: number;
  body?: string;
  code?: string;
  level?: string;
  message?: string;
}

function sanitizeDiagnosticText(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127 ? ' ' : character;
  })
    .join('')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[URL]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(
      /((?:authorization|cookie|set-cookie|token|api[_-]?key|secret|password)\s*["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi,
      '$1[redacted]',
    )
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 300);
}

function summarizeRequest(request: AnivexaDesktopRequest): string {
  if (request.kind === 'episodes') {
    return `GET /episodes/${request.animeId}`;
  }
  return `GET /watch/${request.provider}/${request.animeId}/${request.audio}/${request.episodeId}`;
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
  private runtimeStatus: AnivexaRuntimeStatus = 'stopped';
  private diagnosticRevision = 0;
  private nextDiagnosticId = 1;
  private diagnosticEntries: AnivexaDiagnosticEntry[] = [];

  getDiagnostics(): AnivexaDiagnosticsSnapshot {
    return {
      revision: this.diagnosticRevision,
      status: this.runtimeStatus,
      entries: [...this.diagnosticEntries],
    };
  }

  clearDiagnostics(): AnivexaDiagnosticsSnapshot {
    this.diagnosticEntries = [];
    this.diagnosticRevision += 1;
    this.broadcastDiagnostics();
    return this.getDiagnostics();
  }

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
    const summary = summarizeRequest(request);
    this.recordDiagnostic('info', `${summary} iniciado.`);
    const timeoutMs = request.kind === 'episodes' ? 120_000 : 25_000;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cancel(requestId, new Error('Anivexa request timed out.'));
      }, timeoutMs);
      this.pending.set(requestId, {
        resolve,
        reject,
        timeout,
        summary,
        startedAt: Date.now(),
      });
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
        summary: 'Verificação local do runtime',
        startedAt: Date.now(),
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
    this.setRuntimeStatus('stopped');
    this.rejectPending(new Error('Anivexa runtime stopped.'));
  }

  private ensureStarted(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    if (!app.isReady())
      return Promise.reject(new Error('Electron is not ready.'));

    this.setRuntimeStatus('starting');
    this.recordDiagnostic('info', 'Iniciando o processo local da Anivexa.');
    this.startPromise = new Promise<void>((resolve, reject) => {
      this.resolveStart = resolve;
      this.rejectStart = reject;
      this.startTimeout = setTimeout(() => {
        this.failStart(
          'O runtime da Anivexa excedeu o tempo de inicialização.',
        );
      }, STARTUP_TIMEOUT_MS);

      const root = apiRoot();
      const workerPath = path.join(root, 'utility-worker.cjs');
      try {
        const child = utilityProcess.fork(workerPath, [], {
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
        this.child = child;
        child.on('message', (message) => this.onWorkerMessage(message, child));
        child.on('exit', () => this.onWorkerExit(child));
      } catch {
        this.failStart('Não foi possível iniciar o processo local da Anivexa.');
      }
    });
    return this.startPromise;
  }

  private onWorkerMessage(value: unknown, child: UtilityProcess): void {
    if (child !== this.child) return;
    if (!value || typeof value !== 'object') return;
    const message = value as WorkerMessage;
    if (message.type === 'ready') {
      this.ready = true;
      this.setRuntimeStatus('ready');
      this.recordDiagnostic('info', 'Runtime local da Anivexa pronto.');
      if (this.startTimeout) clearTimeout(this.startTimeout);
      this.startTimeout = null;
      this.resolveStart?.();
      this.resolveStart = null;
      this.rejectStart = null;
      return;
    }
    if (message.type === 'startup-error') {
      const code =
        typeof message.code === 'string' &&
        /^[a-z0-9_-]{1,40}$/i.test(message.code)
          ? ' (' + message.code + ')'
          : '';
      this.failStart('Falha ao carregar o runtime da Anivexa' + code + '.');
      return;
    }
    if (
      message.type === 'diagnostic' &&
      message.level === 'error' &&
      typeof message.message === 'string'
    ) {
      this.recordDiagnostic('error', message.message);
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

  private onWorkerExit(child: UtilityProcess): void {
    if (child !== this.child) return;
    const exitedDuringStartup = !this.ready;
    this.child = null;
    this.ready = false;
    this.startPromise = null;
    if (exitedDuringStartup && this.runtimeStatus !== 'error') {
      this.failStart('O runtime da Anivexa encerrou durante a inicialização.');
    } else if (!exitedDuringStartup) {
      this.setRuntimeStatus('error');
      this.recordDiagnostic(
        'error',
        'O processo local da Anivexa encerrou inesperadamente.',
      );
      this.rejectPending(new Error('Anivexa runtime stopped unexpectedly.'));
    }
  }

  private failStart(message: string): void {
    const error = new Error(message);
    const child = this.child;
    this.child = null;
    if (this.startTimeout) clearTimeout(this.startTimeout);
    this.startTimeout = null;
    this.rejectStart?.(error);
    this.resolveStart = null;
    this.rejectStart = null;
    this.startPromise = null;
    this.ready = false;
    this.setRuntimeStatus('error');
    this.recordDiagnostic('error', message);
    child?.kill();
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
    const durationMs = Date.now() - pending.startedAt;
    if (error) {
      if (error.message === 'Anivexa request timed out.') {
        this.recordDiagnostic(
          'error',
          `${pending.summary} excedeu o tempo limite após ${durationMs} ms.`,
        );
      } else if (
        error.message !== 'Anivexa request cancelled.' &&
        error.message !== 'Anivexa runtime stopped.'
      ) {
        this.recordDiagnostic(
          'error',
          `${pending.summary} falhou antes de receber uma resposta.`,
        );
      }
      pending.reject(error);
    } else if (response) {
      const level: AnivexaDiagnosticLevel =
        response.status >= 500
          ? 'error'
          : response.status >= 400
            ? 'warning'
            : 'info';
      this.recordDiagnostic(
        level,
        `${pending.summary} respondeu HTTP ${response.status} em ${durationMs} ms (${Buffer.byteLength(response.body, 'utf8')} bytes).`,
      );
      pending.resolve(response);
    } else pending.reject(new Error('Anivexa returned an invalid response.'));
  }

  private setRuntimeStatus(status: AnivexaRuntimeStatus): void {
    if (this.runtimeStatus === status) return;
    this.runtimeStatus = status;
    this.diagnosticRevision += 1;
    this.broadcastDiagnostics();
  }

  private recordDiagnostic(
    level: AnivexaDiagnosticLevel,
    message: string,
  ): void {
    this.diagnosticEntries = [
      ...this.diagnosticEntries.slice(-(MAX_DIAGNOSTIC_ENTRIES - 1)),
      {
        id: this.nextDiagnosticId++,
        timestamp: Date.now(),
        level,
        message: sanitizeDiagnosticText(message),
      },
    ];
    this.diagnosticRevision += 1;
    this.broadcastDiagnostics();
  }

  private broadcastDiagnostics(): void {
    const snapshot = this.getDiagnostics();
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed() || window.webContents.isDestroyed()) continue;
      window.webContents.send('anivexa:diagnostics:updated', snapshot);
    }
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
  ipcMain.handle('anivexa:diagnostics:get', (event) => {
    assertTrustedSender(event);
    return anivexaRuntime.getDiagnostics();
  });
  ipcMain.handle('anivexa:diagnostics:clear', (event) => {
    assertTrustedSender(event);
    return anivexaRuntime.clearDiagnostics();
  });
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
