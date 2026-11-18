/* global AbortSignal, URL, fetch, performance, process */

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Buffer } from 'node:buffer';

const FIXTURE_ID = 1535;
const REQUEST_TIMEOUT_MS = 10_000;
const ANIVEXA_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_SMALL_RESPONSE_BYTES = 64 * 1024;
const MAX_IMAGE_RESPONSE_BYTES = 8 * 1024;
const MAX_CONCURRENT_PROBES = 3;

const ANILIST_URL = 'https://graphql.anilist.co';
const ANIZIP_URL = `https://api.ani.zip/mappings?anilist_id=${FIXTURE_ID}`;
const TAIZEN_URL = 'https://taizen.moe/api/graphql';
const TAIZEN_QUERY = `query { animePage(filter: { ids: [${FIXTURE_ID}] }, perPage: 1) { items { id bannerImage clearlogos: artwork(type: CLEARLOGO, limit: 1) { type url lang } hdtvlogos: artwork(type: HDTVLOGO, limit: 1) { type url lang } } } }`;

let tvdbArtworkUrl;
let failureStage = 'source probes';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeTvdbArtworkUrl(value) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol === 'https:' &&
      url.hostname === 'artworks.thetvdb.com' &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith('/banners/episodes/') &&
      !url.search &&
      !url.hash
    )
      return url.toString();
  } catch {
    // AniZip values are untrusted; invalid artwork references are ignored.
  }
  return undefined;
}

async function readBounded(response, maxBytes) {
  if (!response.body) return { bytes: Buffer.alloc(0), tooLarge: false };

  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  let tooLarge = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      if (length + chunk.length > maxBytes) {
        const remaining = maxBytes - length;
        if (remaining > 0) {
          chunks.push(chunk.subarray(0, remaining));
          length += remaining;
        }
        tooLarge = true;
        await reader.cancel();
        break;
      }
      chunks.push(chunk);
      length += chunk.length;
    }
  } finally {
    reader.releaseLock();
  }

  return { bytes: Buffer.concat(chunks, length), tooLarge };
}

async function fetchBounded(
  url,
  options = {},
  maxBytes = MAX_SMALL_RESPONSE_BYTES,
) {
  const startedAt = performance.now();
  const checkedAtUtc = new Date().toISOString();
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...requestOptions } = options;
  try {
    const response = await fetch(url, {
      ...requestOptions,
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const { bytes, tooLarge } = await readBounded(response, maxBytes);
    return {
      httpStatus: response.status,
      contentType: response.headers.get('content-type') ?? '',
      checkedAtUtc,
      latencyMs: Math.round(performance.now() - startedAt),
      body: bytes,
      tooLarge,
    };
  } catch (error) {
    return {
      errorCode: error?.name === 'TimeoutError' ? 'timeout' : 'request_failed',
      checkedAtUtc,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }
}

function reportForFetch(source, result) {
  const common = {
    source,
    checkedAtUtc: result.checkedAtUtc ?? new Date().toISOString(),
    httpStatus: result.httpStatus ?? null,
    latencyMs: result.latencyMs,
  };

  if (result.errorCode)
    return {
      ...common,
      status: 'unavailable',
      evidence: result.errorCode,
    };
  if (result.tooLarge)
    return { ...common, status: 'degraded', evidence: 'response_over_limit' };
  if (result.httpStatus >= 500)
    return { ...common, status: 'unavailable', evidence: 'http_server_error' };
  if (result.httpStatus < 200 || result.httpStatus >= 300)
    return { ...common, status: 'degraded', evidence: 'http_non_success' };

  return { ...common, status: 'healthy', evidence: 'http_success' };
}

async function probeJson(source, url, options, maxBytes, validate, evidence) {
  const result = await fetchBounded(url, options, maxBytes);
  const report = reportForFetch(source, result);
  if (report.status !== 'healthy') return { report };

  let payload;
  try {
    payload = JSON.parse(result.body.toString('utf8'));
  } catch {
    return {
      report: { ...report, status: 'degraded', evidence: 'invalid_json' },
    };
  }

  const isValid = (() => {
    try {
      return validate(payload);
    } catch {
      return false;
    }
  })();
  if (!isValid)
    return {
      report: { ...report, status: 'degraded', evidence: 'contract_mismatch' },
      payload,
    };

  return { report: { ...report, evidence }, payload };
}

async function probeAniList() {
  const query = `query { Media(id: ${FIXTURE_ID}, type: ANIME) { id type isAdult } }`;
  const { report } = await probeJson(
    'AniList catalogue',
    ANILIST_URL,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ query }),
    },
    MAX_SMALL_RESPONSE_BYTES,
    (payload) => {
      const media = payload?.data?.Media;
      return (
        isRecord(payload?.data) &&
        !payload.errors?.length &&
        isRecord(media) &&
        media.id === FIXTURE_ID &&
        media.type === 'ANIME' &&
        media.isAdult === false
      );
    },
    'media_contract_valid',
  );
  return report;
}

async function probeAniZip() {
  const result = await probeJson(
    'AniZip episode enrichment',
    ANIZIP_URL,
    { headers: { accept: 'application/json' } },
    MAX_RESPONSE_BYTES,
    (payload) =>
      isRecord(payload) &&
      isRecord(payload.episodes) &&
      isRecord(payload.mappings) &&
      Object.keys(payload.episodes).length > 0,
    'episode_and_mapping_contract_valid',
  );

  if (result.report.status === 'healthy') {
    const episodes = Object.values(result.payload.episodes);
    tvdbArtworkUrl = episodes
      .map((episode) => safeTvdbArtworkUrl(episode?.image))
      .find(Boolean);
  }
  return result.report;
}

async function probeTaizen() {
  const url = new URL(TAIZEN_URL);
  url.searchParams.set('query', TAIZEN_QUERY);
  const { report } = await probeJson(
    'Taizen.MOE spotlight art',
    url,
    { headers: { accept: 'application/json' } },
    MAX_SMALL_RESPONSE_BYTES,
    (payload) => {
      const items = payload?.data?.animePage?.items;
      return (
        !payload?.errors?.length &&
        isRecord(payload?.data) &&
        Array.isArray(items) &&
        items.every(
          (item) =>
            isRecord(item) &&
            item.id === FIXTURE_ID &&
            (typeof item.bannerImage === 'string' ||
              item.bannerImage === null) &&
            Array.isArray(item.clearlogos) &&
            item.clearlogos.every(
              (logo) =>
                isRecord(logo) &&
                logo.type === 'CLEARLOGO' &&
                typeof logo.url === 'string' &&
                typeof logo.lang === 'string',
            ) &&
            Array.isArray(item.hdtvlogos) &&
            item.hdtvlogos.every(
              (logo) =>
                isRecord(logo) &&
                logo.type === 'HDTVLOGO' &&
                typeof logo.url === 'string' &&
                typeof logo.lang === 'string',
            ),
        )
      );
    },
    'spotlight_banner_and_logo_contract_valid',
  );
  return report;
}

function getAnivexaBase() {
  const value = process.env.VITE_ANIVEXA_API_URL?.trim();
  if (!value) return { error: 'public_base_url_not_configured' };
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return { error: 'public_base_url_invalid' };
    return { base: url.toString().replace(/\/+$/, '') };
  } catch {
    return { error: 'public_base_url_invalid' };
  }
}

function noAnivexaConfig(source, errorCode) {
  return {
    source,
    checkedAtUtc: new Date().toISOString(),
    httpStatus: null,
    latencyMs: 0,
    status: 'not_verifiable',
    evidence: errorCode,
  };
}

async function probeAnivexaRoot(base) {
  if (!base) return noAnivexaConfig('Anivexa API', getAnivexaBase().error);
  const { report } = await probeJson(
    'Anivexa API',
    `${base}/`,
    { headers: { accept: 'application/json' }, timeoutMs: ANIVEXA_TIMEOUT_MS },
    MAX_SMALL_RESPONSE_BYTES,
    (payload) =>
      isRecord(payload) &&
      typeof payload.name === 'string' &&
      payload.name.startsWith('Anivexa API') &&
      Array.isArray(payload.providers) &&
      payload.providers.includes('reanime') &&
      Array.isArray(payload.routes) &&
      payload.routes.some(
        (route) => typeof route === 'string' && route.includes('/episodes/'),
      ),
    'root_route_contract_valid',
  );
  return report;
}

function hasEpisodeArray(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (episode) =>
        isRecord(episode) &&
        (typeof episode.number === 'number' ||
          (typeof episode.number === 'string' && episode.number.length > 0)),
    )
  );
}

async function probeProviderSample(base) {
  if (!base)
    return noAnivexaConfig(
      'ReAnime episode-index sample',
      getAnivexaBase().error,
    );

  const url = `${base}/episodes/reanime/${FIXTURE_ID}?map=false`;
  const result = await probeJson(
    'ReAnime episode-index sample',
    url,
    { headers: { accept: 'application/json' }, timeoutMs: ANIVEXA_TIMEOUT_MS },
    MAX_RESPONSE_BYTES,
    (payload) => isRecord(payload) && isRecord(payload.reanime),
    'filtered_episode_response_valid',
  );

  if (result.report.status !== 'healthy') return result.report;
  const provider = result.payload.reanime;
  if (
    typeof provider.error === 'string' &&
    /^no (?:confirmed reanime match|reanime episodes found)\b/i.test(
      provider.error.trim(),
    )
  )
    return {
      ...result.report,
      status: 'not_verifiable',
      evidence: 'fixture_has_no_provider_episodes',
    };
  if (typeof provider.error === 'string')
    return {
      ...result.report,
      status: 'degraded',
      evidence: 'provider_error_present',
    };

  const sub = provider.episodes?.sub;
  const dub = provider.episodes?.dub;
  if (!hasEpisodeArray(sub) || !hasEpisodeArray(dub))
    return {
      ...result.report,
      status: 'degraded',
      evidence: 'provider_episode_contract_invalid',
    };
  if (sub.length === 0 && dub.length === 0)
    return {
      ...result.report,
      status: 'not_verifiable',
      evidence: 'fixture_has_no_provider_episodes',
    };
  return { ...result.report, evidence: 'filtered_episode_index_nonempty' };
}

async function probeTheTvdbArtwork() {
  if (!tvdbArtworkUrl)
    return {
      source: 'TheTVDB episode artwork',
      checkedAtUtc: new Date().toISOString(),
      httpStatus: null,
      latencyMs: 0,
      status: 'not_verifiable',
      evidence: 'no_safe_artwork_reference_in_sample',
    };

  const result = await fetchBounded(
    tvdbArtworkUrl,
    {
      headers: {
        accept: 'image/avif,image/webp,image/*',
        range: 'bytes=0-0',
      },
    },
    MAX_IMAGE_RESPONSE_BYTES,
  );
  const report = reportForFetch('TheTVDB episode artwork', result);
  if (report.status !== 'healthy') return report;
  if (
    !result.contentType.toLowerCase().startsWith('image/') ||
    result.body.length === 0
  )
    return {
      ...report,
      status: 'degraded',
      evidence: 'image_contract_invalid',
    };
  return { ...report, evidence: 'image_range_response_valid' };
}

async function runLimited(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    async () => {
      while (nextIndex < tasks.length) {
        const index = nextIndex++;
        results[index] = await tasks[index]();
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function markdownSummary(createdAtUtc, reports) {
  const lines = [
    '## Monitor semanal das fontes',
    '',
    `Verificado em **${createdAtUtc}**. Agenda: segunda-feira às 12:00 UTC; ajuste único em .github/workflows/source-health.yml.`,
    '',
    '| Fonte / responsabilidade | Estado | HTTP | Latência | Evidência |',
    '| --- | --- | ---: | ---: | --- |',
  ];

  for (const item of reports) {
    lines.push(
      `| ${item.source} | ${item.status} | ${item.httpStatus ?? '—'} | ${item.latencyMs} ms | ${item.evidence} |`,
    );
  }

  lines.push(
    '',
    'A amostra ReAnime consulta somente o índice filtrado de episódios; não chama `/watch` nem resolve URLs de transmissão. `not_verifiable` indica configuração ausente ou falta de conteúdo no título de amostra, não indisponibilidade do serviço.',
    '',
  );
  return lines.join('\n');
}

async function main() {
  failureStage = 'source probes';
  const configuredBase = getAnivexaBase();
  const base = configuredBase.base;
  const reports = await runLimited(
    [
      probeAniList,
      probeAniZip,
      probeTaizen,
      () => probeAnivexaRoot(base),
      () => probeProviderSample(base),
    ],
    MAX_CONCURRENT_PROBES,
  );
  reports.push(await probeTheTvdbArtwork());

  failureStage = 'report generation';
  const createdAtUtc = new Date().toISOString();
  const outputDirectory = resolve(
    process.env.SOURCE_HEALTH_OUTPUT ||
      join(tmpdir(), 'animonkey-source-health'),
  );
  const jsonPath = join(outputDirectory, 'summary.json');
  const markdownPath = join(outputDirectory, 'summary.md');
  const summary = { schemaVersion: 1, createdAtUtc, sources: reports };
  const markdown = markdownSummary(createdAtUtc, reports);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, markdown, 'utf8');
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, 'utf8');
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, 'report-ready=true\n', 'utf8');

  const failures = reports.filter(
    (item) => item.status === 'degraded' || item.status === 'unavailable',
  );
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  const errorName = typeof error?.name === 'string' ? error.name : 'Error';
  process.stderr.write(
    `Source health monitor failed during ${failureStage} (${errorName}).\n`,
  );
  process.exitCode = 1;
});
