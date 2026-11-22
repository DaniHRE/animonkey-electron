import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderReleaseNotesMarkdown,
  validateReleaseNotes,
} from './release-notes-utils.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const requestedVersion = process.argv[2];

if (!requestedVersion) {
  process.stderr.write('Usage: pnpm render:release-notes <version>\n');
  process.exit(1);
}

const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
);
if (requestedVersion !== packageJson.version) {
  process.stderr.write(
    `Requested version ${requestedVersion} does not match package version ${packageJson.version}.\n`,
  );
  process.exit(1);
}

const releaseNotes = JSON.parse(
  await readFile(path.join(projectRoot, 'src/data/release-notes.json'), 'utf8'),
);
const errors = validateReleaseNotes(releaseNotes, requestedVersion);
if (errors.length > 0) {
  process.stderr.write(
    `Invalid release notes:\n${errors.map((error) => `- ${error}`).join('\n')}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  renderReleaseNotesMarkdown(releaseNotes[requestedVersion].githubRelease),
);
