---
phase: 17-node-migration
plan: 01
subsystem: tree
tags: [viewmodel, treeview, refactor, decoupling]

# Dependency graph
requires:
  - phase: 16-viewmodel-layer
    provides: BaseVM/per-type VM interfaces and TreeViewModelBuilder
provides:
  - All 14 tree node constructors accept VM descriptors instead of raw config
  - vmToNode mapper function for NodeKind-to-node dispatch
  - Standalone WorkspaceFolderNode (extracted from configTreeProvider)
  - ConfigTreeProvider wired to TreeViewModelBuilder
affects: [18-verification-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VM-driven node pattern: constructor(private readonly vm: XxxVM) { super(vm); }"
    - "Static mapper pattern: ConfigTreeNode.mapVM set once in provider, used by all parent nodes"
    - "Lazy VM build: builder.build() called in refresh(), cached as cachedRootVMs"

key-files:
  created:
    - src/tree/vmToNode.ts
    - src/tree/nodes/workspaceFolderNode.ts
  modified:
    - src/tree/nodes/baseNode.ts
    - src/tree/configTreeProvider.ts
    - src/tree/nodes/scopeNode.ts
    - src/tree/nodes/sectionNode.ts
    - src/tree/nodes/permissionGroupNode.ts
    - src/tree/nodes/permissionRuleNode.ts
    - src/tree/nodes/settingNode.ts
    - src/tree/nodes/settingKeyValueNode.ts
    - src/tree/nodes/envVarNode.ts
    - src/tree/nodes/pluginNode.ts
    - src/tree/nodes/mcpServerNode.ts
    - src/tree/nodes/sandboxPropertyNode.ts
    - src/tree/nodes/hookEventNode.ts
    - src/tree/nodes/hookEntryNode.ts
    - src/tree/nodes/hookKeyValueNode.ts
    - src/viewmodel/builder.ts
    - src/utils/jsonLocation.ts

key-decisions:
  - "Used static mapVM property on ConfigTreeNode base to avoid circular imports between vmToNode and node files"
  - "Hook entries changed to leaf nodes -- removed type/command key-value children for cleaner UX"
  - "Builder builds VMs eagerly in constructor (not just refresh) to fix initial tree render"

patterns-established:
  - "VM-driven node: each node class is ~12 lines -- constructor stores typed VM, getChildren maps vm.children"
  - "Static mapper injection: provider sets ConfigTreeNode.mapVM = vmToNode once at construction"

requirements-completed: [VM-05, VM-06, VM-07, VM-08, VM-09, VM-10]

# Metrics
duration: 15min
completed: 2026-03-07
---

# Phase 17 Plan 01: Node Migration Summary

**All 14 tree nodes migrated to VM-driven constructors, eliminating 995 lines of display logic from node files and wiring TreeViewModelBuilder into ConfigTreeProvider**

## Performance

- **Duration:** ~15 min execution + human verification
- **Started:** 2026-03-06T23:25:28Z
- **Completed:** 2026-03-07
- **Tasks:** 3 (2 auto + 1 checkpoint verified)
- **Files modified:** 19

## Accomplishments
- Migrated all 14 tree node types from raw ScopedConfig/allScopes to single-VM constructors (net -995 lines)
- Created vmToNode mapper with NodeKind switch dispatch and static mapVM pattern to avoid circular imports
- Extracted WorkspaceFolderNode from inline class in configTreeProvider.ts to standalone file
- Simplified ConfigTreeNode base: removed finalize(), computeId(), computeContextValue(), computeTooltip(), applyOverrideStyle(), applyClickCommand()
- Wired TreeViewModelBuilder into ConfigTreeProvider.refresh() cycle with cached root VMs
- Verified zero overrideResolver/ScopedConfig/ConfigStore/allScopes/finalize imports in src/tree/nodes/

## Task Commits

Each task was committed atomically:

1. **Task 1: Create vmToNode mapper, WorkspaceFolderNode, simplify ConfigTreeNode base** - `6ad5e06` (feat)
2. **Task 2: Migrate all 14 node constructors and rewrite ConfigTreeProvider** - `b90cf29` (feat)
3. **Task 3: Verify extension behavior in Development Host** - `a38e81c` (fix -- 3 bugs found and fixed during verification)

## Files Created/Modified
- `src/tree/vmToNode.ts` - Central mapper: NodeKind enum to concrete node class dispatch
- `src/tree/nodes/workspaceFolderNode.ts` - Standalone workspace folder node (extracted from provider)
- `src/tree/nodes/baseNode.ts` - Simplified base: VM-driven constructor, static mapVM property
- `src/tree/configTreeProvider.ts` - Wired to TreeViewModelBuilder, removed inline WorkspaceFolderNode
- `src/tree/nodes/scopeNode.ts` - VM-driven, 12 lines (was 171)
- `src/tree/nodes/sectionNode.ts` - VM-driven, 14 lines (was 205)
- `src/tree/nodes/permissionGroupNode.ts` - VM-driven (was 63 lines)
- `src/tree/nodes/permissionRuleNode.ts` - VM-driven leaf (was 54 lines)
- `src/tree/nodes/settingNode.ts` - VM-driven (was 91 lines)
- `src/tree/nodes/settingKeyValueNode.ts` - VM-driven leaf (was 50 lines)
- `src/tree/nodes/envVarNode.ts` - VM-driven leaf (was 46 lines)
- `src/tree/nodes/pluginNode.ts` - VM-driven, preserved PLUGIN_URI_SCHEME and PluginDecorationProvider
- `src/tree/nodes/mcpServerNode.ts` - VM-driven leaf (was 43 lines)
- `src/tree/nodes/sandboxPropertyNode.ts` - VM-driven leaf (was 53 lines)
- `src/tree/nodes/hookEventNode.ts` - VM-driven (was 57 lines)
- `src/tree/nodes/hookEntryNode.ts` - VM-driven leaf (was 68 lines)
- `src/tree/nodes/hookKeyValueNode.ts` - VM-driven leaf (was 48 lines)
- `src/viewmodel/builder.ts` - Hook entry children removed, simplified
- `src/utils/jsonLocation.ts` - Fixed indent tracking for hook leaf click

## Decisions Made
- Used static `ConfigTreeNode.mapVM` property set once in provider constructor to break circular dependency between vmToNode.ts and node files
- Hook entries changed to leaf nodes (removed type/command key-value children) for cleaner UX during verification
- Builder builds VMs eagerly in constructor to ensure initial tree render works before first refresh

## Deviations from Plan

### Auto-fixed Issues (by orchestrator during verification)

**1. [Rule 1 - Bug] Tree not rendered on initial load**
- **Found during:** Task 3 (human verification)
- **Issue:** cachedRootVMs was empty until first refresh(); initial getChildren() returned nothing
- **Fix:** Build VMs eagerly in ConfigTreeProvider constructor
- **Files modified:** src/tree/configTreeProvider.ts
- **Committed in:** a38e81c

**2. [Rule 1 - Bug] Hook leaf click navigated to wrong line**
- **Found during:** Task 3 (human verification)
- **Issue:** findKeyLine indent tracking was incorrect for hook key-value entries
- **Fix:** Fixed indent tracking in jsonLocation.ts findKeyLine
- **Files modified:** src/utils/jsonLocation.ts
- **Committed in:** a38e81c

**3. [Rule 1 - Bug] Plugin checkbox toggled visually when locked scope blocked write**
- **Found during:** Task 3 (human verification)
- **Issue:** Checkbox toggled visually even when write was rejected due to locked scope
- **Fix:** Refresh tree after blocked write to revert visual state
- **Files modified:** src/tree/configTreeProvider.ts
- **Committed in:** a38e81c

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes necessary for correct behavior. No scope creep.

## Issues Encountered
- `npm run test` fails due to pre-existing missing test infrastructure (no src/test/ directory, no tsconfig.test.json) -- not caused by this migration
- Override UI not yet rendering visually -- confirmed as out-of-scope, planned for next milestone

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All tree nodes are VM-driven, ready for Phase 18 (Verification and Cleanup)
- Builder tests can now assert on VM output without tree node dependencies
- Dead import cleanup (VM-11, VM-12) is trivially verifiable via grep

---
*Phase: 17-node-migration*
*Completed: 2026-03-07*
