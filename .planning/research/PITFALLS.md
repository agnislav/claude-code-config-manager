# Domain Pitfalls

**Domain:** Decoupling state from tree rendering in a VS Code TreeView extension
**Researched:** 2026-03-05
**Scope:** Refactoring pitfalls specific to this codebase (5,241 LOC, 14 node files, bidirectional sync)

---

## Critical Pitfalls

Mistakes that cause broken tree rendering, lost sync, or require reverting the refactor.

### Pitfall 1: Breaking the `contextValue` Contract with `package.json` Menu Bindings

**What goes wrong:** Commands disappear from context menus or appear on wrong node types after refactoring node constructors. The `contextValue` string is the sole link between tree nodes and VS Code's `when` clause matching in `package.json`. If the view-model layer changes how `contextValue` is computed (e.g., renaming node types, changing the `editable`/`readOnly` suffix logic, or breaking the `{nodeType}.{editability}[.overridden]` pattern), menus silently break with no runtime error.

**Why it happens:** `contextValue` is assembled inside `baseNode.computeContextValue()` and overridden in `ScopeNode.computeContextValue()`. Refactoring these into a view-model means the string must be composed identically. Developers test by visual inspection ("does the tree render?") but forget to right-click every node type.

**Consequences:** Users lose edit/delete/move/copy buttons on specific node types. Since `when` clause mismatches are silent, this can ship undetected. The `ScopeNode` has its own `contextValue` pattern (`scope.{scopeName}.{editability}[.missing]`) that differs from all other nodes -- easy to miss.

**Prevention:**
- Snapshot all `contextValue` strings from every node type before refactoring. Compare after.
- Write a test that constructs each node type and asserts `contextValue` matches the regex patterns in `package.json`.
- Refactor `contextValue` computation last, after all other node changes are stable.

**Detection:** Right-click every node type in every scope (User locked, User unlocked, Project Shared, Project Local) and verify all expected menu items appear.

---

### Pitfall 2: Invalidating the `parentMap` and Breaking `treeView.reveal()`

**What goes wrong:** Editor-to-tree sync stops working. The `ConfigTreeProvider.parentMap` is populated as a side effect of `getChildren()` calls -- it maps child `id` to parent node. `treeView.reveal()` requires a working `getParent()` chain from leaf to root. If the view-model layer introduces its own node identity scheme or caching that doesn't populate `parentMap` on the same code path, `reveal()` silently fails (no error, just no highlight).

**Why it happens:** The current `findNodeByKeyPath()` walks the tree via `getChildren()` which populates `parentMap` as a side effect. This coupling is intentional but non-obvious. A refactor that separates "query the tree structure" from "render tree items" can easily break this side effect.

**Consequences:** Clicking in the JSON editor no longer highlights the corresponding tree node. This is the bidirectional sync feature -- a core UX element. The failure is silent: `reveal()` returns a resolved promise even when it does nothing.

**Prevention:**
- Document the `parentMap` population contract explicitly: "Any code path that returns nodes for `reveal()` MUST populate `parentMap` for those nodes."
- If introducing a view-model, the view-model must either own the parent map or ensure `getChildren()` still populates it.
- Add an integration test: construct tree, call `findNodeByKeyPath()`, verify `getParent()` returns the correct chain for a leaf node.

**Detection:** Open a config JSON file, click on different keys, verify the tree highlights the matching node. Test with nested nodes (hook entries, setting key-value children).

---

### Pitfall 3: Override Resolution Executed at Wrong Layer

**What goes wrong:** Override detection becomes stale, duplicated, or inconsistent across node types. Currently, each node constructor calls the appropriate `resolve*Override()` function directly (e.g., `SettingNode` calls `resolveScalarOverride`, `PluginNode` calls `resolvePluginOverride`, `EnvVarNode` calls `resolveEnvOverride`). These functions take `allScopes: ScopedConfig[]` as input -- raw data from ConfigStore.

If a view-model pre-computes override status but uses a stale snapshot of `allScopes`, or if some node types compute overrides from the view-model while others still call resolver functions directly, the tree shows inconsistent override indicators.

**Why it happens:** There are 5 different override resolver functions, each with different signatures and semantics. `resolvePermissionOverride` returns `overriddenByCategory` (unique to permissions). `resolveSandboxOverride` handles nested dot-separated keys. Moving these into a unified view-model requires understanding all 5 variants.

**Consequences:** Nodes show incorrect "overridden by X" tooltips, or override dimming appears on wrong items. Users make config changes based on incorrect override information.

**Prevention:**
- Override resolution should remain as pure functions that take data in and return results. The view-model should call them, not replace them.
- Move the `allScopes` parameter into the view-model so all nodes get the same snapshot.
- Do NOT try to unify the 5 resolver functions into one -- they have legitimately different semantics (permissions have category-aware cross-matching, sandbox has nested key walking, etc.).

**Detection:** Set up a config where User scope has a setting overridden by Project Local. Verify the override indicator appears on the User node, not the Project Local node. Repeat for permissions (cross-category override) and env vars.

---

### Pitfall 4: Node `id` Collisions After Refactoring

**What goes wrong:** Tree nodes collapse/expand incorrectly, wrong nodes get selected, or the tree renders duplicate items. The `id` is computed in `baseNode.computeId()` as `{workspaceFolderUri}/{scope}/{keyPath.join('/')}`. VS Code uses `id` to maintain expand/collapse state across refreshes and to match nodes in `onDidChangeTreeData`.

If the view-model changes how `id` is generated (even subtly, like trimming a trailing slash or changing the separator), VS Code treats every node as new on every refresh -- all nodes collapse, selection is lost.

**Why it happens:** The `id` computation depends on `nodeContext` fields that are set during construction. If the view-model produces `nodeContext` with slightly different `workspaceFolderUri` formatting (e.g., `file:///path` vs `file:///path/`), all IDs change.

**Consequences:** Every tree refresh collapses all nodes. Users constantly re-expand to find what they were looking at. This is immediately noticeable but the root cause (ID mismatch) is hard to diagnose.

**Prevention:**
- Snapshot all node IDs before refactoring (`getChildren()` walk, log all `id` values).
- After refactoring, compare the same snapshot. Any ID change is a regression.
- Keep `computeId()` logic in one place (either base node or view-model, not split).

**Detection:** Expand several levels of the tree, trigger a config file change (which causes a refresh via file watcher), verify expand states are preserved.

---

### Pitfall 5: `ScopedConfig` Passthrough Creating Hidden Dependencies

**What goes wrong:** The "decoupled" tree nodes still depend on `ScopedConfig` shape, just indirectly through the view-model, gaining complexity without gaining separation. Currently, nearly every node constructor takes `scopedConfig: ScopedConfig` and `allScopes: ScopedConfig[]`. A naive view-model wraps these same objects and passes them through -- the coupling is identical but now has an extra layer of indirection.

**Why it happens:** `ScopedConfig` is used for three distinct purposes in node constructors:
1. **Identity** -- `scope`, `filePath`, `isReadOnly` go into `NodeContext`
2. **Data** -- `config.permissions`, `config.env`, etc. provide the content to render
3. **Override resolution** -- `allScopes` array feeds override resolvers

A proper decoupling must separate these three concerns, but the temptation is to create a `NodeViewModel` that just wraps `ScopedConfig`.

**Consequences:** The refactor adds abstraction without reducing coupling. Future changes to `ScopedConfig` shape still ripple through every node type. The view-model becomes a pass-through layer that makes the code harder to follow without providing benefit.

**Prevention:**
- Define what the view-model provides to each node type as a separate interface. Example: `SettingNodeData { key: string; value: unknown; isOverridden: boolean; overriddenByScope?: ConfigScope; isReadOnly: boolean; filePath: string; scope: ConfigScope }`.
- The view-model transforms `ScopedConfig` into these per-node-type data shapes. Nodes never see `ScopedConfig`.
- Accept that this means more interfaces. The value is that node constructors have minimal, typed contracts.
- Measure success: after refactoring, grep for `ScopedConfig` in `src/tree/nodes/`. If any node file still imports it, the decoupling is incomplete.

**Detection:** Code review -- check whether node files import from `../types` for `ScopedConfig` or from the view-model for their specific data shape.

---

## Moderate Pitfalls

### Pitfall 6: Plugin Checkbox State Desync During Refactoring

**What goes wrong:** Plugin checkbox toggle writes the wrong value or shows the wrong state. The checkbox flow is: user clicks checkbox -> `treeView.onDidChangeCheckboxState` fires -> handler reads `node.nodeContext.keyPath[1]` for plugin ID and `state` for enabled/disabled -> writes to file -> file watcher reloads -> tree re-renders.

If the view-model changes how `keyPath` is structured for plugin nodes (currently `['enabledPlugins', pluginId]`), the checkbox handler in `extension.ts` line 132 (`keyPath.length < 2`) will reject the event.

**Prevention:**
- The checkbox handler reads `nodeContext` directly. If `nodeContext` shape changes, update the handler simultaneously.
- Alternatively, add a typed accessor like `node.pluginId` rather than relying on positional `keyPath` indexing.
- Write a test: simulate checkbox toggle, verify the correct plugin ID and state are written to disk.

---

### Pitfall 7: `finalize()` Call Order in Refactored Constructors

**What goes wrong:** Nodes render with missing IDs, wrong context values, or no click commands. The `baseNode.finalize()` method must be called at the END of every leaf-class constructor, after all subclass fields are assigned. It reads `this.nodeType`, `this.description`, `this.collapsibleState`, and `this.nodeContext` to compute ID, contextValue, tooltip, override styling, and click command.

If refactoring changes the constructor to accept a view-model object, and `finalize()` is called before the view-model data is applied to the node's fields, the computed values will be wrong.

**Why it happens:** JavaScript class initialization order means `super()` runs before subclass field assignments. `finalize()` is a workaround for this. Refactoring constructors to accept different parameters can accidentally move `finalize()` before all fields are set.

**Prevention:**
- Keep `finalize()` as the last line in every leaf-class constructor. This is already documented in the codebase -- enforce it.
- If node constructors are simplified to accept pre-computed data, `finalize()` still depends on all `this.*` properties being set before it runs.
- Consider refactoring `finalize()` to lazy computation (compute on first access) as a separate enhancement, but NOT as part of this milestone.

---

### Pitfall 8: Commands Reading `node.description` for Current Values

**What goes wrong:** Edit commands show stale or wrong values in input boxes. `editCommands.ts` line 34 reads `node.description?.toString()` as the current value to pre-fill the input box. If the view-model changes how `description` is formatted (e.g., adding override suffix, changing number formatting), the pre-filled value will be wrong and re-saving it could corrupt the config.

**Prevention:**
- This is an existing design smell where commands read display properties for data values.
- During the refactor, consider adding a `nodeContext.rawValue` field or similar so commands can read the actual value, not the display string.
- At minimum, document this coupling so it is addressed intentionally rather than accidentally broken.

---

### Pitfall 9: `WorkspaceFolderNode` Couples to ConfigStore Directly

**What goes wrong:** The multi-root workspace path breaks separately from single-root. `WorkspaceFolderNode` (defined inline in `configTreeProvider.ts`) takes `configStore: ConfigStore` as a constructor parameter to check `isScopeLocked()`. This is the only node that directly references `ConfigStore` -- all others work through `ScopedConfig` data. A refactor that removes `ConfigStore` from node constructors must handle this special case.

**Prevention:**
- Pre-compute the lock state in `ConfigTreeProvider` before constructing `WorkspaceFolderNode`, passing `isLocked` as a boolean per scope instead of the entire `ConfigStore`.
- This pattern already exists for `getSingleRootChildren()` (line 211: `configStore.isScopeLocked()` is called before `ScopeNode` construction, and the result is baked into `effective.isReadOnly`). Apply the same pattern to `WorkspaceFolderNode`.

---

### Pitfall 10: `SectionNode` Has the Most Complex `getChildren()` -- Highest Regression Risk

**What goes wrong:** One of the 7 section types silently stops rendering children. `SectionNode.getChildren()` is a 7-way switch that constructs different node types for each section. Each branch reads different properties from `scopedConfig.config` (permissions, sandbox, hooks, mcpConfig.mcpServers, env, enabledPlugins, catch-all settings). If the view-model flattens or restructures the data differently for different sections, any one branch can break while others work.

**Prevention:**
- Test each section type independently after refactoring: permissions, sandbox, hooks, MCP servers, environment, plugins, settings.
- Consider splitting `SectionNode.getChildren()` into 7 separate factory functions during the refactor, making each testable in isolation.
- This is the node with the most data access patterns -- refactor it last, after individual leaf nodes are stable.

---

### Pitfall 11: Introducing a View-Model Cache That Conflicts with `childrenCache`

**What goes wrong:** Tree shows stale data after a config change. `ConfigTreeProvider` caches `getChildren()` results in `childrenCache`, cleared on `refresh()`. If the view-model introduces its own caching layer, there are now two caches that must be invalidated in sync. A config change that clears one but not the other shows stale nodes.

**Prevention:** Either the view-model owns caching (and `ConfigTreeProvider` stops caching), or `ConfigTreeProvider` keeps its cache and the view-model is stateless on each render pass. Do not have two caching layers for the same data.

---

## Minor Pitfalls

### Pitfall 12: Lock Decoration Provider URI Scheme Coupling

**What goes wrong:** Lock dimming stops working for User scope. `ScopeNode` constructs a special `resourceUri` with scheme `LOCK_URI_SCHEME` for the `LockDecorationProvider`. If the view-model changes how `ScopeNode` is constructed, this URI must be preserved exactly.

**Prevention:** Keep the `resourceUri` construction in `ScopeNode`, not in the view-model. It is a pure presentation concern.

---

### Pitfall 13: Plugin `resourceUri` Scheme for Dimming

**What goes wrong:** Disabled plugins stop being visually dimmed. Similar to the lock decoration, `PluginNode` uses a custom `resourceUri` scheme (`PLUGIN_URI_SCHEME`) for the `PluginDecorationProvider`. The URI encodes scope and enabled state.

**Prevention:** Same as Pitfall 12 -- keep `resourceUri` construction in the node class. The view-model provides data; the node owns VS Code API presentation concerns.

---

### Pitfall 14: Partial Refactoring Leaves Mixed Patterns

**What goes wrong:** Half the nodes use the new view-model pattern, half still take `ScopedConfig` directly. The codebase becomes harder to understand than before the refactor because developers must mentally track which pattern each node uses.

**Prevention:**
- Refactor ALL node types in a single milestone, not incrementally across milestones.
- If the milestone must be split into phases, each phase should fully convert a vertical slice (e.g., "all leaf nodes" or "all nodes in the settings section"), not leave any section half-done.
- Define a clear "done" criterion: zero node files import `ScopedConfig`.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Define view-model interfaces | Pitfall 5: pass-through wrapper | Define per-node-type data shapes, not `ScopedConfig` wrappers |
| Refactor leaf node constructors | Pitfall 7: `finalize()` order | Keep `finalize()` last; run full tree render test after each node |
| Refactor leaf node constructors | Pitfall 1: `contextValue` breakage | Snapshot all `contextValue` strings before/after; test right-click menus |
| Refactor leaf node constructors | Pitfall 4: node `id` changes | Snapshot all IDs before/after; verify expand state preserved |
| Move override resolution to view-model | Pitfall 3: stale/inconsistent overrides | Keep 5 resolver functions pure; view-model calls them with fresh data |
| Wire up editor-tree sync | Pitfall 2: `parentMap` broken | Verify `findNodeByKeyPath` + `reveal()` works end-to-end |
| Wire up checkbox handler | Pitfall 6: plugin state desync | Test checkbox toggle writes correct plugin ID |
| Multi-root workspace support | Pitfall 9: `WorkspaceFolderNode` ConfigStore ref | Pre-compute lock state, pass boolean not store |
| Refactor `SectionNode` | Pitfall 10: one section type breaks | Test all 7 section types independently |
| Add caching to view-model | Pitfall 11: dual cache invalidation | Single cache owner -- view-model OR tree provider, not both |
| All phases | Pitfall 14: mixed patterns | Refactor all nodes; zero `ScopedConfig` imports in node files when done |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `contextValue` + `package.json` `when` clauses | Refactor changes string format, menus silently disappear | Snapshot strings before refactor, compare after, test right-click on every node type |
| `parentMap` + `treeView.reveal()` | View-model bypasses `getChildren()`, parent map not populated | Ensure any node-walking code path populates parentMap for all returned nodes |
| `onDidChangeCheckboxState` + `nodeContext.keyPath` | View-model changes keyPath structure, handler rejects with `keyPath.length < 2` | Keep keyPath contracts stable; better yet, add typed accessors instead of positional indexing |
| `node.description` + `editCommands` | View-model adds decoration to description, edit pre-fills with decorated string | Add `rawValue` to nodeContext; commands should never read display properties for data |
| `computeId()` + tree expand/collapse state | View-model changes nodeContext field formatting, all IDs change, tree collapses | Keep ID generation stable; snapshot and compare |
| Override resolver functions + view-model | View-model pre-computes overrides from stale data snapshot | View-model calls resolvers at construction time with current allScopes, not cached |
| `SectionNode.getChildren()` switch + view-model | One branch reads `scopedConfig.config.X` directly instead of through view-model | Verify all 7 branches after refactoring; each reads from view-model data |
| `WorkspaceFolderNode` + `ConfigStore` | Only node with direct store dependency, missed during "remove store from nodes" sweep | Pre-compute lock state before node construction |
| `childrenCache` + view-model cache | Two caching layers, one invalidated on change, one stale | Single cache owner; do not introduce competing caches |

---

## "Looks Done But Isn't" Checklist

- [ ] **contextValue preserved:** Right-click every node type (scope, section, permissionGroup, permissionRule, hookEvent, hookEntry, hookKeyValue, mcpServer, envVar, plugin, setting, settingKeyValue, sandboxProperty) in both editable and readOnly states. Verify expected menu items.
- [ ] **Node IDs stable:** Expand tree fully, trigger a file watcher reload, verify expand states preserved. No nodes collapse unexpectedly.
- [ ] **Editor-to-tree sync:** Open a config JSON, click on keys in different sections, verify tree highlights the correct node each time. Test nested nodes (hook entries, setting key-value children, sandbox network properties).
- [ ] **Tree-to-editor sync:** Click leaf nodes in the tree, verify editor opens the correct file and jumps to the correct line.
- [ ] **Plugin checkbox:** Toggle a plugin checkbox, verify the correct plugin ID and state are written to disk. Test with User scope locked (should revert checkbox). Test with concurrent write in flight (should show info message).
- [ ] **Override indicators:** Set up User + Project Local with same setting. Verify User shows "overridden by Project Local" with dimmed icon. Verify Project Local does NOT show override. Repeat for permissions (cross-category), env vars, plugins, sandbox.
- [ ] **All 7 section types render:** Create a config with entries in all 7 sections. Verify each section shows its children correctly.
- [ ] **Multi-root workspace:** Open a multi-root workspace. Verify workspace folder nodes appear with correct scope children. Verify lock state affects correct nodes.
- [ ] **No `ScopedConfig` in nodes:** `grep -r "ScopedConfig" src/tree/nodes/` returns zero results (decoupling complete).
- [ ] **No `ConfigStore` in nodes:** `grep -r "ConfigStore" src/tree/nodes/` returns zero results (only `configTreeProvider.ts` should reference it).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| contextValue broken (P1) | LOW | Revert to pre-refactor `computeContextValue()` logic; compare strings |
| parentMap broken (P2) | MEDIUM | Ensure `getChildren()` in tree provider still populates parentMap; add explicit test |
| Override inconsistency (P3) | MEDIUM | Ensure view-model calls resolvers with fresh allScopes; verify all 5 resolver call sites |
| Node ID collision (P4) | LOW | Revert `computeId()` to original logic; compare ID snapshots |
| Pass-through wrapper (P5) | HIGH | Requires redesign of view-model interfaces; cannot be fixed incrementally |
| Plugin desync (P6) | LOW | Fix keyPath access in checkbox handler to match new structure |
| finalize() order (P7) | LOW | Move `finalize()` call to end of constructor |
| description as data (P8) | MEDIUM | Add rawValue field; update all command handlers that read description |
| WorkspaceFolderNode coupling (P9) | LOW | Pre-compute lock state; remove ConfigStore parameter |
| SectionNode regression (P10) | MEDIUM | Test each section; fix broken branches individually |
| Dual cache (P11) | MEDIUM | Remove one caching layer; pick single owner |
| Mixed patterns (P14) | HIGH | Must complete the refactor for all nodes; partial state is worse than no refactor |

---

## Sources

- Direct codebase analysis of all 14 files in `src/tree/nodes/`, `src/tree/configTreeProvider.ts`, `src/config/configModel.ts`, `src/config/overrideResolver.ts`, `src/commands/editCommands.ts`, `src/commands/moveCommands.ts`, and `src/extension.ts`
- VS Code TreeDataProvider API: `parentMap`/`reveal()` contract, `contextValue`/`when` clause binding, `onDidChangeCheckboxState` post-change semantics
- Confidence: HIGH -- all pitfalls derived from direct code reading of this specific codebase, not generic advice

---
*Pitfalls research for v0.6.0: Decouple State from Tree*
*Researched: 2026-03-05*
