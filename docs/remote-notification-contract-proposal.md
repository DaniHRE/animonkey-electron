# Remote notification delivery contract proposal

## Status

**Proposed for owner review.** This document defines a candidate contract for DISC-14. It does not add a database migration, endpoint, or client behavior. Remote notifications should remain unavailable until the owner approves the contract.

## Goal and boundaries

Extend the existing offline notification center with a small feed of broadcast messages maintained by Animonkey. The feed may carry maintenance notices, curated provider-health notices, global moderation notices, spotlights, and trending-anime announcements.

Keep the feed separate from the current local episode and application-update events. The `anivexa_provider_health` table from DISC-29 remains an operational probe snapshot; it is not a client-facing message feed. The first version should publish provider-health notices only after maintainer review, rather than expose individual probe results or automatically convert one failed sample into an outage announcement.

The proposed feed is broadcast-only. It does not identify recipients, carry account-specific moderation decisions, record read receipts on the server, or replace account activity. A moderation message in this feed is a general policy or service notice. Any account-specific moderation workflow needs its own authenticated contract.

## Proposed data model

Create a private `public.app_notifications` table with RLS enabled and no `anon` or `authenticated` table access. Only the trusted `desktop-api` Edge Function may read published rows using its server-side service key. Maintainers publish messages through a trusted Supabase administrative workflow; the desktop app cannot create or edit messages.

| Field                      | Proposed contract                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `id`                       | Stable UUID primary key, also used by the client to preserve local read and dismissal state.                         |
| `category`                 | `maintenance`, `provider_health`, `moderation`, `spotlight`, or `trending`.                                          |
| `severity`                 | `info`, `warning`, or `critical`; presentation priority only, not a verified incident classification.                |
| `title`                    | Required plain text, 1–120 characters.                                                                               |
| `message`                  | Required plain text, 1–300 characters.                                                                               |
| `priority`                 | Integer from 0–100, default 0; higher values sort first within the active feed.                                      |
| `starts_at`                | Required timestamp; the message is not returned before this time.                                                    |
| `expires_at`               | Required timestamp later than `starts_at`; the message is not returned at or after this time.                        |
| `published_at`             | Nullable timestamp. `NULL` means draft; setting it publishes the record.                                             |
| `target_platform`          | `all` or `win32`, default `all`, to allow Windows-specific notices while Windows is the initial distribution target. |
| `provider_id`              | Nullable ID from the Anivexa provider allowlist; permitted only for `provider_health`.                               |
| `anime_id`                 | Nullable positive AniList media ID; permitted only for `spotlight` and `trending`.                                   |
| `action_type`              | `none` or `anime`, default `none`. `anime` requires `anime_id`; no arbitrary route or URL is stored.                 |
| `created_at`, `updated_at` | Server-managed timestamps.                                                                                           |

Database checks and Edge Function validation should enforce category-specific fields, text limits, valid timestamps, the provider allowlist, positive anime IDs, and the action rules. Store no HTML, Markdown, external URLs, user IDs, client diagnostics, raw provider errors, or private moderation details.

## Proposed API

Add a `notifications.list` action to the existing `desktop-api` function. The function currently supports selected unauthenticated actions before its account-authentication step, so this public broadcast action can be handled at the same boundary without changing the rest of the authenticated API.

The desktop main process sends the existing public Supabase key and no account bearer token. The function returns only the allowlisted fields above for rows where `published_at` and `starts_at` are not in the future, `expires_at` is in the future, and `target_platform` matches the client. The query is capped at 50 rows and sorted by `priority DESC`, then `published_at DESC`.

Because this action is public and has no per-account quota, deployment must include an edge-level request ceiling. The response may use public cache headers for a short period because it contains only broadcast data. The exact request ceiling and cache duration must be confirmed against the deployed Supabase gateway before release; do not persist client IP addresses to implement this feed's limit.

Example request:

```json
{
  "action": "notifications.list",
  "platform": "win32"
}
```

Example response:

```json
{
  "notifications": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "category": "maintenance",
      "severity": "warning",
      "title": "Scheduled maintenance",
      "message": "Account services may be unavailable during maintenance.",
      "priority": 20,
      "publishedAt": "2026-11-24T12:00:00Z",
      "expiresAt": "2026-11-25T12:00:00Z",
      "providerId": null,
      "animeId": null,
      "action": { "type": "none" }
    }
  ]
}
```

The client validates the response again before display. Unknown categories, severities, IDs, timestamps, or action shapes are discarded. React renders title and message as text. Anime actions resolve only to the existing typed anime route after validating the positive numeric ID.

## Proposed client behavior

- Fetch on application startup and when the notification center opens. Cache the last valid response locally and refresh it while online; a six-hour freshness window is proposed to bound requests.
- Merge active remote messages into the notification center while keeping the existing local episode and update event behavior intact.
- Persist `readAt` and `dismissedAt` locally against the stable remote UUID. Do not send these actions to the server or sync them across accounts or devices.
- Keep cached messages visible offline until their `expiresAt`; expired messages stop appearing. Apply the existing 30-day and 100-item local retention limits to stored notification state.
- Open only the typed anime route for an `anime` action. Other messages have no action in the first version.
- Keep empty, stale-cache, loading, and request-error states understandable without hiding local notifications.

## Operational and privacy rules

- The endpoint is public and read-only. It returns the same broadcast feed to signed-in and signed-out clients and accepts no user identifier.
- The renderer never receives the Supabase service key. Only the Edge Function uses the server-side key to read the private table.
- Do not write client IP addresses, account IDs, read state, or device identifiers to the notification table. Configure and verify an edge-level request ceiling for the public action before release; do not add user tracking solely for this feed.
- A failed or empty feed request must not affect local notifications, account sync, playback, or offline access.
- Provider-health notices are editorial broadcasts, not direct health-table exposure. If automatic notices are later desired, define a separate threshold and deduplication rule based on multiple probe snapshots before connecting DISC-29 to this feed.

## Decisions requested before implementation

The implementation should start after the owner agrees to these proposed defaults:

1. Broadcast messages are available without account sign-in; read and dismiss state stays on the current device.
2. Moderation messages are global notices only; account-specific moderation is out of scope for this feed.
3. Provider-health messages are manually published at first; automatic messages require a separate probe threshold decision.
4. The initial public message categories, severity values, 50-row limit, six-hour client freshness window, and typed anime-only action are acceptable.
5. The Supabase gateway or a fronting edge service can enforce an acceptable request ceiling and short public cache for this action.

After agreement, implementation can be split into a Supabase migration and Edge Function change, followed by the local notification model and UI integration on a focused DISC-14 branch targeting `dev`.
