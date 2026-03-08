# Phase 17: Node Migration - Research

**Researched:** 2026-03-07
**Domain:** VS Code TreeView node refactoring -- ViewModel-driven rendering
**Confidence:** HIGH

## Summary

Phase 17 migrates all 14 tree node constructors and the inline WorkspaceFolderNode from raw config data (ScopedConfig/allScopes/ConfigStore) to pre-built ViewModel descriptors. The TreeViewModelBuilder from Phase 16 already produces the full VM tree with all display state pre-computed. The work is a mechanical transformation: rewire ConfigTreeProvider to call `builder.build()` on refresh, create a `vmToNode()` mapper that dispatches on `vm.kind`, simplify each node constructor to accept its typed VM and copy fields to TreeItem properties, and remove `getChildren()` business logic from nodes (children come from `vm.children` mapped through `vmToNode()`).

The codebase is small and well-structured. There are exactly 14 node files in `src/tree/nodes/` plus the inline WorkspaceFolderNode in `configTreeProvider.ts`. Six node files import from `overrideResolver` -- these imports must be removed (VM-06). All node constructors currently receive ScopedConfig/allScopes -- these parameters must be replaced with VM types (VM-05, VM-07). The WorkspaceFolderNode receives ConfigStore directly -- this dependency must be removed (VM-08). Command handlers access `node.nodeContext` and `node.nodeType` exclusively -- both are preserved in the VM, so commands require zero changes.

**Primary recommendation:** Implement as a single plan with three logical waves: (1) rewire ConfigTreeProvider + create vmToNode mapper, (2) migrate all 14 node constructors + new WorkspaceFolderNode file, (3) simplify baseNode and verify editor-tree sync.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single plan, all 14 nodes migrated at once -- no waves or temporary compatibility shims
- Top-down conceptual order: provider wiring first, then node constructors
- Generic VM-to-node mapper function: one `vmToNode()` switch on `vm.kind` replaces all entity-specific dispatch in nodes
- `vmToNode()` mapper lives in configTreeProvider.ts alongside getChildren()
- Each node constructor accepts a single ViewModel parameter: `new ScopeNode(vm: ScopeVM)`
- VM stored as `private readonly vm` on the node instance for getChildren() and command access
- ConfigTreeNode base class kept but simplified: stores vm, nodeContext, nodeType; constructor copies VM fields to TreeItem properties
- `finalize()` removed entirely -- builder pre-computes contextValue, id, tooltip in the VM
- `builder.build()` called in refresh(), result cached as root VMs
- getChildren(undefined) maps cached root VMs via vmToNode() -- no separate getSingleRootChildren()/getMultiRootChildren() methods
- parentMap pre-built from ViewModel tree during refresh() (walk VM tree after build) so reveal() works immediately
- childrenCache remains for caching created TreeItem node instances
- Move WorkspaceFolderNode from inline in configTreeProvider.ts to its own file: src/tree/nodes/workspaceFolderNode.ts
- WorkspaceFolderNode accepts WorkspaceFolderVM like all other nodes

### Claude's Discretion
- Exact vmToNode() implementation and NodeKind switch structure
- How to handle the transition of SectionNode.getChildren() (currently has 7 entity-dispatch methods)
- Whether to remove entity-specific getChildren() methods from nodes or leave as empty stubs
- Error handling strategy for malformed VMs

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VM-05 | All 14 tree node types accept ViewModels instead of raw ScopedConfig/allScopes | Node constructor migration pattern documented; all 14 current constructors analyzed |
| VM-06 | No tree node file imports from overrideResolver | Six files identified with overrideResolver imports: permissionRuleNode, settingNode, settingKeyValueNode, pluginNode, envVarNode, sandboxPropertyNode |
| VM-07 | No tree node file receives ConfigStore or allScopes in constructor | All current constructors analyzed; ScopeNode, SectionNode, PermissionGroupNode, SettingNode, PluginNode, EnvVarNode, SandboxPropertyNode receive allScopes; WorkspaceFolderNode receives ConfigStore |
| VM-08 | WorkspaceFolderNode has no direct ConfigStore dependency | WorkspaceFolderNode currently receives ConfigStore in constructor for isScopeLocked(); builder handles this now |
| VM-09 | ConfigTreeProvider wires TreeViewModelBuilder into its refresh cycle | Provider wiring pattern documented with builder.build() caching and parentMap pre-population |
| VM-10 | Bidirectional editor-tree sync preserved with identical behavior | findNodeByKeyPath/walkForNode analysis complete; parentMap pre-build strategy documented; reveal() pattern preserved |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vscode | ^1.96.0 | Extension host API, TreeItem, ThemeIcon | Only API -- no alternatives |
| TypeScript | 5.x strict | Type safety for VM discriminated unions | Project convention |

### Supporting
No new dependencies. This is a pure internal refactor using existing ViewModel types from Phase 16.

## Architecture Patterns

### Recommended Changes Structure
```
src/
├── viewmodel/
│   ├── types.ts              # UNCHANGED -- BaseVM, 14 VM interfaces, NodeKind enum
│   └── builder.ts            # UNCHANGED -- TreeViewModelBuilder
├── tree/
│   ├── configTreeProvider.ts # MAJOR REWRITE -- builder wiring, vmToNode(), parentMap pre-build
│   └── nodes/
│       ├── baseNode.ts       # SIMPLIFIED -- generic VM-driven constructor, no finalize()
│       ├── workspaceFolderNode.ts  # NEW FILE -- extracted from configTreeProvider.ts
│       ├── scopeNode.ts      # SIMPLIFIED -- accepts ScopeVM
│       ├── sectionNode.ts    # SIMPLIFIED -- accepts SectionVM, no entity dispatch
│       ├── permissionGroupNode.ts  # SIMPLIFIED
│       ├── permissionRuleNode.ts   # SIMPLIFIED, overrideResolver import removed
│       ├── settingNode.ts          # SIMPLIFIED, overrideResolver import removed
│       ├── settingKeyValueNode.ts  # SIMPLIFIED, overrideResolver import removed
│       ├── envVarNode.ts           # SIMPLIFIED, overrideResolver import removed
│       ├── pluginNode.ts           # SIMPLIFIED, overrideResolver import removed
│       ├── mcpServerNode.ts        # SIMPLIFIED
│       ├── sandboxPropertyNode.ts  # SIMPLIFIED, overrideResolver import removed
│       ├── hookEventNode.ts        # SIMPLIFIED
│       ├── hookEntryNode.ts        # SIMPLIFIED
│       └── hookKeyValueNode.ts     # SIMPLIFIED
```

### Pattern 1: VM-driven Node Constructor
**What:** Each node constructor accepts a single typed ViewModel, stores it, and copies pre-computed fields to TreeItem properties.
**When to use:** Every node class.
**Example:**
```typescript
// New pattern for all nodes
export class ScopeNode extends ConfigTreeNode {
  readonly nodeType = 'scope';

  constructor(private readonly vm: ScopeVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return vm.children.map(vmToNode);
  }
}
```

### Pattern 2: Simplified Base Class
**What:** ConfigTreeNode base class accepts a BaseVM, maps all fields to TreeItem properties in one place.
**When to use:** Single base class constructor.
**Example:**
```typescript
export abstract class ConfigTreeNode extends vscode.TreeItem {
  abstract readonly nodeType: string;
  readonly nodeContext: NodeContext;

  constructor(vm: BaseVM) {
    super(vm.label, vm.collapsibleState);
    this.nodeContext = vm.nodeContext;
    this.id = vm.id;
    this.iconPath = vm.icon;
    this.description = vm.description;
    this.contextValue = vm.contextValue;
    this.tooltip = vm.tooltip;
    if (vm.resourceUri) this.resourceUri = vm.resourceUri;
    if (vm.checkboxState !== undefined) this.checkboxState = vm.checkboxState;
    if (vm.command) this.command = vm.command;
  }

  abstract getChildren(): ConfigTreeNode[];
}
```

### Pattern 3: vmToNode Mapper
**What:** Single function in configTreeProvider.ts that switches on `vm.kind` to create the right node type.
**When to use:** All node creation flows through this.
**Example:**
```typescript
function vmToNode(vm: BaseVM): ConfigTreeNode {
  switch (vm.kind) {
    case NodeKind.WorkspaceFolder:
      return new WorkspaceFolderNode(vm as WorkspaceFolderVM);
    case NodeKind.Scope:
      return new ScopeNode(vm as ScopeVM);
    case NodeKind.Section:
      return new SectionNode(vm as SectionVM);
    // ... all 14 kinds
    default:
      throw new Error(`Unknown NodeKind: ${(vm as BaseVM).kind}`);
  }
}
```

### Pattern 4: Pre-built ParentMap
**What:** Walk the VM tree in refresh() to populate parentMap before any getChildren() call.
**When to use:** In ConfigTreeProvider.refresh() after builder.build().
**Example:**
```typescript
refresh(): void {
  this.parentMap.clear();
  this.childrenCache.clear();
  this.cachedRootVMs = this.builder.build(this._sectionFilter);
  this.prePopulateParentMap(this.cachedRootVMs, undefined);
  this._onDidChangeTreeData.fire();
}

private prePopulateParentMap(vms: BaseVM[], parentNode: ConfigTreeNode | undefined): void {
  for (const vm of vms) {
    const node = vmToNode(vm);
    if (node.id && parentNode) {
      this.parentMap.set(node.id, parentNode);
    }
    if (vm.children.length > 0) {
      this.prePopulateParentMap(vm.children, node);
    }
  }
}
```

### Anti-Patterns to Avoid
- **Creating nodes eagerly in parentMap pre-build:** The parentMap needs node instances, but creating them eagerly would double-create nodes. Instead, pre-build uses VM IDs mapped to parent VM IDs, then resolve to nodes lazily. Alternatively, create nodes once and cache them during the parentMap walk, reusing them in getChildren().
- **Leaving getChildren() with business logic in nodes:** Nodes should only map `vm.children` through `vmToNode()`. All filtering, override resolution, and entity dispatch stays in the builder.
- **Importing ScopedConfig in node files:** Breaks VM-05/VM-07. The only type imports from `../../types` should be NodeContext (for the public property type) and enum values needed by nodeType.
- **Keeping finalize() calls:** Per locked decision, finalize() is removed. Base constructor handles all property assignment.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Override resolution in nodes | Per-node override calls | Builder pre-computes all overrides in VMs | Builder already does this (Phase 16) |
| Context value computation | Per-node computeContextValue() | Builder pre-computes contextValue string | Already in BaseVM.contextValue |
| ID computation | Per-node computeId() | Builder pre-computes id string | Already in BaseVM.id |
| Tooltip computation | Per-node computeTooltip() | Builder pre-computes tooltip | Already in BaseVM.tooltip |
| Section children dispatch | 7-branch switch in SectionNode | vm.children already contains the right child VMs | Builder handles entity dispatch |

**Key insight:** The TreeViewModelBuilder already produces fully-formed VMs with all display state. Node constructors should be trivial mappers -- no computation, just field copying.

## Common Pitfalls

### Pitfall 1: ParentMap and Node Identity
**What goes wrong:** The parentMap maps node IDs to parent ConfigTreeNode instances. If nodes are created multiple times (once for parentMap, once for getChildren), the parentMap holds stale references and reveal() fails.
**Why it happens:** Pre-building parentMap requires node instances, but getChildren() also creates them.
**How to avoid:** Create nodes once. Either: (a) build the entire node tree eagerly during refresh() and cache it, serving from cache in getChildren(), or (b) use a two-phase approach where parentMap stores parent-child VM ID relationships, then resolves to nodes when getChildren() creates them.
**Warning signs:** treeView.reveal() stops working; clicking an item in the editor doesn't highlight the corresponding tree node.

### Pitfall 2: PLUGIN_URI_SCHEME Export
**What goes wrong:** `PLUGIN_URI_SCHEME` is currently exported from pluginNode.ts and imported by both builder.ts and extension.ts (via PluginDecorationProvider). If pluginNode.ts is heavily refactored, the export might be accidentally removed.
**Why it happens:** The constant is co-located with the node class but used outside.
**How to avoid:** Keep `PLUGIN_URI_SCHEME` export in pluginNode.ts. Also keep `PluginDecorationProvider` class in pluginNode.ts -- it is not part of the migration.
**Warning signs:** Build errors in builder.ts or extension.ts referencing PLUGIN_URI_SCHEME.

### Pitfall 3: formatValue Export from settingNode.ts
**What goes wrong:** `settingKeyValueNode.ts` imports `formatValue` from `settingNode.ts`. After migration, settingNode.ts may no longer need this function, but the import from settingKeyValueNode.ts would break if it's removed.
**Why it happens:** Cross-node utility function co-located with a node class.
**How to avoid:** After migration, settingNode.ts no longer needs formatValue (builder has its own). The import in settingKeyValueNode.ts also goes away since the builder handles description formatting. Safe to remove from both files. But verify no other consumers exist.
**Warning signs:** Build errors referencing formatValue.

### Pitfall 4: nodeType String Must Match contextValue Patterns
**What goes wrong:** Commands in package.json use `when` clause regex patterns on contextValue strings. The nodeType field contributes to contextValue. If nodeType strings change, context menus break silently.
**Why it happens:** nodeType strings are part of the contextValue contract with package.json.
**How to avoid:** Keep exact same nodeType strings on each node class. Verify contextValue strings in VMs match what nodes previously produced. The builder already replicates the same patterns, but verify during testing.
**Warning signs:** Context menu items disappear or appear on wrong nodes.

### Pitfall 5: ScopeNode contextValue is Non-Standard
**What goes wrong:** ScopeNode overrides `computeContextValue()` to produce `scope.{scopeName}.{editable|readOnly}[.missing]` instead of the standard pattern. If the base class just uses vm.contextValue (which the builder already pre-computes correctly), this is fine. But if someone adds a custom override in the new ScopeNode, it would conflict.
**Why it happens:** ScopeNode had custom contextValue logic that differs from the base pattern.
**How to avoid:** Trust the VM. The builder already produces the correct scope contextValue. No node should override contextValue computation -- it comes from the VM.
**Warning signs:** Scope-specific menu items (create file, open file) not appearing.

### Pitfall 6: getChildren() Must Still Handle Error Wrapping
**What goes wrong:** Current nodes wrap getChildren() in try/catch with warning messages. If this error handling is removed from nodes but not added to the provider-level vmToNode mapping, errors propagate silently.
**Why it happens:** Error handling was distributed across all node getChildren() implementations.
**How to avoid:** Centralize error handling in ConfigTreeProvider.getChildren() (it already has try/catch). Individual node getChildren() can be simple: `return this.vm.children.map(vmToNode)` without try/catch since the provider wraps the entire call.
**Warning signs:** Uncaught exceptions in tree rendering.

## Code Examples

### ConfigTreeProvider Rewrite Pattern
```typescript
export class ConfigTreeProvider implements vscode.TreeDataProvider<ConfigTreeNode>, vscode.Disposable {
  private readonly builder: TreeViewModelBuilder;
  private cachedRootVMs: BaseVM[] = [];
  private readonly parentMap = new Map<string, ConfigTreeNode>();
  private readonly childrenCache = new Map<string, ConfigTreeNode[]>();
  // ... sectionFilter, events ...

  constructor(private readonly configStore: ConfigStore) {
    this.builder = new TreeViewModelBuilder(configStore);
    configStore.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.parentMap.clear();
    this.childrenCache.clear();
    this.cachedRootVMs = this.builder.build(this._sectionFilter);
    this._onDidChangeTreeData.fire();
  }

  getChildren(element?: ConfigTreeNode): ConfigTreeNode[] {
    const cacheKey = element?.id ?? '__root__';
    const cached = this.childrenCache.get(cacheKey);
    if (cached) return cached;

    let children: ConfigTreeNode[];
    if (element) {
      children = element.getChildren();
    } else {
      children = this.cachedRootVMs.map(vmToNode);
    }

    // Populate parent map
    for (const child of children) {
      if (child.id && element) {
        this.parentMap.set(child.id, element);
      }
    }

    this.childrenCache.set(cacheKey, children);
    return children;
  }

  // findNodeByKeyPath and walkForNode remain largely the same
  // -- they walk via getChildren() which populates parentMap lazily
}
```

### Node getChildren() Pattern (Parent Nodes)
```typescript
// ScopeNode, SectionNode, PermissionGroupNode, HookEventNode, HookEntryNode, SettingNode
getChildren(): ConfigTreeNode[] {
  return this.vm.children.map(vmToNode);
}
```

### Node getChildren() Pattern (Leaf Nodes)
```typescript
// PermissionRuleNode, EnvVarNode, PluginNode, McpServerNode,
// SandboxPropertyNode, HookKeyValueNode, SettingKeyValueNode
getChildren(): ConfigTreeNode[] {
  return [];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nodes compute display state from raw config | Builder pre-computes all display state in VMs | Phase 16 (2026-03-06) | Nodes become trivial mappers |
| overrideResolver called in node constructors | Builder calls overrideResolver, stores results in VM fields | Phase 16 (2026-03-06) | Node files no longer import overrideResolver |
| ConfigTreeProvider delegates to nodes for child creation | Provider calls builder, maps VMs to nodes | This phase | Single source of truth for tree structure |

## Open Questions

1. **ParentMap Strategy: Lazy vs Eager**
   - What we know: CONTEXT.md says "parentMap pre-built from ViewModel tree during refresh()". Current implementation builds parentMap lazily in getChildren(). findNodeByKeyPath relies on walking via getChildren() which populates parentMap as a side effect.
   - What's unclear: Pre-building parentMap from VMs requires creating node instances eagerly, which conflicts with lazy node creation in getChildren(). Alternatively, we could store VM-ID-to-parent-VM-ID mappings and resolve to nodes later.
   - Recommendation: Keep parentMap lazy (populated in getChildren() as today). The findNodeByKeyPath method already forces tree expansion through getChildren() calls, which populates parentMap. The CONTEXT.md intent of "immediate reveal()" is already achieved because findNodeByKeyPath walks the tree before reveal() is called. Eagerly creating all nodes would be wasteful for large configs. Mark this as Claude's discretion area.

2. **vmToNode Must Be Accessible from Node getChildren()**
   - What we know: vmToNode lives in configTreeProvider.ts. Node getChildren() calls `this.vm.children.map(vmToNode)`. But nodes cannot import from configTreeProvider.ts (circular dependency).
   - What's unclear: How to make vmToNode available to nodes.
   - Recommendation: Export vmToNode as a standalone function from a separate file (e.g., `src/tree/vmToNode.ts`) or pass it to the base class constructor. Simplest approach: make it a module-level export in a small file that both configTreeProvider.ts and node files can import. This avoids circular dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha + VS Code test runner |
| Config file | .vscode-test.mjs |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VM-05 | Node constructors accept VMs only | manual-only | Visual inspection of constructor signatures | N/A |
| VM-06 | No overrideResolver imports in node files | unit | `grep -r "overrideResolver" src/tree/nodes/` (zero results) | N/A |
| VM-07 | No ConfigStore/allScopes in constructors | manual-only | Visual inspection of constructor signatures | N/A |
| VM-08 | WorkspaceFolderNode has no ConfigStore dep | manual-only | Visual inspection of imports and constructor | N/A |
| VM-09 | Provider wires builder into refresh | smoke | `npm run compile` (type-checks wiring) | N/A |
| VM-10 | Editor-tree sync preserved | manual | F5 debug: open config file, move cursor, verify tree selection follows | N/A |

### Sampling Rate
- **Per task commit:** `npm run compile && npm run lint`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green + manual editor-tree sync verification

### Wave 0 Gaps
None -- this is a refactor of existing code. Compile success (`npm run compile`) and lint pass (`npm run lint`) are the primary automated gates. The existing test suite covers end-to-end behavior. Phase 18 (TEST-01 through TEST-03) adds dedicated unit tests for the ViewModel layer.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all 14 node files, configTreeProvider.ts, builder.ts, types.ts
- Phase 16 output: src/viewmodel/builder.ts (1047 lines), src/viewmodel/types.ts (166 lines)
- CONTEXT.md locked decisions from user discussion

### Secondary (MEDIUM confidence)
- VS Code TreeDataProvider API patterns (from project's existing working implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pure internal refactor, no new dependencies
- Architecture: HIGH - all source code analyzed, builder already exists with matching VM types
- Pitfalls: HIGH - identified from direct code analysis of import chains, contextValue patterns, and parentMap mechanics

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- internal refactor, no external dependencies)
