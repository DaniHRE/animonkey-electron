# Documentation

This page is the index for current project guidance and historical records.

## Release records

- [1.0.3 release candidate](releases/1.0.3-candidate.md) — Windows x64 release validation and promotion record.
- [1.0 release closeout](releases/1.0-checklist.md) — published v1.0.2, completed 1.0 gates, evidence, and known limitations.
- [Original 1.0 roadmap](archive/1.0-roadmap.md) — historical plan, superseded by the completed release workflow.

## Starting new feature work

Start from the latest `dev`, create a focused branch, and open a pull request against `dev`. Choose a SemVer release type only after the feature scope and compatibility impact are clear; see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Archived migration records

- [Migration plan](archive/MIGRATION_PLAN.md) — historical decisions and evidence; the migration itself is complete.
- [Migration progress tracker](archive/MIGRATION_PROGRESS.md) — preserved historical tracker; it is no longer active.

## Product feedback

- [Discord feature and fix backlog](discord-feature-backlog.md) — requests from the project's private testers Discord, with current Electron coverage, relative difficulty, technical notes, and per-item branch guidance.
- [Feedback-to-Issue workflow](feedback-issue-workflow.md) — maintainer review and GitHub Actions procedure for turning a Supabase feedback record into a categorized GitHub issue.

## Notifications

- [Remote notification delivery contract proposal](remote-notification-contract-proposal.md) — proposed public feed, payload, client state, and privacy boundaries for DISC-14; awaiting owner review.

## Technical debt

- [Technical debt index](technical-debt/README.md) — deferred issues with evidence and acceptance criteria.

## Monitoring

- [Anivexa provider health monitoring](anivexa-provider-health-monitoring.md) — scheduled provider probes, sanitized Supabase snapshots, status meanings, and workflow configuration.

For repository structure, security rules, and local validation commands, see [AGENTS.md](../AGENTS.md). For branch and contribution practices, see [CONTRIBUTING.md](../CONTRIBUTING.md).
