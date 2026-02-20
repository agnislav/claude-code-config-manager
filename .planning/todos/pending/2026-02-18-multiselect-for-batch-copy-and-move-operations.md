---
created: 2026-02-18T18:49:00.000Z
title: Multiselect for batch copy and move operations
area: ui
files:
  - src/commands/moveCommands.ts
  - src/tree/configTreeProvider.ts
---

## Problem

Currently tree items can only be operated on one at a time. Users should be able to multiselect items in the tree and perform batch copy/move operations across scopes — e.g., select 5 settings and move them all to a different scope in one action.

## Solution

Investigate VS Code TreeView multiselect support (`canSelectMany`). Implement batch versions of copy and move commands that accept multiple selected tree items. Update command handlers to iterate over selections and apply the operation to each item. Consider UX for conflict resolution when batch-moving items that already exist in the target scope.
