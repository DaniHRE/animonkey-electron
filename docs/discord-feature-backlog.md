# Discord Feature and Fix Backlog

## Scope and source

This backlog catalogs the 38 messages returned by the local Discord channel reader with the configured cutoff of 2026-11-21 03:00 UTC (2026-11-21 00:00 in Brasília). The requests come from the project's private testers Discord and are dated 2026-11-21 or 2026-11-23 in Brasília. Follow-up messages that expand one request are grouped into a single item; Discord message IDs are intentionally omitted. No earlier Discord messages were used.

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
- Current state: Settings has a local “include adult content in discovery” preference that defaults to off for existing installations and backups without the key. The preference applies to search and its header preview, Home and catalog lists, airing schedules, relations, recommendations, and adult search tags. Anime discovery uses this global setting without per-search content mode controls. Invalid AniList anime/adult flags are excluded from discovery results; direct title links and user-owned library items remain accessible.
- Technical analysis: Persist a validated boolean with a fail-closed default. Apply the setting through query keys, AniList requests, and recommendation mapping so changing it refreshes the affected surfaces. Keep discovery behavior controlled by the global setting, default missing or invalid imports to exclude, and do not silently remove existing library or progress data.

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
- Current state: Anime pages can add or remove a separate local “Acompanhar” entry, independent of Assistir Depois. Up to 50 followed anime are stored in local preferences and included in local backups; they do not sync with the account. Native new-episode notifications are opt-in and off by default; successfully shown alerts also appear in the local notification center. While the app is open and online, AniList airing data is checked every 15 minutes; successful alerts are deduplicated by episode, and a catch-up alert can cover the latest missed episode. Settings explains that the notification exposes the title and episode to the operating system.
- Technical analysis: Keep following separate from Watch Later and local-only until account sync is explicitly designed. Require an opt-in for system notifications, avoid polling while offline or disabled, use AniList airing data with a bounded cadence, and deduplicate alerts. On reconnect, report at most the latest missed episode rather than generating a notification burst.

### DISC-14 — General notification center

- Difficulty: High.
- Current state: The header has a local notification center for followed-anime episode alerts and application update-ready/installed events. Entries work offline, are retained for up to 30 days with a 100-item limit, and support mark-all-read and per-item dismissal. Episode notices open the anime page; update notices open the existing update center. A proposed public-feed contract for remote maintenance, curated provider-health, global moderation, spotlight, and trending messages is documented in [Remote notification delivery contract proposal](remote-notification-contract-proposal.md); the owner has not approved the contract, so remote messages are not implemented or shown.
- Technical analysis: Keep local notification sources independent from remote feeds, use stable event IDs, and bound local retention. Preserve offline access, read/dismiss state, and the existing update flow. Add maintenance, provider-health, moderation, and editorial messages only after their backend source and delivery contract are agreed; do not imply those messages are available from the current client.

### DISC-15 — Report unavailable providers automatically

- Difficulty: High.
- Current state: The desktop client can optionally report an authenticated provider lookup response with HTTP 502, 503, or 504. Reporting is off by default and available from Settings > Privacy. Reports contain an allowlisted provider ID, status, consent version/time, account association, and creation time; they exclude anime/episode identifiers, titles, URLs, headers, response bodies, raw errors, timeouts, cancellations, and 404 responses. The backend limits accepted reports to 10 per account per 24 hours, deduplicates by provider for one hour, and deletes reports after 30 days. Reports are included in the account data export. The provider-reporting schema is applied to the connected Supabase project, and `desktop-api` v10 is active. Packaged-client runtime validation remains outstanding.
- Technical analysis: Treat these as client-observed provider-route failures, not confirmed provider outages. Keep reporting opt-in, authenticated, allowlisted, rate-limited, deduplicated, and redacted. Do not infer a general outage from an individual client report; independent scheduled probes are unavailable while Anivexa runs only as an embedded local runtime (DISC-29).

### DISC-16 — Search preview with five results

- Difficulty: Medium.
- Current state: The header search now shows up to five debounced AniList results with poster, title, type, and an adult-content indicator. Users can open a title, use arrow keys and Enter to select suggestions, or submit the query to the full search page. Loading, empty, and error states are exposed to assistive technology; the shared query cache and abort signal handle reuse and stale requests.
- Technical analysis: Reuse the AniList search query and cache, debounce input, limit the preview to five results, and provide a “view more” action. Implement accessible combobox keyboard behavior, loading/empty/error states, request cancellation, and protection from stale results.

### DISC-17 — Search by screenshot using trace.moe

- Difficulty: High.
- Current state: Screenshot search is available from a header widget beside app updates rather than from the Discovery page. It accepts PNG, JPEG, or WebP images up to 10 MiB through file selection, drag-and-drop, or clipboard paste, previews the file locally, and uploads only after the user chooses “Buscar.” A narrow IPC bridge sends the image to trace.moe; the app does not persist it. Returned IDs, scene times, episode values, and similarity scores are validated before matching the IDs to AniList results and applying the global adult-content preference. Search supports cancellation and presents service, timeout, and rate-limit errors.
- Technical analysis: Keep screenshot search in an accessible header popover/widget beside app updates. Support clipboard paste, drag-and-drop, and file selection through the same local preview and validation path. Keep the upload user-initiated and disclose the external transfer before submission. Limit formats, size, request duration, and response size; validate results before using catalog IDs; and handle rate limits, network failure, cancellation, and untrusted response data. trace.moe documents multipart image uploads and states that images uploaded to its search engine are deleted immediately ([API](https://github.com/soruly/trace.moe-api/blob/master/swagger.yaml), [terms](https://trace.moe/terms)).

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
- Current state: The owner has deferred all download functionality for now and asked to pursue a different approach. No download implementation should proceed until that approach is defined. The prior permission and provider research remains reference material; no downloader has been implemented.
- Technical analysis: If download functionality is reconsidered, enable it only for provider and stream combinations with explicit authorization, and distinguish provider-supplied download links from permission to create offline copies. HLS/DASH downloads involve manifests, segments, headers, proxy transformations, storage limits, cancellation, integrity, cleanup, and offline playback selection. Preserve the existing media proxy and provider contracts; do not infer permission from a playback URL or a `downloads` field.

### DISC-24 — Sync downloads with a mobile app

- Difficulty: Very high; outside the current desktop repository scope.
- Current state: No mobile application or episode-download feature is part of this repository. Existing account sync covers supported library data, not media files.
- Technical analysis: This requires an explicitly scoped cross-product design, including a mobile client, backend storage/transfer, quota, bandwidth, offline authorization, and user-data policy. Do not modify the separate website or Anivexa submodule as part of a desktop-only implementation.

## Feedback intake

### DISC-25 — Submit suggestions and bug reports

- Request date (Brasília): 2026-11-23.
- Reply metadata: The 00:38 Brasília follow-up is a native Discord reply to the 00:31 request, confirmed by the local MCP reader.
- Difficulty: High.
- Current state: The desktop app has one authenticated feedback form for suggestions and bug reports, with functional-area classification, explicit consent, server-side validation, and a three-submission per account per 24-hour limit. Consent version `feedback-v2` explains that reviewed text may be formalized as a repository Issue. The `feedback_intake` migration is applied to the connected Supabase project, and `desktop-api` v10 is active. A manually dispatched GitHub Actions workflow is prepared locally to accept a reviewed title/body, verify the feedback UUID, add type/area labels, and avoid publishing the raw submission or account ID. The workflow is not on the remote default branch, so issue automation is not active. Packaged-client runtime validation also remains outstanding.
- Technical analysis: Store only the account ID, feedback type, functional area, title, description, consent version, and timestamps. The table has RLS enabled and no client-role access; the authenticated desktop API invokes a restricted database function. Include submitted entries in the account data export and remove them when the account is deleted or after 180 days. Keep an explicit maintainer review before issue creation, use only the reviewed public-facing title/body and non-identifying category metadata, and keep the Supabase secret API key and GitHub token out of Electron packages.

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
- Current state: Canceled by the owner on 2026-11-24 before implementation. No Rich Presence integration will be developed.
- Technical analysis: No further SDK acquisition, portal submission, or code changes are planned for this request.

### DISC-28 — Announce releases and new episodes through a Discord bot

- Request date (Brasília): 2026-11-23.
- Difficulty: Very high; the bot itself is outside the desktop app's scope.
- Current state: Canceled by the owner on 2026-11-24 because no external hosting is available for the bot or its required services. No Discord bot or announcement service will be developed.
- Technical analysis: The bot requires externally hosted infrastructure for Discord credentials, announcement sources, deduplication, and scheduling. This request is canceled until that hosting is available; do not implement bot services in the desktop app.

## Provider health monitoring

### DISC-29 — Monitor provider availability in a Supabase health table

- Request date (Brasília): 2026-11-23, 00:48.
- Difficulty: High; primarily a backend service task.
- Current state: Implemented on the local development branch. A GitHub Actions workflow is configured to run the pinned Anivexa API route handlers every six hours, probe one documented sample per provider, and upsert each provider's latest sanitized status into `public.anivexa_provider_health`. The migration is applied to the connected Supabase project. A manual run on 2026-11-24 exercised all 12 providers: nine were healthy, one was indeterminate because its sample did not match, and two were unavailable after technical failures. Its 12 sanitized rows were upserted into Supabase through the connected MCP session and confirmed with a read query. The table has no renderer access and stores no sample IDs, titles, URLs, response bodies, or raw errors. The scheduled workflow remains local and inactive on GitHub.
- Technical analysis: Run probes in a trusted scheduled service against the pinned embedded Anivexa runtime; Anivexa is not remotely hosted. Keep the monitor independent of desktop clients and use the six-hour cadence and per-provider sample matrix confirmed by the owner. Distinguish successful episode results, technical failures, and sample catalog no-matches, then publish only the latest sanitized snapshot through a server-side Supabase key. See [Anivexa provider health monitoring](anivexa-provider-health-monitoring.md) for the matrix, status rules, and workflow configuration.

## Runtime diagnostics

### DISC-30 — Investigate Anivexa runtime cancellations and DevTools access

- Request date (Brasília): 2026-11-23, 12:20.
- Difficulty: Medium to High.
- Current state: The reported IPC error is caused by an expected renderer `AbortSignal` cancellation: the preload sends `anivexa:cancel`, `AnivexaRuntime.cancel()` rejects the pending request, and the rejected promise reaches Electron's `ipcMain.handle` logger. The renderer has already aborted that request; this stack trace does not establish a runtime crash or increased response latency. Expected cancellations now return an internal HTTP 499 sentinel at the IPC boundary, while other errors still reject. Changes are integrated locally into `dev` at `1596e97`. In a local development runtime, the Anivexa diagnostics panel showed the runtime as active and F12 opened a detached DevTools window for Vite. The production `BrowserWindow` now enables DevTools only when `MAIN_WINDOW_VITE_DEV_SERVER_URL` is present. A local Windows x64 package rebuild succeeded, and the owner confirmed that F12 remains disabled in the packaged executable while it opens DevTools in the development version. The packaged app rendered Home in an isolated temporary profile; the automated F12 re-check was stopped by owner input. A manually opened anime detail page fetched `/episodes/200294` successfully with HTTP 200, so it did not reproduce the renderer cancellation; the HTTP 499 cancellation path remains unverified.
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
- Current state: Implemented and integrated locally into `dev`. A local development runtime visual check confirmed Settings > Debug renders runtime status, severity counts and filters, the current-session Anivexa event list, and export/clear actions; the runtime status showed Active. Export and clear behavior were not exercised. The export includes app version and timestamp and may contain provider and anime IDs; it excludes credentials, signed URLs, and payloads.
- Technical analysis: Give the debug area a clear Settings destination with runtime status, event counts, readable recent entries, severity filters, and actions to export and clear the current session diagnostics. Keep exports limited to sanitized diagnostic data, use a native save dialog, and disclose that request summaries can contain provider and anime identifiers. Do not imply that logs persist between sessions or include credentials, signed URLs, or request payloads.

## Account configuration and Windows distribution

### DISC-33 — Configure the account API in the Windows package

- Request date (Brasília): 2026-11-23, 18:28.
- Difficulty: Low to Medium.
- Current state: A user reported that account registration in the distributed app fails because the account service is not configured. The main-process Vite config requires `VITE_DESKTOP_API_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; both Windows packaging workflows pass these values from GitHub Actions repository variables, and production builds fail when either value is missing or the API URL is not an HTTPS `/desktop-api` endpoint. The owner confirmed both repository variables are configured. A local Windows x64 Squirrel package build succeeded using the ignored local `.env`; inspection of `app.asar` confirmed both public values are embedded in JavaScript bundles and the `.env` file is excluded. This does not independently validate the GitHub variable contents. The already distributed installer is unchanged.
- Technical analysis: Treat the Desktop API URL and Supabase publishable key as public build-time configuration, not secrets. Explicitly inject them into both Windows packaging workflows and never rely on a local ignored `.env`. Keep service-role keys and other private credentials out of Vite and the distributed app.

### DISC-34 — Open screenshot search from a header widget

- Request date (Brasília): 2026-11-23, 19:28.
- Difficulty: Medium.
- Current state: This standalone request asks for a screenshot-search widget near the update action with clipboard paste, drag-and-drop, and file selection. Those flows are already implemented by DISC-17 in commit `038ecc5`: the header widget provides all three inputs, previews and validates the image locally, and sends it to trace.moe only after the user chooses to search. No additional code change is needed for this request.
- Technical analysis: Keep the widget in the application header rather than Discovery. Route clipboard, dropped, and selected files through the same size/type validation and user-initiated upload path, and disclose the external transfer before search.

## Per-item branch and integration rule

When an item is selected for development:

1. Create one unique branch for that catalog item, based on the latest dev branch. Do not combine unrelated Discord items on one branch.
2. Use a focused name such as **feat/discord-disc-16-search-preview** or **fix/discord-disc-19-search-pagination**.
3. Target dev for integration. Follow AGENTS.md and CONTRIBUTING.md for pull-request and review requirements. Never integrate these items into main without separate explicit release authorization.
4. If one selected item must be split into independently reviewable changes, give each resulting change its own branch and record the relationship here.

The backlog does not authorize implementation. The owner selects each item before feature work begins.
