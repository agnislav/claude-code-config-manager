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

## Milestone: v0.7.0 — Visual Fidelity

**Shipped:** 2026-03-09
**Phases:** 4 | **Plans:** 5 | **Commits:** ~30

### What Was Built
- Hook entry keyPath fix for correct JSON line navigation
- Lock-aware plugin display with static icons replacing checkboxes when User scope is locked
- Overlap resolver with nearest-neighbor algorithm for all 7 entity types
- 4-directional overlap model (overrides/isOverriddenBy/duplicates/isDuplicatedBy)
- Color-coded FileDecoration (red/green/yellow/orange) and MarkdownString tooltips for overlap
- Legacy overrideResolver.ts and ResolvedValue fully removed

### What Worked
- Milestone audit caught 3 requirements with partial coverage (LOCK-01/02/03 missing tests), leading to Phase 22 gap closure
- Independent phases (19, 20, 21) allowed parallel development flexibility
- TDD on overlap resolver (Plan 21-01) caught edge cases early — all 25 tests written before implementation
- Visual verification during Plan 21-02 caught 4 auto-fixable issues (permission overlap gaps, missing colors, broken codicons)

### What Was Inefficient
- Phase 20 executed outside GSD workflow — no SUMMARY.md generated, causing audit documentation gaps
- Phase 22 SUMMARY frontmatter left empty `requirements_completed` despite closing LOCK-01/02/03
- VERIFICATION.md Truth #2 for Phase 20 stated "no icon" for disabled plugins but code uses circle-slash — documentation didn't match code

### Patterns Established
- `resolveOverlapGeneric` pattern: shared generic helper with per-entity-type `getValue` callback
- `buildOverlapTooltip` / `buildOverlapResourceUri`: builder helpers for overlap visualization
- Git-themed ThemeColors for overlap: red (isOverriddenBy), green (overrides), yellow (duplicates), orange (isDuplicatedBy)
- Milestone audit → gap closure phase pattern: audit identifies gaps, new phase closes them before shipping

### Key Lessons
1. Milestone audit before completion is high-value — caught LOCK test gaps that would have shipped without coverage
2. Visual verification as final task (21-02 Task 3) found 4 issues invisible to unit tests — always verify UI changes visually
3. When executing outside GSD workflow, manually create SUMMARY.md to maintain audit trail
4. 4-directional overlap model is richer than boolean but simpler than a full graph — right level of abstraction

### Cost Observations
- Model mix: ~60% sonnet, ~40% opus (balanced profile)
- Sessions: ~8 across 4 phases + audit + gap closure
- Notable: Phase 21 was heaviest (2 plans, 45min for plan 02 including visual verification fixes)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v0.6.0 | 10 | 3 | ViewModel layer introduced; first milestone with unit tests |
| v0.7.0 | ~30 | 4 | Overlap system replacing override; milestone audit → gap closure pattern |

### Cumulative Quality

| Milestone | Tests | LOC | Key Addition |
|-----------|-------|-----|--------------|
| v0.6.0 | 23 | 6,247 | First test infrastructure; ViewModel decoupling |
| v0.7.0 | 56 | 5,672 | Overlap resolver tests (+25), lock tests (+3); legacy code removed (-575 LOC) |

### Top Lessons (Verified Across Milestones)

1. Additive-first phases (new files before modifying old ones) reduce risk and enable safer migration
2. Pre-computing display state in a builder yields simpler, more testable node constructors
3. Milestone audit before completion catches test coverage gaps that would ship undetected
4. Visual verification as final step catches UI issues invisible to unit tests
