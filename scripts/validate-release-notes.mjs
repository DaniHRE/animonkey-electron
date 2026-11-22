import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReleaseNotes } from './release-notes-utils.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
);
const releaseNotes = JSON.parse(
  await readFile(path.join(projectRoot, 'src/data/release-notes.json'), 'utf8'),
);
const errors = validateReleaseNotes(releaseNotes, packageJson.version);

if (errors.length > 0) {
  process.stderr.write(
    `Invalid release notes:\n${errors.map((error) => `- ${error}`).join('\n')}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `Release notes found for Animonkey ${packageJson.version}.\n`,
);
