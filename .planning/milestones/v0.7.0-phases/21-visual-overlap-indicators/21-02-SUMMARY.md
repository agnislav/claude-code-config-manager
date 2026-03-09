---
phase: 21-visual-overlap-indicators
plan: 02
subsystem: ui
tags: [vscode, treeview, overlap, fileDecoration, tooltip, viewmodel]

# Dependency graph
requires:
  - phase: 21-visual-overlap-indicators/01
    provides: "overlapResolver.ts with resolve*Overlap functions, OverlapDecorationProvider, OverlapInfo type"
provides:
  - "Builder fully wired to overlap resolver for all entity types (settings, env, plugins, MCP, sandbox, permissions)"
  - "Overlap tooltips with scope/value/relationship details on all overlapping entities"
  - "Color-coded FileDecoration via resourceUri (red=shadowed, green=winning-override, yellow=winning-duplicate, orange=duplicated-by)"
  - "OverlapDecorationProvider registered in extension activation"
  - "Old overrideResolver.ts deleted; ResolvedValue type removed"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "buildOverlapTooltip helper for MarkdownString overlap sections with theme icons"
    - "buildOverlapResourceUri helper for color-coded FileDecoration URIs"
    - "Orange color (debugTokenExpression.string) for isDuplicatedBy state"

key-files:
  created: []
  modified:
    - src/viewmodel/builder.ts
    - src/extension.ts
    - src/types.ts
    - src/config/overlapResolver.ts
    - src/tree/overlapDecorations.ts
    - test/suite/viewmodel/builder.test.ts
    - test/suite/config/overlapResolver.test.ts

key-decisions:
  - "Plugin overlap color takes precedence over plugin disabled decoration"
  - "Permission overlap expanded to detect same-category duplicates and downward cross-category overrides"
  - "Distinct orange color for isDuplicatedBy using debugTokenExpression.string ThemeColor"
  - "supportThemeIcons = true on overlap tooltips for codicon rendering"

patterns-established:
  - "buildOverlapTooltip: append overlap section to any existing tooltip via MarkdownString"
  - "buildOverlapResourceUri: generate overlap:// URI with color query for FileDecorationProvider"

requirements-completed: [OVLP-01, OVLP-02]

# Metrics
duration: 45min
completed: 2026-03-09
---

# Phase 21 Plan 02: Builder Migration to Overlap System Summary

**Full overlap indicator integration: builder wired to overlap resolver for all 7 entity types with tooltips, color tinting, and permission overlap enhancements**

## Performance

- **Duration:** ~45 min (across sessions including visual verification)
- **Started:** 2026-03-09T17:00:00Z
- **Completed:** 2026-03-09T18:02:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Migrated builder.ts from old override system to new overlap resolver for all entity types (settings, env vars, plugins, MCP servers, sandbox properties, permissions)
- Registered OverlapDecorationProvider in extension.ts for color-coded tree items
- Enhanced permission overlap detection to cover same-category duplicates and downward cross-category overrides
- Added distinct orange color for "duplicated by" state, separating it from "overridden by" (red)
- Deleted old overrideResolver.ts and ResolvedValue type -- clean break from legacy system
- All 53 tests pass with clean build

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate builder.ts to overlap system and update tests** - `42bfa54` (feat)
2. **Task 2: Delete old overrideResolver.ts and verify clean build** - merged into Task 1 commit
3. **Task 3: Verify overlap indicators visually** - `4ed6695` (fix) -- verification fixes from visual testing

## Files Created/Modified
- `src/viewmodel/builder.ts` - Uses overlap resolver for all entity types, generates overlap tooltips and resourceUri
- `src/extension.ts` - Registers OverlapDecorationProvider
- `src/types.ts` - Removed ResolvedValue interface, NodeContext uses OverlapInfo
- `src/config/overlapResolver.ts` - Enhanced permission overlap (same-category duplicates, downward overrides)
- `src/tree/overlapDecorations.ts` - Added orange color for isDuplicatedBy
- `test/suite/viewmodel/builder.test.ts` - Migrated assertions from isOverridden to overlap fields
- `test/suite/config/overlapResolver.test.ts` - New permission overlap and orange color tests

## Decisions Made
- Plugin overlap color takes precedence over plugin disabled decoration (overlap is more informative)
- Permission overlap expanded beyond plan scope to detect same-category duplicates and downward cross-category overrides (Rule 2 -- missing critical functionality for correct overlap display)
- Distinct orange color (debugTokenExpression.string ThemeColor) for isDuplicatedBy, separating from red (isOverriddenBy)
- supportThemeIcons enabled on overlap tooltips so codicons render properly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Permission overlap detection incomplete**
- **Found during:** Task 3 (visual verification)
- **Issue:** resolvePermissionOverlap only detected upward cross-category overrides; missed same-category duplicates and downward cross-category overrides
- **Fix:** Expanded resolver to detect all three overlap directions for permissions
- **Files modified:** src/config/overlapResolver.ts, test/suite/config/overlapResolver.test.ts
- **Verification:** Visual verification + 53 tests pass
- **Committed in:** 4ed6695

**2. [Rule 2 - Missing Critical] Permission rules missing overlap visual indicators**
- **Found during:** Task 3 (visual verification)
- **Issue:** Permission rule nodes had no overlap tooltips or color tinting despite overlap data being available
- **Fix:** Added buildOverlapTooltip and buildOverlapResourceUri calls to buildPermissionRule; icon dimming for isDuplicatedBy
- **Files modified:** src/viewmodel/builder.ts
- **Verification:** Visual verification confirms tooltips and colors on permission rules
- **Committed in:** 4ed6695

**3. [Rule 1 - Bug] Tooltip theme icons not rendering**
- **Found during:** Task 3 (visual verification)
- **Issue:** $(arrow-up) and $(arrow-down) codicons in overlap tooltips rendered as plain text
- **Fix:** Set supportThemeIcons = true on MarkdownString in buildOverlapTooltip
- **Files modified:** src/viewmodel/builder.ts
- **Verification:** Visual verification confirms codicons render
- **Committed in:** 4ed6695

**4. [Rule 2 - Missing Critical] No visual distinction between isDuplicatedBy and isOverriddenBy**
- **Found during:** Task 3 (visual verification)
- **Issue:** Both states used red color, making them indistinguishable
- **Fix:** Added orange color in getOverlapColor and OverlapDecorationProvider for isDuplicatedBy
- **Files modified:** src/config/overlapResolver.ts, src/tree/overlapDecorations.ts
- **Verification:** Visual verification + test assertion for orange color
- **Committed in:** 4ed6695

---

**Total deviations:** 4 auto-fixed (3 missing critical, 1 bug)
**Impact on plan:** All fixes necessary for correct and complete overlap visualization. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 21 complete -- all overlap indicators functional with tooltips and color tinting
- Phase 20 (Lock-Aware Plugin Display) can proceed independently
- v0.7.0 milestone ready for final phase

---
*Phase: 21-visual-overlap-indicators*
*Completed: 2026-03-09*
