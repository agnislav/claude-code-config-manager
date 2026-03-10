---
created: 2026-03-05T13:07:58.247Z
title: Plugin checkbox state changes despite locked User scope
area: ui
files:
  - src/commands/pluginCommands.ts
  - src/extension.ts
---

## Problem

When the User scope is locked, clicking a plugin checkbox correctly triggers an error notification informing the user that the scope is locked. However, the checkbox visual state still toggles despite the operation being rejected. This creates a misleading UI where the checkbox appears toggled but the underlying config hasn't changed. On next tree refresh the checkbox reverts, causing a confusing flicker.

## Solution

Ensure the plugin toggle command returns early (before any state change) when the target scope is locked. The tree should not re-render with a changed state if the write was blocked. May need to either:
- Prevent the checkbox state from changing before the lock check, or
- Force a tree refresh after showing the error to revert the visual state
