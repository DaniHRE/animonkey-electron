# Supabase Deployment and Project Status

This document describes the Supabase services used by Animonkey Desktop, records the connected project's state, and gives the deployment sequence for an independent Supabase project.

The app-specific steps target a managed Supabase project. Running the Supabase platform itself on your own infrastructure is separate; use Supabase's official [Docker self-hosting guide](https://supabase.com/docs/guides/self-hosting/docker). The function and schema setup in this document has not been validated against a self-hosted stack.

## Important: schema bootstrap is not yet self-contained

The Supabase migrations in this repository are desktop and operational additions. They depend on Animonkey's existing account and library schema, including `next_auth.users`, `public.users`, `public.watch_later`, `public.episode_progress`, and `public.activity_feed`.

The connected project has three earlier schema migrations that are not present in this repository:

- `20261111155642_complete_animonkey_auth_sync_schema`
- `20261111155851_allow_private_trigger_execution`
- `20261111160004_combine_user_profile_select_policy`

The connected project's migration history also uses different version numbers from four local files:

| Migration                  | Connected project version | Local filename version |
| -------------------------- | ------------------------- | ---------------------- |
| Anime ratings              | `20261111193934`          | `20261111201000`       |
| Provider failure reporting | `20261124011402`          | `20261123231936`       |
| Feedback intake            | `20261124011630`          | `20261123232000`       |
| Anivexa provider health    | `20261124020952`          | `20261124020000`       |

As a result, this checkout cannot currently bootstrap a blank Supabase project by itself, and its migration ledger does not line up with the connected project. Do not run `supabase db push` against the connected project from this checkout until the authoritative baseline SQL is restored and the migration history is reconciled.

The Anivexa runtime update in this development branch adds `anihq`, `pahenime`, and `anipm` to optional provider-failure reporting, and replaces `mkissa` and `senshi` in the provider-health monitor. The local migration `20261126194708_update_anivexa_provider_allowlists.sql` updates the database allowlists and removes the two retired providers' latest health snapshots. It has not been applied to the connected project, and `desktop-api` version 10 has not been updated there. Apply the migration and deploy the updated function in a non-production project before distributing a build with this runtime.

This is a deployment/reproducibility gap, not evidence that the connected project's current features are down. The project is active and the desktop API is active at version 10.

The steps below document the required deployment order. A fully reproducible clean install still requires those baseline migrations and matching migration versions to be checked into the repository.

## Current connected project

Audited on 2026-11-24:

- Project name: `animonkey`
- Region: `sa-east-1` (São Paulo)
- Project status: active and healthy
- Organization plan: Free
- Database engine: PostgreSQL 17
- Edge Functions: `desktop-api` is active at version 10, with JWT verification disabled at the gateway because the function validates its own desktop bearer sessions.

The connected database records 11 migrations. This repository contains 8 migration files. The three missing baseline migrations and four version mismatches are listed above.

### Changes in the 1.1.0 Supabase scope

This audit and documentation pass was read-only; it made no database or Storage changes. The following release-scope changes are already present in the connected project:

- Provider failure reporting: a private, RLS-enabled table, a restricted submission RPC, and the 30-day cleanup job. No reports are stored currently.
- Feedback intake: a private, RLS-enabled table, a consent/rate-limited submission RPC, and the 180-day cleanup job. No submissions are stored currently.
- Anivexa health: a private, RLS-enabled table with one current row per provider. The scheduled workflow updates these sanitized snapshots.
- Remote notifications: a public-read, 4 KiB JSON bucket and an empty feed object at `v1/feed.json`. The bucket and object were provisioned; the feature has not published any messages.
- Desktop API: active version 10, which includes the account API and the current feedback and provider-reporting endpoints.

The older account, sync, ratings, activity-feed, and avatar components are also present, but were not introduced by the notification-feed setup.

### Supabase-backed application features

| Feature                           | Supabase components                                                                              | Behavior                                                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop account and sessions      | `desktop-api`, `next_auth.users`, `desktop_sessions`, refresh-token and login-attempt tables     | Registration, login, refresh, logout, account/profile updates, password changes, and device sessions use a server-side custom API. The renderer never receives a server key.                                  |
| Optional account sync             | `watch_later`, `episode_progress`, `anime_ratings`, `desktop_sync_tombstones`, and `desktop-api` | Signed-in users can sync supported library, progress, and rating data. Local data remains usable offline. Tombstones carry deletions across devices.                                                          |
| Activity feed and privacy         | `activity_feed`, profile privacy settings, and database triggers                                 | Started-watching, completed-episode, and rating activity is generated server-side according to the user's sharing preference.                                                                                 |
| Avatar images                     | Public `avatars` Storage bucket and `desktop-api`                                                | The API validates and manages profile images. The existing bucket accepts JPEG, PNG, WebP, and GIF.                                                                                                           |
| Feedback intake                   | `feedback_submissions`, `desktop_submit_feedback`, `desktop-api`, and `pg_cron`                  | Authenticated users may submit consented suggestions or bug reports. A scheduled job deletes records after 180 days. A separate manually dispatched GitHub workflow can turn reviewed feedback into an issue. |
| Optional provider failure reports | `provider_failure_reports`, `desktop_report_provider_failure`, `desktop-api`, and `pg_cron`      | With opt-in, an authenticated client can report allow-listed HTTP 502/503/504 provider lookup failures. Reports are deduplicated and rate-limited, then deleted after 30 days.                                |
| Anivexa provider health           | Private-to-clients `anivexa_provider_health` table and scheduled GitHub Actions workflow         | Every six hours, a GitHub runner invokes the pinned Anivexa runtime locally and writes one sanitized latest-status row per provider. It does not require a remotely hosted Anivexa API.                       |
| Maintainer announcements          | Public `desktop-notifications` Storage bucket and static JSON file                               | The client reads a reviewed broadcast feed at most every six hours with jitter. It does not use an Edge Function, application-table query, Realtime subscription, or account identifier for feed reads.       |

AniList catalog requests, the embedded Anivexa playback runtime, offline library state, and local episode notifications do not depend on Supabase. Only the account-backed features above require the desktop API.

### Database, scheduled jobs, and Storage state

- The provider health table currently has 12 rows, one per monitored provider. It stores the latest snapshot rather than a history of every probe.
- The feedback and provider failure report tables currently have no submissions.
- Both cleanup jobs are active: provider failure reports are retained for 30 days, and feedback records for 180 days.
- The existing public `avatars` bucket is limited to image MIME types.
- The `desktop-notifications` bucket is public-read, limited to JSON and 4,096 bytes per object. Its only object is `v1/feed.json` (89 bytes), with `Cache-Control: max-age=3600`. The feed is empty; no broadcast messages are published. There are no broad Storage object write policies.
- The notification feed adds no Edge Function calls. At 20 active client profiles, its conservative estimate is up to 2,500 reads and about 10.24 MB per month. Total project egress was not inspected during this audit.

### GitHub Actions configuration

Configure these in the repository that will run the workflows:

| Name                            | GitHub setting      | Used by                                                                                                                           |
| ------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_DESKTOP_API_URL`          | Repository variable | Windows CI and stable package builds; use the project's `/functions/v1/desktop-api` URL.                                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Repository variable | Windows CI and stable package builds. This public key may be bundled in the app.                                                  |
| `SUPABASE_PROJECT_URL`          | Repository variable | Provider monitor and reviewed-feedback workflows.                                                                                 |
| `SUPABASE_SECRET_API_KEY`       | Repository secret   | Server-side REST writes for the provider monitor and reviewed-feedback workflow. Never expose it to Vite, Electron, or a package. |

The scheduled monitor runs at 00:00, 06:00, 12:00, and 18:00 UTC. GitHub only runs scheduled workflows from the repository's default branch. See [provider health monitoring](anivexa-provider-health-monitoring.md) and the [feedback-to-Issue workflow](feedback-issue-workflow.md) for the full procedures.

## Deployment sequence for an independent project

### 1. Create and configure the Supabase project

Create a project and keep its database password in a password manager. Use a current Supabase CLI release. CLI v3 targets the local stack by default, so always include `--remote` on commands intended for the hosted project.

Enable or confirm the extensions required by the migrations, including `pg_cron`, `pgcrypto`, and `uuid-ossp`, where not already available. The hosted project uses PostgreSQL 17.

### 2. Restore the Animonkey baseline schema

Before applying this repository's migrations, provision the existing Animonkey account and sync schema. At minimum, the baseline must provide the tables and contracts listed in the bootstrap warning above, including their required keys, RLS policies, triggers, and the `next_auth.uid()` function.

The authoritative SQL for the three baseline migrations is not included in this repository today. Obtain that SQL from the current Animonkey backend source before proceeding. Do not use a historical schema document as a substitute without verifying it against the current production schema.

### 3. Install the schema migrations

After the baseline is present and the migration files have been reconciled:

1. Authenticate the CLI with `supabase login`.
2. Link the working copy to the new project with `supabase link --project-ref <project-ref>`.
3. Compare the local and remote migration history with `supabase migration list --remote`.
4. Preview pending changes using `supabase db push --dry-run --remote`.
5. Review the preview, then apply with `supabase db push --remote`.

The CLI tracks applied files in Supabase's migration history. When using SQL Editor to apply files manually, apply the baseline first and then these files in filename order:

1. `20261111173501_desktop_auth_sessions_and_limits.sql`
2. `20261111181828_desktop_sync_tombstones.sql`
3. `20261111201000_desktop_anime_ratings.sql`
4. `20261111222217_desktop_activity_started_watching_updates.sql`
5. `20261111225606_desktop_activity_episode_completed.sql`
6. `20261123231936_provider_failure_reporting.sql`
7. `20261123232000_feedback_intake.sql`
8. `20261124020000_anivexa_provider_health.sql`
9. `20261126194708_update_anivexa_provider_allowlists.sql`

Manual SQL execution does not automatically add those files to the CLI migration ledger. After verifying that a migration's SQL has actually been applied, `supabase migration repair <version> --status applied --remote` can update its history record; it does not run the SQL. Do not use that command to add the four local version numbers to the connected project while its ledger records different versions. Reconcile the SQL and history first, then use `db push` later.

Never use `supabase db reset --remote` for production data. Use `supabase db reset` only with a disposable local development database.

### 4. Expose the account schema to the Data API

The Edge Function reads and writes the `next_auth` schema using the Supabase Data API. Add `next_auth` to the project's exposed schemas while retaining `public`, then save the Data API settings. The function still uses a server-side secret key and explicit database grants; exposing a schema does not grant the desktop client direct access.

### 5. Deploy the desktop API

From the repository root, deploy the function after its migrations:

```sh
supabase functions deploy desktop-api
```

The checked-in `supabase/config.toml` sets `verify_jwt = false` for this function. Keep the function's own bearer-token validation and authorization checks intact. Supabase injects server credentials into the Edge Function runtime; do not set or package a service-role or secret API key as a Vite variable.

For local development, run the Supabase stack and function using the official CLI workflow. The local stack is for development and testing, not a production self-hosted deployment.

### 6. Create the notification feed bucket

In **Storage**, create a bucket named `desktop-notifications` with:

- Public bucket enabled for broadcast reads.
- Maximum object size of 4,096 bytes.
- Allowed MIME type `application/json`.
- No public or authenticated write policy.

Upload `docs/remote-notification-feed.json` to `v1/feed.json` with content type `application/json` and cache control `max-age=3600`. When updating the feed, replace that object rather than uploading a duplicate path. Review every message before publishing; the file is public and has no draft area.

The `avatars` bucket is a separate profile-image feature and must not be reused for notification content.

### 7. Configure the application and repository workflows

For a local development build, set `VITE_DESKTOP_API_URL` to the new function URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to the new project's publishable key in the local environment file. These are public build-time values.

For GitHub builds, configure the four repository variables/secrets in the table above. The two `VITE_*` variables must be present in both the Windows CI and stable release workflows. Never add the server-side secret key to the app build.

### 8. Verify the deployment

- Confirm the migration list has no missing, duplicate, or unexpected versions.
- Confirm `desktop-api` is active and the account endpoints reject invalid sessions.
- Confirm `next_auth` is exposed and the server-side function can reach its tables and RPCs.
- Confirm both retention jobs are active in `cron.job`.
- Fetch `/storage/v1/object/public/desktop-notifications/v1/feed.json` and verify HTTP 200, JSON content type, and the expected cache header.
- Run the provider monitor manually and confirm it writes only the latest sanitized provider snapshot.
- Test account registration, login, session refresh, sync, feedback submission, and the optional provider-reporting path in a non-production project before distributing a build.

For current CLI behavior, see the official [Supabase migration workflow](https://supabase.com/docs/guides/local-development/cli-workflows), [Edge Function deployment guide](https://supabase.com/docs/guides/functions/deploy), and [function secrets guide](https://supabase.com/docs/guides/functions/secrets).
