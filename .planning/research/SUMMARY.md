# Project Research Summary

**Project:** Claude Code Config Manager v0.6.0 -- Decouple State from Tree
**Domain:** VS Code extension refactoring -- state-view separation in TreeView architecture
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

v0.6.0 is a structural refactor of an existing 5,241 LOC VS Code extension that provides a visual config viewer/editor for Claude Code settings. The core problem: tree nodes (14 files) currently serve triple duty as data holders, override resolvers, and VS Code TreeItem renderers. This creates tight coupling where `ScopedConfig` objects and `allScopes` arrays are threaded through 4 constructor levels, override resolution is scattered across 6 node files, and testing requires full VS Code mocks. The coupling will worsen as future features (overlap indicators, lock enforcement) add more state to thread.

The recommended approach is a **view model layer** -- a set of pure TypeScript interfaces and a single builder class (`TreeViewModelBuilder`) that transforms ConfigStore data into pre-computed, display-ready descriptors. Tree nodes become thin mappers from ViewModel properties to VS Code TreeItem properties. No new dependencies are needed. No VS Code API surfaces change. The refactor is entirely internal to `src/tree/`, producing one new file (`viewModel.ts`) and modifying 16 existing files. The existing ConfigStore, overrideResolver, configWriter, commands, file watcher, and extension wiring remain unchanged.

The primary risks are breaking silent contracts: `contextValue` strings that bind to `package.json` menu `when` clauses, `parentMap` population that enables editor-to-tree `reveal()`, and node `id` stability that preserves expand/collapse state across refreshes. All three fail silently with no runtime error. Mitigation requires snapshot-and-compare testing before and after the refactor, plus manual verification of right-click menus, bidirectional sync, and plugin checkbox behavior across all 14 node types.

## Key Findings

### Recommended Stack

No new dependencies. The refactor uses existing TypeScript patterns and the VS Code TreeDataProvider API. Zero new npm packages. See [STACK.md](STACK.md) for full analysis.

**Core technologies (unchanged):**
- **TypeScript ^5.3.3**: Language -- strict mode, no implicit any
- **VS Code Extension API ^1.90.0**: TreeDataProvider, TreeItem, EventEmitter -- all APIs already in use
- **esbuild ^0.25.0**: Bundler -- zero runtime dependencies constraint maintained

**What NOT to add:** State management libraries (MobX, RxJS), observable/reactive patterns, event bus/mediator, DI containers, immutable data structures (Immer). VS Code TreeView is pull-based and batch-refresh; reactivity adds complexity with zero rendering benefit.

### Expected Features

See [FEATURES.md](FEATURES.md) for full coupling analysis and feature dependencies.

**Must have (table stakes):**
- View-model layer between ConfigStore and tree nodes (~150-250 new LOC)
- Pre-computed override resolution in view-model (consolidates 5 scattered resolver calls into one builder)
- Node constructors accept typed descriptors instead of ScopedConfig + allScopes
- Remove `allScopes` propagation from 8 node types that carry it as pass-through
- ConfigTreeProvider uses view-model builder instead of direct ConfigStore queries

**Should have (differentiators):**
- Typed descriptor interfaces per node type (compile-time shape safety)
- Section filter applied in view-model (removes presentation logic from ScopeNode)
- Lock state baked into descriptors (eliminates WorkspaceFolderNode's ConfigStore reference)
- Item counts pre-computed in section descriptors

**Defer (anti-features -- explicitly do not build):**
- Observable/reactive view-model -- VS Code has no partial-update API for trees
- Persistent view-model cache -- stateless rebuild avoids invalidation bugs
- Abstract factory for node creation -- simple switch is sufficient for 10 node types
- Unit tests as part of this milestone -- separate deliverable; F5 testing validates the refactor
- Modifying overrideResolver to return descriptors -- layering violation

### Architecture Approach

Introduce a `TreeViewModelBuilder` class in a single new file (`src/tree/viewModel.ts`) that sits between ConfigStore and tree nodes. The builder reads all scopes once, computes ALL override resolutions upfront in batch, applies lock state and section filtering, and returns a tree of ViewModel objects using only primitive types (no VS Code imports). Tree nodes receive these ViewModels and map properties to TreeItem properties in ~10 lines per constructor, down from ~20 lines of mixed logic. See [ARCHITECTURE.md](ARCHITECTURE.md) for full component boundaries and data flow.

**Major components (after refactor):**
1. **ConfigStore** -- raw config data, reload, lock state, change events (unchanged API)
2. **TreeViewModelBuilder** -- transforms ScopedConfig[] into display-ready ViewModels; sole caller of overrideResolver; owns all formatting and filtering
3. **ConfigTreeProvider** -- orchestrates tree refresh, calls builder, creates nodes from ViewModels via factory
4. **Tree nodes** -- pure renderers mapping ViewModel properties to TreeItem properties; zero logic, zero imports from `config/`
5. **Commands** -- read `node.nodeContext` for scope, keyPath, filePath (unchanged contract)

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for all 14 pitfalls with detection and prevention strategies.

1. **contextValue contract breakage** -- contextValue strings link nodes to `package.json` when-clause menu bindings. Refactoring changes to the `{nodeType}.{editability}[.overridden]` pattern cause menus to silently disappear. Prevention: snapshot all contextValue strings before/after; test right-click on every node type in every scope.

2. **parentMap invalidation breaking reveal()** -- editor-to-tree sync relies on `parentMap` being populated as a side effect of `getChildren()`. If the view-model layer bypasses this population, `reveal()` silently fails. Prevention: document the parentMap contract; ensure any node-walking path populates it.

3. **Override resolution at wrong layer** -- 5 different resolver functions with different signatures. Partial migration (some nodes use view-model, some still call resolvers) causes inconsistent override indicators. Prevention: view-model is the ONLY caller of override functions; complete migration, no partial state.

4. **Node ID instability** -- `id` computed from nodeContext fields. Even subtle formatting changes (trailing slash in URI) cause all expand/collapse states to reset on every refresh. Prevention: snapshot IDs before/after.

5. **ScopedConfig pass-through wrapper** -- naive view-model wraps ScopedConfig instead of transforming it, adding indirection without reducing coupling. Prevention: define per-node-type data shapes; success criterion is zero `ScopedConfig` imports in `src/tree/nodes/`.

## Implications for Roadmap

Based on research, the refactor has a clear dependency chain that dictates phase ordering. Four phases, sequentially dependent.

### Phase 1: Define ViewModel Interfaces and ConfigStore Getter

**Rationale:** Pure type work with zero runtime changes. Establishes the contract before implementation. Lowest risk phase -- catches data shape issues at compile time.
**Delivers:** All ViewModel interfaces (`ScopeViewModel`, `SectionViewModel`, `SettingViewModel`, `PluginViewModel`, etc.) as a discriminated union type. `ConfigStore.getLockedScopes()` getter (3 lines).
**Addresses:** Typed descriptor interfaces (differentiator from FEATURES.md).
**Avoids:** Pitfall 5 (pass-through wrapper) by designing per-node-type shapes upfront before any implementation.

### Phase 2: Implement TreeViewModelBuilder and Factory

**Rationale:** Core of the refactor. Must exist before any node can be migrated. Pure functions that can be validated independently by calling `build()` and inspecting output.
**Delivers:** `TreeViewModelBuilder.build()` that produces complete ViewModel tree from ConfigStore data. `createNodeFromViewModel()` factory function. Format utilities (`formatValue`, `formatSandboxValue`, `formatHookValue`) relocated from node files.
**Addresses:** View-model layer (table stakes), pre-computed override resolution (table stakes), section filter in view-model (differentiator), lock state in descriptors (differentiator), item counts in descriptors (differentiator).
**Avoids:** Pitfall 3 (override at wrong layer) by centralizing all 5 resolver calls. Pitfall 11 (dual cache) by keeping builder stateless.

### Phase 3: Wire Builder Into ConfigTreeProvider and Migrate All Nodes

**Rationale:** Single-pass migration of all 14 node types. Must be atomic to avoid the partial-migration anti-pattern (Pitfall 14). The codebase is small enough that splitting creates more risk than doing it together. Highest surface area but each node follows the same mechanical pattern.
**Delivers:** All 14 node types refactored to accept ViewModels. ConfigTreeProvider calls builder in `getSingleRootChildren()` and `getMultiRootChildren()`. WorkspaceFolderNode drops ConfigStore reference. Zero `ScopedConfig` or `overrideResolver` imports in any node file.
**Addresses:** Node constructors accept descriptors (table stakes), remove allScopes propagation (table stakes), ConfigTreeProvider uses view-model (table stakes), WorkspaceFolderNode decoupling (differentiator).
**Avoids:** Pitfalls 1 (contextValue), 2 (parentMap), 4 (node IDs), 6 (plugin checkbox), 7 (finalize order), 9 (WorkspaceFolderNode), 10 (SectionNode branches), 14 (mixed patterns).

### Phase 4: Simplify baseNode and Clean Up

**Rationale:** With all nodes migrated, `finalize()` and base node utilities can be simplified. Dead imports and unused format functions removed. Lint cleanup.
**Delivers:** Simplified `baseNode.ts`. Clean lint output. Verified completion criteria: `grep -r "ScopedConfig" src/tree/nodes/` and `grep -r "ConfigStore" src/tree/nodes/` both return zero results.
**Addresses:** Final code hygiene. Confirms decoupling is complete.

### Phase Ordering Rationale

- **Phases 1 and 2 are additive** -- new code only, zero risk to existing functionality. Can be verified independently before touching any existing node code.
- **Phase 3 is the switch-over** -- must be atomic for all node types. This is the highest-risk phase and benefits from having the builder fully tested (Phase 2) before wiring begins.
- **Phase 4 is cleanup** -- only possible after Phase 3 is complete and verified. Pure deletion and simplification.
- **Dependency chain:** Interfaces (Phase 1) -> Builder (Phase 2) -> Node migration (Phase 3) -> Cleanup (Phase 4). No phase can start before its predecessor is complete.

### Research Flags

Phases with standard patterns (skip `/gsd:research-phase`):
- **Phase 1:** Pure TypeScript interfaces. No research needed.
- **Phase 2:** Data transformation builder pattern. Override resolver functions are documented in codebase. No research needed.
- **Phase 4:** Mechanical cleanup. No research needed.

Phase needing attention during planning:
- **Phase 3:** Highest surface area (14+ files, ~400-600 LOC changed). Needs a concrete migration checklist derived from the "Looks Done But Isn't" checklist in PITFALLS.md. Verification steps (right-click menus on all node types, reveal sync, plugin checkbox, override indicators across scopes, multi-root workspace, all 7 section types) should be formalized as acceptance criteria. Consider migrating one node type end-to-end first (e.g., SettingNode) to prove the pattern before applying to all 14.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies; verified against codebase source and VS Code API |
| Features | HIGH | All 6 coupling points identified from direct audit of 5,241 LOC |
| Architecture | HIGH | Full audit of all 14 node files, ConfigStore, overrideResolver, ConfigTreeProvider, commands |
| Pitfalls | HIGH | All 14 pitfalls derived from direct code reading, not generic advice |

**Overall confidence:** HIGH

### Gaps to Address

- **Unit testing strategy:** Research explicitly defers tests as anti-feature for this milestone. The view-model layer enables unit testing without VS Code mocks, but writing those tests is a separate deliverable. The roadmapper should note this as a follow-up milestone.
- **`node.description` as data source (Pitfall 8):** `editCommands.ts` reads `node.description` to pre-fill input boxes. This is an existing design smell. Consider adding `nodeContext.rawValue` during Phase 3, but this may expand scope. Flag for planning decision.
- **Multi-root workspace path:** `WorkspaceFolderNode` is an inline class in `configTreeProvider.ts` with its own ConfigStore dependency (Pitfall 9). Phase 3 must handle this case separately from the standard node migration pattern. Needs explicit attention in task breakdown.
- **Estimated LOC impact:** ~400-600 lines modified/added. Net LOC likely stays similar -- new view-model module roughly offsets logic removed from node constructors. This estimate needs validation during Phase 2 implementation.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: all 14 files in `src/tree/nodes/`, `src/tree/configTreeProvider.ts`, `src/config/configModel.ts`, `src/config/overrideResolver.ts`, `src/commands/editCommands.ts`, `src/commands/moveCommands.ts`, `src/extension.ts`, `src/types.ts`
- VS Code TreeView API documentation: TreeDataProvider contract, getChildren/getTreeItem pattern
- VS Code Extension Samples: TreeItem subclass pattern, reveal() contract
- VS Code API reference: TreeDataProvider, TreeItem, EventEmitter, FileDecorationProvider

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
