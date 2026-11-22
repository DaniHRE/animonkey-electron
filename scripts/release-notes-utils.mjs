const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const supportedIcons = new Set(['discover', 'library', 'sync', 'play']);
const requiredTextFields = ['eyebrow', 'title', 'summary'];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateGithubReleaseNotes(release, version, errors) {
  if (!isRecord(release)) {
    errors.push(
      `Release notes for ${version} require a 'githubRelease' object.`,
    );
    return;
  }

  if (!isNonEmptyString(release.summary)) {
    errors.push(
      `GitHub release notes for ${version} require a non-empty 'summary'.`,
    );
  }

  if (!Array.isArray(release.sections) || release.sections.length === 0) {
    errors.push(
      `GitHub release notes for ${version} require at least one section.`,
    );
    return;
  }

  for (const [index, section] of release.sections.entries()) {
    const label = `GitHub release notes for ${version}, section ${index + 1}`;
    if (!isRecord(section)) {
      errors.push(`${label} must be a JSON object.`);
      continue;
    }

    if (!isNonEmptyString(section.title)) {
      errors.push(`${label} requires a non-empty 'title'.`);
    }
    if (!Array.isArray(section.details) || section.details.length === 0) {
      errors.push(`${label} requires at least one detail.`);
      continue;
    }

    for (const [detailIndex, detail] of section.details.entries()) {
      if (!isNonEmptyString(detail)) {
        errors.push(
          `${label}, detail ${detailIndex + 1} must be non-empty text.`,
        );
      }
    }
  }
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

    if (version === requiredVersion || entry.githubRelease !== undefined) {
      validateGithubReleaseNotes(entry.githubRelease, version, errors);
    }
  }

  if (!Object.hasOwn(releaseNotes, requiredVersion)) {
    errors.push(`Add release notes for package version ${requiredVersion}.`);
  }

  return errors;
}

export function renderReleaseNotesMarkdown(githubRelease) {
  const sections = githubRelease.sections
    .map(({ title, details }) => {
      const bulletPoints = details.map((detail) => `- ${detail.trim()}`);
      return [`## ${title.trim()}`, '', ...bulletPoints].join('\n');
    })
    .join('\n\n');

  return [githubRelease.summary.trim(), '', sections, ''].join('\n');
}
