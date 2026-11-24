# GitHub feedback issue requirements

This document records product requirements from the linked GitHub issue
descriptions. It does not add implementation assumptions about notification
placement, duration, queue behavior, persistence, or delivery channel.

## Issue #9: Notifications and action feedback

Source: [Refactor notifications and provide feedback for user actions](https://github.com/DaniHRE/animonkey-electron/issues/9)

- Refactor the application's general notification component so notifications
  can be shown separately by category.
- Show visible feedback after user actions that call for a notification. This
  applies broadly and is not limited to saving an anime or sharing it.
- Support separate notification categories for:
  - Actions taken in the application
  - System notifications
  - Anime and episode alerts
  - Update alerts

The original feedback described confirmation after saving or sharing an anime;
the issue scope now covers all user actions that should produce visible
notification feedback.

## Issue #10: Refresh the profile image after a change

Source: [Refresh the profile image immediately after it is changed](https://github.com/DaniHRE/animonkey-electron/issues/10)

- Update the profile image in the interface immediately after it is changed.
- Show the updated image consistently across tabs without requiring an
  application restart.
