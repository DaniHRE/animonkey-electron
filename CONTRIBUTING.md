# Contributing to Animonkey Electron

Thanks for helping improve Animonkey Electron. Bug reports, documentation updates, and focused code contributions are welcome.

## Development setup

- Use Node.js 26.x and pnpm 10.33.3, matching the versions used by the project.
- Clone the repository with its Anivexa API submodule, or initialize it afterward:

  ```sh
  git clone --recurse-submodules https://github.com/DaniHRE/animonkey-electron.git
  cd animonkey-electron
  pnpm install --frozen-lockfile
  ```

- If the submodule is missing from an existing checkout, run `git submodule update --init --recursive`.
- Start the desktop app with `pnpm start`. Optional account and sync settings are documented in [`.env.example`](.env.example). Never put server-side secrets in the desktop app or commit local `.env` files.

## Branches and pull requests

- Start work from the latest `dev` branch and create a focused branch with a descriptive name, such as `feat/library-filters`, `fix/player-retry`, `docs/setup-guide`, or `chore/dependencies`.
- Open pull requests against `dev` unless a maintainer asks for a different target. Keep each pull request focused on one change and describe its user impact, implementation, and validation.
- `dev` is the integration and staging branch. Maintainers promote reviewed, release-ready changes from `dev` to `main`; `main` is the stable release branch.
- For large product or architecture changes, open an issue first to agree on scope before starting implementation.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) with a short, action-oriented subject. Examples:

```text
feat(search): add format filters
fix(player): recover after a failed source
docs(readme): clarify local setup
chore(deps): update Electron tooling
```

## Checks before opening a pull request

Run the checks relevant to your change:

```sh
pnpm lint
pnpm typecheck
pnpm format:check
```

For release-note or release-workflow changes, also run `pnpm validate:release-notes`. For Windows packaging changes, use `pnpm make --platform=win32 --arch=x64` when the required environment is available. Mention checks you could not run and any manual verification in the pull request.

For user-facing UI changes, include a screenshot or a concise description of the affected screen and states when practical. Do not claim a packaged or audiovisual behavior is verified unless it was checked in the packaged app.

## Release notes

Add a complete entry to `src/data/release-notes.json` whenever `package.json` changes version. This structured file is the source for the in-app “What’s New” screen and the GitHub draft release description. Keep user-facing copy in Brazilian Portuguese and use one of the icon identifiers already rendered by the app. Run `pnpm validate:release-notes` to check every entry and `pnpm render:release-notes <version>` to preview the current version’s GitHub description. Do not maintain a separate hand-written draft description.

## Project-specific notes

- Keep `pnpm-lock.yaml` in sync when changing dependencies; do not add another package manager lockfile.
- `vendor/anivexa-api` is a submodule. Make API changes in its own repository, then update the pinned submodule commit in this repository.
- Keep secrets, signing keys, local user data, generated packages, and build output out of commits.
- Review [`AGENTS.md`](AGENTS.md) for the detailed Electron security boundaries, architecture conventions, and release-specific rules.
