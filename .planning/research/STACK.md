# Technology Stack

**Project:** Claude Code Config Manager v0.6.0 — Decouple State from Tree
**Researched:** 2026-03-05
**Confidence:** HIGH (all findings verified against codebase source and VS Code TreeDataProvider API)

---

## Context

This is a subsequent-milestone research document. The extension exists at 5,241 LOC with a working
TreeView, override resolution, file watching, bidirectional editor-tree sync, and scope-level lock
toggle. This document covers patterns and approaches for decoupling tree node state from tree
rendering -- the sole objective of v0.6.0.

**Already validated (DO NOT re-research):** TypeScript strict mode, VS Code Extension API
(TreeDataProvider, TreeItem, FileDecorationProvider), esbuild bundler, no runtime dependencies.

---

## Verdict: No New Dependencies Required

State-view decoupling is a structural refactor achievable entirely with existing TypeScript patterns
and the VS Code TreeDataProvider API. Zero new npm packages. Zero new VS Code API surfaces.

---

## The Problem

### Current Coupling Points

Tree nodes currently do three jobs simultaneously:

1. **Hold config data** -- `ScopeNode`, `SectionNode`, `SettingNode`, etc. receive `ScopedConfig`
   and `allScopes: ScopedConfig[]` in their constructors
2. **Compute derived state** -- override resolution happens inside node constructors
   (e.g., `resolveScalarOverride` called in `SettingNode` constructor, `resolvePluginOverride` in
   `PluginNode` constructor)
3. **Produce VS Code TreeItem properties** -- icon, description, tooltip, contextValue, checkbox
   state, resourceUri

Additionally:
- `ConfigTreeProvider.getChildren()` calls `this.configStore.getAllScopes()` and
  `this.configStore.isMultiRoot()` directly
- `WorkspaceFolderNode` holds a reference to `ConfigStore` for lock state queries
- `ScopeNode` applies lock state (`configStore.isScopeLocked`) inline during construction
- Override resolver functions are called per-node during tree construction, meaning the same
  `allScopes` array traversal repeats for every node

### Why This Matters

- Adding v0.7.0 features (overlap indicators, lock enforcement) means modifying node constructors
  to thread even more state -- the coupling gets worse over time
- Testing node rendering requires constructing full `ScopedConfig` objects with all scopes
- No way to unit-test "what data does the tree show" without VS Code API mocks
- `ConfigStore` changes require understanding the full node hierarchy to know what breaks

---

## Recommended Pattern: View Model Layer

### Pattern: Intermediate Data Transfer Objects

Introduce a **view model layer** between `ConfigStore` and tree nodes. This is not MVVM in the
WPF/SwiftUI sense -- there is no two-way binding framework. It is a set of plain TypeScript
interfaces and a builder function that transforms `ConfigStore` state into a flat, pre-computed
data structure that tree nodes consume without calling back into ConfigStore or overrideResolver.

**Why this pattern:**
- VS Code's TreeDataProvider API is inherently pull-based (getChildren/getTreeItem), not
  observable/reactive. A reactive framework adds nothing.
- The extension already has `NodeContext` as a proto-view-model. The pattern extends this.
- No new dependencies. Pure TypeScript interfaces and functions.
- Testable: view model builder can be unit-tested without VS Code mocks.

### The Three Layers After Refactor

```
ConfigStore (Model)
  |
  v
TreeViewModel builder (pure functions, no VS Code imports)
  |
  v
Tree Nodes (View -- TreeItem subclasses, VS Code-specific rendering)
```

### What the View Model Contains

```typescript
/** Pre-computed data for a single tree node. No VS Code types. */
interface TreeNodeViewModel {
  // Identity
  scope: ConfigScope;
  section?: SectionType;
  keyPath: string[];
  workspaceFolderUri?: string;

  // Display data (pre-computed, not derived at render time)
  label: string;
  description?: string;
  isReadOnly: boolean;
  isOverridden: boolean;
  overriddenByScope?: ConfigScope;
  filePath?: string;

  // Type discriminator for node factory
  nodeType: string;

  // Type-specific payload (union or generic)
  data: NodeData;

  // Pre-computed children view models
  children: TreeNodeViewModel[];
}
```

Tree nodes receive a `TreeNodeViewModel` instead of `ScopedConfig` + `allScopes`. They never
import `overrideResolver` or `ConfigStore`.

### What the View Model Builder Does

A single `buildTreeViewModel(configStore: ConfigStore): TreeNodeViewModel[]` function:

1. Reads all scopes from ConfigStore (one traversal)
2. Computes ALL override resolutions upfront (batch, not per-node)
3. Applies section filtering
4. Applies lock state
5. Returns a tree of `TreeNodeViewModel` objects

This replaces the scattered logic currently in:
- `ConfigTreeProvider.getSingleRootChildren()` / `getMultiRootChildren()`
- `ScopeNode.getChildren()` (section creation, lock application)
- `SectionNode.getChildren()` (node creation per section type)
- Override resolution calls in every leaf node constructor

### How Tree Nodes Change

**Before:** `new SettingNode(key, value, scopedConfig, allScopes)`
**After:** `new SettingNode(viewModel)` where viewModel contains pre-computed override status

The `ConfigTreeNode` base class constructor changes from:
```typescript
constructor(label, collapsibleState, nodeContext: NodeContext)
```
to:
```typescript
constructor(viewModel: TreeNodeViewModel)
```

`NodeContext` becomes derivable from `TreeNodeViewModel` (or they merge).

### How ConfigTreeProvider Changes

**Before:** `getChildren()` calls `configStore.getAllScopes()`, creates nodes that internally
create more nodes
**After:** `getChildren()` walks a pre-built `TreeNodeViewModel[]` tree, calling a node factory
to create `ConfigTreeNode` instances from view models

```typescript
class ConfigTreeProvider {
  private viewModelTree: TreeNodeViewModel[] = [];

  refresh(): void {
    this.viewModelTree = buildTreeViewModel(this.configStore);
    this._onDidChangeTreeData.fire();
  }

  getChildren(element?: ConfigTreeNode): ConfigTreeNode[] {
    const vms = element
      ? element.viewModel.children
      : this.viewModelTree;
    return vms.map(vm => createTreeNode(vm));
  }
}
```

---

## VS Code API Alignment

### Why This Works With TreeDataProvider

The VS Code `TreeDataProvider<T>` generic type `T` is the caller's choice. The official samples
use `T = TreeItem subclass` (nodes that are both data and view), but the API equally supports
`T = data object` with `getTreeItem()` doing the conversion.

The current codebase uses `TreeDataProvider<ConfigTreeNode>` where `ConfigTreeNode extends TreeItem`.
This is fine -- the refactor keeps this pattern but changes what data feeds into node constructors.

The key VS Code API contract:
- `getChildren(element?)` returns `T[]` -- still returns `ConfigTreeNode[]`
- `getTreeItem(element)` returns `TreeItem` -- still returns the node itself (since it extends
  TreeItem)
- `onDidChangeTreeData` fires to trigger re-render -- unchanged
- `getParent(element)` for reveal support -- unchanged (parentMap pattern stays)

No API surface changes. The refactor is entirely internal.

### Alternative: Split T into Data Object + getTreeItem Conversion

VS Code supports `TreeDataProvider<TreeNodeViewModel>` where `getTreeItem()` converts a
`TreeNodeViewModel` into a `TreeItem`. This is architecturally purer but would break:

- `treeView.reveal(node)` -- requires the same `T` reference
- `parentMap` -- currently maps `ConfigTreeNode` to `ConfigTreeNode`
- `findNodeByKeyPath` -- walks the tree comparing `nodeContext` on `ConfigTreeNode`
- `onDidChangeCheckboxState` -- returns `T` references
- `expandAll` / `collapseAll` -- needs `collapsibleState` from nodes

**Recommendation:** Keep `TreeDataProvider<ConfigTreeNode>`. The view model is an internal
implementation detail, not exposed to the VS Code API. This avoids breaking reveal, checkbox,
and bidirectional sync.

---

## Existing Stack (Unchanged)

### Core Framework
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| TypeScript | ^5.3.3 | Language | No change |
| VS Code Extension API | ^1.90.0 | Extension host | No change |
| esbuild | ^0.25.0 | Bundler | No change |

### VS Code APIs Already In Use (Relevant to v0.6.0)
| API | Current Usage | v0.6.0 Impact |
|-----|--------------|---------------|
| `TreeDataProvider<ConfigTreeNode>` | Tree rendering | Keep generic type; change internal data flow |
| `EventEmitter<void>` / `onDidChange` | ConfigStore change notification | Unchanged -- triggers view model rebuild |
| `TreeItem` subclass (`ConfigTreeNode`) | Node rendering | Constructor signature changes (receives view model) |
| `NodeContext` interface | Node identity/state | Evolves into or merges with view model |
| `overrideResolver` functions | Per-node override computation | Moves to view model builder (batch computation) |

---

## What to Build

### New Files

| File | Purpose | Imports VS Code? |
|------|---------|-----------------|
| `src/tree/viewModel.ts` | `TreeNodeViewModel` interfaces and `buildTreeViewModel()` | NO -- pure TypeScript |
| `src/tree/nodeFactory.ts` | `createTreeNode(vm: TreeNodeViewModel): ConfigTreeNode` | YES -- creates TreeItem subclasses |

### Modified Files

| File | Change |
|------|--------|
| `src/tree/configTreeProvider.ts` | `getChildren()` walks view model tree instead of calling ConfigStore |
| `src/tree/nodes/baseNode.ts` | Constructor takes `TreeNodeViewModel` instead of `NodeContext` |
| `src/tree/nodes/*.ts` (all node files) | Constructors simplified to receive view model, no override resolution calls |
| `src/types.ts` | `NodeContext` either removed or kept as a derived subset |

### Unchanged Files

| File | Why Unchanged |
|------|--------------|
| `src/config/configModel.ts` | ConfigStore API stays the same; view model consumes it |
| `src/config/overrideResolver.ts` | Functions stay the same; called from view model builder instead of nodes |
| `src/config/configWriter.ts` | Write operations use `filePath` + `keyPath` from node context, not ConfigStore |
| `src/commands/*.ts` | Commands read `node.nodeContext` which still exists (derived from view model) |
| `src/extension.ts` | Wiring stays the same; ConfigStore -> TreeProvider -> TreeView |
| `src/watchers/fileWatcher.ts` | Triggers ConfigStore.reload() which fires onDidChange -> view model rebuild |

---

## What NOT to Add

| Avoid | Why |
|-------|-----|
| State management library (MobX, RxJS, Zustand) | No-runtime-deps constraint. Pull-based TreeDataProvider does not benefit from reactivity. |
| Observable/reactive patterns | VS Code TreeView is pull-based. Observables add complexity without benefit. |
| Event bus / mediator | ConfigStore.onDidChange is already the single event source. Adding another bus creates dual-source confusion. |
| Abstract factory pattern for nodes | A simple switch/map in `nodeFactory.ts` is sufficient for 10 node types. |
| Immutable data structures (Immer, etc.) | View model is rebuilt from scratch on every refresh. Immutability adds overhead without benefit. |
| Dependency injection container | 5K LOC extension with explicit constructor wiring. DI container is overkill. |
| Separate "presenter" layer | Two layers (view model + node) are sufficient. Three layers (model + presenter + view) is overengineering for a TreeView. |

---

## Alternatives Considered

| Approach | Considered | Why Not |
|----------|-----------|---------|
| Keep nodes as-is, just extract override calls | Partial fix -- nodes still receive `allScopes` and construct children | Coupling remains; v0.7.0 threading gets worse |
| Split `T` to data object (non-TreeItem) | Purer architecture | Breaks reveal, checkbox, parentMap, findNodeByKeyPath |
| Reactive state with subscriptions | Nodes subscribe to state changes | VS Code TreeView is batch-refresh, not incremental; subscriptions leak |
| Central state store (Redux-like) | Single source of truth with actions/reducers | Way too heavy; ConfigStore already IS the single source of truth |
| Pass ConfigStore to view model builder as interface | Enables mocking in tests | Good idea -- view model builder should accept an interface, not ConfigStore directly |

---

## Testing Implications

The view model layer enables a new category of tests:

| Test Type | Before | After |
|-----------|--------|-------|
| "Does User scope show 3 settings?" | Need VS Code mocks, full node construction | Call `buildTreeViewModel()` with mock data, assert children count |
| "Is setting X marked overridden?" | Construct SettingNode with real ScopedConfig arrays | Assert `viewModel.isOverridden === true` |
| "Does lock state propagate?" | Need ConfigStore instance + lockScope() | Pass locked flag to builder, assert isReadOnly on output |
| "Does filter hide Hooks section?" | Need ConfigTreeProvider + filter state | Pass filter to builder, assert section absence |

---

## Version Constraints

No new VS Code API surfaces. All APIs used are available in VS Code 1.90.0+. No version bump
required.

---

## Installation

```bash
# No new dependencies to install
# No changes to package.json dependencies
# Only changes: TypeScript source files
```

---

## Summary

v0.6.0 is a structural refactor introducing a view model layer between ConfigStore and tree nodes:

1. **New `viewModel.ts`** -- Pure TypeScript interfaces and builder function that pre-computes
   all tree state (override resolution, lock state, filtering) in a single pass
2. **New `nodeFactory.ts`** -- Simple factory that creates `ConfigTreeNode` subclasses from
   view model objects
3. **Simplified tree nodes** -- Constructors receive pre-computed view models instead of raw
   config data; no imports from `config/` directory
4. **ConfigTreeProvider rewired** -- `getChildren()` walks view model tree instead of calling
   ConfigStore directly

The ConfigStore API, overrideResolver functions, configWriter, commands, and file watcher remain
unchanged. The refactor is internal to the `src/tree/` directory with a new dependency on
`src/config/overrideResolver.ts` from the view model builder (which already exists from nodes).

---

## Sources

- Codebase analysis: `configTreeProvider.ts`, `configModel.ts`, `baseNode.ts`, `scopeNode.ts`,
  `sectionNode.ts`, `settingNode.ts`, `pluginNode.ts`, `overrideResolver.ts`, `extension.ts`,
  `editCommands.ts`, `types.ts`
- [VS Code Tree View API documentation](https://code.visualstudio.com/api/extension-guides/tree-view) --
  TreeDataProvider contract, getChildren/getTreeItem pattern, generic type T
- [VS Code Tree View Sample](https://github.com/microsoft/vscode-extension-samples/blob/main/tree-view-sample/USAGE.md) --
  Official sample showing TreeItem subclass pattern
- [VS Code API reference](https://code.visualstudio.com/api/references/vscode-api) --
  TreeDataProvider, TreeItem, FileDecorationProvider, EventEmitter

---

*Stack research for: v0.6.0 Decouple State from Tree -- view model layer pattern*
*Researched: 2026-03-05*
