---
phase: 30-code-simplification
plan: "01"
subsystem: commands/utils
tags: [refactoring, code-simplification, helpers, utilities]
dependency_graph:
  requires: []
  provides: [commandHelpers, timestamp, formatValue-style-param]
  affects: [addCommands, editCommands, deleteCommands, moveCommands, pluginCommands, openFileCommands, fileWatcher, configWriter, builder]
tech_stack:
  added: []
  patterns: [withWriteRetry, guardReadOnly, pickEditableTargetScope, confirmOverwrite, formatTimestamp]
key_files:
  created:
    - src/utils/commandHelpers.ts
    - src/utils/timestamp.ts
  modified:
    - src/viewmodel/builder.ts
    - src/commands/addCommands.ts
    - src/commands/editCommands.ts
    - src/commands/deleteCommands.ts
    - src/commands/moveCommands.ts
    - src/commands/pluginCommands.ts
    - src/commands/openFileCommands.ts
    - src/watchers/fileWatcher.ts
    - src/config/configWriter.ts
decisions:
  - "withWriteRetry passes action directly as retryFn to showWriteError rather than wrapping in another closure"
  - "guardReadOnly accepts allowLockedUser option to permit copy operations from locked User scope"
  - "formatValue gains optional style parameter ('summary'|'raw') replacing the separate formatSandboxValue function"
  - "pickEditableTargetScope handles noWorkspaceFolders and noEditableScopes messages internally"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-15"
  tasks_completed: 2
  files_modified: 9
  files_created: 2
---

# Phase 30 Plan 01: Extract Shared Command Helpers Summary

**One-liner:** Six duplicated patterns extracted into commandHelpers.ts and timestamp.ts, reducing command files by ~308 net lines with zero behavior change.

## Objective

Extract 6 duplicated patterns from command handlers into shared helpers to reduce code duplication and improve maintainability before adding new features in Phases 31-33.

## What Was Built

### New Files

**`src/utils/commandHelpers.ts`** — Four shared helpers:
- `withWriteRetry(filePath, action)` — Wraps action in try/catch, calls `showWriteError` on failure
- `guardReadOnly(node, message, options?)` — Returns true if node is read-only; shows appropriate message; `allowLockedUser` option lets copy commands pass through locked User scope
- `pickEditableTargetScope(configStore, sourceScope, workspaceFolderUri, placeHolder, labelPrefix?)` — Shared scope QuickPick for copy/move operations
- `confirmOverwrite(itemName, scopeLabel)` — Modal confirmation dialog for overwrite scenarios

**`src/utils/timestamp.ts`** — One helper:
- `formatTimestamp()` — Returns `[HH:MM:SS.mmm]` formatted string, replacing 3 inline formatters

### Modified Files

- **`src/viewmodel/builder.ts`** — Merged `formatSandboxValue` into `formatValue(value, 'raw')`, deleted `formatSandboxValue`
- **`src/commands/addCommands.ts`** — 4 try/catch blocks replaced with `withWriteRetry`
- **`src/commands/editCommands.ts`** — 2 inline guards replaced with `guardReadOnly`, 2 try/catch blocks replaced with `withWriteRetry`
- **`src/commands/deleteCommands.ts`** — 1 inline guard replaced with `guardReadOnly`, 1 try/catch replaced with `withWriteRetry`
- **`src/commands/moveCommands.ts`** — 5 inline guards with `guardReadOnly`, 5 scope pickers with `pickEditableTargetScope`, 3 overwrite dialogs with `confirmOverwrite`, 5 try/catch blocks with `withWriteRetry`
- **`src/commands/pluginCommands.ts`** — 2 inline guards with `guardReadOnly`, 1 scope picker with `pickEditableTargetScope`, 2 try/catch blocks with `withWriteRetry`
- **`src/commands/openFileCommands.ts`** — Inline timestamp formatter replaced with `formatTimestamp()`
- **`src/watchers/fileWatcher.ts`** — Inline timestamp formatter replaced with `formatTimestamp()`
- **`src/config/configWriter.ts`** — Inline timestamp formatter replaced with `formatTimestamp()`

## Verification Results

- `npm run compile` — passes with no errors
- `npm run lint` — passes with no warnings
- `grep -rn "showWriteError" src/commands/` — no results (only extension.ts, Plan 02 scope)
- `grep -rn "formatSandboxValue" src/` — no results
- `grep -rn "getHours.*padStart" src/` — only in `src/utils/timestamp.ts` (the implementation itself)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/utils/commandHelpers.ts` exists
- [x] `src/utils/timestamp.ts` exists
- [x] `formatSandboxValue` not found in `src/viewmodel/builder.ts`
- [x] Commits `31b99b0` and `895ad4e` verified in git log
