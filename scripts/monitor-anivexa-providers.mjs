import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

const REPOSITORY_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ANIVEXA_ROOT = join(REPOSITORY_ROOT, 'vendor', 'anivexa-api');
const SAMPLE_MATRIX = Object.freeze({
  anihq: [16498],
  reanime: [16498],
  anikoto: [16498],
  animegg: [16498],
  animenosub: [199547],
  anizone: [199547],
  aniwaves: [16498],
  pahenime: [101922],
  kaa: [21],
  animedunya: [16498],
  animeonsen: [16498],
  anipm: [178788],
});
const PROBE_CONCURRENCY = 2;
const PROBE_TIMEOUT_MS = 90_000;
const SUPABASE_TIMEOUT_MS = 20_000;
const API_VERSION = '2.3';

const mode = process.argv[2];
const supabaseProjectUrlValue = process.env.SUPABASE_PROJECT_URL?.trim() ?? '';
const supabaseSecretApiKey = process.env.SUPABASE_SECRET_API_KEY?.trim() ?? '';

// Keep the Supabase credential out of the embedded Anivexa runtime environment.
delete process.env.SUPABASE_PROJECT_URL;
delete process.env.SUPABASE_SECRET_API_KEY;

function fail(message) {
  process.stderr.write(message + '\n');
  process.exitCode = 1;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSampleNoMatch(errorMessage) {
  return /match not found|no episodes? (?:found|available)|no mal id found/i.test(
    errorMessage,
  );
}

function countEpisodes(episodes) {
  if (!isRecord(episodes)) return null;
  let count = 0;
  for (const list of Object.values(episodes)) {
    if (!Array.isArray(list)) return null;
    count += list.length;
  }
  return count;
}

function summarizeProvider(provider, sampleResults) {
  const successfulSampleCount = sampleResults.filter(
    (sample) => sample.kind === 'success',
  ).length;
  const technicalFailureCount = sampleResults.filter(
    (sample) => sample.kind === 'technical_failure',
  ).length;
  const noMatchCount = sampleResults.filter(
    (sample) => sample.kind === 'no_match',
  ).length;
  const episodesReturned = sampleResults.reduce(
    (total, sample) => total + sample.episodesReturned,
    0,
  );
  const averageResponseTimeMs = Math.round(
    sampleResults.reduce((total, sample) => total + sample.responseTimeMs, 0) /
      sampleResults.length,
  );

  let status = 'indeterminate';
  if (successfulSampleCount > 0 && technicalFailureCount > 0) {
    status = 'degraded';
  } else if (successfulSampleCount > 0) {
    status = 'healthy';
  } else if (technicalFailureCount > 0) {
    status = 'unavailable';
  }

  const summary =
    status +
    ': ' +
    successfulSampleCount +
    '/' +
    sampleResults.length +
    ' samples returned episodes; ' +
    technicalFailureCount +
    ' technical failures, ' +
    noMatchCount +
    ' no-match; ' +
    episodesReturned +
    ' episodes; ' +
    averageResponseTimeMs +
    ' ms average.';

  const checkedAt = new Date().toISOString();
  return {
    provider,
    status,
    sample_count: sampleResults.length,
    successful_sample_count: successfulSampleCount,
    technical_failure_count: technicalFailureCount,
    no_match_count: noMatchCount,
    episodes_returned: episodesReturned,
    average_response_time_ms: averageResponseTimeMs,
    summary,
    checked_at: checkedAt,
    updated_at: checkedAt,
  };
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runWorker),
  );
  return results;
}

async function validateProviderMatrix() {
  const source = await readFile(join(ANIVEXA_ROOT, 'index.js'), 'utf8');
  const match = source.match(/providers:\s*\[([\s\S]*?)\],\s*routes:/);
  if (!match) {
    throw new Error(
      'The provider manifest in the pinned Anivexa API could not be read.',
    );
  }

  const registeredProviders = Array.from(
    match[1].matchAll(/['"]([a-z0-9-]+)['"]/g),
    (entry) => entry[1],
  ).sort();
  const monitoredProviders = Object.keys(SAMPLE_MATRIX).sort();
  if (
    registeredProviders.length !== monitoredProviders.length ||
    registeredProviders.some(
      (provider, index) => provider !== monitoredProviders[index],
    )
  ) {
    throw new Error(
      'The provider sample matrix does not match the pinned Anivexa provider manifest.',
    );
  }
}

async function loadAnivexaApi() {
  const moduleUrl = pathToFileURL(join(ANIVEXA_ROOT, 'index.js')).href;
  return import(moduleUrl);
}

async function probeSample(api, provider, sampleId) {
  const startedAt = performance.now();
  let timeoutId;

  try {
    const request = new Request(
      'http://anivexa.local/episodes/' +
        provider +
        '/' +
        sampleId +
        '?map=false',
      { method: 'GET' },
    );
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('probe-timeout')),
        PROBE_TIMEOUT_MS,
      );
    });
    const response = await Promise.race([
      api.default.fetch(request, { API_VERSION }),
      timeout,
    ]);
    if (!response.ok) {
      return {
        kind: 'technical_failure',
        episodesReturned: 0,
        responseTimeMs: Math.round(performance.now() - startedAt),
      };
    }

    const payload = await response.json();
    const providerResult = isRecord(payload) ? payload[provider] : null;
    if (!isRecord(providerResult)) {
      return {
        kind: 'technical_failure',
        episodesReturned: 0,
        responseTimeMs: Math.round(performance.now() - startedAt),
      };
    }

    if (typeof providerResult.error === 'string') {
      return {
        kind: isSampleNoMatch(providerResult.error)
          ? 'no_match'
          : 'technical_failure',
        episodesReturned: 0,
        responseTimeMs: Math.round(performance.now() - startedAt),
      };
    }

    const episodeCount = countEpisodes(providerResult.episodes);
    if (episodeCount === null) {
      return {
        kind: 'technical_failure',
        episodesReturned: 0,
        responseTimeMs: Math.round(performance.now() - startedAt),
      };
    }

    return {
      kind: episodeCount > 0 ? 'success' : 'no_match',
      episodesReturned: episodeCount,
      responseTimeMs: Math.round(performance.now() - startedAt),
    };
  } catch {
    return {
      kind: 'technical_failure',
      episodesReturned: 0,
      responseTimeMs: Math.round(performance.now() - startedAt),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function collectProviderHealth() {
  await validateProviderMatrix();
  // The pinned runtime may log raw provider errors, sample IDs, or source URLs.
  console.error = () => {};
  console.log = () => {};
  console.warn = () => {};
  const api = await loadAnivexaApi();
  const providers = Object.entries(SAMPLE_MATRIX);
  return mapWithConcurrency(
    providers,
    PROBE_CONCURRENCY,
    async ([provider, sampleIds]) => {
      const sampleResults = await mapWithConcurrency(sampleIds, 1, (sampleId) =>
        probeSample(api, provider, sampleId),
      );
      return summarizeProvider(provider, sampleResults);
    },
  );
}

function formatTable(rows) {
  const columns = [
    ['provider', 'Provider'],
    ['status', 'Status'],
    ['successful_sample_count', 'Samples OK'],
    ['technical_failure_count', 'Failures'],
    ['no_match_count', 'No match'],
    ['episodes_returned', 'Episodes'],
    ['average_response_time_ms', 'Avg ms'],
  ];
  const widths = columns.map(([key, label]) =>
    Math.max(label.length, ...rows.map((row) => String(row[key]).length)),
  );
  const line = (values) =>
    values
      .map((value, index) => String(value).padEnd(widths[index]))
      .join(' | ');
  return [
    line(columns.map(([, label]) => label)),
    widths.map((width) => '-'.repeat(width)).join('-+-'),
    ...rows.map((row) => line(columns.map(([key]) => row[key]))),
  ].join('\n');
}

function validateSupabaseUrl(value) {
  let projectUrl;
  try {
    projectUrl = new URL(value);
  } catch {
    throw new Error(
      'SUPABASE_PROJECT_URL must be a valid HTTPS Supabase project URL.',
    );
  }
  if (
    projectUrl.protocol !== 'https:' ||
    !projectUrl.hostname.endsWith('.supabase.co') ||
    projectUrl.pathname !== '/' ||
    projectUrl.search ||
    projectUrl.hash ||
    projectUrl.username ||
    projectUrl.password
  ) {
    throw new Error(
      'SUPABASE_PROJECT_URL must be a valid HTTPS Supabase project URL.',
    );
  }
  return projectUrl;
}

async function writeHealthSnapshot(rows) {
  if (!supabaseProjectUrlValue || !supabaseSecretApiKey) {
    throw new Error(
      'SUPABASE_PROJECT_URL and SUPABASE_SECRET_API_KEY are required for --write.',
    );
  }

  const endpoint = new URL(
    '/rest/v1/anivexa_provider_health',
    validateSupabaseUrl(supabaseProjectUrlValue),
  );
  endpoint.searchParams.set('on_conflict', 'provider');
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: supabaseSecretApiKey,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    });
  } catch {
    throw new Error('Supabase could not be reached to save provider health.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      'Supabase rejected the provider health snapshot (HTTP ' +
        response.status +
        ').',
    );
  }
  await response.body?.cancel();
}

async function main() {
  if (mode !== '--dry-run' && mode !== '--write') {
    throw new Error(
      'Choose --dry-run to print a sanitized snapshot or --write to upsert it to Supabase.',
    );
  }

  const rows = await collectProviderHealth();
  process.stdout.write(
    'Anivexa provider health snapshot (' +
      mode.slice(2) +
      ')\n' +
      formatTable(rows) +
      '\n',
  );

  if (mode === '--write') {
    await writeHealthSnapshot(rows);
    process.stdout.write(
      'Updated ' + rows.length + ' provider rows in Supabase.\n',
    );
  }
}

main().catch((error) => {
  fail(
    error instanceof Error
      ? error.message
      : 'Provider health monitoring failed.',
  );
});
