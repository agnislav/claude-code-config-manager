---
phase: 32-drag-and-drop-between-scopes
plan: "01"
subsystem: ui
tags: [drag-and-drop, treeview, vscode-api, move, copy, scopes]

# Dependency graph
requires:
  - phase: 30-code-simplification
    provides: withWriteRetry, guardReadOnly, configWriter functions
  - phase: 31-settings-add-button
    provides: moveCommands.ts move/copy patterns
provides:
  - ConfigDragAndDropController wired to TreeView
  - moveItemToScope and copyItemToScope as reusable exported functions
  - removeSandboxProperty in configWriter for atomic sandbox key removal
  - Drag-and-drop move between all 6 supported item types across scopes
affects: [33-accessibility-labels]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TreeDragAndDropController<T> pattern for VS Code tree view drag-and-drop"
    - "MIME type application/vnd.code.tree.{viewid} for tree item data transfer"
    - "resolveDropTarget helper to normalize drop onto scope/section/leaf nodes to target scope"

key-files:
  created:
    - src/dnd/dndController.ts
  modified:
    - src/config/configWriter.ts
    - src/commands/moveCommands.ts
    - src/extension.ts

key-decisions:
  - "DnD defaults to Move (no QuickPick prompt for action choice) — simplified from original plan which offered Move/Copy via QuickPick after drop"
  - "Drop targets resolve through leaf nodes and intermediate nodes (permission groups) to parent scope, not just ScopeNode/SectionNode"
  - "Cross-entity-type drops silently rejected (no error notification, per UX best practice for drag operations)"
  - "removeSandboxProperty mirrors setSandboxProperty key-splitting and cleans up empty sandbox/network objects"

patterns-established:
  - "DnD controller in src/dnd/ directory separate from commands/"
  - "moveItemToScope and copyItemToScope are the canonical reusable functions for programmatic scope transfers"

requirements-completed: [DND-01, DND-02, DND-03, DND-04, DND-05, DND-06]

# Metrics
duration: ~60min
completed: 2026-03-27
---

# Phase 32 Plan 01: Drag-and-Drop Between Scopes Summary

**Drag-and-drop Move for all 6 item types (PermissionRule, EnvVar, McpServer, Plugin, Setting, SandboxProperty) across scopes via VS Code TreeDragAndDropController, with lock/read-only rejection and leaf-node drop resolution**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-03-27
- **Completed:** 2026-03-27
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 4

## Accomplishments
- Created `ConfigDragAndDropController` implementing VS Code's `TreeDragAndDropController<ConfigTreeNode>` with drag, drop, lock checking, and entity-type validation
- Added `removeSandboxProperty` to `configWriter.ts` as the inverse of `setSandboxProperty`, with proper key-splitting and empty-object cleanup
- Extracted `moveItemToScope` and `copyItemToScope` as reusable exported functions from `moveCommands.ts`, covering all 6 entity types including sandbox properties
- Wired `ConfigDragAndDropController` into `extension.ts` `createTreeView` call; no new commands or package.json changes needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add removeSandboxProperty, extract move/copy core logic, and create DnD controller** - `f2d8c19` (feat)
2. **Task 2: Wire DnD controller into extension.ts** - `4598de9` (feat)
3. **Task 3: Simplify DnD to move-only and support leaf node drops** - `c8aee1c` (feat)

## Files Created/Modified
- `src/dnd/dndController.ts` - ConfigDragAndDropController implementing TreeDragAndDropController; handles drag, drop, scope resolution, lock/read-only rejection, entity-type cross-check
- `src/config/configWriter.ts` - Added `removeSandboxProperty` for atomic removal of a single sandbox key (with empty-object cleanup)
- `src/commands/moveCommands.ts` - Extracted `moveItemToScope` and `copyItemToScope` as exported functions; existing command handler refactored to call `moveItemToScope`
- `src/extension.ts` - Imports `ConfigDragAndDropController`, instantiates it, and passes as `dragAndDropController` to `createTreeView`

## Decisions Made
- **Move-only DnD (no QuickPick):** The original plan called for a QuickPick after drop asking Move or Copy. This was simplified during the human-verify checkpoint: DnD always performs Move. Copy remains available via the existing context menu commands. This reduces friction for the primary use case.
- **Leaf node drop resolution:** The original plan only accepted drops on ScopeNode or SectionNode. During verification it was found that VS Code often resolves drops to the nearest visible node (leaf items, permission group nodes). The final implementation traverses up through intermediate nodes to find the parent scope, making drops on any node within a scope work correctly.
- **Silent rejection for cross-type drops:** Dropping a PermissionRule on an Environment section produces no notification — VS Code drag UX convention is that invalid drop targets show no indicator and nothing happens.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Simplified DnD: removed QuickPick, made Move the default**
- **Found during:** Task 3 (human-verify checkpoint feedback)
- **Issue:** QuickPick after drop added unnecessary friction; Copy is already available via context menu
- **Fix:** Removed QuickPick, dndController.ts always calls moveItemToScope
- **Files modified:** src/dnd/dndController.ts
- **Verification:** Drag-and-drop confirmed working in Extension Development Host
- **Committed in:** c8aee1c

**2. [Rule 1 - Bug] Extended drop target resolution to support leaf node and intermediate node drops**
- **Found during:** Task 3 (human-verify checkpoint feedback)
- **Issue:** Drops on leaf nodes and permission group nodes were silently rejected because resolveDropTarget only accepted scope/section nodeTypes
- **Fix:** resolveDropTarget now walks up through any node type using nodeContext.scope to find the target scope
- **Files modified:** src/dnd/dndController.ts
- **Verification:** Drops confirmed working on any node in target scope
- **Committed in:** c8aee1c

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug/behavior corrections from checkpoint feedback)
**Impact on plan:** Both fixes improved usability and correctness. No scope creep; all core requirements DND-01 through DND-06 fulfilled.

## Issues Encountered
- VS Code's TreeDragAndDropController API does not expose keyboard modifiers (Ctrl/Alt for copy vs move), so the original QuickPick approach was the planned workaround. Simplified to Move-only after user verification confirmed this is the preferred UX.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DnD infrastructure is complete; phase 33 (Accessibility Labels) can proceed independently
- `moveItemToScope` and `copyItemToScope` are now reusable for any future programmatic scope transfer needs
- No blockers

---
*Phase: 32-drag-and-drop-between-scopes*
*Completed: 2026-03-27*
