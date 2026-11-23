# Discord Feature and Fix Backlog

## Scope and source

This backlog catalogs the 36 messages returned by the local Discord channel reader with the configured cutoff of 2026-11-21 03:00 UTC (2026-11-21 00:00 in Brasília). The requests come from the project's private testers Discord and are dated 2026-11-21 or 2026-11-23 in Brasília. Follow-up messages that expand one request are grouped into a single item; Discord message IDs are intentionally omitted. No earlier Discord messages were used.

The reader returns attachment filenames, not attachment contents. The selected DISC-31 header image was retrieved through the local read-only Discord configuration after the owner requested it; the DISC-32 debug-panel reference image was also retrieved and reviewed for the selected request. Other attachment content remains unreviewed.

This is an inventory, not an approved implementation plan. Estimates are relative: Low means a localized UI or behavior change; Medium means multiple renderer components or persisted preferences; High means substantial integration, data policy, or media/storage work; Very high means cross-product or platform scope. Defect reports are not treated as confirmed causes until reproduced.

## Navigation and application shell

### DISC-01 — Custom navigation bar appearance

- Difficulty: Medium.
- Current state: Shipped in Animonkey Desktop 1.0.3 on `main`. Windows uses a frameless window with a hidden native menu and compact application controls in a transparent 32-pixel strip. The packaged Windows build passed, but the window was not visually checked at runtime. Other platforms retain native window chrome.
- Technical analysis: On Windows, use a frameless BrowserWindow and remove its menu. Place compact, accessible application controls in a 32-pixel draggable strip above the existing navigation header. Keep native window chrome on other platforms and preserve resizing, maximize/restore, minimize, close, and the existing router.

### DISC-02 — Restore the last visited page

- Difficulty: Medium.
- Current state: Shipped in Animonkey Desktop 1.0.3 on `main`. The renderer stores the last successfully resolved, allow-listed hash route in versioned local storage and restores it when startup begins at the default home route. An explicit app-protocol anime deep link takes precedence. Invalid routes or parameters leave startup at home; existing route error states and shell navigation remain available when content cannot load.
- Technical analysis: Persist only validated internal routes and supported parameters. Restore them through the existing hash history, while allowing explicit deep links to take precedence. Keep local data and home navigation available when a stored route is invalid or its data is unavailable.

### DISC-03 — Application-level back button

- Difficulty: Low to Medium.
- Current state: Shipped in Animonkey Desktop 1.0.3 on `main`. Back and forward controls sit in Windows' custom title bar beside the window controls; platforms with native title bars keep them in the app header. Back uses TanStack's in-app history index. Without a valid in-app entry it returns non-home routes to Início and is disabled on Início. Forward is enabled only for an in-app entry observed during the current session. Navigation preserves hash routes and query state, including the episode parameter.
- Technical analysis: Add a shell control that uses TanStack Router history and handles an empty or external-entry history safely. Preserve hash routes, browser back/forward behavior, and the episode query parameter.

### DISC-04 — Common and configurable keyboard shortcuts

- Difficulty: Medium.
- Current state: Settings provides editable, locally persisted shortcuts for toggling the sidebar, focusing search, and opening Settings. The command registry uses Ctrl on Windows/Linux and Command on macOS, reserves common editing, window, browser, and developer-tools shortcuts, rejects collisions, and ignores key events from editable controls. Preferences are included in local backups.
- Technical analysis: Keep application commands in a typed renderer registry and persist only validated shortcut bindings. Reject reserved combinations and collisions before saving, normalize imported preference values, and do not handle shortcuts while the user is typing in an input or editable control. Keep playback shortcuts owned by Vidstack where possible.

### DISC-05 — Reorderable sidebar

- Difficulty: Medium.
- Current state: Settings can reorder the links within the primary and More sections using accessible up/down controls. Início and Explorar stay pinned. The order is stored as allow-listed stable identifiers in local preferences and included in backups; normalization removes unknown and duplicate identifiers and appends newly supported routes in their default order.
- Technical analysis: Persist only stable identifiers from the renderer's route registry, keep Início and Explorar pinned, and supply defaults for newly added or removed destinations. Resolve every identifier through the static route registry; never persist arbitrary URLs or trust renderer-provided route strings as navigation targets.

### DISC-06 — Move title-language preference to Settings

- Difficulty: Low.
- Current state: The title-language control is in Settings > Preferências. Its selection is stored in the existing local preference store and included in local preference backups; the default remains Japanese (romaji), and invalid imported values fall back to that default.
- Technical analysis: Keep the EN/JP selection in local application preferences and expose it in Settings rather than the header. Preserve the current title resolution behavior and make the selected language visible to the user.

## Settings, privacy, and interaction

### DISC-07 — Redesign the Settings page

- Difficulty: Medium.
- Current state: Shipped in Animonkey Desktop 1.0.3 on `main`. Account and sync, Anivexa diagnostics, and local backup use a section navigation layout inspired by the reviewed Re:ANIME Settings page. Caption guidance is temporarily commented out until the player exposes configurable caption controls.
- Technical analysis: Adapt the reference's persistent settings navigation and clear section hierarchy to the Electron app's existing dark and green visual identity. Preserve local-data and account boundaries, loading/error/offline states, accessible labels, and current Anivexa diagnostics. Keep the redesign within the Electron repository.

### DISC-08 — Adult-content preference with SFW default

- Difficulty: Medium.
- Current state: Settings has a local “include adult content in discovery” preference that defaults to off for existing installations and backups without the key. The preference applies to search and its header preview, Home and catalog lists, airing schedules, relations, recommendations, and adult search tags. Search can override the global setting per query. Invalid AniList anime/adult flags are excluded from discovery results; direct title links and user-owned library items remain accessible.
- Technical analysis: Persist a validated boolean with a fail-closed default. Apply the setting through query keys, AniList requests, and recommendation mapping so changing it refreshes the affected surfaces. Preserve the per-search include/exclude/only choice, default missing or invalid imports to exclude, and do not silently remove existing library or progress data.

### DISC-09 — Adult-content privacy controls

- Difficulty: High.
- Current state: Settings has separate controls for recording new local episode progress, showing Continue Watching on Home and in navigation, syncing episode progress with an account, and sharing activity in the account feed. Controls default to the current behavior. Disabling them stops future writes, pauses progress sync, or hides entries without deleting existing local or remote records. Privacy preferences are included in local backups and validated on import.
- Technical analysis: Keep local progress recording, Continue Watching visibility, episode-progress sync, and account activity visibility independent. Sync opt-out skips only episode-progress reconciliation; library and rating sync continue. Preserve existing local and remote data while disabled, keep local backups valid for all supported preferences, and restore normal behavior when each control is re-enabled.

### DISC-10 — Configure caption appearance in Settings

- Difficulty: Medium.
- Current state: Settings has a caption section for selecting small, medium, large, or extra-large text. The validated `player.subtitle-size` preference is stored locally, included in backups, and applied to Vidstack's caption font-size multiplier. The existing player remains responsible for track selection and playback.
- Technical analysis: Keep the preference limited to supported size values, default missing or invalid stored values to medium, and use Vidstack's existing caption style variable. Do not infer caption availability or language, and do not add a second player framework.

### DISC-11 — Avoid accidental text selection

- Difficulty: Low to Medium.
- Current state: Sidebar navigation, sidebar visibility controls, header history controls, and window controls do not initiate text selection. Form fields and readable page content remain selectable.
- Technical analysis: Scope non-selectable styling to navigation and window controls. Preserve selection in form fields and readable content that users may need to copy; do not apply a blanket restriction to the application.

### DISC-12 — Remove the “filters saved in URL” explanation

- Difficulty: Low.
- Current state: The search page describes AniList filtering without exposing internal URL persistence. Search state remains in TanStack hash-route parameters, preserving back/forward navigation and reopening a search.
- Technical analysis: Remove copy that explains filters are saved in the URL. Keep the underlying search route parameters because they support back/forward navigation and reopening a search.

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
- Current state: The header search now shows up to five debounced AniList results with poster, title, type, and an adult-content indicator. Users can open a title, use arrow keys and Enter to select suggestions, or submit the query to the full search page. Loading, empty, and error states are exposed to assistive technology; the shared query cache and abort signal handle reuse and stale requests.
- Technical analysis: Reuse the AniList search query and cache, debounce input, limit the preview to five results, and provide a “view more” action. Implement accessible combobox keyboard behavior, loading/empty/error states, request cancellation, and protection from stale results.

### DISC-17 — Search by screenshot using trace.moe

- Difficulty: High.
- Current state: The Search page accepts PNG, JPEG, or WebP images up to 10 MiB, previews the selected file locally, and uploads it only after the user selects “Enviar imagem e buscar.” A narrow IPC bridge sends the image to trace.moe; the app does not persist it. Returned IDs, scene times, episode values, and similarity scores are validated before matching the IDs to AniList results and applying the current adult-content filter. Search supports cancellation and presents service, timeout, and rate-limit errors.
- Technical analysis: Keep the upload user-initiated and disclose the external transfer before submission. Limit formats, size, request duration, and response size; validate results before using catalog IDs; and handle rate limits, network failure, cancellation, and untrusted response data. trace.moe documents multipart image uploads and states that images uploaded to its search engine are deleted immediately ([API](https://github.com/soruly/trace.moe-api/blob/master/swagger.yaml), [terms](https://trace.moe/terms)).

### DISC-18 — Show continuation or recommendations at the finale

- Difficulty: Medium.
- Current state: On a confirmed final episode, the watch page highlights AniList sequel relations, or recommendations when no sequel relation exists. Finale detection requires a finished catalog status, a positive known episode count, and a complete contiguous provider episode list that matches that count.
- Technical analysis: Treat the finale as confirmed only when catalog status, total episode count, provider episode sequence, and current episode all agree. Prefer sequel relations, then recommendations if no continuation exists. Keep the existing related titles and recommendation sections on other episodes; do not classify ongoing series or incomplete provider lists as finished.

### DISC-19 — Search reports too many pages

- Difficulty: Medium.
- Current state: A live `One Piece` query returned `total: 5000` and `lastPage: 500` on the first non-adult page, while page 10 was empty and reported `hasNextPage: false`. AniList's pagination guide says `total` and `lastPage` are not accurate and advises relying on `hasNextPage`. Search and catalog pagination now show the current page and use `hasNextPage` to enable the next action; displayed counts describe only results on that page.
- Technical analysis: Treat AniList `total` and `lastPage` as unreliable. Use `hasNextPage` for forward navigation and avoid presenting an estimated total count or page count as exact, including when search results merge adult and non-adult requests.

### DISC-20 — Search jumps to the top when changing page

- Difficulty: Medium.
- Current state: Search page changes now set TanStack Router's `resetScroll` option to `false`, preserving the current scroll position while the page parameter changes. Query and filter changes keep their normal navigation behavior. Runtime visual validation has not been performed.
- Technical analysis: TanStack navigation resets scroll to the top by default. Override that behavior only for search pagination; preserve route history, query, and filters so back and forward navigation continue to work.

### DISC-21 — Remove wasted space beside the Home schedule

- Difficulty: Low to Medium.
- Current state: The reviewed screenshot shows the fixed-width schedule column ending after five entries while later discovery rails remain confined to the left column. The Home layout now keeps Continue Watching and Watch Later beside the schedule on wide screens, then lets discovery rails span the full content width. On small screens, the schedule remains after those rails.
- Technical analysis: Reflow the fixed-width schedule alongside only the initial Home content and allow later discovery sections to use the full grid width. Preserve a useful schedule empty state and keep the existing single-column mobile order.

## Playback and offline use

### DISC-22 — Remember player preferences such as volume

- Difficulty: Medium.
- Current state: Shipped in Animonkey Desktop 1.0.3 on `main`. Vidstack volume uses the IndexedDB-backed local preference store, and Anivexa episode lists use a persistent client-side cache with expiry driven by the next airing time and hourly retries when a scheduled episode is still missing.
- Technical analysis: Store volume with `useLocalPreference` so it survives app restarts. Persist episode lists in the existing IndexedDB catalog cache and return cached data until its deadline. Use the AniList next-airing timestamp as the TTL; after that time, retry hourly while the expected episode is missing. Once it appears, expire at the following weekly slot, or in seven days when an ongoing series has no updated schedule. Keep completed series with a complete episode list for 30 days. A failed refresh serves the last cached list and retries in one hour. Do not persist signed source URLs or provider credentials; stream-link caching remains a separate decision.

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
- Current state: The `MUSIC` format is removed from both format pickers and ignored in legacy search URLs before filtering, display, and active-filter counts. Search remains constrained to AniList anime. Source options describe the work an anime was adapted from, not a streaming provider, and the exposed values match the current `MediaSource` enum. An attempted `version: 3` argument on `Page.media` was rejected by AniList and broke search and catalog requests; the unsupported argument has been removed. Episode and provider availability remains an Anivexa lookup.
- Technical analysis: Keep the search query constrained to `ANIME`, make `MUSIC` unavailable as a selectable filter, and discard stale `MUSIC` format values from old URLs. Preserve `MUSIC` in the metadata type because AniList may still return that format. Keep exposed status, season, sort, and source values aligned with AniList's enums. Do not pass a `version` argument to `Page.media`, whose schema does not accept it, and describe source filters as adaptation metadata rather than playback availability.

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

## Runtime diagnostics

### DISC-30 — Investigate Anivexa runtime cancellations and DevTools access

- Request date (Brasília): 2026-11-23, 12:20.
- Difficulty: Medium to High.
- Current state: The reported IPC error is caused by an expected renderer `AbortSignal` cancellation: the preload sends `anivexa:cancel`, `AnivexaRuntime.cancel()` rejects the pending request, and the rejected promise reaches Electron's `ipcMain.handle` logger. The renderer has already aborted that request; this stack trace does not establish a runtime crash or increased response latency. Expected cancellations now return an internal HTTP 499 sentinel at the IPC boundary, while other errors still reject. F12 and the platform DevTools shortcut open detached DevTools only when the Vite development server is active. Changes are integrated locally into `dev` at `1596e97`; runtime behavior has not yet been verified.
- Technical analysis: Preserve the renderer's abort as the source of cancellation and keep expected aborts separate from provider failures. Do not log sensitive request data. Restrict DevTools access to development builds and preserve the production security model.

## Application updates

### DISC-31 — Redesign the application update center

- Request date (Brasília): 2026-11-23, 12:47.
- Difficulty: Medium.
- Current state: Shipped in Animonkey Desktop 1.0.3 on `main`. The header places the update action beside an avatar-only profile link, the status indicator pulses while a package downloads or is ready, and the dialog browses versioned release notes from the app's existing release data. The requested Discord image was retrieved and reviewed after the owner asked for it.
- Technical analysis: Place the update action beside an avatar-only profile control. Use the supplied compact header reference, preserve the existing update state and install flow, and add a restrained pulse only while a new package is downloading or ready, respecting reduced-motion preferences. Let users browse the existing versioned release notes as update history without adding another update service or persistence layer.

## Debug settings

### DISC-32 — Redesign the settings debug panel

- Request date (Brasília): 2026-11-23, 16:23.
- Difficulty: Medium.
- Current state: Implemented and integrated locally into `dev`. Settings now has a Debug section with runtime status, severity counts and filters, and a readable list of current-session Anivexa events. Users can export the session records to JSON through a native save dialog or clear them. The export includes app version and timestamp and may contain provider and anime IDs; it excludes credentials, signed URLs, and payloads. Visual runtime validation has not been performed.
- Technical analysis: Give the debug area a clear Settings destination with runtime status, event counts, readable recent entries, severity filters, and actions to export and clear the current session diagnostics. Keep exports limited to sanitized diagnostic data, use a native save dialog, and disclose that request summaries can contain provider and anime identifiers. Do not imply that logs persist between sessions or include credentials, signed URLs, or request payloads.

## Per-item branch and integration rule

When an item is selected for development:

1. Create one unique branch for that catalog item, based on the latest dev branch. Do not combine unrelated Discord items on one branch.
2. Use a focused name such as **feat/discord-disc-16-search-preview** or **fix/discord-disc-19-search-pagination**.
3. Target dev for integration. Follow AGENTS.md and CONTRIBUTING.md for pull-request and review requirements. Never integrate these items into main without separate explicit release authorization.
4. If one selected item must be split into independently reviewable changes, give each resulting change its own branch and record the relationship here.

The backlog does not authorize implementation. The owner selects each item before feature work begins.
