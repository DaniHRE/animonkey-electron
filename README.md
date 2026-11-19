# Animonkey Desktop

<table align="center" bgcolor="#0b0b0c">
  <tr><td align="center"><img src="src/assets/brand/animonkey-logo.svg" alt="Animonkey" width="560" /></td></tr>
</table>

<p align="center">
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="https://github.com/DaniHRE/animonkey-electron">GitHub repository</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-43.4.0-47848F?logo=electron&logoColor=white" alt="Electron 43.4.0" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0" />
  <img src="https://img.shields.io/badge/pnpm-10.33.3-F69220?logo=pnpm&logoColor=white" alt="pnpm 10.33.3" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-4CAF50.svg" alt="MIT License" /></a>
</p>

Animonkey Desktop is an offline-first anime discovery and personal-library app built with Electron. It uses AniList for catalog metadata and includes the Anivexa episode runtime for provider listings and playback sources.

> **Release status:** The 1.0 release is still being prepared. Windows x64 is the initial distribution target; no public installer has been published yet. Other operating systems are not confirmed release targets.

## Features

- Browse seasonal anime, search with filters, explore schedules, and view anime details using AniList data.
- Keep a local watch list, ratings, and episode progress available without an account.
- Import and export a versioned local backup.
- Optionally sign in to sync supported library data and use the activity feed.
- Play available Anivexa sources in Vidstack, including HLS/DASH streams and selectable captions when a provider supplies them.

Provider, episode, audio, and caption availability depends on the source and can change over time.

## Screenshots

![Animonkey Desktop Home page](docs/screenshots/home.png)

## Technology

- Electron Forge and Vite
- React 19 and TypeScript 6
- Tailwind CSS 4
- TanStack Router and TanStack Query
- Vidstack, HLS.js, and dash.js
- pnpm 10

## Install and run from source

There is no public installer yet. To run the development app, install Node.js 26.x and pnpm 10.33.3, then run:

```sh
pnpm install
pnpm start
```

Optional account and sync features require the desktop API configuration shown in [`.env.example`](.env.example). Use only the publishable client key there; server secrets such as Supabase `service_role` keys must never be added to the desktop app.

To create a Windows x64 package locally:

```sh
pnpm make --platform=win32 --arch=x64
```

The package prepares the pinned [`vendor/anivexa-api`](vendor/anivexa-api) submodule as a local utility process. The renderer uses typed Electron IPC for episode and provider requests; it does not connect to an arbitrary local HTTP listener.

## Project documentation

- [Documentation index](docs/README.md)
- [1.0 release roadmap](docs/releases/1.0-roadmap.md)
- [Active 1.0 release checklist](docs/releases/1.0-checklist.md)
- [Archived migration plan](docs/archive/MIGRATION_PLAN.md)
- [Contributing guide](CONTRIBUTING.md)

## Credits and inspiration

- [AniList](https://anilist.co/) provides the anime catalog and schedule data.
- [Anivexa API](https://github.com/DaniHRE/Anivexa-API) provides episode and provider integration through the pinned submodule in this repository.
- [Taizen](https://taizen.moe/) supplies optional artwork enrichment for featured titles.
- [Vidstack](https://vidstack.io/) provides the media-player framework and caption interfaces.
- The watch-page information hierarchy was inspired by [Re:ANIME](https://reanime.cz/); Animonkey's desktop layout and styling are implemented independently.

This repository is licensed under the [MIT License](LICENSE). Third-party projects, artwork, and APIs retain their own licenses and terms.
