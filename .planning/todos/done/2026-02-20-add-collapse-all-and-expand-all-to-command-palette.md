---
created: 2026-02-20T11:05:51.358Z
title: Add collapse all and expand all to command palette
area: ui
files:
  - package.json
  - src/extension.ts
---

## Problem

Collapse All and Expand All commands are currently hidden from the VS Code Command Palette via `when: false` in the `commandPalette` section of `package.json`. During Phase 7 UAT, the user indicated these should also be accessible from the Command Palette — not just toolbar-only.

## Solution

Remove the `when: false` entries for `claudeConfig.collapseAll` and `claudeConfig.expandAll` from the `commandPalette` deny-list in `package.json`. The commands are already registered and functional — they just need to be unhidden.
