---
phase: 24-flatten-permissions-with-type-icons
plan: 01
subsystem: ui
tags: [treeview, permissions, icons, viewmodel]

# Dependency graph
requires:
  - phase: 22-viewmodel-layer
    provides: ViewModel builder pattern with PermissionGroupVM and PermissionRuleVM
provides:
  - Flat PermissionRuleVM[] with category field and type-aware icons
  - Removed PermissionGroupVM intermediary from tree hierarchy
affects: [24-02, permissions, treeview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat permission list with category-specific ThemeIcons (check/close/question)"
    - "undefined ThemeColor for non-overlapped icons instead of explicit icon.foreground"

key-files:
  created: []
  modified:
    - src/viewmodel/types.ts
    - src/viewmodel/builder.ts
    - src/tree/vmToNode.ts
    - package.json

key-decisions:
  - "Sort order Allow -> Ask -> Deny (most permissive first)"
  - "Non-overlapped icons use undefined ThemeColor, not icon.foreground"

patterns-established:
  - "Flat section children: permission rules are direct children of SectionVM"

requirements-completed: [PERM-01, PERM-02, PERM-03]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 24 Plan 01: Flatten Permissions Summary

**Flattened 3-level permission hierarchy to 2-level with category-specific icons (check/close/question) on each rule**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T10:25:10Z
- **Completed:** 2026-03-11T10:27:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Flattened permission tree from Section -> PermissionGroup -> PermissionRule to Section -> PermissionRule
- Each permission rule now displays a distinct icon matching its type (check for allow, question for ask, close for deny)
- Removed all PermissionGroup dead code (enum, interface, node class, vmToNode case, package.json menu entry)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add category to PermissionRuleVM, remove PermissionGroup types, refactor builder** - `84d1669` (feat)
2. **Task 2: Update package.json menus** - `9a52f00` (chore)

## Files Created/Modified
- `src/viewmodel/types.ts` - Added category field to PermissionRuleVM, removed PermissionGroup enum/interface
- `src/viewmodel/builder.ts` - Replaced buildPermissionGroups with buildPermissionRules returning flat list, updated icon logic
- `src/tree/vmToNode.ts` - Removed PermissionGroup case and imports
- `src/tree/nodes/permissionGroupNode.ts` - Deleted (dead code)
- `package.json` - Removed permissionGroup context menu entry

## Decisions Made
- Sort order is Allow -> Ask -> Deny (most permissive first), matching the locked decision from planning
- Non-overlapped permission icons use undefined ThemeColor (VS Code default) rather than explicit icon.foreground

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Flat permission list ready for Plan 02 (inline add button on section header, changePermissionType command)
- contextValue pattern `permissionRule.{editable|readOnly}[.overridden]` preserved for existing commands

---
*Phase: 24-flatten-permissions-with-type-icons*
*Completed: 2026-03-11*
