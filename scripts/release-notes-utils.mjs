const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const supportedIcons = new Set(['discover', 'library', 'sync', 'play']);
const requiredTextFields = ['eyebrow', 'title', 'summary'];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateReleaseNotes(releaseNotes, requiredVersion) {
  const errors = [];

  if (!isRecord(releaseNotes)) {
    return ['The release notes root must be a JSON object.'];
  }

  if (!versionPattern.test(requiredVersion)) {
    errors.push(
      `Package version '${requiredVersion}' must use MAJOR.MINOR.PATCH.`,
    );
  }

  for (const [version, entry] of Object.entries(releaseNotes)) {
    if (!versionPattern.test(version)) {
      errors.push(`Release-note key '${version}' must use MAJOR.MINOR.PATCH.`);
    }

    if (!isRecord(entry)) {
      errors.push(`Release notes for ${version} must be a JSON object.`);
      continue;
    }

    for (const field of requiredTextFields) {
      if (!isNonEmptyString(entry[field])) {
        errors.push(
          `Release notes for ${version} require a non-empty '${field}'.`,
        );
      }
    }

    if (!Array.isArray(entry.highlights) || entry.highlights.length === 0) {
      errors.push(
        `Release notes for ${version} require at least one highlight.`,
      );
      continue;
    }

    const highlightTitles = new Set();
    for (const [index, highlight] of entry.highlights.entries()) {
      const label = `Release notes for ${version}, highlight ${index + 1}`;
      if (!isRecord(highlight)) {
        errors.push(`${label} must be a JSON object.`);
        continue;
      }

      if (!supportedIcons.has(highlight.icon)) {
        errors.push(`${label} uses unsupported icon '${highlight.icon}'.`);
      }
      if (!isNonEmptyString(highlight.title)) {
        errors.push(`${label} requires a non-empty 'title'.`);
      } else if (highlightTitles.has(highlight.title)) {
        errors.push(`${label} repeats title '${highlight.title}'.`);
      } else {
        highlightTitles.add(highlight.title);
      }
      if (!isNonEmptyString(highlight.description)) {
        errors.push(`${label} requires a non-empty 'description'.`);
      }
    }
  }

  if (!Object.hasOwn(releaseNotes, requiredVersion)) {
    errors.push(`Add release notes for package version ${requiredVersion}.`);
  }

  return errors;
}

export function renderReleaseNotesMarkdown(entry) {
  const highlights = entry.highlights
    .map(
      ({ title, description }) =>
        `- **${title.trim()}** — ${description.trim()}`,
    )
    .join('\n');

  return [
    `**${entry.eyebrow.trim()}**`,
    '',
    `# ${entry.title.trim()}`,
    '',
    entry.summary.trim(),
    '',
    '## Destaques',
    '',
    highlights,
    '',
  ].join('\n');
}
