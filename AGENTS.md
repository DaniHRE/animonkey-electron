# AGENTS.md — Animonkey Desktop

> Repository-wide instructions for OpenAI Codex and other AI coding agents.
>
> These instructions apply to the entire repository unless a more specific `AGENTS.md` exists in a subdirectory. Follow the most specific applicable instructions without violating the repository-wide security, GitFlow, language, or approval requirements.

## 1. Project Overview

Animonkey Desktop is an Electron application for anime discovery, personal library management, offline-first tracking, optional account synchronization, and playback through supported providers.

The application uses:

- Electron Forge and Vite
- React 19 and TypeScript in strict mode
- Tailwind CSS 4 and Radix-based UI components
- TanStack Router and TanStack Query
- Zustand where appropriate
- Vidstack, HLS.js, and dash.js
- AniList for catalog metadata
- The pinned Anivexa API submodule for episode and provider integration
- pnpm as the package manager

The desktop application is independent of the web application. Do not modify the separate `../animonkey` repository unless explicitly requested.

Before making changes, inspect the relevant source code, configuration, existing conventions, and active documentation. Do not rely on outdated architectural assumptions.

## 2. Non-Negotiable Rules

1. Never modify, merge into, push to, tag, or release from `main` without explicit authorization from the repository owner for that specific operation.
2. Treat `main` as the protected production branch containing approved stable releases only.
3. Treat `dev` as the permanent development and integration branch.
4. Never interpret permission to implement, test, commit, or merge into `dev` as permission to modify `main`.
5. Never push, create pull requests, publish packages, or trigger releases without explicit authorization.
6. Never force-push, rewrite shared history, delete remote branches, or modify GitHub repository settings without explicit authorization.
7. Preserve existing user changes and unrelated files.
8. Never commit secrets, credentials, private keys, access tokens, or sensitive runtime data.
9. Do not bypass security controls, disable validation, or weaken TypeScript strictness to make a change pass.
10. All repository-maintained technical content must be written in English.

When instructions conflict, prioritize security, data preservation, explicit user authorization, and the protected release workflow.

If a requested operation would violate these rules, stop and request explicit clarification.

## 3. Language Policy — English Only

**English is the mandatory language for all repository-maintained technical content.**

Write the following in English:

- Source code identifiers, comments, and developer-facing strings
- `AGENTS.md`, `CLAUDE.md`, and other AI-agent instructions
- All documentation under `docs/`
- `README.md`, contributing guides, and architecture documents
- Technical specifications, plans, checklists, and release documentation
- Commit messages, pull request titles, and pull request descriptions
- GitHub issue descriptions and technical discussions authored by agents
- Test descriptions, fixture documentation, and developer-facing diagnostics
- New filenames and directory names, where naming is not constrained by an existing contract

**Exceptions:**

- Localized user-interface text, including Brazilian Portuguese translations
- Localization resources and language-specific fixtures
- Proper nouns, external API fields, established identifiers, and compatibility-sensitive contracts
- User-provided text that must be preserved exactly

Do not translate public API contracts, persisted keys, routes, or identifiers merely to satisfy the language policy.

When editing an existing document containing Portuguese, write new material in English. Translate existing content when it is within the approved scope and can be done without changing its technical meaning.

Do not perform an unrelated repository-wide translation without explicit approval.

## 4. GitFlow and Branch Protection

### Branch responsibilities

| Branch | Purpose |
|---|---|
| `main` | Production-ready, explicitly approved stable releases only |
| `dev` | Ongoing development, integration, staging, and validation |
| `feature/*` or `feat/*` | New features based on `dev` |
| `fix/*` | Bug fixes based on `dev` |
| `refactor/*` | Refactoring based on `dev` |
| `chore/*` | Maintenance and tooling based on `dev` |
| `docs/*` | Documentation changes based on `dev` |
| `release/*` | Release stabilization when explicitly authorized |
| `hotfix/*` | Emergency production fixes under an explicitly approved release procedure |

### Required workflow

1. Inspect the current branch and working tree before editing.
2. Start ordinary work from an up-to-date `dev` branch.
3. Use a focused working branch when appropriate.
4. Keep each branch scoped to a clearly defined objective.
5. Implement and validate changes before requesting integration.
6. Integrate approved development work into `dev`, never directly into `main`.
7. Keep unverified or unreleased changes out of `main`.
8. Promote a tested release to `main` only after explicit approval from the repository owner.
9. Create release tags and publish artifacts only after separate explicit authorization.

A user request to implement a feature does **not** authorize a merge, push, pull request, release, or production deployment.

### Absolute protection of `main`

**The repository owner must explicitly approve every operation that changes `main` or publishes a release.**

This includes:

- Direct commits
- Pull request merges
- Branch merges or rebases affecting `main`
- Cherry-picks into `main`
- Remote pushes
- Release tags
- GitHub Releases publication
- Production deployment or distribution

Approval must be specific to the proposed operation. Previous approvals do not carry forward.

If the current branch is `main`, do not make changes there. Use an appropriate development branch or request instructions.

Never automatically promote `dev` to `main`, even when all checks pass.

### Release procedure

A release candidate must:

1. Have a clearly defined version and scope.
2. Have completed the applicable automated checks.
3. Have undergone the necessary functional and packaged-application validation.
4. Have updated release notes and active release documentation.
5. Have documented known limitations and outstanding issues.
6. Be presented to the repository owner for explicit approval.

Only after approval may the authorized release workflow update `main`, create tags, or publish artifacts.

A successful build is not equivalent to release approval.

### Git safety

Before modifying files, inspect:

```bash
git status --short
git branch --show-current
git diff --check
```

Do not overwrite unrelated work or stage files indiscriminately.

Use Conventional Commits when commits are explicitly requested or authorized.

Do not create commits automatically merely because an implementation is complete. When the user requests files or a proposal only, deliver the changes for review without committing.

## 5. Repository Architecture

Respect the separation between Electron's privileged and unprivileged environments.

### `src/main/`

Responsible for privileged desktop capabilities, including:

- Window lifecycle
- Native integrations
- Validated IPC handlers
- Secure external requests and media proxying
- Application protocols and deep links
- Desktop authentication and secure token storage
- Updates and operating-system integration

Keep privileged operations in the main process.

### `src/preload/`

Responsible for the minimal, typed bridge between the main process and renderer.

Expose narrow, domain-specific capabilities only.

Never expose unrestricted Electron, Node.js, filesystem, or IPC access.

### `src/renderer/`

Responsible for:

- Routes and application UI
- React components and hooks
- Client-side state
- Presentation logic
- Safe domain services and adapters
- Offline-first user data

Use the established directory structure and naming conventions.

Prefer domain-oriented components and services rather than creating unnecessary abstractions.

Do not import `electron`, privileged Node.js modules, or main-process modules into the renderer.

Do not introduce Next.js-specific imports or assumptions.

### Shared contracts

Keep shared types and IPC contracts explicit and strongly typed.

Validate untrusted data at process and network boundaries.

Avoid circular dependencies and unnecessary coupling between UI, domain logic, and platform adapters.

## 6. Electron Security

Electron security is a release-blocking concern.

Maintain the following BrowserWindow defaults unless an exception is explicitly justified and reviewed:

```ts
contextIsolation: true
nodeIntegration: false
sandbox: true
```

Additional requirements:

- Never expose raw `ipcRenderer`, `require`, or unrestricted filesystem access.
- Never implement a generic IPC execution bridge.
- Validate IPC channels, senders, payloads, and authorization.
- Treat renderer input and external provider responses as untrusted.
- Prevent untrusted navigation inside the application window.
- Open external URLs only through explicitly validated and permitted mechanisms.
- Maintain a restrictive Content Security Policy.
- Preserve secure protocol handling for application deep links.
- Never expose server-side credentials in Vite variables, renderer bundles, or packaged assets.
- Store desktop refresh tokens using Electron `safeStorage`, not renderer storage.
- Keep authentication and synchronization boundaries explicit.
- Sanitize errors and diagnostic events before exposing them to the renderer.
- Never log tokens, credentials, sensitive headers, or private user data.

Preserve the existing `animonkey-media:` protocol and its required CSP allowances for media, thumbnails, and associated resources.

Do not broaden CSP directives with unrestricted schemes or wildcard domains without a documented security review.

Security-sensitive changes require runtime verification, not only static compilation.

## 7. Application Contracts and Data Integrity

Preserve existing contracts unless the requested change explicitly includes a compatible migration.

### Catalog and metadata

- AniList remains the authoritative source for the established catalog fields.
- Preserve anime identifiers, media-type constraints, and adult-content filtering.
- Treat Taizen as an explicitly scoped enrichment source, not a replacement for AniList.
- Validate external metadata before exposing it through IPC.

### Episodes and playback

- Preserve the Anivexa episode and provider contracts.
- Preserve supported HLS and DASH playback behavior.
- Maintain the existing media proxy, required headers, range handling, and manifest transformations.
- Preserve subtitle support and provider-specific language metadata.
- Do not infer subtitle availability or language without evidence.
- Preserve provider fallback behavior without bypassing required proxy transformations.
- Treat external stream URLs and provider payloads as untrusted.

Vidstack is the application's player framework. Do not introduce a second player architecture without explicit approval.

### Routing

The renderer uses **TanStack Router with hash-based history**.

Preserve:

- Existing `#/...` navigation
- Back and forward navigation
- Typed route parameters
- Deep-link handling
- Existing episode query parameters, including `ep`

Do not reintroduce React Router.

### Offline-first behavior

Local persisted user data remains the source of truth for offline-capable functionality.

TanStack Query is used for request coordination, caching, and invalidation; it must not silently replace the established persistent data model.

Preserve:

- Local library and watch progress
- Ratings and preferences
- Offline usability
- Versioned backup import and export
- Optional synchronization
- Safe background reconciliation

Do not block access to locally available data while waiting for network authentication or synchronization.

## 8. UI, Accessibility, and Design

Follow the established Animonkey visual identity.

- Use the locally bundled Rubik font where required by the existing design.
- Prefer established design tokens and reusable components.
- Maintain accessible names, keyboard navigation, and visible focus states.
- Respect reduced-motion preferences.
- Preserve loading, empty, error, and offline states.
- Avoid layout changes that degrade readability or responsiveness.
- Do not introduce new UI libraries without a clear need and approval.
- Do not copy third-party compiled stylesheets, scripts, or proprietary assets.

The separate web application may be consulted as a design reference when available, but it must not be modified without explicit authorization.

Use evidence from the actual implementation rather than assuming that a visual reference establishes an architectural contract.

## 9. Dependencies and Tooling

Use the versions and tools declared by the repository.

- Respect the Node.js version specified in `package.json`.
- Use pnpm and the committed `pnpm-lock.yaml`.
- Do not introduce npm, Yarn, or Bun lockfiles.
- Do not update dependencies unrelated to the requested task.
- Do not modify the Anivexa submodule reference without explicit justification and approval.
- Prefer existing utilities and libraries over adding new dependencies.
- Keep TypeScript strict.
- Avoid `any`, unnecessary assertions, and unexplained lint suppressions.
- Do not leave debugging statements or temporary workarounds in production code.

Preserve locally generated or ignored development directories and files.

Do not commit machine-specific caches, local agent configurations, or private environment files.

Do not run optional external workflows or computer-control tools without the required user authorization.

## 10. Implementation Workflow

For each task:

### Understand

1. Read the request and identify the exact scope.
2. Check the current branch and working-tree state.
3. Inspect the relevant code, types, tests, and documentation.
4. Identify affected security boundaries and existing contracts.
5. Clarify requirements when implementation would otherwise require guessing.

### Plan

1. Prefer the smallest maintainable change that solves the problem.
2. Identify the files and components affected.
3. Consider backward compatibility and migration requirements.
4. Identify appropriate validation steps.
5. Avoid unrelated refactoring or dependency upgrades.

### Implement

1. Follow established patterns.
2. Keep changes focused and reviewable.
3. Preserve existing behavior outside the approved scope.
4. Add or update tests when an applicable test framework exists.
5. Update relevant English-language documentation.
6. Avoid speculative abstractions and unnecessary new files.

### Verify

1. Run checks appropriate to the change.
2. Inspect the final diff.
3. Verify that no secrets or unrelated files were introduced.
4. Record any checks that could not be completed.
5. Distinguish verified behavior from assumptions.

### Report

Summarize:

- What changed
- Why it changed
- Which checks were executed
- Which checks passed or failed
- Any remaining risks or limitations
- Whether files were committed, pushed, or left uncommitted

Never claim a test passed unless it was actually executed successfully.

## 11. Validation Commands

Use the existing project scripts:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm validate:release-notes
```

For runtime validation:

```bash
pnpm start
```

For packaging:

```bash
pnpm make
```

Choose checks based on the change scope.

For changes affecting Electron security, authentication, native integration, media playback, packaging, or auto-update, validate the relevant behavior in a packaged application when the environment permits.

Do not claim that compilation alone proves runtime correctness.

If a required platform or environment is unavailable, explicitly report the validation gap.

Do not create or publish release artifacts merely to satisfy a validation checklist without the necessary authorization.

## 12. Windows Packaging and Releases

Windows x64 is the initial distribution target.

Preserve consistency between:

- Package identity and metadata
- Electron window identity
- Squirrel installer configuration
- Application icons
- App User Model ID
- Auto-update behavior
- Versioned release notes

Do not invent publisher identities or imply that a package is digitally signed when it is not.

Preserve the established Windows auto-update safeguards, including platform restrictions, startup timing, sanitized IPC status events, and controlled restart behavior.

Maintain `src/data/release-notes.json` according to the existing release-note validation rules.

Consult the active release documentation before changing packaging or release automation.

**Release automation must never bypass the owner's explicit approval requirement for `main`, tags, publication, or distribution.**

## 13. Documentation Policy

Keep documentation accurate, focused, and written in English.

Use the existing documentation structure:

- `README.md` for project introduction and setup
- `CONTRIBUTING.md` for contribution workflows
- `docs/README.md` for the documentation index
- `docs/releases/` for active release planning and validation
- `docs/archive/` for historical plans, decisions, and superseded material

Archived documentation is historical reference, not an authoritative source of current implementation requirements.

When documentation conflicts with the code, investigate the discrepancy instead of assuming either is correct.

Update documentation when a change modifies:

- Public or internal contracts
- Setup or build instructions
- Architecture or security boundaries
- User-visible functionality
- Release requirements
- Operational procedures

Do not append implementation diaries, dated debugging notes, or large historical narratives to this file.

Record detailed investigations and historical decisions in appropriately named documentation files instead.

## 14. AGENTS.md Maintenance

This file is the concise, repository-wide operational contract for coding agents.

Maintain it according to these principles:

- Keep instructions actionable and unambiguous.
- Prefer stable rules over temporary implementation details.
- Avoid repeating information already maintained elsewhere.
- Link to authoritative documentation rather than duplicating it.
- Remove obsolete instructions when the underlying architecture changes.
- Do not append a new rule after every task automatically.
- Add nested `AGENTS.md` files only when a directory genuinely requires distinct instructions.
- Never weaken the global GitFlow, approval, security, or English-language policies through nested instructions.

Potential areas for future scoped instructions include:

- `src/main/` for privileged Electron security
- `src/preload/` for typed IPC bridge constraints
- `src/renderer/` for UI and state-management conventions
- `docs/` for documentation-specific editorial requirements

Create these files only when they add meaningful guidance beyond this document.

## 15. Final Pre-Delivery Checklist

Before reporting completion, verify:

- [ ] The requested scope was respected.
- [ ] The current branch is appropriate for the task.
- [ ] `main` was not modified without explicit owner approval.
- [ ] No unauthorized commit, push, merge, tag, PR, or release occurred.
- [ ] Existing user changes were preserved.
- [ ] Technical content and documentation are written in English.
- [ ] Security boundaries and application contracts remain intact.
- [ ] Relevant checks were executed or their absence was documented.
- [ ] The diff contains no secrets or unrelated changes.
- [ ] The final report accurately distinguishes completed work from pending validation.

**Default behavior: implement safely, validate thoroughly, preserve the user's work, and never promote changes to production without explicit authorization.**