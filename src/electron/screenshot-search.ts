import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import type {
  ScreenshotImageType,
  ScreenshotSearchInput,
  ScreenshotSearchMatch,
} from '../types/screenshot-search';

const TRACE_MOE_SEARCH_URL = 'https://api.trace.moe/search';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const SEARCH_TIMEOUT_MS = 20_000;
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_TYPES: ScreenshotImageType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const activeSearches = new Map<string, AbortController>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasImageSignature(
  contentType: ScreenshotImageType,
  bytes: Uint8Array,
): boolean {
  if (contentType === 'image/png')
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  if (contentType === 'image/jpeg')
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  );
}

function parseInput(value: unknown): ScreenshotSearchInput {
  if (!isRecord(value)) throw new Error('Selecione uma imagem válida.');
  const contentType = value.contentType;
  const bytes = value.bytes;
  if (
    typeof contentType !== 'string' ||
    !IMAGE_TYPES.includes(contentType as ScreenshotImageType) ||
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_IMAGE_BYTES ||
    !hasImageSignature(contentType as ScreenshotImageType, bytes)
  ) {
    throw new Error('Use uma imagem PNG, JPG ou WebP válida de até 10 MB.');
  }
  return { contentType: contentType as ScreenshotImageType, bytes };
}

function parseRequestId(value: unknown): string {
  if (typeof value !== 'string' || !REQUEST_ID_PATTERN.test(value))
    throw new Error('Identificador da busca inválido.');
  return value;
}

function parseEpisode(value: unknown): string | null {
  if (typeof value === 'number')
    return Number.isFinite(value) && value >= 0 ? String(value) : null;
  if (typeof value === 'string')
    return value.length <= 48 ? value.trim() || null : null;
  if (Array.isArray(value) && value.length > 0 && value.length <= 4) {
    const parts = value.map(parseEpisode);
    return parts.every((part) => part !== null) ? parts.join('–') : null;
  }
  return null;
}

function parseMatch(value: unknown): ScreenshotSearchMatch | null {
  if (!isRecord(value) || !isRecord(value.anilist)) return null;
  const id = value.anilist.id;
  const startTime = value.from;
  const endTime = value.to;
  const similarity = value.similarity;
  if (
    typeof id !== 'number' ||
    !Number.isSafeInteger(id) ||
    id < 1 ||
    typeof startTime !== 'number' ||
    !Number.isFinite(startTime) ||
    startTime < 0 ||
    typeof endTime !== 'number' ||
    !Number.isFinite(endTime) ||
    endTime < startTime ||
    typeof similarity !== 'number' ||
    !Number.isFinite(similarity) ||
    similarity < 0 ||
    similarity > 1
  )
    return null;
  return {
    animeId: String(id),
    episode: parseEpisode(value.episode),
    startTime,
    endTime,
    similarity,
  };
}

async function readJsonWithLimit(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader)
    throw new Error('O serviço de busca retornou uma resposta vazia.');

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('A resposta do serviço de busca excedeu o limite.');
    }
    chunks.push(value);
  }

  const body = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error('O serviço de busca retornou dados inválidos.');
  }
}

function getHttpError(status: number): Error {
  if (status === 400)
    return new Error('O trace.moe não conseguiu reconhecer esta imagem.');
  if (status === 402)
    return new Error(
      'O serviço de busca está ocupado ou sem cota disponível. Tente novamente em instantes.',
    );
  if (status === 429)
    return new Error(
      'O limite de buscas foi atingido. Aguarde um pouco e tente novamente.',
    );
  if (status === 503)
    return new Error('O serviço de busca está temporariamente indisponível.');
  return new Error('Não foi possível buscar esta imagem agora.');
}

async function searchTraceMoe(
  input: ScreenshotSearchInput,
  signal: AbortSignal,
): Promise<ScreenshotSearchMatch[]> {
  const url = new URL(TRACE_MOE_SEARCH_URL);
  url.searchParams.set('anilistInfo', '');
  const image = new Blob([Buffer.from(input.bytes)], {
    type: input.contentType,
  });
  const body = new FormData();
  const filename =
    input.contentType === 'image/jpeg'
      ? 'screenshot.jpg'
      : input.contentType === 'image/png'
        ? 'screenshot.png'
        : 'screenshot.webp';
  body.append('image', image, filename);

  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body,
    redirect: 'error',
    signal,
  });
  if (!response.ok) throw getHttpError(response.status);

  const payload = await readJsonWithLimit(response);
  if (!isRecord(payload) || !Array.isArray(payload.result))
    throw new Error('O serviço de busca retornou dados inválidos.');

  const bestMatchByAnime = new Map<string, ScreenshotSearchMatch>();
  for (const rawMatch of payload.result) {
    const match = parseMatch(rawMatch);
    if (!match) continue;
    const previous = bestMatchByAnime.get(match.animeId);
    if (!previous || match.similarity > previous.similarity)
      bestMatchByAnime.set(match.animeId, match);
  }
  return [...bestMatchByAnime.values()]
    .sort((first, second) => second.similarity - first.similarity)
    .slice(0, 10);
}

export function registerScreenshotSearchIpc(
  assertTrustedSender: (event: IpcMainInvokeEvent | IpcMainEvent) => void,
): void {
  ipcMain.handle(
    'screenshot-search:search',
    async (event, value: unknown, requestIdValue: unknown) => {
      assertTrustedSender(event);
      const requestId = parseRequestId(requestIdValue);
      const input = parseInput(value);
      if (activeSearches.size > 0)
        throw new Error('Outra busca por imagem já está em andamento.');
      const controller = new AbortController();
      activeSearches.set(requestId, controller);
      const timeoutSignal = AbortSignal.timeout(SEARCH_TIMEOUT_MS);
      const signal = AbortSignal.any([controller.signal, timeoutSignal]);
      try {
        return await searchTraceMoe(input, signal);
      } catch (error) {
        if (controller.signal.aborted)
          throw new Error('Busca cancelada.', { cause: error });
        if (timeoutSignal.aborted)
          throw new Error('A busca excedeu o tempo limite. Tente novamente.', {
            cause: error,
          });
        if (error instanceof TypeError)
          throw new Error(
            'Não foi possível conectar ao serviço de busca. Verifique sua conexão e tente novamente.',
            { cause: error },
          );
        throw error;
      } finally {
        if (activeSearches.get(requestId) === controller)
          activeSearches.delete(requestId);
      }
    },
  );

  ipcMain.on('screenshot-search:cancel', (event, value: unknown) => {
    try {
      assertTrustedSender(event);
    } catch {
      return;
    }
    if (typeof value !== 'string' || !REQUEST_ID_PATTERN.test(value)) return;
    activeSearches.get(value)?.abort();
  });
}
