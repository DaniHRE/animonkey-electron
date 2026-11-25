# Feedback-to-Issue workflow

Animonkey feedback can be turned into GitHub issues in two ways. Both require
reviewing the issue text before it is shared with repository collaborators.

## Codex-assisted review and publishing

Use the project skill `$feedback-to-github-issue` or ask Codex to review recent
feedback submissions. It reads the Animonkey Supabase project through the
connected Supabase plugin, checks for existing issues in
`DaniHRE/animonkey-electron`, and prepares privacy-safe drafts. It starts with
the 50 newest submissions; ask it to continue with older records if needed.

Codex shows the final title and full issue body for review. It creates an issue
only after you explicitly approve that draft. This path needs connected
Supabase and GitHub plugins; it does not dispatch the GitHub Actions workflow.
It does not write processing status or issue URLs to Supabase, so the feedback
UUID marker in the issue body is used for duplicate checks. Issue type and area
are included in the body, and the corresponding feedback type and product-area
labels are applied using the mapping below. Each issue also receives the
`Automated` label and identifies the feedback automation in its context.

If you want Codex to prepare text for you to publish, tell it to draft only.
Codex will not create the issue. You can then use the manual workflow below.

## Manual GitHub Actions workflow

1. Review the feedback submission in the Supabase dashboard.
2. Rewrite it as a concise issue title and body. Remove account identifiers,
   contact details, credentials, private URLs, and other personal information.
3. Open **Actions > Create GitHub issue from reviewed feedback > Run workflow**.
4. Enter the submission UUID and the reviewed issue text. Confirm the content
   is appropriate for people who can access the repository, then run it.

The workflow verifies that the UUID belongs to an existing feedback record. It
reads only the type, functional area, and submission date; it does not copy the
original title, description, or account ID into the issue. It creates feedback
type, product-area, and automation labels and adds a record reference to prevent
a second issue for the same submission. The human-reviewed title and body are
included in the workflow run input and the resulting issue, so they must be safe
to share with repository collaborators.

## Repository labels

The feedback issue paths use these repository labels:

| Feedback value       | Label                    | Color     | Description                                                   |
| -------------------- | ------------------------ | --------- | ------------------------------------------------------------- |
| `bug_report`         | `Bug Report`             | `#cf222e` | Reviewed bug report from Animonkey Desktop feedback.          |
| `suggestion`         | `Product Suggestion`     | `#1f883d` | Reviewed product suggestion from Animonkey Desktop feedback.  |
| `discovery`          | `Discovery & Search`     | `#1f6feb` | Feedback about finding anime, search, or discovery filters.   |
| `catalog`            | `Catalog & Metadata`     | `#8250df` | Feedback about anime catalog entries and metadata.            |
| `player`             | `Player & Episodes`      | `#bf3989` | Feedback about episode playback, subtitles, or providers.     |
| `library`            | `Library & History`      | `#2da44e` | Feedback about the saved library, watch lists, and history.   |
| `account`            | `Account & Sync`         | `#9a6700` | Feedback about profiles, sign-in, or account synchronization. |
| `notifications`      | `Notifications`          | `#0969da` | Feedback about system or provider notifications.              |
| `interface`          | `Interface & Navigation` | `#57606a` | Feedback about application layout, controls, or navigation.   |
| `other`              | `General`                | `#6e7781` | Feedback that does not fit another product area.              |
| Every feedback issue | `Automated`              | `#6f42c1` | Created by the feedback-to-GitHub automation.                 |

The feedback type and area each map to one label, and every automation-created
issue receives `Automated`. The Actions workflow creates any missing labels
before publishing; the Codex-assisted path expects the repository labels to
exist. No additional issue form or project-field configuration is required for
feedback transfer because the reviewed issue content and category metadata are
supplied by the selected path.

## GitHub Actions configuration

Configure these values in the repository's Actions settings:

| Name                      | Kind                | Value                                                          |
| ------------------------- | ------------------- | -------------------------------------------------------------- |
| `SUPABASE_PROJECT_URL`    | Repository variable | HTTPS project URL, such as `https://<project-ref>.supabase.co` |
| `SUPABASE_SECRET_API_KEY` | Repository secret   | A Supabase secret API key for server-side access               |

The secret API key can bypass row-level security. Keep it in GitHub Actions
secrets and never pass it to Electron, Vite, or a Windows package. The workflow
uses GitHub's generated token with only repository contents read and Issues
write permission.

The workflow file must be present on the repository's default branch before
GitHub will accept `workflow_dispatch` requests. The feedback migration and
updated `desktop-api` function must also be deployed before any record can be
verified. Neither the workflow nor the Supabase changes are deployed by local
development commits.
