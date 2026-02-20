# Roadmap: Claude Code Config Manager

**Created:** 2026-02-18
**Updated:** 2026-02-20
**Status:** v0.3.x complete (Phases 1–5); v0.4.0 complete (Phases 6–8)

---

## Milestones

- ✅ **v0.3.x Toolbar UX Improvements** — Phases 1–5 (shipped 2026-02-19)
- ✅ **v0.4.0 Tree UX Refinements** — Phases 6–8 (shipped 2026-02-20)
- **v0.4.1 Node Display Polish** — Phase 9

---

<details>
<summary>✅ v0.3.x Toolbar UX Improvements (Phases 1–5) — SHIPPED 2026-02-19</summary>

- [x] Phase 1: QuickPick Multi-Select Filter (2/2 plans) — completed 2026-02-19
- [x] Phase 2: Remove Refresh Toolbar Button (1/1 plan) — completed 2026-02-19
- [x] Phase 3: User Scope Lock Toggle (2/2 plans) — completed 2026-02-19
- [x] Phase 4: Fix Filter Cancel + Tech Debt Cleanup (1/1 plan) — completed 2026-02-19
- [x] Phase 5: Add Move Inline Button (1/1 plan) — completed 2026-02-19

</details>

<details>
<summary>✅ v0.4.0 Tree UX Refinements (Phases 6–8) — SHIPPED 2026-02-20</summary>

- [x] Phase 6: Lock UX Rework (1/1 plan) — completed 2026-02-19
- [x] Phase 7: Collapse/Expand Toolbar Buttons (1/1 plan) — completed 2026-02-20
- [x] Phase 8: Object Settings Expansion (1/1 plan) — completed 2026-02-20

</details>

---

## v0.4.1 Node Display Polish

### Phase 9: Refine Tree Node Rendering

**Goal:** Polish tree node display by showing relative paths for project scopes, removing redundant plugin text, and making hook entries expandable.

**Requirements:** TREE-01, TREE-02, TREE-03
**Plans:** 1 plan

Plans:
- [ ] 09-01-PLAN.md — Relative paths, plugin cleanup, expandable hooks

**Success Criteria:**
- Project Shared and Project Local scope nodes display relative workspace path in description field
- Plugin nodes show only plugin name without "enabled/disabled" suffix
- Hook entry nodes expand to reveal key-value child nodes (matching object settings UX)
- All three changes work correctly in multi-root workspaces
- No regressions to existing tree display or inline buttons

---
*Roadmap created: 2026-02-18*
*Last updated: 2026-02-20 — v0.4.1 roadmap defined*
