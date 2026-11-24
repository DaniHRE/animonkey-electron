import process from 'node:process';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEEDBACK_TYPES = new Set(['suggestion', 'bug_report']);
const FEEDBACK_AREAS = new Set([
  'discovery',
  'catalog',
  'player',
  'library',
  'account',
  'notifications',
  'interface',
  'other',
]);
const FEEDBACK_TYPE_LABELS = {
  bug_report: {
    name: 'Bug Report',
    color: 'cf222e',
    description: 'Reviewed bug report from Animonkey Desktop feedback.',
  },
  suggestion: {
    name: 'Product Suggestion',
    color: '1f883d',
    description: 'Reviewed product suggestion from Animonkey Desktop feedback.',
  },
};
const FEEDBACK_AREA_LABELS = {
  discovery: {
    name: 'Discovery & Search',
    color: '1f6feb',
    description: 'Feedback about finding anime, search, or discovery filters.',
  },
  catalog: {
    name: 'Catalog & Metadata',
    color: '8250df',
    description: 'Feedback about anime catalog entries and metadata.',
  },
  player: {
    name: 'Player & Episodes',
    color: 'bf3989',
    description: 'Feedback about episode playback, subtitles, or providers.',
  },
  library: {
    name: 'Library & History',
    color: '2da44e',
    description: 'Feedback about the saved library, watch lists, and history.',
  },
  account: {
    name: 'Account & Sync',
    color: '9a6700',
    description:
      'Feedback about profiles, sign-in, or account synchronization.',
  },
  notifications: {
    name: 'Notifications',
    color: '0969da',
    description: 'Feedback about system or provider notifications.',
  },
  interface: {
    name: 'Interface & Navigation',
    color: '57606a',
    description: 'Feedback about application layout, controls, or navigation.',
  },
  other: {
    name: 'General',
    color: '6e7781',
    description: 'Feedback that does not fit another product area.',
  },
};
const AUTOMATION_LABEL = {
  name: 'Automated',
  color: '6f42c1',
  description: 'Created by the feedback-to-GitHub automation.',
};
const GITHUB_API = 'https://api.github.com';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Required workflow configuration is missing: ${name}.`);
  return value;
}

function assertInput(value, name, maxLength) {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > maxLength ||
    normalized.includes('\0')
  ) {
    throw new Error(
      `The reviewed ${name} is empty or exceeds its length limit.`,
    );
  }
  return normalized;
}

async function githubRequest(path, options = {}) {
  const response = await fetch(new URL(path, GITHUB_API), {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${required('GITHUB_TOKEN')}`,
      'X-GitHub-Api-Version': '2026-03-10',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });

  if (options.allowNotFound && response.status === 404) return null;
  if (options.allowUnprocessable && response.status === 422) return null;
  if (!response.ok) {
    throw new Error(`GitHub API request failed with HTTP ${response.status}.`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error('GitHub API returned an invalid response.');
  }
}

async function ensureLabel(repository, label) {
  const labelPath = `/repos/${repository}/labels/${encodeURIComponent(label.name)}`;
  if (await githubRequest(labelPath, { allowNotFound: true })) return;

  const created = await githubRequest(`/repos/${repository}/labels`, {
    method: 'POST',
    body: {
      name: label.name,
      color: label.color,
      description: label.description,
    },
    allowUnprocessable: true,
  });
  if (created) return;

  if (!(await githubRequest(labelPath, { allowNotFound: true }))) {
    throw new Error(`GitHub could not create the ${label.name} label.`);
  }
}

async function loadFeedback(projectUrl, secretApiKey, feedbackId) {
  const endpoint = new URL('/rest/v1/feedback_submissions', projectUrl);
  endpoint.searchParams.set(
    'select',
    'id,feedback_type,functional_area,created_at',
  );
  endpoint.searchParams.set('id', `eq.${feedbackId}`);
  endpoint.searchParams.set('limit', '2');

  let response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        apikey: secretApiKey,
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(
      'Supabase could not be reached to verify the feedback record.',
    );
  }

  if (!response.ok) {
    throw new Error(
      `Supabase could not verify the feedback record (HTTP ${response.status}).`,
    );
  }

  let rows;
  try {
    rows = await response.json();
  } catch {
    throw new Error('Supabase returned an invalid feedback response.');
  }

  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error('The feedback record was not found or is ambiguous.');
  }

  const [feedback] = rows;
  if (
    typeof feedback !== 'object' ||
    feedback === null ||
    !FEEDBACK_TYPES.has(feedback.feedback_type) ||
    !FEEDBACK_AREAS.has(feedback.functional_area) ||
    typeof feedback.created_at !== 'string' ||
    Number.isNaN(Date.parse(feedback.created_at))
  ) {
    throw new Error('The feedback record contains unsupported metadata.');
  }

  return feedback;
}

async function findExistingIssue(repository, feedbackId, marker) {
  const search = new URL('/search/issues', GITHUB_API);
  search.searchParams.set(
    'q',
    `repo:${repository} is:issue in:body ${feedbackId}`,
  );
  search.searchParams.set('per_page', '100');
  const result = await githubRequest(`${search.pathname}${search.search}`);
  if (!Array.isArray(result.items)) {
    throw new Error('GitHub returned an invalid issue-search response.');
  }
  return result.items.find(
    (issue) => typeof issue.body === 'string' && issue.body.includes(marker),
  );
}

async function main() {
  if (process.env.INPUT_CONTENT_REVIEWED !== 'true') {
    throw new Error(
      'Confirm that the reviewed issue content is appropriate before dispatching.',
    );
  }

  const feedbackId = required('INPUT_FEEDBACK_ID').toLowerCase();
  if (!UUID_PATTERN.test(feedbackId)) {
    throw new Error('The feedback ID must be a UUID.');
  }

  const issueTitle = assertInput(required('INPUT_ISSUE_TITLE'), 'title', 256);
  const issueSummary = assertInput(
    required('INPUT_ISSUE_BODY'),
    'body',
    60_000,
  );
  const repository = required('GITHUB_REPOSITORY');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('The workflow repository value is invalid.');
  }

  const projectUrl = new URL(required('SUPABASE_PROJECT_URL'));
  if (
    projectUrl.protocol !== 'https:' ||
    !projectUrl.hostname.endsWith('.supabase.co') ||
    projectUrl.pathname !== '/' ||
    projectUrl.search ||
    projectUrl.hash ||
    projectUrl.username ||
    projectUrl.password
  ) {
    throw new Error(
      'SUPABASE_PROJECT_URL must be an HTTPS Supabase project URL.',
    );
  }

  const secretApiKey = required('SUPABASE_SECRET_API_KEY');
  const feedback = await loadFeedback(projectUrl, secretApiKey, feedbackId);
  const marker = `<!-- animonkey-feedback-id:${feedbackId} -->`;
  const existingIssue = await findExistingIssue(repository, feedbackId, marker);
  if (existingIssue) {
    process.stdout.write(
      `Feedback already has a GitHub issue: ${existingIssue.html_url}\n`,
    );
    return;
  }

  const feedbackTypeLabel = FEEDBACK_TYPE_LABELS[feedback.feedback_type];
  const areaLabel = FEEDBACK_AREA_LABELS[feedback.functional_area];
  const labels = [feedbackTypeLabel, areaLabel, AUTOMATION_LABEL];

  for (const label of labels) await ensureLabel(repository, label);

  const typeDescription =
    feedback.feedback_type === 'bug_report' ? 'Bug report' : 'Suggestion';
  const receivedDate = new Date(feedback.created_at).toISOString().slice(0, 10);
  const issueBody = [
    issueSummary,
    '',
    '---',
    '',
    '### Feedback context',
    `- Type: ${typeDescription}`,
    `- Functional area: ${areaLabel.name}`,
    `- Received: ${receivedDate}`,
    '- Created by: Feedback automation',
    `- Feedback reference: \`${feedbackId}\``,
    marker,
  ].join('\n');

  if (issueBody.length > 65_000) {
    throw new Error('The reviewed issue body exceeds GitHub’s size limit.');
  }

  const issue = await githubRequest(`/repos/${repository}/issues`, {
    method: 'POST',
    body: {
      title: issueTitle,
      body: issueBody,
      labels: labels.map(({ name }) => name),
    },
  });
  if (typeof issue.number !== 'number' || typeof issue.html_url !== 'string') {
    throw new Error('GitHub did not return the created issue.');
  }

  process.stdout.write(
    `Created reviewed feedback issue #${issue.number}: ${issue.html_url}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Feedback issue automation failed.'}\n`,
  );
  process.exitCode = 1;
});
