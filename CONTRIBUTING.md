# Contributing

## Branch lifecycle

- Give each working branch one clear objective; do not reuse a completed branch for unrelated work.
- Never begin a branch name with `Codex` or `codex`; use a descriptive type and objective, such as `feat/...`, `fix/...`, `chore/...`, or `release/...`.
- Use `dev` as the permanent integration and staging branch. After a work branch is complete and reviewed, merge it into `dev`, verify the merge, and close/delete the completed branch.
- Create the next work branch from the updated `dev`; do not reuse the completed branch.
- Promote `dev` to `main` only after the stable release is approved. Do not push, force-push, or rewrite history without an explicit request.
