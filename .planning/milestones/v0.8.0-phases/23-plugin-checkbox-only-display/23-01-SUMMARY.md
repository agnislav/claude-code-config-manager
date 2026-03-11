---
phase: 23-plugin-checkbox-only-display
plan: 01
subsystem: ui
tags: [treeview, checkbox, plugin, icons, vscode]

# Dependency graph
requires:
  - phase: 20-lock-aware-plugin-display
    provides: "Lock-aware plugin icon/checkbox branching in buildPlugins"
provides:
  - "Checkbox-only plugin display when User scope is unlocked (no icon noise)"
  - "ResourceUri skipped in unlocked mode to prevent fallback file icon"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Set icon to undefined for checkbox-only TreeItems (VS Code renders no icon)"
    - "Skip resourceUri when no ThemeIcon is set to avoid VS Code fallback file icon"

key-files:
  created: []
  modified:
    - src/viewmodel/builder.ts

key-decisions:
  - "Set icon to undefined (not empty ThemeIcon) for clean checkbox-only appearance"
  - "Skip plugin-disabled resourceUri in unlocked mode to prevent VS Code fallback file icon rendering"

patterns-established:
  - "Checkbox-only pattern: when a TreeItem has checkboxState, set icon to undefined and resourceUri to undefined for a clean checkbox-only appearance"

requirements-completed: [PLUG-01]

# Metrics
duration: 8min
completed: 2026-03-10
---

# Phase 23 Plan 01: Plugin Checkbox-Only Display Summary

**Plugin nodes show checkbox-only appearance when unlocked by removing ThemeIcon and resourceUri, preserving static icons when locked**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-10
- **Completed:** 2026-03-10
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Plugin nodes display a clean checkbox (no icon) when User scope is unlocked
- Static check/circle-slash icons preserved when User scope is locked (read-only)
- Prevented VS Code fallback file icon by also skipping resourceUri in unlocked mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove plugin icon when unlocked (checkbox-only mode)** - `167c85b` (feat)
2. **Task 2: Verify checkbox-only plugin display** - `6322a64` (fix: resourceUri adjustment discovered during visual verification)

## Files Created/Modified
- `src/viewmodel/builder.ts` - Changed plugin icon to `undefined` when unlocked; skip plugin-disabled resourceUri in unlocked mode

## Decisions Made
- Set icon to `undefined` rather than an empty/invisible ThemeIcon for cleaner rendering
- Also set resourceUri to `undefined` in unlocked mode -- discovered during visual verification that a resourceUri without a matching ThemeIcon causes VS Code to render a fallback file icon

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Skip plugin resourceUri in unlocked mode to prevent fallback icon**
- **Found during:** Task 2 (visual verification)
- **Issue:** Setting icon to `undefined` while keeping a `resourceUri` caused VS Code to render a fallback file icon instead of no icon
- **Fix:** Made resourceUri conditional on `scopedConfig.isReadOnly` -- only set for locked (read-only) scopes where static icons need the decoration
- **Files modified:** src/viewmodel/builder.ts
- **Verification:** Visual verification confirmed clean checkbox-only display
- **Committed in:** 6322a64

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was necessary for correct visual behavior. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 23 complete, ready for Phase 24 (Flatten Permissions with Type Icons)
- No blockers or concerns

---
*Phase: 23-plugin-checkbox-only-display*
*Completed: 2026-03-10*
