# Feature Landscape

**Domain:** Decoupling state management from tree rendering in a VS Code TreeView extension
**Researched:** 2026-03-05
**Confidence:** HIGH (all findings based on direct codebase analysis of 5,241 LOC)

---

## Current Coupling Analysis

Before defining features, here is exactly what is coupled and how. Every feature below targets a specific coupling point.

**Coupling Point 1 -- `allScopes: ScopedConfig[]` threading:**
Passed from ConfigTreeProvider -> ScopeNode -> SectionNode -> leaf nodes (PermissionGroupNode, PermissionRuleNode, EnvVarNode, PluginNode, SettingNode, SettingKeyValueNode, SandboxPropertyNode). Used solely for override resolution. 8 node types carry this parameter they do not directly use -- they pass it to `resolveXxxOverride()` functions.

**Coupling Point 2 -- Override resolution in constructors:**
SettingNode calls `resolveScalarOverride()`, EnvVarNode calls `resolveEnvOverride()`, PluginNode calls `resolvePluginOverride()`, SandboxPropertyNode calls `resolveSandboxOverride()`, PermissionRuleNode calls `resolvePermissionOverride()`. Five different resolver calls spread across five node files, each importing from `overrideResolver.ts`.

**Coupling Point 3 -- `ScopedConfig` as the universal data carrier:**
Every node receives the full `ScopedConfig` (scope, filePath, fileExists, config, mcpConfig, isReadOnly). Nodes only use a subset: most need `scope`, `filePath`, `isReadOnly`. The full config object is only needed by parent nodes to extract children; leaf nodes never read it.

**Coupling Point 4 -- ConfigStore in tree building:**
`ConfigTreeProvider.getSingleRootChildren()` calls `configStore.isScopeLocked()` and mutates ScopedConfig before passing to ScopeNode. `WorkspaceFolderNode` holds a `ConfigStore` reference for the same lock check. The tree building path depends on ConfigStore directly.

**Coupling Point 5 -- Section filter in ScopeNode:**
`ScopeNode` receives `sectionFilter: ReadonlySet<SectionType>` and applies it in `getChildren()` to decide which SectionNodes to create. This is presentation logic (what to show) mixed with the node that represents a scope.

**Coupling Point 6 -- Item counts in SectionNode:**
`SectionNode.getItemCount()` reads raw config data (`config.permissions`, `config.hooks`, `config.env`, etc.) to compute description strings like "3 rules". This is data extraction happening in a presentation class.

---

## Table Stakes

Features that are essential for the decoupling to deliver real value. Without these, the refactor is cosmetic.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| View-model layer between ConfigStore and tree nodes | This IS the decoupling. A module of pure functions that transforms `ScopedConfig[]` + lock state + filter into typed descriptors that nodes render without data extraction. | Med (~150-250 new LOC) | ConfigStore, overrideResolver, all node types |
| Pre-computed override resolution in view-model | Eliminates Coupling Point 2. Five different `resolveXxxOverride()` calls move from five node constructors into one view-model builder. Nodes receive `isOverridden` and `overriddenByScope` as pre-resolved fields. | Med | View-model layer, overrideResolver.ts (unchanged) |
| Node constructors accept typed descriptors instead of ScopedConfig | Eliminates Coupling Point 3. Each node receives exactly the fields it needs (scope, filePath, isReadOnly, display value, override state) via a typed interface. No more passing full config objects to leaf nodes. | Med (12+ constructor signature changes) | View-model layer must produce descriptors |
| Remove `allScopes` propagation from node tree | Eliminates Coupling Point 1. With pre-computed overrides, no node needs the full `allScopes` array. Constructor signatures shrink across 8 node types. | Low (mechanical removal) | Pre-computed overrides must exist first |
| ConfigTreeProvider uses view-model to build root nodes | Eliminates Coupling Point 4. `getSingleRootChildren()` and `getMultiRootChildren()` call the view-model builder instead of directly querying ConfigStore for lock state and constructing ScopeNodes with raw data. | Med (2 methods rewritten) | View-model layer |

---

## Differentiators

Features that amplify the decoupling's value. Not strictly required, but increase architectural cleanliness significantly.

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Typed descriptor interfaces per node type | Define `ScopeDescriptor`, `SectionDescriptor`, `SettingDescriptor`, `PluginDescriptor`, etc. with exactly the fields each node needs. Catches data-shape mismatches at compile time instead of runtime. | Low (type definitions only) | None -- can be done first |
| Section filter applied in view-model | Eliminates Coupling Point 5. `ScopeNode.getChildren()` currently checks filter and conditionally creates SectionNodes. Move filtering into the view-model: ScopeNode receives only the sections it should render. | Low | View-model layer |
| Lock state baked into descriptors | Eliminates the `configStore.isScopeLocked()` call in both `getSingleRootChildren()` and `WorkspaceFolderNode.getChildren()`. Lock state is resolved once in the view-model and encoded in the descriptor's `isReadOnly` field. | Low | View-model layer |
| WorkspaceFolderNode drops ConfigStore reference | Eliminates Coupling Point 4 completely. Currently `WorkspaceFolderNode` holds `private readonly configStore: ConfigStore` solely for lock checks. With lock state in descriptors, this constructor parameter disappears. | Low | Lock state in descriptors |
| Item counts pre-computed in section descriptors | Eliminates Coupling Point 6. `SectionNode.getItemCount()` reads raw config data to produce "3 rules", "2 servers", etc. Move this to the view-model: SectionNode receives `itemCount: string` in its descriptor. | Low | View-model layer |

---

## Anti-Features

Features to explicitly NOT build as part of this decoupling milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Observable/reactive view-model (RxJS, MobX, signals) | VS Code TreeView has no partial-update API. The entire tree rebuilds on `_onDidChangeTreeData.fire()`. A reactive system adds abstraction with zero rendering benefit. The view-model would be observed by exactly one consumer that always wants all data at once. | Keep the current fire() -> full rebuild model. View-model is computed fresh on each getChildren() call, discarded on refresh(). |
| Persistent view-model cache across refreshes | ConfigTreeProvider already has `childrenCache` for the current render cycle. A persistent view-model cache introduces invalidation complexity (stale lock state, stale override data, stale filter state) for negligible performance gain. Config data is tiny (hundreds of settings at most). | Stateless view-model: build on demand, discard on refresh. Zero cache invalidation bugs. |
| View-model as a VS Code service/singleton | Over-architecture. The view-model is a pure data transformation (ConfigStore data -> node descriptors). It needs no lifecycle management, no DI registration, no event emission. Making it a service suggests it has state -- it should not. | Module of pure functions or a stateless class instantiated by ConfigTreeProvider. |
| Abstract factory for node creation | 12 node types, each constructed in exactly one place (parent creates children). A factory adds indirection without reducing duplication. The "factory" is just the parent node's `getChildren()` method. | Each parent node constructs children directly from descriptors, same as today but with cleaner inputs. |
| Extracting tree nodes into a separate package | 5,241 LOC extension with zero runtime dependencies. Package boundaries or dynamic imports add build complexity for code that will never be consumed outside this extension. | Keep flat `src/tree/nodes/` structure. TypeScript imports provide sufficient module boundaries. |
| Deep immutability enforcement (Object.freeze, readonly deep) | Descriptors are created, passed to constructors, consumed, and discarded. They are never stored or mutated post-construction. Runtime freezing adds overhead and makes debugging harder with no correctness benefit. | TypeScript `readonly` on descriptor interface fields. Compile-time safety is sufficient. |
| Modifying overrideResolver to return descriptors | The resolver functions are clean domain utilities that work with `ScopedConfig[]`. They should remain domain-level, not presentation-level. Coupling them to the view-model shape creates a layering violation. | View-model imports resolver functions, maps results to descriptor fields. Resolver stays unchanged. |
| Unit tests as part of this milestone | Testing is valuable but is a separate deliverable. The decoupling itself is the milestone goal. Adding tests increases scope by ~50% for a refactor whose correctness is verifiable by manual tree inspection. | Note as follow-up task. The existing manual testing flow (F5 Extension Development Host) validates the refactor. |

---

## Feature Dependencies

```
Typed descriptor interfaces (differentiator, independent)
  |
  v
View-model layer (table stakes, core)
  |
  +-> Pre-computed override resolution (table stakes)
  |     |
  |     +-> Remove allScopes propagation (table stakes, cleanup)
  |
  +-> Node constructors accept descriptors (table stakes)
  |     |
  |     +-> Remove allScopes propagation (table stakes, cleanup)
  |
  +-> ConfigTreeProvider uses view-model (table stakes)
  |     |
  |     +-> Section filter in view-model (differentiator)
  |     +-> Lock state in descriptors (differentiator)
  |     |     |
  |     |     +-> WorkspaceFolderNode drops ConfigStore (differentiator)
  |     +-> Item counts in descriptors (differentiator)
```

All differentiators depend on the view-model layer existing. Table stakes features have internal ordering: descriptor interfaces should be defined first (they shape everything else), then the view-model, then node constructor refactoring, then cleanup.

---

## MVP Recommendation

**Build order (sequential, each step validates the previous):**

1. **Define descriptor interfaces** -- Pure type work, zero runtime changes. Establishes the contract for every node type. Can validate that each descriptor captures exactly what the node currently extracts from ScopedConfig.

2. **Create view-model builder module** -- Pure functions that transform `ScopedConfig[] + lockState + filter` into a tree of descriptors. This is where override resolution, lock merging, section filtering, and item counting move. ~150-250 LOC of new code.

3. **Refactor node constructors** -- Largest surface area change (12+ files). Each node's constructor signature changes from `(data, scopedConfig, allScopes)` to `(descriptor)`. Mechanical but requires care. Each node file touched individually and verified.

4. **Update ConfigTreeProvider** -- Wire `getSingleRootChildren()` and `getMultiRootChildren()` to call the view-model builder. Remove direct ConfigStore queries from the tree-building path.

5. **Remove allScopes and clean up** -- Drop the `allScopes` parameter from all node types. Remove the `configStore` field from `WorkspaceFolderNode`. Pure deletion.

**Defer to later commits (not blockers):**
- Section filter in view-model (can fold into step 2 or do separately)
- Item counts in descriptors (can fold into step 2 or do separately)

---

## Complexity Assessment

| Area | Estimated Effort | Risk | Notes |
|------|-----------------|------|-------|
| Descriptor interfaces | Small | Low | Type definitions only, no runtime |
| View-model builder | Medium (~150-250 LOC) | Low | Pure functions, testable in isolation |
| Node constructor refactoring | Medium (12+ files) | Medium | High surface area; each file is small but there are many |
| ConfigTreeProvider update | Small-medium | Low | 2 methods rewritten |
| allScopes removal | Small | Low | Mechanical deletion |

**Total estimated LOC change:** ~400-600 lines modified/added. Net LOC likely stays similar -- new view-model module roughly offsets logic removed from node constructors.

**Key risk:** The node constructor refactoring touches 12+ files. Missing a parameter or misaligning a descriptor field will manifest as broken tree items (wrong labels, missing icons, incorrect override indicators). Mitigation: refactor one node type end-to-end first (e.g., SettingNode) to prove the pattern before applying to all.

---

## Sources

- Direct codebase analysis: `src/tree/configTreeProvider.ts` (ConfigStore dependency, tree building)
- Direct codebase analysis: `src/tree/nodes/baseNode.ts` (NodeContext, finalize pattern)
- Direct codebase analysis: `src/tree/nodes/scopeNode.ts` (allScopes + filter coupling)
- Direct codebase analysis: `src/tree/nodes/sectionNode.ts` (config data extraction, item counts)
- Direct codebase analysis: `src/tree/nodes/settingNode.ts` (resolveScalarOverride in constructor)
- Direct codebase analysis: `src/tree/nodes/envVarNode.ts` (resolveEnvOverride in constructor)
- Direct codebase analysis: `src/tree/nodes/pluginNode.ts` (resolvePluginOverride in constructor)
- Direct codebase analysis: `src/tree/nodes/permissionGroupNode.ts` (allScopes pass-through)
- Direct codebase analysis: `src/tree/nodes/hookEventNode.ts` (ScopedConfig dependency)
- Direct codebase analysis: `src/config/overrideResolver.ts` (5 resolver functions)
- Direct codebase analysis: `src/config/configModel.ts` (ConfigStore API surface)
- Direct codebase analysis: `src/types.ts` (ScopedConfig, NodeContext, ResolvedValue)
- VS Code TreeDataProvider API: fire() triggers full tree rebuild, no partial update mechanism
- Confidence: HIGH -- all findings from direct code inspection, no external sources needed

---
*Feature research for: Claude Code Config Manager v0.6.0 -- Decouple State from Tree*
*Researched: 2026-03-05*
