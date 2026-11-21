import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const currentNotes = releaseNotes[packageJson.version];
const supportedIcons = new Set(['discover', 'library', 'sync', 'play']);

if (
  !currentNotes ||
  typeof currentNotes.title !== 'string' ||
  !currentNotes.title.trim() ||
  typeof currentNotes.summary !== 'string' ||
  !currentNotes.summary.trim() ||
  !Array.isArray(currentNotes.highlights) ||
  currentNotes.highlights.length === 0 ||
  currentNotes.highlights.some(
    (item) =>
      !item ||
      !supportedIcons.has(item.icon) ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      typeof item.description !== 'string' ||
      !item.description.trim(),
  )
) {
  process.stderr.write(
    `Add complete release notes for package version ${packageJson.version}.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `Release notes found for Animonkey ${packageJson.version}.\n`,
);
