# Roadmap: Claude Code Config Manager

**Created:** 2026-02-18
**Updated:** 2026-03-12
**Status:** v0.3.x-v0.8.0 complete (Phases 1-24), v0.9.0 in progress (Phases 25-28)

---

## Milestones

- ✅ **v0.3.x Toolbar UX Improvements** — Phases 1-5 (shipped 2026-02-19)
- ✅ **v0.4.0 Tree UX Refinements** — Phases 6-8 (shipped 2026-02-20)
- ✅ **v0.4.1 Node Display Polish** — Phase 9 (shipped 2026-02-20)
- ✅ **v0.5.0 Hardening** — Phases 10-15 (shipped 2026-02-21)
- ✅ **v0.6.0 Decouple State from Tree** — Phases 16-18 (shipped 2026-03-08)
- ✅ **v0.7.0 Visual Fidelity** — Phases 19-22 (shipped 2026-03-09)
- ✅ **v0.8.0 Tree Display Polish** — Phases 23-24 (shipped 2026-03-11)
- 🚧 **v0.9.0 UX Audit** — Phases 25-28 (in progress)

---

<details>
<summary>✅ v0.3.x Toolbar UX Improvements (Phases 1-5) — SHIPPED 2026-02-19</summary>

- [x] Phase 1: QuickPick Multi-Select Filter (2/2 plans) — completed 2026-02-19
- [x] Phase 2: Remove Refresh Toolbar Button (1/1 plan) — completed 2026-02-19
- [x] Phase 3: User Scope Lock Toggle (2/2 plans) — completed 2026-02-19
- [x] Phase 4: Fix Filter Cancel + Tech Debt Cleanup (1/1 plan) — completed 2026-02-19
- [x] Phase 5: Add Move Inline Button (1/1 plan) — completed 2026-02-19

</details>

<details>
<summary>✅ v0.4.0 Tree UX Refinements (Phases 6-8) — SHIPPED 2026-02-20</summary>

- [x] Phase 6: Lock UX Rework (1/1 plan) — completed 2026-02-19
- [x] Phase 7: Collapse/Expand Toolbar Buttons (1/1 plan) — completed 2026-02-20
- [x] Phase 8: Object Settings Expansion (1/1 plan) — completed 2026-02-20

</details>

<details>
<summary>✅ v0.4.1 Node Display Polish (Phase 9) — SHIPPED 2026-02-20</summary>

- [x] Phase 9: Refine Tree Node Rendering (1/1 plan) — completed 2026-02-20

</details>

<details>
<summary>✅ v0.5.0 Hardening (Phases 10-15) — SHIPPED 2026-02-21</summary>

- [x] Phase 10: Error Handling Foundation (2/2 plans) — completed 2026-02-20
- [x] Phase 11: Tree Error Resilience (1/1 plan) — completed 2026-02-20
- [x] Phase 12: Write Lifecycle & Concurrency (2/2 plans) — completed 2026-02-20
- [x] Phase 13: Path Safety Hardening (2/2 plans) — completed 2026-02-20
- [x] Phase 14: Resource Management (1/1 plan) — completed 2026-02-20
- [x] Phase 15: Code Quality Cleanup (2/2 plans) — completed 2026-02-20

</details>

<details>
<summary>✅ v0.6.0 Decouple State from Tree (Phases 16-18) — SHIPPED 2026-03-08</summary>

- [x] Phase 16: ViewModel Layer (1/1 plan) — completed 2026-03-06
- [x] Phase 17: Node Migration (1/1 plan) — completed 2026-03-07
- [x] Phase 18: Verification and Cleanup (2/2 plans) — completed 2026-03-07

</details>

<details>
<summary>✅ v0.7.0 Visual Fidelity (Phases 19-22) — SHIPPED 2026-03-09</summary>

- [x] Phase 19: Hook Navigation + Cleanup (1/1 plan) — completed 2026-03-08
- [x] Phase 20: Lock-Aware Plugin Display (1/1 plan) — completed 2026-03-09
- [x] Phase 21: Visual Overlap Indicators (2/2 plans) — completed 2026-03-09
- [x] Phase 22: Lock Test Coverage & Doc Cleanup (1/1 plan) — completed 2026-03-09

</details>

---

<details>
<summary>✅ v0.8.0 Tree Display Polish (Phases 23-24) — SHIPPED 2026-03-11</summary>

- [x] Phase 23: Plugin Checkbox-Only Display (1/1 plan) — completed 2026-03-10
- [x] Phase 24: Flatten Permissions with Type Icons (2/2 plans) — completed 2026-03-11

</details>

---

### 🚧 v0.9.0 UX Audit (In Progress)

**Milestone Goal:** Systematically audit every entity type's tree structure, node behavior, and inline buttons -- find inconsistencies and UX gaps, then fix them.

## Phases

- [x] **Phase 25: Audit Catalog + Trivial Fixes** - Document actual-vs-expected state for all node types; ship zero-risk fixes (completed 2026-03-12)
- [x] **Phase 26: Inline Button Cleanup** - Enable valid disabled guards, document intentional ones, establish uniform inline button ordering (completed 2026-03-12)
- [ ] **Phase 27: Hook Overlap Detection** - Complete overlap model coverage for all 7 entity types
- [ ] **Phase 28: Action Parity** - Add missing actions where structurally valid (EnvVar copy, MCP UX, SettingKeyValue edit/delete)
- [ ] **Phase 29: Permission Overlap Performance** - Replace O(R²) per-rule overlap resolution with batch indexed algorithm

## Phase Details

### Phase 25: Audit Catalog + Trivial Fixes
**Goal**: Every node type's actual behavior is documented against expected behavior, and trivial display gaps are fixed
**Depends on**: Nothing (first phase of v0.9.0)
**Requirements**: AUDIT-01, AUDIT-02, TRIV-01, TRIV-02, TRIV-03
**Success Criteria** (what must be TRUE):
  1. A complete audit matrix exists documenting all 14 node types across all audit vectors (icons, descriptions, tooltips, inline buttons, context menus, click behavior, overlap)
  2. Each audit finding is labeled as intentional design decision or unintentional inconsistency
  3. Sandbox section header shows item count in its description (matching other section headers)
  4. HookEntry nodes display the hook type (command, prompt, or agent) in their description
  5. EnvVar nodes show a base tooltip with key=value context (not just overlap tooltip)
**Plans**: 2 plans

Plans:
- [x] 25-01-PLAN.md — Audit matrix: code analysis documenting all node types across 5 audit vectors
- [x] 25-02-PLAN.md — Trivial fixes: sandbox count, hook type description, envvar base tooltip

### Phase 26: Inline Button Cleanup
**Goal**: Every entity type uses fixed-position inline button slots with consistent ordering; dead guards removed and intentional guards documented
**Depends on**: Phase 25
**Requirements**: INLN-03, INLN-04
**Success Criteria** (what must be TRUE):
  1. Dead `&& false` editValue guard removed from package.json (was blocking envVar/sandboxProperty edit — deferred to separate EditValue phase)
  2. Plugin `&& false` guards (move, copy, delete) documented as intentional design decisions in audit matrix
  3. All entity types use fixed-position inline button slots: edit@0, move@1, copy@2, delete@3 — matching ITEMS.md
  4. EnvVar moveToScope uses inline@1 (not @0); Setting moveToScope uses inline@1 and copySettingToScope uses inline@2
**Plans**: 1 plan

Plans:
- [ ] 26-01-PLAN.md — Remove dead editValue guard, reposition inline button slots, document plugin guard decisions

### Phase 27: Hook Overlap Detection
**Goal**: Hook entries participate in the overlap detection system, completing coverage for all 7 entity types
**Depends on**: Phase 25
**Requirements**: OVLP-01, OVLP-02
**Success Criteria** (what must be TRUE):
  1. When the same hook exists in multiple scopes, each instance shows overlap color-coding (red/green/yellow/orange) matching the conventions used by other entity types
  2. Overlapping hook entries display MarkdownString tooltips showing scope, value, and relationship details consistent with other overlap tooltips
**Plans**: 1 plan

Plans:
- [ ] 27-01-PLAN.md — Add resolveHookOverlap resolver and wire overlap into builder for HookEntry nodes

### Phase 28: Action Parity
**Goal**: Add missing actions where structurally valid — EnvVar copy-to-scope, MCP Server UX enrichment, SettingKeyValue edit/delete
**Depends on**: Phase 26
**Requirements**: ACTN-01, ACTN-02, ACTN-03, ACTN-04, ACTN-05
**Success Criteria** (what must be TRUE):
  1. EnvVar nodes show a copy-to-scope inline button that copies the variable to another scope (matching permissions and settings)
  2. MCP Server nodes show enriched tooltip with server type and command details; description is consistent with other entities
  3. MCP Server inline button set reviewed and corrected based on what's structurally valid (.mcp.json is workspace-scoped)
  4. SettingKeyValue child nodes support editing the value via inline edit button
  5. SettingKeyValue child nodes support deleting the key via inline delete button or context menu
**Plans**: 1 plan

Plans:
- [ ] 28-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 25 → 26 → 27 → 28

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. QuickPick Filter | v0.3.x | 2/2 | Complete | 2026-02-19 |
| 2. Remove Refresh | v0.3.x | 1/1 | Complete | 2026-02-19 |
| 3. Lock Toggle | v0.3.x | 2/2 | Complete | 2026-02-19 |
| 4. Filter Fix + Cleanup | v0.3.x | 1/1 | Complete | 2026-02-19 |
| 5. Move Inline Button | v0.3.x | 1/1 | Complete | 2026-02-19 |
| 6. Lock UX Rework | v0.4.0 | 1/1 | Complete | 2026-02-19 |
| 7. Collapse/Expand | v0.4.0 | 1/1 | Complete | 2026-02-20 |
| 8. Object Settings | v0.4.0 | 1/1 | Complete | 2026-02-20 |
| 9. Node Rendering | v0.4.1 | 1/1 | Complete | 2026-02-20 |
| 10. Error Handling | v0.5.0 | 2/2 | Complete | 2026-02-20 |
| 11. Tree Resilience | v0.5.0 | 1/1 | Complete | 2026-02-20 |
| 12. Write Lifecycle | v0.5.0 | 2/2 | Complete | 2026-02-20 |
| 13. Path Safety | v0.5.0 | 2/2 | Complete | 2026-02-20 |
| 14. Resource Mgmt | v0.5.0 | 1/1 | Complete | 2026-02-20 |
| 15. Code Quality | v0.5.0 | 2/2 | Complete | 2026-02-20 |
| 16. ViewModel Layer | v0.6.0 | 1/1 | Complete | 2026-03-06 |
| 17. Node Migration | v0.6.0 | 1/1 | Complete | 2026-03-07 |
| 18. Verification & Cleanup | v0.6.0 | 2/2 | Complete | 2026-03-07 |
| 19. Hook Navigation + Cleanup | v0.7.0 | 1/1 | Complete | 2026-03-08 |
| 20. Lock-Aware Plugin Display | v0.7.0 | 1/1 | Complete | 2026-03-09 |
| 21. Visual Overlap Indicators | v0.7.0 | 2/2 | Complete | 2026-03-09 |
| 22. Lock Test Coverage & Doc Cleanup | v0.7.0 | 1/1 | Complete | 2026-03-09 |
| 23. Plugin Checkbox-Only Display | v0.8.0 | 1/1 | Complete | 2026-03-10 |
| 24. Flatten Permissions | v0.8.0 | 2/2 | Complete | 2026-03-11 |
| 25. Audit Catalog + Trivial Fixes | v0.9.0 | 2/2 | Complete | 2026-03-12 |
| 26. Inline Button Cleanup | 1/1 | Complete    | 2026-03-12 | - |
| 27. Hook Overlap Detection | v0.9.0 | 0/? | Not started | - |
| 28. Action Parity | v0.9.0 | 0/? | Not started | - |

### Phase 29: Permission Overlap Performance
**Goal**: Tree renders instantly with 140+ permission rules per scope by replacing O(R²) per-rule overlap resolution with a batch indexed algorithm
**Depends on**: Phase 25 (audit data informs which overlaps matter)
**Requirements**: PERF-01, PERF-02
**Success Criteria** (what must be TRUE):
  1. Pre-index rules by tool name, cache parsed results, and compute all overlaps in a single pass
  2. Eliminate redundant RegExp compilations and unnecessary cross-tool comparisons
  3. "Expand All" on a tree with 140+ rules per scope completes without perceptible hang
  4. Existing overlap test suite passes unchanged (no behavioral regression)
**Plans**: 1 plan

Plans:
- [ ] TBD (run /gsd:plan-phase 29 to break down)

---

*Roadmap created: 2026-02-18*
*Last updated: 2026-03-12 -- v0.9.0 roadmap added*
