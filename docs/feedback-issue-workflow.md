# Feedback-to-Issue workflow

The workflow turns a reviewed Supabase feedback submission into a categorized
GitHub issue. It runs only when a repository maintainer dispatches it and
confirms that the issue text has been reviewed.

## Review and publish

1. Review the feedback submission in the Supabase dashboard.
2. Rewrite it as a concise issue title and body. Remove account identifiers,
   contact details, credentials, private URLs, and other personal information.
3. Open **Actions > Create GitHub issue from reviewed feedback > Run workflow**.
4. Enter the submission UUID and the reviewed issue text. Confirm the content
   is appropriate for people who can access the repository, then run it.

The workflow verifies that the UUID belongs to an existing feedback record. It
reads only the type, functional area, and submission date; it does not copy the
original title, description, or account ID into the issue. It creates feedback
type and functional-area labels and adds a record reference to prevent a second
issue for the same submission. The human-reviewed title and body are included
in the workflow run input and the resulting issue, so they must be safe to share
with repository collaborators.

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
