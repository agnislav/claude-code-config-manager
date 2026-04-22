---
name: v0.6.0-decouple-state-from-tree
status: completed
created: 2026-03-06T18:11:45Z
updated: 2026-03-08T00:00:00Z
progress: 100%
prd:
github:
---

# Decouple State from Tree (v0.6.0)

## Summary

v0.6.0 decoupled tree node construction from direct ConfigStore access by introducing a ViewModel layer. TreeViewModelBuilder pre-computes all display state (labels, descriptions, icons, contextValues, override resolution) and all 14 tree node types now accept typed ViewModel descriptors instead of raw ScopedConfig/allScopes data. A 23-test suite validates builder output across all 7 entity types, override resolution, and NodeContext preservation.

The milestone delivered three phases (16–18): a new ViewModel type system and builder, migration of all 14 node constructors plus provider wiring, and a verification/cleanup phase establishing the test infrastructure. This was the first milestone with unit tests. Net change: +2,053 / -1,057 source lines for 6,247 total TypeScript LOC.

## Requirements delivered

ViewModel Interfaces:
- **VM-01**: ViewModel interfaces defined with per-type data shapes covering all 14 node types
- **VM-02**: NodeContext preserved in every ViewModel so command handlers require zero changes

ViewModel Builder:
- **VM-03**: TreeViewModelBuilder pre-computes override resolution for all 7 entity types
- **VM-04**: TreeViewModelBuilder computes display state (labels, descriptions, icons, contextValues) from raw config data

Node Migration:
- **VM-05**: All 14 tree node constructors accept ViewModels instead of ScopedConfig/allScopes
- **VM-06**: Zero overrideResolver imports remain in any file under src/tree/nodes/
- **VM-07**: No tree node constructor receives ConfigStore or allScopes
- **VM-08**: WorkspaceFolderNode extracted to standalone file with no ConfigStore dependency

Provider Integration:
- **VM-09**: ConfigTreeProvider wires TreeViewModelBuilder into its refresh cycle
- **VM-10**: Bidirectional editor-tree sync preserved with identical behavior

Testing:
- **TEST-01**: Unit tests for TreeViewModelBuilder covering all 7 entity types
- **TEST-02**: Unit tests verify override resolution produces correct display state per scope
- **TEST-03**: Unit tests verify NodeContext preservation (contextValue strings, keyPaths)

Cleanup:
- **VM-11**: Dead overrideResolver imports removed from node files
- **VM-12**: baseNode simplified — no ScopedConfig-dependent logic

## Implementation history

- **Phase 16 — ViewModel Layer** (35min, 2026-03-06): Created src/viewmodel/types.ts with NodeKind enum (14 members), BaseVM interface, and 15 per-type ViewModel interfaces; implemented TreeViewModelBuilder covering all 7 entity types (permissions, settings, env vars, plugins, hooks, sandbox, MCP servers) with override resolution and display state pre-computation. Formatting helpers replicated in builder.ts to keep viewmodel→tree boundary clean. Commits: `7bfb199` (feat), `1c14eb0` (feat).
- **Phase 17 — Node Migration** (15min + verification, 2026-03-07): Migrated all 14 tree node constructors from raw ScopedConfig/allScopes to single-VM constructors (net -995 lines), created vmToNode.ts mapper with NodeKind switch dispatch and static ConfigTreeNode.mapVM property to break circular imports, extracted WorkspaceFolderNode to standalone file, simplified ConfigTreeNode base (removed finalize, computeId, computeContextValue, computeTooltip, applyOverrideStyle, applyClickCommand), wired TreeViewModelBuilder into provider refresh with eager VM build in constructor. Three bugs auto-fixed during human verification: empty initial tree, wrong hook-leaf JSON navigation, plugin-checkbox visual toggle on blocked write. Commits: `6ad5e06` (feat), `b90cf29` (feat), `a38e81c` (fix).
- **Phase 18 — Verification and Cleanup** (10min, 2026-03-07): Created VS Code extension test infrastructure from scratch (test/runTests.ts launcher, test/suite/index.ts Mocha TDD runner, tsconfig.test.json with corrected exclude), verified VM-11 (zero overrideResolver imports across 13 node files) and VM-12 (baseNode uses BaseVM pattern) via source-file assertions, added 23 unit tests in builder.test.ts covering entity types, override resolution, and NodeContext preservation. Commits: `a044280` (chore), `38c4396` (test), `7e8a0bc` (test), `d8c8c67` (test).

## Key decisions

- **Additive-first Phase 16**: New code introduced without touching existing files, enabling Phase 17 migration with a safety net.
- **Static ConfigTreeNode.mapVM property**: Breaks circular imports between vmToNode and node files; set once in provider, used by all parent nodes for child mapping.
- **Eager VM build in constructor**: Ensures initial tree render works without waiting for first refresh.
- **Replicate formatting helpers in builder.ts**: formatValue, formatSandboxValue, formatHookValue live in builder to avoid viewmodel→tree dependency; keeps layers independent.
- **Hook entries as leaf nodes**: Simplified tree structure; removed type/command key-value children mid-Phase 17 for cleaner UX. Left HookKeyValueVM/Node dead code to be cleaned in the next milestone.
- **VM-driven node pattern**: Each node class is ~12 lines — constructor stores typed VM, getChildren maps vm.children; no node-level computation.
- **TDD Mocha UI (suite/test) not BDD**: Matches VS Code extension test conventions.
- **Mock ConfigStore stub pattern**: Cast minimal object as unknown as ConfigStore for isolated builder testing without Extension Host.
- **makeScopedConfig + findVM/findAllVMs helpers**: Fixture factory plus recursive VM tree traversal enables concise entity-type assertions.

## Functionality delivered

- **Code added/modified**: src/viewmodel/types.ts (new — NodeKind, BaseVM, 15 per-type interfaces), src/viewmodel/builder.ts (new — TreeViewModelBuilder, entity builders, override resolution, display-state computation), src/tree/vmToNode.ts (new — NodeKind dispatch), src/tree/nodes/workspaceFolderNode.ts (extracted from provider), src/tree/nodes/baseNode.ts (simplified to VM-driven base with static mapVM), all 14 node files migrated to VM-driven constructors, src/tree/configTreeProvider.ts (wired to builder with cached root VMs), src/utils/jsonLocation.ts (indent-tracking fix for hook leaf), test/runTests.ts + test/suite/index.ts + test/suite/viewmodel/builder.test.ts (new test infrastructure).
- **User-facing behavior**: No visible behavior change — decoupling is internal. Bidirectional editor-tree sync, reveal-in-file, context menu bindings, and plugin checkbox behavior all preserved. Three incidental bug fixes landed in Phase 17: initial tree render, hook-leaf navigation to correct JSON line, plugin checkbox no-op on blocked write.
- **Tests**: +23 unit tests (first test suite in the project). 8 entity-type tests, 5 override-resolution tests, 7 NodeContext-preservation tests, 3 cleanup/smoke tests.

## Audit outcome

v0.6.0 shipped with **15/15 requirements satisfied** across all three verification sources (VERIFICATION.md, SUMMARY frontmatter, REQUIREMENTS.md traceability). All 3 phase verifications passed. 12/12 cross-phase integration exports connected with zero orphaned exports or broken connections. 4/4 E2E flows verified (config→tree, tree click→editor reveal, editor cursor→tree highlight, plugin toggle→config write). All 3 phases Nyquist-compliant with VALIDATION.md. Tech debt at ship: 4 dead-code items from hook entry simplification (buildHookKeyValueVM, HookKeyValueVM import, HookKeyValueNode, vmToNode HookKeyValue case) — all non-blocking, cosmetic, slated for v0.7.0 cleanup.

## Lessons learned

- Decoupling via a ViewModel layer is cleaner than incremental refactoring — the boundary is crisp and testable.
- Eager child building in the builder simplifies the tree provider significantly; lazy loading adds complexity without benefit for trees of this size.
- Clear phase boundaries (types → builder → migration → tests) make each phase independently verifiable.
- Builder pre-computing everything reduces node constructors to trivially simple super(vm) calls.
- The static mapVM pattern is an elegant solution to circular imports between a dispatch module and the modules it dispatches to.
- When changing semantics mid-milestone (hook leaf simplification), clean up upstream dead code immediately rather than deferring — Phase 16 builder still held dead paths after Phase 17's simplification.
- Builder was the heaviest phase (1047 lines); subsequent phases were faster because the builder did the heavy lifting.
