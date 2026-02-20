---
created: 2026-02-20T11:06:30.000Z
title: Add "go to (scope/entity)" to the command palette
area: ui
files:
  - package.json
  - src/extension.ts
  - src/commands/
---

## Problem

There is no Command Palette command to quickly navigate to a specific scope or entity in the tree. Users must manually expand and scroll through the tree to find what they want. A "Go to..." command would let users jump directly to a scope node or specific entity (setting, permission rule, MCP server, etc.) from the Command Palette.

## Solution

TBD — Could be implemented as a QuickPick that lists scopes and/or entities, then reveals the selected item in the tree via `treeView.reveal()`. Needs design for how to present the hierarchy (flat list vs. multi-step picker).
