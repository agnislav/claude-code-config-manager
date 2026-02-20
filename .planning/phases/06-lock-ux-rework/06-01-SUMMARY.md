---
phase: 06-lock-ux-rework
plan: 01
subsystem: ui
tags: [vscode-extension, treeview, lock, toolbar, menus, context-keys]

# Dependency graph
requires: []
provides:
  - Lock-by-default activation: User scope locked before first tree render
  - State-semantic lock icons: $(lock) when locked, $(unlock) when unlocked
  - Toolbar lock toggle: button in view/title left of filter button
affects:
  - 06-lock-ux-rework (remaining plans)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dual-entry icon-swap in view/title with navigation@ ordering for left-to-right button placement
    - Lock-by-default: lockScope called immediately after reload(), before tree provider construction

key-files:
  created: []
  modified:
    - src/extension.ts
    - package.json

key-decisions:
  - "Lock User scope by default on activation: configStore.lockScope(ConfigScope.User) called between reload() and ConfigTreeProvider construction ensures locked state on first render"
  - "State semantics for lock icons: lockUserScope command shows $(unlock) icon (current state = unlocked), unlockUserScope shows $(lock) icon (current state = locked) — icon reflects state, not action"
  - "navigation@-1 group positions lock button left of filter (navigation@0) in toolbar"

patterns-established:
  - "navigation@ ordering: lower numbers render left-of in VS Code toolbar (navigation@-1 < navigation@0)"
  - "Dual-entry toggle: two commands with complementary when clauses swap icons atomically via setContext"

requirements-completed:
  - LOCK-11
  - LOCK-12
  - LOCK-13

# Metrics
duration: 1min
completed: 2026-02-19
---

# Phase 6 Plan 01: Lock UX Rework — Lock-by-Default, Icon Semantics, Toolbar Placement Summary

**User scope locked by default on activation with state-semantic icons and toolbar-mounted toggle replacing the inline User scope node button**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-19T22:46:34Z
- **Completed:** 2026-02-19T22:47:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- User scope is locked before the first tree render — write operations blocked before any user interaction (LOCK-11)
- Lock icons use state semantics: $(unlock) shown when scope is unlocked, $(lock) shown when locked — icon communicates current state, not action (LOCK-12)
- Lock toggle button moved to toolbar (view/title) at navigation@-1, positioned left of filter button at navigation@0 (LOCK-13)
- Inline lock buttons removed from User scope tree node context menu

## Task Commits

Each task was committed atomically:

1. **Task 1: Lock User scope by default on activation** - `e88fed8` (feat)
2. **Task 2: Move lock toggle to toolbar, fix icon semantics, remove inline buttons** - `bea42e9` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/extension.ts` - Added `configStore.lockScope(ConfigScope.User)` after `reload()`, changed `setContext` initial value to `true`
- `package.json` - Swapped icon assignments on lockUserScope/unlockUserScope commands, added 2 toolbar entries at navigation@-1, removed 2 inline context menu entries from view/item/context

## Decisions Made
- `configStore.lockScope(ConfigScope.User)` must be called before `new ConfigTreeProvider(configStore)` so the first tree render sees the locked state — insertion order between `reload()` and tree provider construction is critical
- Used `navigation@-1` for lock vs `navigation@0` for filter: VS Code renders lower numbers left-of higher numbers in toolbar
- Icon semantics follow "icon reflects current state" convention: when unlocked, show the unlocked icon ($(unlock)); when locked, show the locked icon ($(lock)) — consistent with standard VS Code toggle patterns (e.g., filter/filter-filled)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Lock-by-default and toolbar placement complete for Phase 6
- Ready for Phase 6 Plan 02 (if it exists)
- All three lock UX requirements (LOCK-11, LOCK-12, LOCK-13) satisfied

---
*Phase: 06-lock-ux-rework*
*Completed: 2026-02-19*
