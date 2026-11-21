const path = require('node:path');
const { pathToFileURL } = require('node:url');
const parentPort = process.parentPort;

const API_VERSION = '2.3';
const controllers = new Map();
let api;

function isAllowedRoute(route) {
  return (
    route === '/' ||
    /^\/episodes\/\d+$/.test(route) ||
    /^\/watch\/[a-z0-9_-]+\/\d+\/(?:sub|dub)\/[a-z0-9_-]+$/i.test(route)
  );
}

function send(message) {
  parentPort?.postMessage(message);
}

function sanitizeDiagnosticText(value) {
  return Array.from(String(value), (character) => {
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
    .slice(0, 220);
}

function captureApiError(args) {
  const prefix = typeof args[0] === 'string' ? args[0] : '';
  const match = /^\[(ep|bg):([a-z0-9_-]{1,48})\]$/i.exec(prefix);
  if (!match) return;

  const detail =
    typeof args[1] === 'string'
      ? args[1]
      : args[1] && typeof args[1].message === 'string'
        ? args[1].message
        : '';
  const safeDetail = sanitizeDiagnosticText(detail);
  send({
    type: 'diagnostic',
    level: 'error',
    message:
      `Anivexa ${match[1].toLowerCase()} ${match[2]}` +
      (safeDetail ? ': ' + safeDetail : ' reportou uma falha.'),
  });
}

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  captureApiError(args);
  originalConsoleError('[Anivexa runtime] Error details suppressed.');
};

async function loadApi() {
  const root = process.env.ANIVEXA_API_ROOT;
  if (!root) throw new Error('Anivexa runtime path is missing.');
  const moduleUrl = pathToFileURL(path.join(root, 'index.js')).href;
  const imported = await import(moduleUrl);
  if (typeof imported.default?.fetch !== 'function') {
    throw new Error('Anivexa API handler is unavailable.');
  }
  api = imported.default;
  send({ type: 'ready' });
}

async function handleRequest(message) {
  const { requestId, route } = message;
  if (
    typeof requestId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(requestId) ||
    typeof route !== 'string' ||
    !isAllowedRoute(route)
  ) {
    send({ type: 'response', requestId, status: 400, body: '' });
    return;
  }

  const controller = new AbortController();
  controllers.set(requestId, controller);
  try {
    const request = new Request('http://anivexa.internal' + route, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const response = await api.fetch(request, { API_VERSION });
    const body = await response.text();
    send({ type: 'response', requestId, status: response.status, body });
  } catch {
    if (!controller.signal.aborted) {
      send({
        type: 'response',
        requestId,
        status: 500,
        body: '{"error":"Anivexa request failed."}',
      });
    }
  } finally {
    controllers.delete(requestId);
  }
}

async function smokeDependencies(requestId) {
  let stage = 'handler';
  try {
    const health = await api.fetch(new Request('http://anivexa.internal/'), {
      API_VERSION,
    });
    if (!health.ok) throw new Error('Anivexa handler health check failed.');
    stage = 'wreq-js';
    const { createSession } = await import('wreq-js');
    const session = await createSession({
      browser: 'chrome_149',
      os: 'windows',
    });
    await session.close();
    send({ type: 'response', requestId, status: 200, body: '{"ok":true}' });
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : error?.name;
    send({
      type: 'response',
      requestId,
      status: 500,
      body: JSON.stringify({ stage, code: code ?? 'Error' }),
    });
  }
}

if (!parentPort) {
  process.exit(1);
} else {
  parentPort.on('message', (event) => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'cancel' && typeof message.requestId === 'string') {
      controllers.get(message.requestId)?.abort();
      return;
    }
    if (message.type === 'request') {
      void handleRequest(message);
      return;
    }
    if (message.type === 'smoke' && typeof message.requestId === 'string') {
      void smokeDependencies(message.requestId);
    }
  });

  void loadApi().catch((error) => {
    send({
      type: 'startup-error',
      code: typeof error?.code === 'string' ? error.code : error?.name,
    });
    process.exit(1);
  });
}
