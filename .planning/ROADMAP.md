# Roadmap: Claude Code Config Manager

**Created:** 2026-02-18
**Updated:** 2026-03-10
**Status:** v0.3.x-v0.7.0 complete (Phases 1-22), v0.8.0 in progress (Phases 23-24)

---

## Milestones

- ✅ **v0.3.x Toolbar UX Improvements** — Phases 1-5 (shipped 2026-02-19)
- ✅ **v0.4.0 Tree UX Refinements** — Phases 6-8 (shipped 2026-02-20)
- ✅ **v0.4.1 Node Display Polish** — Phase 9 (shipped 2026-02-20)
- ✅ **v0.5.0 Hardening** — Phases 10-15 (shipped 2026-02-21)
- ✅ **v0.6.0 Decouple State from Tree** — Phases 16-18 (shipped 2026-03-08)
- ✅ **v0.7.0 Visual Fidelity** — Phases 19-22 (shipped 2026-03-09)
- 🚧 **v0.8.0 Tree Display Polish** — Phases 23-24 (in progress)

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

### 🚧 v0.8.0 Tree Display Polish (In Progress)

**Milestone Goal:** Refine tree node display — checkbox-only plugins when unlocked, flattened permissions with type-aware icons and inline type switching.

## Phases

- [x] **Phase 23: Plugin Checkbox-Only Display** - Plugin nodes show only checkbox (no plugin icon) when User scope is unlocked
- [ ] **Phase 24: Flatten Permissions with Type Icons** - Permission rules display as flat list with type-aware icons and inline type switching

## Phase Details

### Phase 23: Plugin Checkbox-Only Display
**Goal**: Plugin nodes present a clean checkbox-only appearance when User scope is unlocked, removing visual noise from redundant plugin icons
**Depends on**: Nothing (first phase in v0.8.0)
**Requirements**: PLUG-01
**Success Criteria** (what must be TRUE):
  1. When User scope is unlocked, plugin nodes show a checkbox with no additional plugin icon next to it
  2. When User scope is locked, plugin nodes continue to show static icons (existing lock-aware behavior preserved)
  3. Toggling the lock changes plugin nodes between checkbox-only and static-icon modes without tree collapse or flicker
**Plans**: 1 plan

Plans:
- [x] 23-01-PLAN.md — Remove extensions icon when unlocked, verify checkbox-only display

### Phase 24: Flatten Permissions with Type Icons
**Goal**: Users see all permission rules in a single flat list under Permissions, with icons that immediately communicate each rule's type and an inline button to change type
**Depends on**: Phase 23
**Requirements**: PERM-01, PERM-02, PERM-03, PERM-04
**Success Criteria** (what must be TRUE):
  1. Permission rules appear directly under the Permissions section node without Allow/Ask/Deny group nodes in between
  2. Each permission rule displays a distinct icon that visually indicates whether it is an allow, deny, or ask rule
  3. Right-clicking a permission rule still shows edit, delete, and move options (contextValue preserved)
  4. An inline button on each permission rule opens a QuickPick to switch the rule between Allow, Ask, and Deny types
  5. Switching a rule's type via the inline button persists the change to the correct config file and refreshes the tree
**Plans**: TBD

Plans:
- [ ] 24-01: TBD

---

## Progress

**Execution Order:**
Phases execute in numeric order: 23 → 24

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
| 23. Plugin Checkbox-Only Display | v0.8.0 | Complete    | 2026-03-10 | 2026-03-10 |
| 24. Flatten Permissions | v0.8.0 | 0/? | Not started | - |

---

*Roadmap created: 2026-02-18*
*Last updated: 2026-03-10 — Phase 23 completed*
