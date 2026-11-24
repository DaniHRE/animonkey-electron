# Remote notification delivery contract proposal

## Status

**The client implementation is complete on `dev`.** It reads one static JSON object from Supabase Storage and its CDN. The feature creates no database schema or Edge Function endpoint and makes no application-table queries. The `desktop-notifications` bucket is provisioned as public-read, JSON-only, and limited to 4 KiB per object. The empty initial object is published at `v1/feed.json`; its public GET returned HTTP 200 with `application/json` and `Cache-Control: public, max-age=3600`. No remote messages have been published.

## Goal and boundaries

Extend the existing offline notification center with broadcast messages maintained by Animonkey. The feed may carry system maintenance, curated provider-health notices, global moderation notices, new-anime announcements, followed-anime spotlights, and global trending-anime announcements.

Keep the feed separate from local episode and application-update events. The `anivexa_provider_health` table from DISC-29 remains an operational probe snapshot; it is not exposed to clients. Provider-health messages are manually reviewed before publication. The feed carries global policy or service notices only, not account-specific moderation decisions. Followed-anime spotlights are filtered against the local follow list; the app does not send follow data to Supabase.

## Notification categories

| Category          | Intended content                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `maintenance`     | Planned maintenance and broad incidents or recovery notices for Animonkey services.                                         |
| `provider_health` | Manually reviewed availability notices for an Anivexa provider; never raw probe results.                                    |
| `moderation`      | Global moderation or platform-policy notices; never a notice about an individual account.                                   |
| `new_anime`       | An editorial notice introducing a newly available anime title.                                                              |
| `spotlight`       | An editorial highlight for a specific anime. The client shows it only when that anime is in the user's local followed list. |
| `trending`        | A broadcast notice about an anime that is popular or seasonally relevant; not personalized.                                 |

The local notification center already handles followed-anime episode alerts and application-update events. Those remain separate and are not duplicated in this feed.

## Delivery source

Store one JSON object at `v1/feed.json` in a dedicated public Storage bucket named `desktop-notifications`. The public bucket is intentional: every published message is broadcast content suitable for anyone to read. Storage writes remain restricted to maintainers; the desktop app never uploads or edits the feed.

Use the Supabase Storage CDN for reads. The main process derives the project origin from the existing validated `VITE_DESKTOP_API_URL` configuration and appends the fixed path `/storage/v1/object/public/desktop-notifications/v1/feed.json`. For example, `https://<project-ref>.supabase.co/functions/v1/desktop-api` maps to `https://<project-ref>.supabase.co/storage/v1/object/public/desktop-notifications/v1/feed.json`. Never accept a URL or bucket path from the renderer. This requires no new public build variable or Windows pipeline change. Do not bundle the Supabase service key or require an account bearer token for the public object.

Set the object cache lifetime to 3,600 seconds. Supabase routes Storage requests through its CDN, and public objects can be shared across clients in the same region. A cache miss may still reach the Storage origin, so the budget below conservatively counts every response byte as egress. The client cache is refreshed at most every six hours while the app is open and online; with the one-hour CDN cache, a connected client should receive a new notice within about six and a half hours.

The read path does not call `desktop-api`, invoke an Edge Function, query application tables, subscribe to Realtime, or send account, device, or installation identifiers. A CDN miss still reaches the Supabase Storage origin. Check the object at app startup when due, then at most once every six hours while the app is open and online; opening the notification center may also trigger a check when that interval has elapsed. Add up to 30 minutes of random jitter to eligible checks. Record each attempt before fetching. Do not retry a failed request before the six-hour interval; after HTTP 402 or 429, defer the next attempt for at least 24 hours. This caps traffic at 125 requests per client profile in a 31-day month, even if the app stays open continuously.

## JSON contract

The object contains only published messages that are active during the publication window. Uploading a new object publishes it; drafts are kept outside the public bucket.

| Field                   | Contract                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`         | Integer, initially `1`.                                                                                       |
| `generatedAt`           | ISO 8601 UTC timestamp for the uploaded feed.                                                                 |
| `id`                    | Stable UUID used for local read and dismissal state.                                                          |
| `category`              | `maintenance`, `provider_health`, `moderation`, `new_anime`, `spotlight`, or `trending`.                      |
| `severity`              | `info`, `warning`, or `critical`; a presentation hint, not incident verification.                             |
| `title`                 | Plain text, 1–120 characters.                                                                                 |
| `message`               | Plain text, 1–300 characters.                                                                                 |
| `priority`              | Integer from 0–100, default 0.                                                                                |
| `startsAt`, `expiresAt` | ISO 8601 UTC timestamps; `expiresAt` must be later than `startsAt`.                                           |
| `providerId`            | Optional allowlisted Anivexa provider ID, only for `provider_health`.                                         |
| `animeId`               | Required positive AniList media ID for `new_anime`, `spotlight`, and `trending`; absent for other categories. |
| `action`                | `{ "type": "none" }` or `{ "type": "anime" }`; an anime action requires `animeId`.                            |

Limit the feed to 8 active messages and 4,096 UTF-8 bytes after JSON serialization. Reject unknown fields, categories, severities, invalid timestamps, non-allowlisted provider IDs, and invalid action shapes. The client validates the downloaded object again before display. Render title and message as text; do not store HTML, Markdown, external URLs, arbitrary routes, user IDs, diagnostics, raw provider errors, or private moderation details.

Example object:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-24T12:00:00Z",
  "notifications": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "category": "maintenance",
      "severity": "warning",
      "title": "Scheduled maintenance",
      "message": "Account services may be unavailable during maintenance.",
      "priority": 20,
      "startsAt": "2026-11-24T12:00:00Z",
      "expiresAt": "2026-11-25T12:00:00Z",
      "providerId": null,
      "animeId": null,
      "action": { "type": "none" }
    }
  ]
}
```

## Client behavior

- Fetch at startup when due, then at most once every six hours while the app is open and online. Opening the notification center can trigger a fetch only when the same interval has elapsed.
- Cache the last valid feed locally. Show cached, unexpired messages offline; a network error must not hide local episode or update notifications.
- Persist `readAt` and `dismissedAt` locally by remote UUID. Do not send these states to Supabase or sync them across devices.
- For a `spotlight`, compare its `animeId` with the local followed-anime list before display. Never upload the follow list or use it to target a server response.
- Ignore expired messages. Open only the existing typed anime route for an `anime` action; all other messages have no action.
- Do not promise real-time or urgent delivery. A connected app should receive a newly published notice within about six and a half hours; an offline app receives it after the next launch and eligible fetch.

## Load estimate for the connected project

The connected Supabase organization is on the Free plan. Its current quotas include 500,000 Edge Function invocations, 5 GB of cached egress, and 5 GB of uncached egress ([invocation quota](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations), [egress quotas and overage behavior](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [pricing](https://supabase.com/pricing)). Cached and uncached egress have separate quotas; a CDN hit counts as cached egress, while a cache miss counts as uncached egress ([Storage CDN behavior](https://supabase.com/docs/guides/storage/cdn/fundamentals)). The proposal consumes no Edge Function invocations or application-table queries.

At the 4 KiB response cap and six-hour refresh interval, the conservative estimate allows 125 reads per client profile in a 31-day month:

| Active client profiles | Storage/CDN reads per month (maximum) |               Maximum transferred bytes per month |
| ---------------------: | ------------------------------------: | ------------------------------------------------: |
|                     20 |                                 2,500 | About 10.24 MB (0.2% of either 5 GB egress quota) |
|                  1,000 |                               125,000 |                                    About 0.512 GB |
|                 10,000 |                             1,250,000 |                                     About 5.12 GB |
|                 20,000 |                             2,500,000 |                                    About 10.24 GB |

Each transferred byte counts against the cached or uncached egress quota according to the CDN result, not both. These estimates exclude all existing project traffic. The owner's rough estimate is about 20 users, modeled as 20 active client profiles; multiple installations per user count separately. At that size, the feed adds at most 2,500 reads and about 10.24 MB per month. This is about 0.2% of either Free-plan egress quota and is a small incremental load. If usage grows toward thousands of active profiles, the six-hour cadence can consume a meaningful share of the quota; review the organization's usage dashboard before increasing distribution.

Supabase documents that Free-plan quota overruns generate a notification and grace period; continued overuse can result in service restrictions ([egress usage policy](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)). This is not described as an immediate project pause on the first overage. The client-side interval is not a project-wide egress cap, and the connected tools do not expose current monthly egress. The total project can still be restricted by traffic from account, auth, database, Storage, or other services if the organization's quota is exceeded.

For comparison, the earlier six-hour `desktop-api` polling idea could add up to 120 Edge Function invocations per client profile per month. The static object avoids adding those function calls and application-table queries; its remaining cost is bounded Storage/CDN traffic based on the active client count.

## Operational and privacy rules

- Keep `desktop-notifications` public-read and maintainer-write only. The file itself must contain only reviewed broadcast content.
- Keep the Anivexa health table private. Provider notices are manually curated and must not expose individual probe payloads or turn a single failed sample into a general outage notice.
- Keep moderation notices global. Account-specific moderation requires a separate authenticated contract.
- Keep read/dismiss state on the device and preserve the existing 30-day, 100-item local notification retention behavior.
- Treat the remote feed as best effort. A Storage error, quota response, or invalid feed must never block app startup, navigation, playback, local library data, account screens, or local notifications. Keep the last valid cache and enforce the retry delays above.

## Remaining operational setup

The client treats a missing or unavailable feed as a non-fatal condition. The `desktop-notifications` bucket is configured for public reads, JSON-only objects, and a 4 KiB object limit. The empty `v1/feed.json` is published with a 3,600-second cache lifetime and verified over public HTTP. Keep write access restricted to maintainers. Review current cached and uncached egress headroom in the Supabase dashboard before publishing messages; the estimates in this proposal cover only the incremental feed traffic, not total project usage.

Keep provider-health notices manual until a separate rule for automating them from DISC-29 snapshots is agreed. The empty feed contains no messages; no provider-health data or user reports were uploaded.

The fixed main-process fetch, local notification-state integration, public Storage bucket, and validated JSON contract are implemented. A focused DISC-14 runtime check remains useful before relying on the feed in a packaged release. No database migration or Edge Function endpoint is needed for feed reads.
