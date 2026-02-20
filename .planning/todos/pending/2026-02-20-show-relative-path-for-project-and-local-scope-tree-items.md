---
created: 2026-02-20T11:39:51.942Z
title: Show relative path for project and local scope tree items
area: ui
files:
  - src/tree/nodes/scopeNode.ts
---

## Problem

Project Shared and Project Local scope nodes in the TreeView display the full absolute file path (e.g. `/Users/name/Projects/foo/.claude/settings.json`). They should show a workspace-relative path instead (e.g. `.claude/settings.json` or `.claude/settings.local.json`) for readability.

## Solution

In the scope node description or tooltip, compute the path relative to the workspace root for project-level scopes. User and Managed scopes can keep their full paths since they're outside the workspace.
