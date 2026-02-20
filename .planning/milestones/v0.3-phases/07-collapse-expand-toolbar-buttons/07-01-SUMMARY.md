---
phase: 07-collapse-expand-toolbar-buttons
plan: 01
subsystem: ui
tags: [vscode, tree-view, toolbar, navigation]

# Dependency graph
requires:
  - phase: 06-lock-ux-rework
    provides: toolbar button placement pattern with navigation indices
provides:
  - Collapse All toolbar button for tree navigation
  - Expand All toolbar button with recursive node expansion
  - collectExpandableNodes helper for tree traversal
affects: [future toolbar button additions, tree navigation features]

# Tech tracking
tech-stack:
  added: []
  patterns: [recursive tree walking via getChildren(), VS Code treeView.reveal() for expansion]

key-files:
  created: []
  modified: [package.json, src/extension.ts]

key-decisions:
  - "Collapse All delegates to VS Code built-in workbench.actions.treeView.claudeConfigTree.collapseAll"
  - "Expand All walks tree and reveals each expandable node with expand:true"
  - "Navigation index order: lock@0, collapse@1, expand@2, filter@3 (left-to-right)"
  - "Both commands hidden from command palette (toolbar-only UX)"

patterns-established:
  - "Tree traversal pattern: recursive walk via treeProvider.getChildren() with collapsibleState check"
  - "Expand All pattern: reveal each expandable node to force expansion (catches try/catch for filtered nodes)"

requirements-completed: [TOOL-01, TOOL-02]

# Metrics
duration: 15min
completed: 2026-02-20
---

# Phase 7: Collapse/Expand Toolbar Buttons Summary

**Collapse All and Expand All toolbar buttons with icon-based navigation for instant tree state control**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-20
- **Completed:** 2026-02-20
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Collapse All button collapses entire tree to top-level scope nodes
- Expand All button recursively expands all collapsible nodes to full depth
- Toolbar buttons positioned correctly: lock, collapse, expand, filter (left-to-right)
- Both commands work correctly regardless of lock/filter state

## Task Commits

Each task was committed atomically:

1. **Task 1: Register Collapse All and Expand All commands and add package.json declarations** - `1f27a80` (feat)

## Files Created/Modified
- `package.json` - Added claudeConfig.collapseAll and claudeConfig.expandAll command definitions, view/title menu entries with navigation indices, and command palette deny-list entries
- `src/extension.ts` - Registered collapseAll and expandAll commands, added collectExpandableNodes helper function for recursive tree walking

## Decisions Made

- **Collapse All delegates to VS Code built-in:** Uses `workbench.actions.treeView.claudeConfigTree.collapseAll` for consistency with VS Code's built-in collapse behavior
- **Expand All uses reveal pattern:** Walks tree via `getChildren()` and reveals each expandable node with `expand: true` to force expansion of all ancestors
- **Navigation index updated:** Changed lock from @-1 to @0, collapse @1, expand @2, filter from @0 to @3 for correct left-to-right toolbar order
- **Toolbar-only UX:** Both commands hidden from command palette via `when: false` since they're only useful as toolbar buttons

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Toolbar button infrastructure complete. Ready for future toolbar additions or tree navigation enhancements.

---
*Phase: 07-collapse-expand-toolbar-buttons*
*Completed: 2026-02-20*
