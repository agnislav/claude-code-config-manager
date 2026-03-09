# Roadmap: Claude Code Config Manager

**Created:** 2026-02-18
**Updated:** 2026-03-09
**Status:** v0.3.x-v0.6.0 complete (Phases 1-18), v0.7.0 in progress (Phases 19-22)

---

## Milestones

- ✅ **v0.3.x Toolbar UX Improvements** — Phases 1-5 (shipped 2026-02-19)
- ✅ **v0.4.0 Tree UX Refinements** — Phases 6-8 (shipped 2026-02-20)
- ✅ **v0.4.1 Node Display Polish** — Phase 9 (shipped 2026-02-20)
- ✅ **v0.5.0 Hardening** — Phases 10-15 (shipped 2026-02-21)
- ✅ **v0.6.0 Decouple State from Tree** — Phases 16-18 (shipped 2026-03-08)
- 🚧 **v0.7.0 Visual Fidelity** — Phases 19-22 (in progress)

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

---

### 🚧 v0.7.0 Visual Fidelity (In Progress)

**Milestone Goal:** Make the tree reflect true state -- overlaps visible across scopes, lock toggle respected by plugin checkbox, hook leaf navigation correct.

## Phases

- [x] **Phase 19: Hook Navigation + Cleanup** - Fix hook leaf editor navigation and remove dead HookKeyValue code (completed 2026-03-08)
- [x] **Phase 20: Lock-Aware Plugin Display** - Replace plugin checkboxes with static icons when User scope is locked (completed 2026-03-09)
- [x] **Phase 21: Visual Overlap Indicators** - Show cross-scope overlap via tooltips for config entities (completed 2026-03-09)
- [x] **Phase 22: Lock Test Coverage & Doc Cleanup** - Add missing LOCK test cases and fix documentation gaps from audit (completed 2026-03-09)

## Phase Details

### Phase 19: Hook Navigation + Cleanup
**Goal**: Hook entry leaf nodes navigate the editor to the correct JSON line, and dead code from v0.6.0 is removed
**Depends on**: Nothing (independent bug fix + cleanup)
**Requirements**: NAV-01, CLEN-01
**Success Criteria** (what must be TRUE):
  1. Clicking any hook entry node in the tree opens the editor and selects the correct JSON line for that hook entry
  2. No HookKeyValueVM, HookKeyValueNode, or buildHookKeyValueVM code exists in the codebase
  3. All existing tests pass after the keyPath fix and dead code removal
**Plans**: TBD

### Phase 20: Lock-Aware Plugin Display
**Goal**: Locked User scope plugins display static icons instead of interactive checkboxes, eliminating click-flicker behavior
**Depends on**: Nothing (independent of Phase 19)
**Requirements**: LOCK-01, LOCK-02, LOCK-03
**Success Criteria** (what must be TRUE):
  1. When User scope is locked, enabled plugins show a checkmark icon instead of a checkbox
  2. When User scope is locked, disabled plugins show no icon instead of a checkbox
  3. Toggling the lock off restores checkboxes on plugin nodes; toggling it on removes them again
**Plans:** 1 plan
Plans:
- [ ] 20-01-PLAN.md — Conditional icon/checkbox in buildPlugins based on lock state

### Phase 21: Visual Overlap Indicators
**Goal**: Users can see when config entities exist in multiple scopes via tooltip information and color tinting showing each scope's value and overlap relationships
**Depends on**: Nothing (independent, but benefits from Phases 19-20 validating ViewModel extensibility)
**Requirements**: OVLP-01, OVLP-02
**Success Criteria** (what must be TRUE):
  1. Hovering over a config entity (setting, env var, plugin, MCP server, sandbox property) that exists in multiple scopes shows a tooltip listing all scopes where it appears, with each scope's value and override status
  2. Overlap detection uses separate data fields from override detection (not reusing isOverridden)
  3. Entities that exist in only one scope show no overlap tooltip content
**Plans:** 2/2 plans complete
Plans:
- [x] 21-01-PLAN.md — Create overlap resolver, types, decoration provider, and tests (completed 2026-03-09)
- [x] 21-02-PLAN.md — Migrate builder to overlap system, register decorations, delete old code (completed 2026-03-09)

### Phase 22: Lock Test Coverage & Doc Cleanup
**Goal**: Close audit gaps — add missing LOCK-01/02/03 automated tests and fix documentation inconsistencies
**Depends on**: Phase 20 (tests target Phase 20's lock-aware plugin logic)
**Requirements**: LOCK-01, LOCK-02, LOCK-03
**Gap Closure**: Closes partial requirements from v0.7.0 audit
**Success Criteria** (what must be TRUE):
  1. builder.test.ts contains test cases for LOCK-01 (locked enabled plugin shows checkmark icon), LOCK-02 (locked disabled plugin shows no icon), LOCK-03 (unlock restores checkboxes)
  2. REQUIREMENTS.md checkboxes for LOCK-01, LOCK-02, LOCK-03 are checked
  3. All tests pass (`npm run test`)
**Plans:** 1/1 plans complete
Plans:
- [x] 22-01-PLAN.md — Add LOCK-01/02/03 test cases and update REQUIREMENTS.md (completed 2026-03-09)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 19 → 20 → 21 → 22

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

---

*Roadmap created: 2026-02-18*
*Last updated: 2026-03-09 -- Phase 22 complete, all v0.7.0 phases done*
