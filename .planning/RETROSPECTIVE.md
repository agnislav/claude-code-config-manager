# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.6.0 — Decouple State from Tree

**Shipped:** 2026-03-08
**Phases:** 3 | **Plans:** 4 | **Commits:** 10

### What Was Built
- Complete ViewModel type system (BaseVM + 15 per-type interfaces) for all tree node types
- TreeViewModelBuilder that pre-computes override resolution and display state from ConfigStore
- All 14 node constructors migrated from raw ScopedConfig to typed VM descriptors
- 23-test suite covering all 7 entity types, override resolution, and NodeContext preservation

### What Worked
- Additive-first approach: Phase 16 added new code without touching existing files, enabling Phase 17 migration with a safety net
- Clear phase boundaries: types → builder → migration → tests made each phase independently verifiable
- Builder pre-computing everything meant node constructors became trivially simple (single super(vm) call)
- Static mapVM pattern elegantly solved circular import problem between vmToNode and node files

### What Was Inefficient
- Hook entry simplification (removing key-value children) during Phase 17 left dead code in Phase 16's builder (buildHookKeyValueVM, HookKeyValueNode) — could have been caught and cleaned up in Phase 18
- Phase 18 plan checkboxes in ROADMAP.md were not checked (cosmetic inconsistency in tracking)

### Patterns Established
- VM-driven node pattern: `constructor(private readonly vm: XxxVM) { super(vm); }` — all display state comes from VM, no node-level computation
- ConfigTreeNode.mapVM static property — set once in provider, used by all parent nodes for child mapping
- Mock ConfigStore stub pattern for isolated builder testing without VS Code Extension Host

### Key Lessons
1. Decoupling via ViewModel layer is cleaner than incremental refactoring — the boundary is crisp and testable
2. Eager child building in the builder simplifies the tree provider significantly — no lazy loading complexity
3. When changing semantics mid-milestone (hook leaf simplification), should immediately clean up upstream dead code rather than deferring

### Cost Observations
- Model mix: ~70% sonnet, ~30% opus (balanced profile)
- Sessions: ~5 across 3 phases
- Notable: Phase 16 (builder) was the heaviest — 1047 lines. Phases 17-18 were faster because the builder did the heavy lifting

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v0.6.0 | 10 | 3 | ViewModel layer introduced; first milestone with unit tests |

### Cumulative Quality

| Milestone | Tests | LOC | Key Addition |
|-----------|-------|-----|--------------|
| v0.6.0 | 23 | 6,247 | First test infrastructure; ViewModel decoupling |

### Top Lessons (Verified Across Milestones)

1. Additive-first phases (new files before modifying old ones) reduce risk and enable safer migration
2. Pre-computing display state in a builder yields simpler, more testable node constructors
