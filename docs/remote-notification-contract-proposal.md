# Remote notification delivery contract proposal

## Status

**Proposed for owner review.** This low-load revision uses a static JSON object in Supabase Storage and its CDN. It creates no database schema, Edge Function endpoint, bucket, or client behavior until approved. The proposed read path makes no Edge Function invocations or application-table queries.

## Goal and boundaries

Extend the existing offline notification center with broadcast messages maintained by Animonkey. The feed may carry maintenance notices, curated provider-health notices, global moderation notices, spotlights, and trending-anime announcements.

Keep the feed separate from local episode and application-update events. The `anivexa_provider_health` table from DISC-29 remains an operational probe snapshot; it is not exposed to clients. Provider-health messages are manually reviewed before publication. The feed carries global policy or service notices only, not account-specific moderation decisions.

## Delivery source

Store one JSON object at `v1/feed.json` in a dedicated public Storage bucket named `desktop-notifications`. The public bucket is intentional: every published message is broadcast content suitable for anyone to read. Storage writes remain restricted to maintainers; the desktop app never uploads or edits the feed.

Use the Supabase Storage CDN for reads. The main process derives the project origin from the existing validated `VITE_DESKTOP_API_URL` configuration and appends the fixed path `/storage/v1/object/public/desktop-notifications/v1/feed.json`. For example, `https://<project-ref>.supabase.co/functions/v1/desktop-api` maps to `https://<project-ref>.supabase.co/storage/v1/object/public/desktop-notifications/v1/feed.json`. Never accept a URL or bucket path from the renderer. This requires no new public build variable or Windows pipeline change. Do not bundle the Supabase service key or require an account bearer token for the public object.

Set the object cache lifetime to 43,200 seconds. Supabase routes Storage requests through its CDN, and public objects can be shared across clients in the same region. A cache miss may still reach the Storage origin, so the budget below conservatively counts every client response as egress. The CDN may serve an updated object until its cache lifetime expires; the client cache can keep a previously fetched feed for up to 48 hours.

The read path does not call `desktop-api`, invoke an Edge Function, query application tables, subscribe to Realtime, or send account, device, or installation identifiers. A CDN miss still reaches the Supabase Storage origin. Each client checks the object only when the user opens the notification center and the previous attempt was at least 48 hours ago. Add random jitter of up to 12 hours to the next eligible check. Record the attempt before fetching and do not retry automatically within that window, including after a failure. This caps requests at 16 per client profile in a 31-day calendar month; profiles that do not open the center send fewer requests.

## JSON contract

The object contains only published messages that are active during the publication window. Uploading a new object publishes it; drafts are kept outside the public bucket.

| Field                   | Contract                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `schemaVersion`         | Integer, initially `1`.                                                            |
| `generatedAt`           | ISO 8601 UTC timestamp for the uploaded feed.                                      |
| `id`                    | Stable UUID used for local read and dismissal state.                               |
| `category`              | `maintenance`, `provider_health`, `moderation`, `spotlight`, or `trending`.        |
| `severity`              | `info`, `warning`, or `critical`; a presentation hint, not incident verification.  |
| `title`                 | Plain text, 1–120 characters.                                                      |
| `message`               | Plain text, 1–300 characters.                                                      |
| `priority`              | Integer from 0–100, default 0.                                                     |
| `startsAt`, `expiresAt` | ISO 8601 UTC timestamps; `expiresAt` must be later than `startsAt`.                |
| `providerId`            | Optional allowlisted Anivexa provider ID, only for `provider_health`.              |
| `animeId`               | Optional positive AniList media ID, only for `spotlight` or `trending`.            |
| `action`                | `{ "type": "none" }` or `{ "type": "anime" }`; an anime action requires `animeId`. |

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

- Fetch only when the notification center opens and the local 48-hour attempt window plus random jitter has elapsed. Do not poll while the application is running or fetch on every open.
- Cache the last valid feed locally for up to 48 hours. Show cached, unexpired messages offline; a network error must not hide local episode or update notifications.
- Persist `readAt` and `dismissedAt` locally by remote UUID. Do not send these states to Supabase or sync them across devices.
- Ignore expired messages. Open only the existing typed anime route for an `anime` action; all other messages have no action.
- Do not promise real-time or urgent delivery. A newly published notice may take several days to reach an offline client that recently fetched the feed.

## Load estimate for the connected project

The connected Supabase organization is on the Free plan. Supabase currently includes 500,000 Edge Function invocations and 5 GB of cached egress in that plan ([invocation quota](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations), [pricing](https://supabase.com/pricing)). The proposed Storage read path consumes no Edge Function invocations and issues no queries to application tables; its remaining load is Storage/CDN traffic and egress. A cache miss still reaches the Storage origin ([Storage CDN behavior](https://supabase.com/docs/guides/storage/cdn/fundamentals), [`cacheControl` upload option](https://supabase.com/docs/reference/javascript/file-buckets-upload)).

At the 4 KiB response cap and one request per client profile every 48 hours, the conservative estimate allows 16 requests per client profile in a 31-day month:

| Active client profiles | Storage requests/month (maximum) | Feed egress/month (maximum) |
| ---------------------: | -------------------------------: | --------------------------: |
|                  1,000 |                           16,000 |               About 0.07 GB |
|                 10,000 |                          160,000 |               About 0.66 GB |
|                 20,000 |                          320,000 |               About 1.31 GB |

These estimates count every response byte, including responses that the CDN may serve from cache. They exclude the project's existing Storage egress. At 20,000 active client profiles, the feed would use about one quarter of the Free plan's 5 GB cached-egress allowance before existing usage. The connected tooling does not expose the project's current monthly cached-egress usage, so an absolute no-overage guarantee is not available from the evidence collected. The CDN cache and delayed refresh reduce origin traffic and correlated checks, but do not provide a hard burst limit.

For comparison, the earlier six-hour `desktop-api` polling idea could add up to 120 Edge Function invocations per client profile per month, or 120,000 at 1,000 active profiles. The connected function logs showed 2,688 `desktop-api` events in the preceding 24 hours; this is a log-based estimate, not the billing usage report. A public Storage object avoids adding those function calls and application-table queries. At 10,000 active profiles, the revised feed estimate is at most 160,000 Storage/CDN requests and about 0.66 GB per month, with no added Edge Function invocations.

## Operational and privacy rules

- Keep `desktop-notifications` public-read and maintainer-write only. The file itself must contain only reviewed broadcast content.
- Keep the Anivexa health table private. Provider notices are manually curated and must not expose individual probe payloads or turn a single failed sample into a general outage notice.
- Keep moderation notices global. Account-specific moderation requires a separate authenticated contract.
- Keep read/dismiss state on the device and preserve the existing 30-day, 100-item local notification retention behavior.
- If the Storage request fails or the feed is invalid, keep local notifications available and do not retry before the 48-hour window plus jitter has elapsed.

## Decisions requested before implementation

1. Approve the feed as public broadcast content stored in Supabase Storage, with maintainers uploading the JSON object manually.
2. Accept the 48-hour refresh window, up to 12 hours of jitter, and the absence of real-time delivery.
3. Accept the 4 KiB payload and 8-message cap.
4. Confirm the expected monthly active client-profile range and available cached-egress headroom. At 10,000 active profiles, this feed is estimated at about 0.66 GB/month before existing Storage egress.
5. Keep provider-health notices manual until a separate rule for automating them from DISC-29 snapshots is agreed.

After agreement, implementation can add the public Storage bucket and validated JSON contract, a fixed main-process fetch, local notification-state integration, and a focused DISC-14 runtime check. No database migration or Edge Function endpoint is needed for feed reads.
