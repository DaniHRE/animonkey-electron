import { net, protocol } from 'electron';
import { lookup } from 'node:dns/promises';

const SCHEME = 'animonkey-media';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function isPrivateAddress(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '::1' ||
    host === '::' ||
    host.startsWith('::ffff:') ||
    /^f[cd][0-9a-f]{2}:/i.test(host) ||
    /^fe[89ab][0-9a-f]:/i.test(host) ||
    host.startsWith('ff')
  ) {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(Number);
  if (octets.some((part) => part > 255)) return true;
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function parseHttpsUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    isPrivateAddress(url.hostname)
  ) {
    throw new Error('URL de mídia não permitida.');
  }
  return url;
}

async function assertPublicHost(url: URL): Promise<void> {
  if (isPrivateAddress(url.hostname))
    throw new Error('Host de mídia não permitido.');
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new Error('Host de mídia não permitido.');
  }
}

function proxyUrl(
  target: string,
  referer: string | null,
  playlistKey: string | null,
  authorization: string | null,
): string {
  const url = new URL(`${SCHEME}://proxy/`);
  url.searchParams.set('url', target);
  if (referer) url.searchParams.set('referer', referer);
  if (playlistKey && /\.m3u8?(?:$|\?)/i.test(target)) {
    url.searchParams.set('playlistKey', playlistKey);
  }
  if (authorization) url.searchParams.set('authorization', authorization);
  return url.href;
}

function rewriteM3u8(
  content: string,
  sourceUrl: string,
  referer: string | null,
  playlistKey: string | null,
  authorization: string | null,
): string {
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || (trimmed.startsWith('#') && !trimmed.includes('URI='))) {
        return line;
      }
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          const absolute = parseHttpsUrl(new URL(uri, sourceUrl).href).href;
          return `URI="${proxyUrl(absolute, referer, playlistKey, authorization)}"`;
        });
      }
      const absolute = parseHttpsUrl(new URL(trimmed, sourceUrl).href).href;
      return proxyUrl(absolute, referer, playlistKey, authorization);
    })
    .join('\n');
}

function rewriteDash(content: string, sourceUrl: string): string {
  const base = new URL('.', sourceUrl).href;
  if (/<BaseURL\s*\/\s*>/i.test(content)) {
    return content.replace(/<BaseURL\s*\/\s*>/i, `<BaseURL>${base}</BaseURL>`);
  }
  if (/<BaseURL\b/i.test(content)) {
    return content.replace(
      /(<BaseURL\b[^>]*>)([^<]+)(<\/BaseURL>)/gi,
      (_match, open: string, value: string, close: string) => {
        try {
          return `${open}${new URL(value.trim(), sourceUrl).href}${close}`;
        } catch {
          return `${open}${value}${close}`;
        }
      },
    );
  }
  return content.replace(/(<MPD\b[^>]*>)/i, `$1<BaseURL>${base}</BaseURL>`);
}

function rewriteVtt(
  content: string,
  sourceUrl: string,
  referer: string | null,
  authorization: string | null,
): string {
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (
        !trimmed ||
        /^(WEBVTT|NOTE|STYLE|REGION)/.test(trimmed) ||
        trimmed.includes('-->')
      )
        return line;
      const hashIndex = trimmed.indexOf('#');
      const rawUrl = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
      const fragment = hashIndex === -1 ? '' : trimmed.slice(hashIndex);
      if (
        !/^https?:\/\//i.test(rawUrl) &&
        !/\.(?:jpe?g|png|webp|gif|avif)$/i.test(rawUrl)
      )
        return line;
      try {
        const absolute = parseHttpsUrl(new URL(rawUrl, sourceUrl).href).href;
        return `${proxyUrl(absolute, referer, null, authorization)}${fragment}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

function decryptFlixManifest(
  body: ArrayBuffer,
  playlistKey: string | null,
): string {
  const raw = new TextDecoder()
    .decode(body)
    .replace(/^\uFEFF/, '')
    .trim();
  if (raw.startsWith('#EXTM3U')) return raw;
  if (!playlistKey) throw new Error('Manifest HLS sem chave de playlist.');
  const key = Uint8Array.from(atob(playlistKey), (character) =>
    character.charCodeAt(0),
  );
  const payload = Uint8Array.from(atob(raw), (character) =>
    character.charCodeAt(0),
  );
  if (!key.length || !payload.length) throw new Error('Manifest HLS inválido.');
  const decoded = payload.map((byte, index) => byte ^ key[index % key.length]);
  const manifest = new TextDecoder()
    .decode(decoded)
    .replace(/^\uFEFF/, '')
    .trim();
  if (!manifest.startsWith('#EXTM3U'))
    throw new Error('Falha ao decodificar manifest HLS.');
  return manifest;
}

function corsHeaders(headers: HeadersInit = {}): Headers {
  const result = new Headers(headers);
  result.set('Access-Control-Allow-Origin', '*');
  result.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  result.set('Access-Control-Allow-Headers', 'Authorization, Range');
  result.set(
    'Access-Control-Expose-Headers',
    'Accept-Ranges, Content-Length, Content-Range',
  );
  return result;
}

async function fetchUpstream(
  source: URL,
  headers: Headers,
  method: string,
): Promise<Response> {
  let target = source;
  const originalOrigin = source.origin;
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    await assertPublicHost(target);
    if (target.origin !== originalOrigin) headers.delete('Authorization');
    const response = await net.fetch(target.href, {
      method,
      headers,
      redirect: 'manual',
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location || redirects === 5) return response;
    await response.body?.cancel();
    target = parseHttpsUrl(new URL(location, target).href);
  }
  throw new Error('Limite de redirecionamentos excedido.');
}

async function readLimitedBytes(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error('Manifest de mídia excede o limite permitido.');
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('Manifest de mídia excede o limite permitido.');
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function unwrapFlixSegment(body: Uint8Array): Uint8Array | null {
  const isWebp =
    body.length > 12 &&
    body[0] === 0x52 &&
    body[1] === 0x49 &&
    body[2] === 0x46 &&
    body[3] === 0x46 &&
    body[8] === 0x57 &&
    body[9] === 0x45 &&
    body[10] === 0x42 &&
    body[11] === 0x50;
  const isPng =
    body.length > 8 &&
    body[0] === 0x89 &&
    body[1] === 0x50 &&
    body[2] === 0x4e &&
    body[3] === 0x47 &&
    body[4] === 0x0d &&
    body[5] === 0x0a &&
    body[6] === 0x1a &&
    body[7] === 0x0a;
  if (!isWebp && !isPng) return null;
  const offset = isWebp ? 12 : 8;
  const xorKey = [
    157, 42, 241, 71, 179, 142, 92, 112, 166, 25, 228, 59, 216, 98, 15, 197,
  ];
  const output = body.slice(offset);
  if (output[0] !== 0x47) {
    for (let index = 0; index < output.length; index += 1) {
      output[index] ^= xorKey[index % xorKey.length];
    }
  }
  // FlixCloud segments decode to MPEG-TS. Avoid serving arbitrary images as
  // video if a provider reuses the same filename pattern for another asset.
  if (
    output.length < 3 * 188 ||
    output[0] !== 0x47 ||
    output[188] !== 0x47 ||
    output[376] !== 0x47
  ) {
    return null;
  }
  return output;
}

export function installMediaProxy(): void {
  protocol.handle(SCHEME, async (request) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: corsHeaders() });
    }
    try {
      const requestUrl = new URL(request.url);
      if (requestUrl.hostname !== 'proxy') {
        return new Response(null, { status: 404, headers: corsHeaders() });
      }
      const targetValue = requestUrl.searchParams.get('url');
      if (!targetValue || targetValue.length > 8192) {
        return new Response(null, { status: 400, headers: corsHeaders() });
      }
      const target = parseHttpsUrl(targetValue);
      const refererValue = requestUrl.searchParams.get('referer');
      const referer = refererValue ? parseHttpsUrl(refererValue).href : null;
      const playlistKey = requestUrl.searchParams.get('playlistKey');
      const authorization =
        request.headers.get('authorization') ??
        requestUrl.searchParams.get('authorization');
      const headers = new Headers({ 'User-Agent': USER_AGENT });
      if (referer) {
        headers.set('Referer', referer);
        headers.set('Origin', new URL(referer).origin);
      }
      if (authorization) headers.set('Authorization', authorization);
      const range = request.headers.get('range');
      if (range) headers.set('Range', range);

      const upstream = await fetchUpstream(target, headers, request.method);
      const contentType = upstream.headers.get('content-type') ?? '';
      const lowerPath = target.pathname.toLowerCase();
      const isHls =
        /mpegurl|vnd\.apple\.mpegurl/i.test(contentType) ||
        /\.m3u8?$/.test(lowerPath);
      const isDash =
        /dash\+xml/i.test(contentType) || lowerPath.endsWith('.mpd');
      if ((isHls || isDash) && !upstream.ok) {
        await upstream.body?.cancel();
        return new Response(null, {
          status: upstream.status,
          headers: corsHeaders(),
        });
      }
      if (isDash && request.method === 'GET') {
        const bytes = await readLimitedBytes(upstream, 20 * 1024 * 1024);
        const manifest = rewriteDash(
          new TextDecoder().decode(bytes),
          target.href,
        );
        return new Response(manifest, {
          status: upstream.status,
          headers: corsHeaders({
            'Content-Type': 'application/dash+xml',
            'Cache-Control': 'no-store',
          }),
        });
      }
      if (isHls && request.method === 'GET') {
        try {
          const bytes = await readLimitedBytes(upstream, 20 * 1024 * 1024);
          const buffer = new ArrayBuffer(bytes.byteLength);
          new Uint8Array(buffer).set(bytes);
          const manifest = decryptFlixManifest(buffer, playlistKey);
          return new Response(
            rewriteM3u8(
              manifest,
              target.href,
              referer,
              playlistKey,
              authorization,
            ),
            {
              status: upstream.status,
              headers: corsHeaders({
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Cache-Control': 'no-store',
              }),
            },
          );
        } catch {
          return new Response(null, { status: 502, headers: corsHeaders() });
        }
      }
      if (
        (contentType.includes('text/vtt') || lowerPath.endsWith('.vtt')) &&
        request.method === 'GET'
      ) {
        const text = rewriteVtt(
          new TextDecoder().decode(
            await readLimitedBytes(upstream, 20 * 1024 * 1024),
          ),
          target.href,
          referer,
          authorization,
        );
        return new Response(text, {
          status: upstream.status,
          headers: corsHeaders({
            'Content-Type': 'text/vtt',
            'Cache-Control': 'public, max-age=3600',
          }),
        });
      }
      if (
        /\/seg-[^/]+\.(?:png|webp)$/i.test(target.pathname) &&
        request.method === 'GET'
      ) {
        const unwrapped = unwrapFlixSegment(
          new Uint8Array(await upstream.arrayBuffer()),
        );
        if (unwrapped) {
          const segmentBuffer = new ArrayBuffer(unwrapped.byteLength);
          new Uint8Array(segmentBuffer).set(unwrapped);
          return new Response(segmentBuffer, {
            status: 200,
            headers: corsHeaders({
              'Content-Type': 'video/mp2t',
              'Cache-Control': 'public, max-age=3600',
            }),
          });
        }
      }
      const passthroughHeaders = new Headers();
      for (const name of [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
        'last-modified',
        'etag',
      ]) {
        const value = upstream.headers.get(name);
        if (value) passthroughHeaders.set(name, value);
      }
      return new Response(request.method === 'HEAD' ? null : upstream.body, {
        status: upstream.status,
        headers: corsHeaders(passthroughHeaders),
      });
    } catch {
      return new Response(null, { status: 502, headers: corsHeaders() });
    }
  });
}
