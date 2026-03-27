---
phase: 30-code-simplification
plan: 02
subsystem: ui
tags: [vscode-extension, typescript, plugin, commands, refactoring]

# Dependency graph
requires:
  - phase: 30-01
    provides: withWriteRetry and guardReadOnly helpers in commandHelpers.ts

provides:
  - togglePluginEnabled() exported from pluginCommands.ts, handling guard + write + error for plugin enable/disable
  - Simplified onDidChangeCheckboxState handler in extension.ts (~3 lines)
  - Simplified togglePlugin command handler in extension.ts (~4 lines)

affects: [31-settings-add-button, 32-drag-and-drop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared helper function replacing duplicated command guard + write + error-handling blocks"
    - "Plugin toggle path: togglePluginEnabled() consolidates isWriteInFlight check, guardReadOnly check, setPluginEnabled call, and showWriteError retry"

key-files:
  created: []
  modified:
    - src/commands/pluginCommands.ts
    - src/extension.ts

key-decisions:
  - "Used try/catch inside togglePluginEnabled (matching original behavior exactly) rather than relying on withWriteRetry return value, since withWriteRetry swallows errors internally"
  - "refreshTree callback called only on error or guard block, matching original extension.ts behavior"

patterns-established:
  - "Shared toggle helpers: extract guard + write + error logic into a single exported function called by both checkbox and context menu handlers"

requirements-completed: [SIMP-07]

# Metrics
duration: 8min
completed: 2026-03-15
---

# Phase 30 Plan 02: Deduplicate Plugin Toggle Logic Summary

**Extracted shared togglePluginEnabled() helper to pluginCommands.ts, reducing both plugin toggle handlers in extension.ts from ~20 lines each to ~3-4 lines**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-15T00:35:00Z
- **Completed:** 2026-03-15T00:43:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added `togglePluginEnabled(node, enabled, refreshTree?)` as exported function in pluginCommands.ts
- `onDidChangeCheckboxState` handler reduced from 20 lines to 3 lines
- `togglePlugin` command handler reduced from 20 lines to 4 lines
- Removed `setPluginEnabled`, `showWriteError`, and `isWriteInFlight` from extension.ts imports
- Removed unused `MESSAGES` import from extension.ts
- No duplicated plugin enable/disable guard or write logic remains in extension.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract togglePluginEnabled and simplify extension.ts handlers** - `c74bd48` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/commands/pluginCommands.ts` - Added `togglePluginEnabled` exported function; added `isWriteInFlight`, `showWriteError`, `ConfigScope` imports
- `src/extension.ts` - Simplified both plugin toggle handlers; removed unused `setPluginEnabled`, `showWriteError`, `isWriteInFlight`, `MESSAGES` imports

## Decisions Made

- Used inline try/catch in `togglePluginEnabled` rather than `withWriteRetry`, because the original extension.ts handlers called `treeProvider.refresh()` after `showWriteError` (in the catch block), and `withWriteRetry` does not expose success/failure state to callers. The inline approach replicates the original behavior precisely.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plugin toggle logic is now centralized; any future changes to plugin enable/disable behavior have a single point of modification.
- extension.ts is cleaner with fewer direct imports from configWriter, making it easier to audit what belongs at the orchestration level vs. command level.

---
*Phase: 30-code-simplification*
*Completed: 2026-03-15*

## Self-Check: PASSED

- `src/commands/pluginCommands.ts` — FOUND
- `src/extension.ts` — FOUND
- `.planning/phases/30-code-simplification/30-02-SUMMARY.md` — FOUND
- Commit `c74bd48` — FOUND
