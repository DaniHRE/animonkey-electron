# Discord Feature and Fix Backlog

## Scope and source

This backlog catalogs the 32 messages returned by the local Discord channel reader with the configured cutoff of 2026-11-21 03:00 UTC (2026-11-21 00:00 in Brasília). The requests come from the project's private testers Discord and are dated 2026-11-21 or 2026-11-23 in Brasília. Follow-up messages that expand one request are grouped into a single item; Discord message IDs are intentionally omitted. No earlier Discord messages were used.

The reader returned attachment filenames for some messages, but not the attached image or video contents. Visual reports below are therefore based on message text and the current source tree; affected screens still need review when an item is selected.

This is an inventory, not an approved implementation plan. Estimates are relative: Low means a localized UI or behavior change; Medium means multiple renderer components or persisted preferences; High means substantial integration, data policy, or media/storage work; Very high means cross-product or platform scope. Defect reports are not treated as confirmed causes until reproduced.

## Navigation and application shell

### DISC-01 — Custom navigation bar appearance

- Difficulty: Medium.
- Current state: Implemented locally on `dev`: Windows uses a frameless window with a hidden native menu and compact application controls in a transparent 32-pixel strip. The packaged Windows build passed, but the window was not visually checked at runtime. Other platforms retain native window chrome.
- Technical analysis: On Windows, use a frameless BrowserWindow and remove its menu. Place compact, accessible application controls in a 32-pixel draggable strip above the existing navigation header. Keep native window chrome on other platforms and preserve resizing, maximize/restore, minimize, close, and the existing router.

### DISC-02 — Restore the last visited page

- Difficulty: Medium.
- Current state: Implemented locally. The renderer stores the last successfully resolved, allow-listed hash route in versioned local storage and restores it when startup begins at the default home route. An explicit app-protocol anime deep link takes precedence. Invalid routes or parameters leave startup at home; existing route error states and shell navigation remain available when content cannot load.
- Technical analysis: Persist only validated internal routes and supported parameters. Restore them through the existing hash history, while allowing explicit deep links to take precedence. Keep local data and home navigation available when a stored route is invalid or its data is unavailable.

### DISC-03 — Application-level back button

- Difficulty: Low to Medium.
- Current state: Route history exists, but no general back control is present in the application shell. The player has previous-episode navigation, which is a different action.
- Technical analysis: Add a shell control that uses TanStack Router history and handles an empty or external-entry history safely. Preserve hash routes, browser back/forward behavior, and the episode query parameter.

### DISC-04 — Common and configurable keyboard shortcuts

- Difficulty: Medium.
- Current state: The watch page describes a few player shortcuts. There is no application-level Ctrl+B action or shortcut editor.
- Technical analysis: Define a small typed command registry in the renderer, then add shortcut preferences and collision validation. Avoid handling shortcuts while the user is typing in an input or editable control. Keep playback shortcuts owned by Vidstack where possible, and account for platform-specific modifier keys and accessibility.

### DISC-05 — Reorderable sidebar

- Difficulty: Medium.
- Current state: Sidebar entries are fixed in source. Início and Explorar are already in the primary section.
- Technical analysis: Persist an ordered list of stable route identifiers, keep Início and Explorar pinned, and provide defaults for newly added or removed routes. Do not persist arbitrary URLs or treat renderer-provided route strings as trusted navigation targets.

### DISC-06 — Move title-language preference to Settings

- Difficulty: Low.
- Current state: The EN/JP title toggle is in the header. Its provider initializes in memory and does not persist the selection.
- Technical analysis: Move the control into local application preferences and persist it with the existing local preference mechanism. Preserve the current title resolution behavior and make the selected language visible to the user.

## Settings, privacy, and interaction

### DISC-07 — Redesign the Settings page

- Difficulty: Medium.
- Current state: A Settings page already groups account sync, diagnostics, caption guidance, and backup. The visual mismatch claim cannot be confirmed without the attached reference.
- Technical analysis: Review the actual desktop screen and supplied design reference when available. Preserve the existing local-data and account boundaries, loading/error/offline states, accessible labels, and current Anivexa diagnostics. Keep the redesign within the Electron repository.

### DISC-08 — Adult-content preference with SFW default

- Difficulty: Medium.
- Current state: Search exposes adult-content filters, but the current service default is include. No global Settings preference was found.
- Technical analysis: Add a persisted preference defaulting to exclude adult content, then apply it consistently to catalog queries and relevant discovery surfaces. Define behavior for existing installations and imported backups. Preserve the ability to opt in and validate AniList adult flags at the data boundary.

### DISC-09 — Adult-content privacy controls

- Difficulty: High.
- Current state: No per-category privacy controls were found for continue-watching history, activity, or sync.
- Technical analysis: Define each data flow separately: local progress, visible Continue Watching entries, account sync, and activity records. Decide whether controls prevent future recording, hide existing records, or also delete them. Keep local-first access, backup semantics, and optional sync consistent; do not silently discard existing user data.

### DISC-10 — Configure caption appearance in Settings

- Difficulty: Medium.
- Current state: Vidstack exposes caption appearance controls during playback. Settings currently points users to those controls but does not edit or persist them.
- Technical analysis: Identify which caption style values Vidstack supports, persist only supported values locally, and apply them to the existing Vidstack player. Do not infer caption availability or language, and do not add a second player framework.

### DISC-11 — Avoid accidental text selection

- Difficulty: Low to Medium.
- Current state: Text selection is disabled only on selected elements such as the brand mark; general text remains selectable.
- Technical analysis: Scope any non-selectable styling to decorative shell controls. Preserve selection in fields and in readable content that users may need to copy. A blanket restriction can harm accessibility and usability, so the exact surfaces need agreement.

### DISC-12 — Remove the “filters saved in URL” explanation

- Difficulty: Low.
- Current state: The search page explicitly says its criteria are saved in the URL. Search state is represented by internal TanStack hash-route parameters; the desktop window has no normal browser address bar.
- Technical analysis: Remove or rewrite the explanatory copy while retaining internal search parameters unless the request explicitly asks to change filter persistence. Preserving route state supports back/forward navigation and reopening a search.

## Discovery, notifications, and catalog defects

### DISC-13 — Follow airing anime and notify on new episodes

- Difficulty: High.
- Current state: The app displays a general airing schedule and has a Watch Later list, but no followed-anime notification preference was found.
- Technical analysis: Define whether following is a separate list or reuses an existing list. Store it locally and decide whether it participates in optional account sync. Detect new episodes from AniList schedule data without aggressive polling, and handle time zones, duplicate alerts, offline periods, and missed-airing changes.

### DISC-14 — General notification center

- Difficulty: High.
- Current state: The app has an update center for application updates, but no general inbox for anime, maintenance, provider, or moderation messages.
- Technical analysis: Separate notification sources and define retention, read/dismiss state, delivery timing, and offline behavior. Moderation messaging and live service status require an agreed backend contract; they are not supplied by the current desktop application. Keep update notifications working independently.

### DISC-15 — Report unavailable providers automatically

- Difficulty: High.
- Current state: Local Anivexa runtime diagnostics exist, but no provider health reporting or outbound failure report was found.
- Technical analysis: Distinguish a confirmed provider outage from a transient network error, unsupported stream, or user cancellation. Any report sent off-device needs an endpoint, consent and retention rules, rate limiting, and strict redaction of signed stream URLs, authorization headers, and personal data.

### DISC-16 — Search preview with five results

- Difficulty: Medium.
- Current state: The header search submits a query; it does not show a result preview while typing.
- Technical analysis: Reuse the AniList search query and cache, debounce input, limit the preview to five results, and provide a “view more” route. Implement accessible combobox keyboard behavior, loading/empty/error states, request cancellation, and protection from stale results.

### DISC-17 — Search by screenshot using trace.moe

- Difficulty: High.
- Current state: No screenshot search or trace.moe integration was found.
- Technical analysis: Define accepted image formats and size limits, explain that image data is sent to an external service, and make that action explicit. Validate returned matches and map confirmed catalog IDs back to AniList metadata. Handle rate limits, network failure, cancellation, and untrusted response data.

### DISC-18 — Show continuation or recommendations at the finale

- Difficulty: Medium.
- Current state: The watch page already shows relations and recommendations on every episode; it does not condition their presentation on the final episode.
- Technical analysis: Detect a finale only when the current episode and known episode count provide reliable evidence. Prefer continuation relations when available, then show recommendations if no continuation exists. Avoid claiming a series has ended when it is ongoing or the provider's episode list is incomplete.

### DISC-19 — Search reports too many pages

- Difficulty: Medium.
- Current state: The search UI displays totalPages returned by the catalog service. The service derives this from AniList pageInfo; it also merges adult and non-adult results in include mode.
- Technical analysis: Reproduce the One Piece query and inspect raw, sanitized pageInfo values for both requests. Confirm how totals and lastPage relate to the merged page size before changing pagination. Add a regression case for the observed response and clamp navigation to valid pages.

### DISC-20 — Search jumps to the top when changing page

- Difficulty: Medium.
- Current state: Pagination updates the search route's page parameter. The handler has no explicit scroll call; runtime behavior has not been reproduced.
- Technical analysis: Reproduce with a long result list and determine whether router scroll restoration or component remounting causes the jump. Preserve query and filters, and restore the intended result-list position without interfering with back/forward navigation or accessibility focus.

### DISC-21 — Remove wasted space beside the Home schedule

- Difficulty: Low to Medium.
- Current state: Home uses a fixed-width schedule column at wide breakpoints and renders an empty-state message when no schedule entries are available.
- Technical analysis: Inspect the attached screenshot and reproduce the affected viewport/data state before changing layout. Consider collapsing or reflowing the schedule column when empty while preserving responsive balance and a useful empty state.

## Playback and offline use

### DISC-22 — Remember player preferences such as volume

- Difficulty: Medium.
- Current state: Watch progress is persisted, but no application-level volume preference was found.
- Technical analysis: Select the supported player settings to persist, store them using the app's local preference model, and restore them when a Vidstack instance mounts. Validate numeric ranges and use safe defaults. Do not persist signed source URLs or provider credentials.

### DISC-23 — Download episodes for offline playback

- Difficulty: High.
- Current state: Library, ratings, and progress support local/offline use; episode media download was not found.
- Technical analysis: First determine which providers and stream types permit downloads. HLS/DASH downloads involve manifests, segments, headers, proxy transformations, storage limits, cancellation, integrity, cleanup, and offline playback selection. Preserve the existing media proxy and provider contracts; do not assume every stream can be downloaded.

### DISC-24 — Sync downloads with a mobile app

- Difficulty: Very high; outside the current desktop repository scope.
- Current state: No mobile application or episode-download feature is part of this repository. Existing account sync covers supported library data, not media files.
- Technical analysis: This requires an explicitly scoped cross-product design, including a mobile client, backend storage/transfer, quota, bandwidth, offline authorization, and user-data policy. Do not modify the separate website or Anivexa submodule as part of a desktop-only implementation.

## Feedback intake

### DISC-25 — Submit suggestions and bug reports

- Request date (Brasília): 2026-11-23.
- Reply metadata: The 00:38 Brasília follow-up is a native Discord reply to the 00:31 request, confirmed by the local MCP reader.
- Difficulty: High.
- Current state: No general suggestion/report intake UI or GitHub issue automation was found. The app already uses Supabase for account services, but no feedback intake contract or table was found.
- Technical analysis: A shared feedback component is applicable to the desktop app, with distinct suggestion/report categories and classification tags. Store validated entries in a dedicated Supabase table, with defined consent, privacy, retention, rate limits, and anti-abuse controls. A trusted backend workflow should take reviewed entries from Supabase, reshape free-form user text into the project's standard issue format, and create the corresponding GitHub issues. Keep GitHub credentials on the backend; never ship a GitHub token in the Electron app. The UI and backend automation may need separate implementation scopes.

## Discovery and catalog defects

### DISC-26 — Disable the unsupported music format filter

- Request date (Brasília): 2026-11-23.
- Difficulty: Medium.
- Current state: Search exposes `MUSIC` in its format filters, while the AniList query is constrained to anime and the app has no music playback flow. The reported client error has not been independently reproduced.
- Technical analysis: Reproduce the failure and trace whether it occurs in search results, anime details, or playback. Temporarily remove the unsupported `MUSIC` filter from the UI, then audit the other exposed format and source filters against the app's anime metadata and Anivexa playback contracts. Preserve AniList query behavior and do not claim the reported cause is confirmed until reproduced.

## Discord integrations

### DISC-27 — Show Animonkey presence in Discord

- Request date (Brasília): 2026-11-23.
- Difficulty: High.
- Current state: No Discord presence integration was found. This is a desktop-app feature and could be optional.
- Technical analysis: Define opt-in behavior and which activity details may be shared before selecting an integration mechanism. Cover Discord being closed or unavailable, app lifecycle, platform support, and privacy. Never expose provider URLs, account credentials, or other private data in presence.

### DISC-28 — Announce releases and new episodes through a Discord bot

- Request date (Brasília): 2026-11-23.
- Difficulty: Very high; the bot itself is outside the desktop app's scope.
- Current state: No Discord bot or announcement service was found. The Electron app already registers the `app:` protocol and can open anime deep links by ID.
- Technical analysis: Bot hosting, Discord credentials, announcement sources, deduplication, and scheduling belong in a separate trusted service. The desktop app can support the request by opening validated anime deep links; define the bot's link format against the existing protocol and route contract. Do not embed bot credentials or implement the bot inside the renderer.

## Provider health monitoring

### DISC-29 — Monitor provider availability in a Supabase health table

- Request date (Brasília): 2026-11-23, 00:48.
- Difficulty: High; primarily a backend service task.
- Current state: The desktop app has local Anivexa runtime diagnostics, but no scheduled provider health pipeline or shared Supabase status table was found. This is related to, but distinct from, client-side failure reports in DISC-15.
- Technical analysis: Define which frequently used providers to probe, the check cadence, success criteria, retry policy, and freshness/expiry of stored results. Run probes in a trusted scheduled service and write sanitized status records through a restricted backend contract; do not expose provider credentials or probe secrets to Electron. Guard against transient network errors and false outage reports.

## Per-item branch and integration rule

When an item is selected for development:

1. Create one unique branch for that catalog item, based on the latest dev branch. Do not combine unrelated Discord items on one branch.
2. Use a focused name such as **feat/discord-disc-16-search-preview** or **fix/discord-disc-19-search-pagination**.
3. Target dev for integration. Follow AGENTS.md and CONTRIBUTING.md for pull-request and review requirements. Never integrate these items into main without separate explicit release authorization.
4. If one selected item must be split into independently reviewable changes, give each resulting change its own branch and record the relationship here.

The backlog does not authorize implementation. The owner selects each item before feature work begins.
