# Architecture Patterns: State-View Separation for ConfigStore / TreeView

**Domain:** VS Code TreeView extension — decoupling state management from tree rendering
**Researched:** 2026-03-05
**Confidence:** HIGH (analysis based on full codebase audit of all 14 node files, ConfigStore, overrideResolver, ConfigTreeProvider, commands, and extension.ts)

---

## Problem Statement

Tree nodes currently reach directly into `ScopedConfig` and `allScopes` to compute their own display state. Every node constructor calls `overrideResolver` functions, accesses `scopedConfig.config.*`, and derives visual properties (icons, descriptions, tooltips, dimming) inline. This creates three problems:

1. **Tight coupling** — nodes cannot be rendered without the full `ScopedConfig[]` array and knowledge of override resolution logic.
2. **Scattered computation** — the same override pattern (call resolver, build NodeContext, set icon color) is repeated across 8+ node constructors.
3. **Untestable presentation** — testing what a node displays requires constructing real `ScopedConfig` objects with full config data.

### Concrete Evidence From Codebase

- **6 node files** import from `overrideResolver.ts`: `settingNode`, `settingKeyValueNode`, `permissionRuleNode`, `envVarNode`, `pluginNode`, `sandboxPropertyNode`
- **`allScopes: ScopedConfig[]`** is threaded through 4 constructor levels: `ConfigTreeProvider` -> `ScopeNode` -> `SectionNode` -> leaf nodes
- **Lock-aware readOnly** is computed in 2 places: `configTreeProvider.ts:211` and `configTreeProvider.ts:264` (WorkspaceFolderNode)
- **Display formatting** lives in node files: `formatValue()` in settingNode.ts, `formatSandboxValue()` in sandboxPropertyNode.ts, `formatHookValue()` in hookKeyValueNode.ts

---

## Current Data Flow (Before)

```
ConfigStore.getAllScopes(key) -> ScopedConfig[]
  |
ConfigTreeProvider.getSingleRootChildren()
  reads configStore.isScopeLocked()
  computes effective ScopedConfig (locked -> isReadOnly: true)
  passes (scopedConfig, allScopes, workspaceFolderUri, sectionFilter) to ScopeNode
    |
ScopeNode.getChildren()
  reads scopedConfig.config.permissions/hooks/env/etc.
  decides which sections exist
  passes (sectionType, scopedConfig, allScopes) to SectionNode
    |
SectionNode.getChildren()
  reads scopedConfig.config[section] to extract data
  passes (entity, scopedConfig, allScopes) to leaf nodes
    |
Leaf node constructor:
  1. Calls overrideResolver(key, scope, allScopes)  <-- computation in view
  2. Builds NodeContext from result                   <-- mixing concerns
  3. Sets icon/description/tooltip from context       <-- presentation logic
```

---

## Recommended Architecture

### Introduce a ViewModel Layer Between ConfigStore and Tree Nodes

A new `TreeViewModelBuilder` (single class, one file) transforms `ScopedConfig[]` into a tree of plain data objects (`*ViewModel` interfaces) that contain all pre-computed display state. Tree nodes become pure renderers that map ViewModel properties to VS Code TreeItem properties.

### New Data Flow (After)

```
ConfigStore.getAllScopes(key) -> ScopedConfig[]
  |
TreeViewModelBuilder.build(allScopes, lockedScopes, sectionFilter, workspaceFolderUri)
  calls overrideResolver internally
  computes all display state (labels, icons, descriptions, tooltips, override status)
  returns ScopeViewModel[]
  |
ConfigTreeProvider receives ScopeViewModel[]
  passes to ScopeNode(viewModel)
    |
ScopeNode.getChildren()
  maps viewModel.sections -> SectionNode(sectionViewModel)
    |
Leaf node constructor:
  receives pre-computed ViewModel
  maps label/description/icon/tooltip directly  <-- pure rendering, no logic
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `ConfigStore` | Raw config data, reload, lock state, change events | TreeViewModelBuilder (provides data) |
| `TreeViewModelBuilder` | Transforms ScopedConfig[] into display-ready ViewModels; calls overrideResolver; owns all formatting | ConfigStore (reads), overrideResolver (calls), ConfigTreeProvider (returns ViewModels) |
| `overrideResolver` | Pure functions computing override status across scopes | TreeViewModelBuilder (called by) — no longer called by nodes |
| `ConfigTreeProvider` | Orchestrates tree refresh, caches nodes, manages parent map and reveal | TreeViewModelBuilder (calls), Tree nodes (creates from ViewModels) |
| Tree nodes | Map ViewModel properties to VS Code TreeItem properties. Zero logic. | ConfigTreeProvider (created by) |
| Commands | Read `node.nodeContext` to get scope, keyPath, filePath, isReadOnly | Tree nodes (read context) — unchanged |

---

## New File: `src/tree/viewModel.ts`

This file contains three things: ViewModel interfaces, the TreeViewModelBuilder class, and a `createNodeFromViewModel` factory function.

### ViewModel Interfaces

```typescript
// Primitive display properties — no vscode imports needed for types
interface BaseViewModel {
  readonly nodeContext: NodeContext;  // preserved unchanged for commands
  readonly label: string;
  readonly description: string;
  readonly tooltipMarkdown: string | undefined;  // raw markdown, nodes wrap in MarkdownString
  readonly iconId: string;
  readonly iconColor: string | undefined;  // ThemeColor ID (e.g. 'disabledForeground') or undefined
  readonly collapsible: boolean;  // true = Collapsed, false = None
  readonly contextValue: string;
}

interface ScopeViewModel extends BaseViewModel {
  readonly type: 'scope';
  readonly scopeEnum: ConfigScope;
  readonly resourceUri: { scheme: string; path: string; query: string } | undefined;
  readonly sections: SectionViewModel[];
}

interface SectionViewModel extends BaseViewModel {
  readonly type: 'section';
  readonly sectionType: SectionType;
  readonly children: NodeViewModel[];  // mixed leaf types
}

// Discriminated union for all view models that can appear as children
type NodeViewModel =
  | PermissionGroupViewModel
  | PermissionRuleViewModel
  | EnvVarViewModel
  | SettingViewModel
  | SettingKeyValueViewModel
  | PluginViewModel
  | SandboxPropertyViewModel
  | McpServerViewModel
  | HookEventViewModel
  | HookEntryViewModel
  | HookKeyValueViewModel;

interface PermissionGroupViewModel extends BaseViewModel {
  readonly type: 'permissionGroup';
  readonly children: PermissionRuleViewModel[];
}

interface PermissionRuleViewModel extends BaseViewModel {
  readonly type: 'permissionRule';
}

interface EnvVarViewModel extends BaseViewModel {
  readonly type: 'envVar';
}

interface SettingViewModel extends BaseViewModel {
  readonly type: 'setting';
  readonly children: SettingKeyValueViewModel[];  // empty for scalar settings
}

interface SettingKeyValueViewModel extends BaseViewModel {
  readonly type: 'settingKeyValue';
}

interface PluginViewModel extends BaseViewModel {
  readonly type: 'plugin';
  readonly checkboxChecked: boolean;
  readonly resourceUri: { scheme: string; path: string; query: string } | undefined;
}

interface SandboxPropertyViewModel extends BaseViewModel {
  readonly type: 'sandboxProperty';
  readonly arrayTooltipItems: string[] | undefined;  // for array values
}

interface McpServerViewModel extends BaseViewModel {
  readonly type: 'mcpServer';
}

interface HookEventViewModel extends BaseViewModel {
  readonly type: 'hookEvent';
  readonly children: HookEntryViewModel[];
}

interface HookEntryViewModel extends BaseViewModel {
  readonly type: 'hookEntry';
  readonly children: HookKeyValueViewModel[];
}

interface HookKeyValueViewModel extends BaseViewModel {
  readonly type: 'hookKeyValue';
}
```

**Design rationale:** ViewModels use only primitive types and plain objects (no `vscode.ThemeIcon`, `vscode.ThemeColor`, `vscode.MarkdownString`). This means ViewModel construction and the builder itself can be unit-tested without mocking the VS Code API. The one exception is `NodeContext`, which is already a plain interface defined in `types.ts`.

### TreeViewModelBuilder Class

```typescript
export class TreeViewModelBuilder {
  build(
    allScopes: ScopedConfig[],
    lockedScopes: ReadonlySet<ConfigScope>,
    sectionFilter: ReadonlySet<SectionType>,
    workspaceFolderUri?: string,
  ): ScopeViewModel[] {
    return allScopes
      .filter(sc => sc.scope !== ConfigScope.Managed)
      .map(sc => {
        const effective = lockedScopes.has(sc.scope) && !sc.isReadOnly
          ? { ...sc, isReadOnly: true }
          : sc;
        return this.buildScope(effective, allScopes, sectionFilter, workspaceFolderUri);
      });
  }

  private buildScope(...): ScopeViewModel { /* ... */ }
  private buildSections(...): SectionViewModel[] { /* ... */ }
  private buildPermissionGroup(...): PermissionGroupViewModel { /* ... */ }
  private buildPermissionRule(...): PermissionRuleViewModel {
    // Calls resolvePermissionOverride() HERE, not in node
  }
  private buildSetting(...): SettingViewModel {
    // Calls resolveScalarOverride() HERE, not in node
    // Calls formatValue() HERE, not in node
  }
  // ... one builder method per node type
}
```

The builder encapsulates ALL current logic from node constructors:

| Current Location | Moves To Builder |
|-----------------|------------------|
| `resolveScalarOverride()` calls in settingNode, settingKeyValueNode | `buildSetting()`, `buildSettingKeyValue()` |
| `resolvePermissionOverride()` call in permissionRuleNode | `buildPermissionRule()` |
| `resolveEnvOverride()` call in envVarNode | `buildEnvVar()` |
| `resolvePluginOverride()` call in pluginNode | `buildPlugin()` |
| `resolveSandboxOverride()` call in sandboxPropertyNode | `buildSandboxProperty()` |
| `formatValue()` in settingNode.ts | Builder utility or stays as shared function |
| `formatSandboxValue()` in sandboxPropertyNode.ts | Builder utility |
| `formatHookValue()` in hookKeyValueNode.ts | Builder utility |
| `PluginMetadataService.getInstance().getDescription()` in pluginNode | `buildPlugin()` |
| Lock-aware isReadOnly in configTreeProvider | `build()` method |
| Section existence checks in scopeNode.getChildren() | `buildSections()` |
| Item counts in sectionNode.getItemCount() | `buildSection()` |
| Plugin display name splitting in pluginNode | `buildPlugin()` |
| MCP server type detection in mcpServerNode | `buildMcpServer()` |

### Factory Function

```typescript
export function createNodeFromViewModel(vm: NodeViewModel): ConfigTreeNode {
  switch (vm.type) {
    case 'permissionGroup': return new PermissionGroupNode(vm);
    case 'permissionRule': return new PermissionRuleNode(vm);
    case 'envVar': return new EnvVarNode(vm);
    case 'setting': return new SettingNode(vm);
    case 'settingKeyValue': return new SettingKeyValueNode(vm);
    case 'plugin': return new PluginNode(vm);
    case 'sandboxProperty': return new SandboxPropertyNode(vm);
    case 'mcpServer': return new McpServerNode(vm);
    case 'hookEvent': return new HookEventNode(vm);
    case 'hookEntry': return new HookEntryNode(vm);
    case 'hookKeyValue': return new HookKeyValueNode(vm);
  }
}
```

---

## Refactored Tree Nodes (Example)

### Before (SettingNode):

```typescript
constructor(
  private readonly key: string,
  private readonly value: unknown,
  private readonly scopedConfig: ScopedConfig,
  private readonly allScopes: ScopedConfig[],
) {
  const override = resolveScalarOverride(key, scopedConfig.scope, allScopes);
  const ctx: NodeContext = {
    scope: scopedConfig.scope,
    keyPath: [key],
    isReadOnly: scopedConfig.isReadOnly,
    isOverridden: override.isOverridden,
    overriddenByScope: override.overriddenByScope,
    filePath: scopedConfig.filePath,
  };
  const isExpandableObject = typeof value === 'object' && value !== null && !Array.isArray(value);
  const collapsibleState = isExpandableObject ? Collapsed : None;
  super(key, collapsibleState, ctx);
  this.iconPath = override.isOverridden
    ? new ThemeIcon('tools', new ThemeColor('disabledForeground'))
    : new ThemeIcon('tools');
  this.description = isExpandableObject ? '' : formatValue(value);
  if (typeof value === 'object' && value !== null) {
    this.tooltip = new MarkdownString('```json\n' + JSON.stringify(value, null, 2) + '\n```');
  }
  this.finalize();
}

getChildren(): ConfigTreeNode[] {
  if (typeof this.value !== 'object' || this.value === null || Array.isArray(this.value)) return [];
  return Object.entries(this.value).map(
    ([childKey, childValue]) => new SettingKeyValueNode(this.key, childKey, childValue, this.scopedConfig, this.allScopes),
  );
}
```

### After (SettingNode):

```typescript
constructor(private readonly vm: SettingViewModel) {
  super(
    vm.label,
    vm.collapsible ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
    vm.nodeContext,
  );
  this.iconPath = new ThemeIcon(vm.iconId, vm.iconColor ? new ThemeColor(vm.iconColor) : undefined);
  this.description = vm.description;
  if (vm.tooltipMarkdown) {
    this.tooltip = new MarkdownString(vm.tooltipMarkdown);
  }
  this.finalize();
}

getChildren(): ConfigTreeNode[] {
  return this.vm.children.map(child => new SettingKeyValueNode(child));
}
```

The constructor drops from ~20 lines of mixed logic to ~10 lines of pure property mapping. No imports from `overrideResolver`. No access to `ScopedConfig` or `allScopes`.

---

## ConfigTreeProvider Changes

### Before:

```typescript
private getSingleRootChildren(): ConfigTreeNode[] {
  const keys = this.configStore.getWorkspaceFolderKeys();
  if (keys.length === 0) return [];
  const key = keys[0];
  const allScopes = this.configStore.getAllScopes(key);
  return allScopes
    .filter(s => s.scope !== ConfigScope.Managed)
    .map(scopedConfig => {
      const locked = this.configStore.isScopeLocked(scopedConfig.scope);
      const effective = locked && !scopedConfig.isReadOnly
        ? { ...scopedConfig, isReadOnly: true }
        : scopedConfig;
      return new ScopeNode(effective, allScopes, key, this._sectionFilter);
    });
}
```

### After:

```typescript
private readonly viewModelBuilder = new TreeViewModelBuilder();

private getSingleRootChildren(): ConfigTreeNode[] {
  const keys = this.configStore.getWorkspaceFolderKeys();
  if (keys.length === 0) return [];
  const key = keys[0];
  const allScopes = this.configStore.getAllScopes(key);
  const lockedScopes = this.configStore.getLockedScopes();
  const viewModels = this.viewModelBuilder.build(allScopes, lockedScopes, this._sectionFilter, key);
  return viewModels.map(vm => new ScopeNode(vm));
}
```

The `WorkspaceFolderNode` inner class similarly changes to receive a pre-built list of ScopeViewModels instead of constructing them.

---

## Patterns to Follow

### Pattern 1: ViewModel as Single Source of Truth for Display

**What:** Every visual property (label, icon, color, tooltip, description) is computed once in the builder and stored in the ViewModel. Nodes never derive display state.
**When:** Always. No exceptions.
**Why:** Eliminates the scattered computation problem. Makes it trivial to unit-test display logic by asserting on ViewModel properties without constructing VS Code TreeItem objects.

### Pattern 2: Preserve NodeContext Unchanged

**What:** The `NodeContext` interface stays exactly as-is. ViewModels carry a `nodeContext` property. Commands continue reading `node.nodeContext` to get scope, keyPath, filePath, isReadOnly.
**When:** For all command handlers and the editor-tree sync logic.
**Why:** NodeContext is the stable contract between tree nodes and the command layer. Changing it would cascade into every command file. The ViewModel layer sits between ConfigStore and tree nodes, not between tree nodes and commands.

### Pattern 3: Builder Owns Override Resolution

**What:** The builder is the only caller of `overrideResolver` functions. No tree node imports from `overrideResolver`.
**When:** For all override-dependent display state (dimmed icons, override tooltips, contextValue `.overridden` suffix).
**Why:** Centralizes the override computation. Today, 6 node files import and call override functions independently. After migration, one file does.

### Pattern 4: Children Pre-built in ViewModel Hierarchy

**What:** Parent ViewModels contain their children as arrays, matching the tree hierarchy. `ScopeViewModel.sections` holds `SectionViewModel[]`, `SectionViewModel.children` holds `NodeViewModel[]`, etc.
**When:** For all parent-child relationships in the tree.
**Why:** Currently, `SectionNode.getChildren()` reads raw config data (`scopedConfig.config.permissions`, etc.) and constructs child nodes. After the refactor, `SectionNode.getChildren()` maps `vm.children` to node instances via the factory. The builder does all the data extraction.

### Pattern 5: Primitives Over VS Code Types in ViewModels

**What:** Use `iconId: string` not `ThemeIcon`, `tooltipMarkdown: string` not `MarkdownString`, `collapsible: boolean` not `TreeItemCollapsibleState`.
**When:** For all ViewModel interface fields.
**Why:** Enables unit testing without VS Code module. Nodes do the trivial conversion (`new ThemeIcon(vm.iconId)`) in their constructors.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Partial Migration

**What:** Migrating some nodes to use ViewModels while others still receive `ScopedConfig` directly.
**Why bad:** Creates two parallel systems. Developers must understand both paths. Override logic remains scattered across two layers.
**Instead:** Migrate all 14 node types in a single pass. The builder produces the complete tree. This is feasible because the codebase is ~5,200 LOC and all node types follow the same constructor pattern.

### Anti-Pattern 2: ViewModel Containing VS Code Types

**What:** Putting `vscode.ThemeIcon`, `vscode.ThemeColor`, or `vscode.TreeItemCollapsibleState` directly in ViewModel interfaces.
**Why bad:** Makes ViewModels untestable without the `vscode` module. Couples the data layer to VS Code API.
**Instead:** Use primitive representations. Nodes convert these to VS Code types in 1-2 lines.

### Anti-Pattern 3: Making the Builder a God Object

**What:** Putting non-display logic (command handling, write operations, file watching, diagnostics) into the builder.
**Why bad:** The builder should only transform read data into display-ready ViewModels. It is a pure function of its inputs.
**Instead:** Builder is stateless. Given (allScopes, lockedScopes, sectionFilter), it produces ViewModels. It writes nothing, owns no state, has no side effects.

### Anti-Pattern 4: Observable/Reactive ViewModel

**What:** Making ViewModels emit change events or implementing MVVM reactive bindings.
**Why bad:** Overkill. VS Code TreeView already handles refresh via `onDidChangeTreeData`. The existing pattern (ConfigStore.onDidChange -> treeProvider.refresh() -> rebuild entire tree) is simple, correct, and fast for this codebase size.
**Instead:** ViewModels are rebuilt from scratch on every refresh. They are cheap plain objects. No caching, no diffing, no reactivity needed.

### Anti-Pattern 5: Splitting Builder Into Per-Section Classes

**What:** Creating separate builder classes per section type (PermissionsViewModelBuilder, HooksViewModelBuilder, etc.).
**Why bad:** Adds unnecessary abstraction for 7 section types that each have ~20 lines of build logic. The "builder" is really just a function that transforms data; it does not need an inheritance hierarchy.
**Instead:** Single class with private methods. Each `buildFoo()` method is self-contained and short.

---

## Integration Points

### New Components

| File | Type | Description |
|------|------|-------------|
| `src/tree/viewModel.ts` | **NEW** | ViewModel interfaces, TreeViewModelBuilder class, createNodeFromViewModel factory, format utilities |

### Modified Components

| File | Change Summary |
|------|---------------|
| `src/config/configModel.ts` | Add `getLockedScopes(): ReadonlySet<ConfigScope>` (3-line getter) |
| `src/tree/configTreeProvider.ts` | Instantiate TreeViewModelBuilder, call `.build()` in getSingle/MultiRootChildren, simplify WorkspaceFolderNode |
| `src/tree/nodes/baseNode.ts` | Simplify `finalize()` — most logic moves to builder; some methods may become no-ops |
| `src/tree/nodes/scopeNode.ts` | Constructor takes `ScopeViewModel`, getChildren maps `vm.sections` |
| `src/tree/nodes/sectionNode.ts` | Constructor takes `SectionViewModel`, getChildren maps `vm.children` via factory |
| `src/tree/nodes/settingNode.ts` | Constructor takes `SettingViewModel`, remove overrideResolver import |
| `src/tree/nodes/settingKeyValueNode.ts` | Constructor takes `SettingKeyValueViewModel` |
| `src/tree/nodes/permissionGroupNode.ts` | Constructor takes `PermissionGroupViewModel` |
| `src/tree/nodes/permissionRuleNode.ts` | Constructor takes `PermissionRuleViewModel`, remove overrideResolver import |
| `src/tree/nodes/envVarNode.ts` | Constructor takes `EnvVarViewModel`, remove overrideResolver import |
| `src/tree/nodes/pluginNode.ts` | Constructor takes `PluginViewModel`, remove overrideResolver + PluginMetadataService imports |
| `src/tree/nodes/sandboxPropertyNode.ts` | Constructor takes `SandboxPropertyViewModel`, remove overrideResolver import |
| `src/tree/nodes/mcpServerNode.ts` | Constructor takes `McpServerViewModel` |
| `src/tree/nodes/hookEventNode.ts` | Constructor takes `HookEventViewModel` |
| `src/tree/nodes/hookEntryNode.ts` | Constructor takes `HookEntryViewModel` |
| `src/tree/nodes/hookKeyValueNode.ts` | Constructor takes `HookKeyValueViewModel` |

### Unchanged Components

| File | Why Unchanged |
|------|--------------|
| `src/types.ts` | NodeContext, ScopedConfig, all config types — stable contracts |
| `src/config/overrideResolver.ts` | Pure functions, now called from builder instead of nodes — API unchanged |
| `src/config/configWriter.ts` | Write path unaffected by view layer changes |
| `src/config/configDiscovery.ts` | Discovery unaffected |
| `src/config/configLoader.ts` | Loading unaffected |
| `src/commands/*.ts` | Commands read `node.nodeContext` which is preserved in ViewModels |
| `src/watchers/fileWatcher.ts` | Triggers ConfigStore.reload() — unchanged |
| `src/extension.ts` | Wiring unchanged (ConfigStore -> TreeProvider -> TreeView). Commands read `node.nodeContext`. |
| `src/validation/*.ts` | Validation unaffected |
| `src/utils/*.ts` | Utilities unaffected |

### Why Commands Are Unaffected

Commands do:
```typescript
const { filePath, keyPath, isReadOnly, scope } = node.nodeContext;
```

`nodeContext` is preserved in ViewModels and passed through to tree nodes unchanged. The `node.description` read in `editCommands.ts:34` also works because nodes still set `this.description` from the ViewModel.

The plugin checkbox handler in `extension.ts` reads `node.nodeContext` and `node.checkboxState` — both are set from the ViewModel in the PluginNode constructor.

---

## Suggested Build Order

The ordering ensures each step compiles and preserves existing behavior before the next begins.

### Step 1: Define ViewModel Interfaces

Create `src/tree/viewModel.ts` with all ViewModel interfaces and the `NodeViewModel` discriminated union. No builder, no factory. Just types.

**Files:** `src/tree/viewModel.ts` (new, types only)
**Risk:** None. Purely additive. Zero runtime impact.
**Verification:** `npm run typecheck` passes.

### Step 2: Add `ConfigStore.getLockedScopes()`

Add a 3-line getter returning `ReadonlySet<ConfigScope>` from the existing private `_lockedScopes` field.

**Files:** `src/config/configModel.ts` (add method)
**Risk:** None. Additive.
**Verification:** `npm run typecheck` passes.

### Step 3: Implement TreeViewModelBuilder + Factory

Build the complete builder class and `createNodeFromViewModel` factory in `src/tree/viewModel.ts`. Extract logic from existing node constructors. Move format utilities (`formatValue`, `formatSandboxValue`, `formatHookValue`) to this file (or keep as shared exports — design choice during implementation).

**Files:** `src/tree/viewModel.ts` (add builder class + factory)
**Risk:** Low. No existing code modified yet. Builder can be tested by calling `.build()` and verifying ViewModel output against current node behavior.
**Verification:** Write integration test: `builder.build(allScopes, ...)` produces ViewModels matching current tree output.

### Step 4: Wire Builder Into ConfigTreeProvider

Modify `getSingleRootChildren()`, `getMultiRootChildren()`, and `WorkspaceFolderNode` to use the builder. The provider now creates nodes from ViewModels.

**Files:** `src/tree/configTreeProvider.ts` (modify)
**Risk:** Medium. This is the switch-over point. The tree must render identically after this change. Run extension in debug mode and visually verify.
**Verification:** F5 debug launch, verify all tree nodes render as before.

### Step 5: Migrate All Node Types (Single Pass)

Refactor all 14 node files to accept ViewModel constructors. Remove `ScopedConfig`/`allScopes` parameters, remove `overrideResolver` imports, remove display computation from constructors. Each node becomes a thin ViewModel-to-TreeItem mapper.

**Files:** All 14 files in `src/tree/nodes/`
**Risk:** Medium. Large surface area but mechanical — each node follows the same refactor pattern. Do this in a single commit to avoid the partial-migration anti-pattern.
**Verification:** F5 debug launch, verify all node types (permissions, env, plugins, settings, hooks, MCP, sandbox).

### Step 6: Simplify `baseNode.ts`

With display properties pre-computed in ViewModels, evaluate `finalize()`. The `applyOverrideStyle()` method becomes a no-op if the builder handles override description suffixes. `computeTooltip()` may simplify to just wrapping `vm.tooltipMarkdown`. `computeContextValue()` can be removed if contextValue comes from the ViewModel.

**Files:** `src/tree/nodes/baseNode.ts` (simplify)
**Risk:** Low. Simplification only.

### Step 7: Clean Up

Remove dead imports, unused local format functions from node files, verify no node file imports from `overrideResolver`. Run `npm run lint` to catch any remaining issues.

**Files:** Various
**Risk:** None. Cleanup only.

---

## Scalability Considerations

| Concern | Current (100s of nodes) | At 1K+ nodes | Notes |
|---------|------------------------|--------------|-------|
| ViewModel allocation | Negligible | Negligible | Plain objects, no event emitters, GC-friendly |
| Tree rebuild time | <5ms | <20ms | Builder does same work nodes did, just centralized |
| Memory | +1 ViewModel per node | Same | Short-lived, GC'd after tree nodes are constructed |
| Override resolution | Same total calls | Same | Moved from 6 node files to 1 builder, count unchanged |
| Code size | +1 new file (~300-400 LOC) | Same | Node files shrink by roughly same amount |

The ViewModel layer adds no meaningful performance overhead. It restructures existing computation rather than adding new computation.

---

## Sources

- Full codebase audit: `src/tree/nodes/` (14 files), `src/tree/configTreeProvider.ts`, `src/config/configModel.ts`, `src/config/overrideResolver.ts`, `src/commands/editCommands.ts`, `src/extension.ts`
- VS Code TreeView API: TreeDataProvider, TreeItem, TreeItemCollapsibleState patterns
- Confidence: HIGH — all findings based on direct source code inspection with zero external dependencies

---
*Architecture research for: Claude Code Config Manager v0.6.0 — Decouple State from Tree*
*Researched: 2026-03-05*
