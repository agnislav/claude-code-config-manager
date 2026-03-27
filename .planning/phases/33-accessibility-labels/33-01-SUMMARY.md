---
phase: 33-accessibility-labels
plan: 01
subsystem: ui
tags: [accessibility, screen-reader, treeview, vscode, viewmodel]

# Dependency graph
requires: []
provides:
  - accessibilityInformation on all tree nodes (leaf and container)
  - buildOverlapAccessibilityLabel helper for overlap-aware a11y text
affects: [accessibility, treeview, viewmodel]

# Tech tracking
tech-stack:
  added: []
  patterns: [ViewModel carries accessibilityInformation; baseNode wires to TreeItem; overlap helper appends scope relationship text]

key-files:
  created: []
  modified:
    - src/viewmodel/types.ts
    - src/tree/nodes/baseNode.ts
    - src/viewmodel/builder.ts

key-decisions:
  - "accessibilityInformation is optional on BaseVM; baseNode wires it conditionally so nodes without it remain unaffected"
  - "buildOverlapAccessibilityLabel appends overrides/isOverriddenBy/duplicates/isDuplicatedBy text to any base label, keeping overlap semantics consistent with tooltip"
  - "Value truncated to 50 chars for EnvVar labels to avoid screen reader verbosity"

patterns-established:
  - "Accessibility label pattern: '{nodeType}: {identity}, {scopeLabel} scope[, overlap relationships]'"
  - "Container label pattern: '{name} {nodeType} in {scope} scope, {count} {children}'"

requirements-completed: [A11Y-01, A11Y-02, A11Y-03]

# Metrics
duration: 27min
completed: 2026-03-27
---

# Phase 33 Plan 01: Accessibility Labels Summary

**VS Code TreeItem.accessibilityInformation wired to all 13 tree node types via ViewModel layer, with scope, value, and overlap-relationship text for screen readers**

## Performance

- **Duration:** 27 min
- **Started:** 2026-03-27T11:43:25Z
- **Completed:** 2026-03-27T12:10:55Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added optional `accessibilityInformation` field to `BaseVM` interface and wired it to `TreeItem` in `ConfigTreeNode` constructor
- Implemented `buildOverlapAccessibilityLabel` helper that appends overrides/isOverriddenBy/duplicates/isDuplicatedBy text to any base label
- Added descriptive accessibility labels to all 9 leaf node types: PermissionRule, Setting, SettingKeyValue, EnvVar, Plugin, SandboxProperty, SandboxChild, McpServer, HookEntry
- Added descriptive accessibility labels to all 4 container node types: ScopeNode, SectionNode, HookEventNode, WorkspaceFolderNode

## Task Commits

Each task was committed atomically:

1. **Task 1: Add accessibilityInformation to BaseVM and all leaf nodes** - `496b27e` (feat)
2. **Task 2: Add accessibilityInformation to all container nodes** - `63993f1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/viewmodel/types.ts` - Added optional `accessibilityInformation?: { label: string; role?: string }` field to `BaseVM`
- `src/tree/nodes/baseNode.ts` - Wires `vm.accessibilityInformation` to `this.accessibilityInformation` in constructor
- `src/viewmodel/builder.ts` - Added `buildOverlapAccessibilityLabel` helper; added `accessibilityInformation` to all 13 node builder return objects

## Decisions Made

- `accessibilityInformation` is optional on `BaseVM` so existing nodes without it are unaffected at runtime
- `buildOverlapAccessibilityLabel` mirrors the overlap semantics already in tooltips, giving screen reader users the same relationship information visual users get from icons and tooltip text
- EnvVar value is truncated to 50 characters in the accessibility label to avoid excessively long announcements for long env values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- All tree nodes now expose accessibility labels to VS Code's screen reader infrastructure
- No further accessibility work planned for v0.10.0; this completes the milestone scope

---
*Phase: 33-accessibility-labels*
*Completed: 2026-03-27*
