# Anivexa provider health monitoring

The scheduled monitor runs the pinned Anivexa API from the repository's
`vendor/anivexa-api` submodule on a GitHub-hosted runner. It calls the API
worker's existing `/episodes/:provider/:anilistId?map=false` route once for
each provider sample. The route handler runs in-process; the workflow does not
expose a local Anivexa server to the network or depend on a remotely hosted
Anivexa service.

## Schedule and provider samples

GitHub Actions runs at 00:00, 06:00, 12:00, and 18:00 UTC. The workflow also
supports a manual dispatch. It probes two providers concurrently and uses a
90-second per-sample timeout.

| Provider     | Sample AniList ID |
| ------------ | ----------------: |
| `mkissa`     |             16498 |
| `reanime`    |             16498 |
| `anikoto`    |             16498 |
| `animegg`    |             16498 |
| `animenosub` |            199547 |
| `anizone`    |            199547 |
| `aniwaves`   |             16498 |
| `senshi`     |             16498 |
| `kaa`        |                21 |
| `animedunya` |             16498 |
| `animeonsen` |             16498 |
| `anipm`      |            178788 |

The script checks that this matrix matches the provider manifest in the pinned
Anivexa source. Update the matrix when the Anivexa provider inventory changes.
Samples are used only to request the route; their IDs are neither logged nor
stored in Supabase.

## Status interpretation

- `healthy`: at least one sample returned episodes and no technical failure
  was observed.
- `degraded`: at least one sample returned episodes and at least one sample
  failed technically.
- `unavailable`: no sample returned episodes and at least one technical
  failure was observed.
- `indeterminate`: the sample did not match provider catalog data and no
  technical failure established availability.

Each sample is classified as a successful result, a technical failure, or a
catalog no-match. The table constraints ensure those counts add up to the
sample count. A known sample that no longer matches its provider is not
misreported as a provider outage.

## Supabase snapshot

The migration creates `public.anivexa_provider_health`, with one row per
provider. Each workflow run upserts the latest snapshot; this table does not
retain run history. Rows include status, sample and failure counts, the number
of returned episodes, average response time, a generated summary, and check
timestamps.

The monitor never stores sample IDs, anime titles, provider URLs, response
bodies, or raw provider errors. It suppresses the pinned runtime's provider
logs while probing and writes only allow-listed slugs, counts, status, timings,
and a generated summary. Row-level security is enabled, and table access is
granted only to `service_role`; the desktop client has no read or write
access.

## GitHub Actions configuration and operation

The workflow expects:

| Name                      | Kind                | Purpose                                     |
| ------------------------- | ------------------- | ------------------------------------------- |
| `SUPABASE_PROJECT_URL`    | Repository variable | HTTPS Supabase project URL                  |
| `SUPABASE_SECRET_API_KEY` | Repository secret   | Server-side REST access to the health table |

The secret remains in the GitHub Actions job. The script removes both
Supabase values from `process.env` before loading the Anivexa runtime and
uses the secret only for the final Supabase upsert. Never use a publishable key
for this workflow or add the secret to Electron, Vite, or a Windows package.

For a local sanitized probe, install the pinned submodule dependencies and run:

```sh
npm ci --prefix vendor/anivexa-api --no-audit --no-fund
node scripts/monitor-anivexa-providers.mjs --dry-run
```

`--dry-run` makes provider requests and prints the sanitized table without
writing to Supabase. The scheduled workflow uses `--write`. GitHub only
activates scheduled workflows from its default branch; this local development
change does not activate or run the hosted workflow.
