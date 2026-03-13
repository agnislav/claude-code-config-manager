---
phase: 28-action-parity
plan: 01
subsystem: ui
tags: [vscode-extension, treeview, commands, configWriter, menus]

# Dependency graph
requires:
  - phase: 27-hook-overlap
    provides: hook overlap detection and identity patterns
provides:
  - setSettingKeyValue writer function for object-setting child key editing
  - removeSettingKeyValue writer function for object-setting child key deletion
  - editValue handler extended to handle settingKeyValue nodes
  - deleteItem handler extended to handle settingKeyValue nodes
  - copyEnvVarToScope command following established copy-to-scope pattern
  - package.json menu wiring for settingKeyValue edit/delete and envVar copy
affects: [29-permission-overlap-performance, future-action-parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "settingKeyValue branch guard: keyPath.length === 2 && !DEDICATED_SECTION_KEYS.has(rootKey)"
    - "Override suffix stripping for edit pre-fill: .replace(/ \\(overridden by .*\\)$/, '')"
    - "Test path whitelisting: monkey-patch getAllowedWritePaths before requiring configWriter"

key-files:
  created:
    - test/suite/config/configWriter.settingKeyValue.test.ts
  modified:
    - src/config/configWriter.ts
    - src/commands/editCommands.ts
    - src/commands/deleteCommands.ts
    - src/commands/moveCommands.ts
    - src/constants.ts
    - package.json

key-decisions:
  - "removeSettingKeyValue leaves parent as empty {} when last child key removed — consistent with user decision to not clean up"
  - "setSettingKeyValue replaces non-object parent with {} before setting child — guards against stale scalar"
  - "Test path whitelisting via monkey-patching getAllowedWritePaths avoids needing workspace folders in unit tests"

patterns-established:
  - "settingKeyValue guard: check keyPath.length === 2 && !DEDICATED_SECTION_KEYS.has(rootKey) before scalar fallback in edit/delete handlers"
  - "Copy-to-scope pattern: guard read-only, validate keyPath, build targetScopes filter, QuickPick, overwrite check, write, success toast"

requirements-completed: [ACTN-01, ACTN-04, ACTN-05]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 28 Plan 01: Action Parity — SettingKeyValue + EnvVar Copy Summary

**SettingKeyValue edit/delete actions and EnvVar copy-to-scope via two new configWriter functions, extended command dispatch chains, and full package.json menu wiring**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T10:52:43Z
- **Completed:** 2026-03-13T10:56:52Z
- **Tasks:** 2 (Task 1 with TDD: 3 commits)
- **Files modified:** 6

## Accomplishments

- Added `setSettingKeyValue` and `removeSettingKeyValue` to configWriter.ts with full TDD cycle (11 tests, all green)
- Extended `editValue` and `deleteItem` command handlers with settingKeyValue branches using `DEDICATED_SECTION_KEYS` guard
- Added `copyEnvVarToScope` command following established `copySettingToScope`/`copyPermissionToScope` pattern
- Wired settingKeyValue edit (inline@0) and delete (inline@3) inline buttons and context menu in package.json
- Wired envVar copy (inline@2) inline button and `2_copyMove` context menu in package.json
- Added `MESSAGES.copiedEnvVar` to centralized messages object

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for writer functions** - `e4dd260` (test)
2. **Task 1 GREEN: Writer functions + extended handlers** - `22819ba` (feat)
3. **Task 2: copyEnvVarToScope + package.json wiring** - `9af4f2c` (feat)

_Note: TDD task has RED commit (e4dd260) + GREEN commit (22819ba)_

## Files Created/Modified

- `test/suite/config/configWriter.settingKeyValue.test.ts` - 11 unit tests for setSettingKeyValue and removeSettingKeyValue
- `src/config/configWriter.ts` - Added setSettingKeyValue and removeSettingKeyValue exports
- `src/commands/editCommands.ts` - Added setSettingKeyValue import + DEDICATED_SECTION_KEYS guard branch + override suffix stripping
- `src/commands/deleteCommands.ts` - Added removeSettingKeyValue import + DEDICATED_SECTION_KEYS guard branch
- `src/commands/moveCommands.ts` - Added copyEnvVarToScope command handler
- `src/constants.ts` - Added MESSAGES.copiedEnvVar
- `package.json` - New command declaration, inline@0/inline@2/inline@3 entries, context menu entries, commandPalette suppression

## Decisions Made

- `removeSettingKeyValue` leaves parent as `{}` when last child key is removed — not cleaned up, consistent with existing user decision documented in STATE.md
- `setSettingKeyValue` overwrites parent with `{}` if it's a non-object/null/array — defensive guard for stale data
- Unit tests for configWriter monkey-patch `getAllowedWritePaths` from constants module before requiring configWriter, so temp file paths pass validation without needing a real VS Code workspace

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- configWriter's `validateConfigPath` rejects temp file paths (correct security behavior). Unit tests needed to patch `getAllowedWritePaths` before importing configWriter. This is a test infrastructure concern, not a bug. Resolved by monkey-patching the constants module export before require.

## Next Phase Readiness

- SettingKeyValue and EnvVar copy actions are fully wired — Phase 28 action parity complete for plan 01
- Pre-existing builder.test.ts plugin icon test failures (2 tests) are unrelated to this plan's changes and remain to be addressed separately

## Self-Check: PASSED

All files exist and all commits verified.

---
*Phase: 28-action-parity*
*Completed: 2026-03-13*
