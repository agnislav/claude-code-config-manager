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

## Milestone: v0.8.0 — Tree Display Polish

**Shipped:** 2026-03-11
**Phases:** 2 | **Plans:** 3 | **Commits:** 14

### What Was Built
- Plugin checkbox-only display — icon and resourceUri set to undefined when unlocked
- Flat permission list — removed PermissionGroupVM intermediary, rules directly under Section
- Category-specific icons (check/question/close) on each permission rule
- Inline pencil button for type switching via QuickPick with (current) marker
- Inline + button on Permissions section header for direct rule creation
- Full dead code cleanup — PermissionGroupVM, permissionGroupNode.ts, related menu entries

### What Worked
- Small, focused milestone (2 phases, 3 plans) — fast execution with clear scope
- Visual verification during Phase 23 caught resourceUri fallback issue immediately (VS Code renders file icon when no ThemeIcon but resourceUri exists)
- Phase 24 Plan 01 executed in 2 minutes — flat PermissionRuleVM with category field was a clean architectural change
- Audit passed on first attempt — no gaps, no integration issues

### What Was Inefficient
- Nyquist validation missing for both phases (VALIDATION.md not generated) — flagged by audit but not blocking
- ROADMAP.md progress table had formatting inconsistencies (Phase 23/24 rows had misaligned columns)

### Patterns Established
- Checkbox-only pattern: set both icon and resourceUri to undefined for clean checkbox-only TreeItems
- Flat section children: permission rules as direct children of SectionVM (no intermediate group)
- Inline type-switch pattern: QuickPick with (current) marker, synchronous remove+add for single refresh

### Key Lessons
1. When removing an icon from a TreeItem, also clear resourceUri — VS Code uses resourceUri as icon fallback
2. Synchronous remove+add in configWriter prevents double tree refresh (better than async with two writes)
3. Two-phase approach (flatten first, add inline buttons second) kept each plan small and independently verifiable

### Cost Observations
- Model mix: ~50% sonnet, ~50% opus
- Sessions: ~3 across 2 phases + audit
- Notable: Fastest milestone yet — 2 days, minimal rework

---

## Milestone: v0.9.0 — UX Audit

**Shipped:** 2026-03-14
**Phases:** 5 | **Plans:** 7 | **Commits:** 58

### What Was Built
- Complete audit matrix documenting all 12 NodeKind types across 5 audit vectors with gap tracking
- Trivial display fixes: sandbox section count, hook type descriptions, envvar base tooltips
- Uniform inline button slot ordering (edit@0, move@1, copy@2, delete@3) across all entity types
- Hook overlap detection completing coverage for all 7 entity types with color-coded decorations
- Action parity: SettingKeyValue edit/delete, EnvVar copy-to-scope, MCP multi-scope discovery + move/copy
- Permission overlap batch algorithm replacing O(R²) with indexed O(R×G) and RegExp/parse caching

### What Worked
- Audit-first approach (Phase 25) created a comprehensive gap inventory that directly drove Phases 26-29 scope
- TDD pattern matured — 9 feat commits each had preceding test commits; zero behavioral regressions
- Milestone audit caught 4 real tech debt items (sandbox count bug, stale audit prose, test failures, missing requirements) — all resolved before shipping
- Re-audit pattern: first audit found issues, fixes applied, re-audit confirmed clean — two-pass verification
- MCP multi-scope discovery (Phase 28-02) reused established patterns (scope-aware dispatch, Record<string,unknown> preservation)

### What Was Inefficient
- ROADMAP.md progress table had formatting drift (Phases 26-29 missing milestone column, swapped columns)
- Nyquist validation for Phases 25-29 remained in draft status (5 non-compliant phases)
- Phase 29 post-merge revealed UI hang — debounce, overlap map hoisting, and sandbox rendering fix needed as hotfix (fix commit 8c291f8)

### Patterns Established
- Audit matrix → gap tracking → phase creation pipeline for systematic UX improvement
- Hook overlap identity: (eventType, matcherPattern, hookIndex) — positional within matcher
- Inline button slot convention: edit@0, move@1, copy@2, delete@3 — applied uniformly
- Module-level Map caches for RegExp and ParsedPermissionRule objects
- Tool-name bucket isolation for batch overlap computation (prevents cross-tool comparisons by construction)
- dispatchMcpWrite/dispatchMcpRemove pattern for scope-based MCP writer dispatch

### Key Lessons
1. Systematic audit before UX work is highly effective — gap inventory drives precise phase scope
2. Batch algorithms with pre-indexing solve performance problems more cleanly than incremental optimization
3. Post-merge visual testing is essential — Phase 29 batch algorithm introduced a UI hang only visible with real data
4. Record<string,unknown> for partial file reads (e.g., ~/.claude.json) prevents data loss when writing back
5. && false guards in package.json are ambiguous — distinguish dead artifacts from intentional feature suppression

### Cost Observations
- Model mix: ~55% sonnet, ~45% opus (balanced profile)
- Sessions: ~10 across 5 phases + audit + re-audit
- Notable: Phase 28 was heaviest (2 plans, MCP multi-scope discovery required 4 new test files)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v0.6.0 | 10 | 3 | ViewModel layer introduced; first milestone with unit tests |
| v0.7.0 | ~30 | 4 | Overlap system replacing override; milestone audit → gap closure pattern |
| v0.8.0 | 14 | 2 | Flat permission list; checkbox-only plugin pattern; inline type switching |
| v0.9.0 | 58 | 5 | Audit-driven UX fixes; action parity; batch overlap algorithm; MCP multi-scope |

### Cumulative Quality

| Milestone | Tests | LOC | Key Addition |
|-----------|-------|-----|--------------|
| v0.6.0 | 23 | 6,247 | First test infrastructure; ViewModel decoupling |
| v0.7.0 | 56 | 5,672 | Overlap resolver tests (+25), lock tests (+3); legacy code removed (-575 LOC) |
| v0.8.0 | 56 | 5,672 | Net +20 LOC source; PermissionGroup dead code removed; inline buttons restored |
| v0.9.0 | 132 | 6,466 | +76 tests; overlap complete for all 7 types; batch algorithm; MCP multi-scope |

### Top Lessons (Verified Across Milestones)

1. Additive-first phases (new files before modifying old ones) reduce risk and enable safer migration
2. Pre-computing display state in a builder yields simpler, more testable node constructors
3. Milestone audit before completion catches test coverage gaps that would ship undetected
4. Visual verification as final step catches UI issues invisible to unit tests
5. When removing a TreeItem icon, also clear resourceUri to prevent VS Code fallback rendering
6. Synchronous remove+add is preferable to two async writes when changing entity categories
7. Audit-first approach (systematic gap inventory) directly drives precise phase scope and prevents missed requirements
8. Batch algorithms with pre-indexing solve performance problems more cleanly than incremental optimization
9. Post-merge visual testing catches issues invisible to unit tests — especially with real-world data volumes
