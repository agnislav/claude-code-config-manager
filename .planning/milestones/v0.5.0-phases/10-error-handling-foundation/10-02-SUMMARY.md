---
phase: 10-error-handling-foundation
plan: 02
subsystem: config
tags: [error-handling, json-parsing, vscode-notifications, user-feedback]

# Dependency graph
requires:
  - phase: None
    provides: Initial config loading infrastructure
provides:
  - Parse error detection and user-facing notifications for corrupted JSON config files
  - Open File navigation to error position for all config scopes
  - Console.error logging for Developer Tools debugging
affects: [11-tree-error-resilience, error-handling]

# Tech tracking
tech-stack:
  added: []
  patterns: [parse-error-notification-pattern, open-file-navigation]

key-files:
  created: []
  modified: [src/config/configModel.ts]

key-decisions:
  - "Use showErrorMessage() for parse errors (not warnings) - treat parse failures as errors"
  - "Extract line/column from JSON.parse error messages using regex pattern matching"
  - "Show separate notification per broken file - no batching"
  - "Add console.error logging for Developer Tools debugging alongside notifications"
  - "Tree still renders with fallback empty data for broken files - no crash"

patterns-established:
  - "Parse error notification pattern: check .error field, log to console, show message with Open File button"
  - "Open File navigation pattern: extract position from error, open document, set selection at position"

requirements-completed: [ERR-02, ERR-03]

# Metrics
duration: 5 min
completed: 2026-02-20
---

# Phase 10 Plan 02: Config Parse Error Notifications Summary

**Parse error detection and user-facing notifications for corrupted JSON config files with Open File navigation to error position**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T17:00:00Z
- **Completed:** 2026-02-20T17:05:20Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Parse errors now surface as user-facing error notifications instead of silent failures
- Each broken config file (managed, user, projectShared, projectLocal, mcp) gets a separate notification
- Line/column position extracted from JSON.parse error messages and included in notification
- "Open File" button navigates directly to the error position in the file
- Console.error logging added for Developer Tools debugging

## Task Commits

Each task was committed atomically:

1. **Task 1: Surface config and MCP parse errors with Open File navigation** - `384e0f9` (feat)

**Plan metadata:** (to be added in metadata commit)

## Files Created/Modified
- `src/config/configModel.ts` - Added showParseError() helper method and parse error checks for all config scopes (managed, user, projectShared, projectLocal, mcp)

## Decisions Made
- **Use showErrorMessage() for parse errors**: Treat parse failures as errors (not warnings) for consistency. User needs to know their config is broken.
- **Extract line/column from JSON.parse errors**: Newer Node.js versions include line/column in error messages. Regex extracts these for precise navigation.
- **Separate notification per broken file**: No batching - each broken file gets its own notification with specific file path and error details.
- **Console.error logging**: Added alongside notifications for Developer Tools debugging. Follows user decision to use console.error/console.warn for debugging.
- **Tree still renders**: Falls back to empty data for broken files. Extension remains functional even with corrupted config.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 10-03 (ERR-01: Propagate writeJsonFile errors).

Parse error handling complete for config loading path. Write path error handling is next.

---
*Phase: 10-error-handling-foundation*
*Completed: 2026-02-20*
