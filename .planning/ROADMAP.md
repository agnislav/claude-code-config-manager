# Roadmap: Claude Code Config Manager

**Created:** 2026-02-18
**Updated:** 2026-03-16
**Status:** v0.3.x-v0.9.0 complete (Phases 1-29), v0.10.0 in progress (Phases 30-33)

---

## Milestones

- ✅ **v0.3.x Toolbar UX Improvements** — Phases 1-5 (shipped 2026-02-19)
- ✅ **v0.4.0 Tree UX Refinements** — Phases 6-8 (shipped 2026-02-20)
- ✅ **v0.4.1 Node Display Polish** — Phase 9 (shipped 2026-02-20)
- ✅ **v0.5.0 Hardening** — Phases 10-15 (shipped 2026-02-21)
- ✅ **v0.6.0 Decouple State from Tree** — Phases 16-18 (shipped 2026-03-08)
- ✅ **v0.7.0 Visual Fidelity** — Phases 19-22 (shipped 2026-03-09)
- ✅ **v0.8.0 Tree Display Polish** — Phases 23-24 (shipped 2026-03-11)
- ✅ **v0.9.0 UX Audit** — Phases 25-29 (shipped 2026-03-14)
- 🚧 **v0.10.0 Simplify & Power Features** — Phases 30-33 (in progress)

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

<details>
<summary>✅ v0.8.0 Tree Display Polish (Phases 23-24) — SHIPPED 2026-03-11</summary>

- [x] Phase 23: Plugin Checkbox-Only Display (1/1 plan) — completed 2026-03-10
- [x] Phase 24: Flatten Permissions with Type Icons (2/2 plans) — completed 2026-03-11

</details>

<details>
<summary>✅ v0.9.0 UX Audit (Phases 25-29) — SHIPPED 2026-03-14</summary>

- [x] Phase 25: Audit Catalog + Trivial Fixes (2/2 plans) — completed 2026-03-12
- [x] Phase 26: Inline Button Cleanup (1/1 plan) — completed 2026-03-12
- [x] Phase 27: Hook Overlap Detection (1/1 plan) — completed 2026-03-12
- [x] Phase 28: Action Parity (2/2 plans) — completed 2026-03-13
- [x] Phase 29: Permission Overlap Performance (1/1 plan) — completed 2026-03-13

</details>

---

### v0.10.0 Simplify & Power Features (In Progress)

**Milestone Goal:** Clean up ~270+ lines of duplicated command code, then add Settings "Add" button, drag-and-drop between scopes, and accessibility labels.

## Phases

- [x] **Phase 30: Code Simplification** - Extract duplicated patterns into shared helpers across command handlers (completed 2026-03-15)
- [x] **Phase 31: Settings Add Button** - Inline "+" button on Settings section with schema-aware QuickPick and type-appropriate input (completed 2026-03-15)
- [ ] **Phase 32: Drag and Drop Between Scopes** - Move/copy tree items across scopes by dragging, with lock awareness
- [ ] **Phase 33: Accessibility Labels** - Populate accessibilityInformation on all tree node types

## Phase Details

### Phase 30: Code Simplification
**Goal**: Duplicated patterns in command handlers are replaced by shared helpers, making the codebase smaller and easier to maintain
**Depends on**: Nothing (first phase of milestone)
**Requirements**: SIMP-01, SIMP-02, SIMP-03, SIMP-04, SIMP-05, SIMP-06, SIMP-07
**Success Criteria** (what must be TRUE):
  1. Every try/catch retry dispatch block is replaced by a single named closure call — no inline duplication remains in the 5 affected locations
  2. Every read-only guard check calls `guardReadOnly()` — the 8 call sites are identical one-liners
  3. Every target-scope picker calls `pickEditableTargetScope()` — the 5 call sites share one implementation
  4. `formatValue()` handles both regular and sandbox values via a style parameter — `formatSandboxValue()` no longer exists as a separate function
  5. Plugin checkbox registration and toggle handler share `togglePluginEnabled()` — no duplicated enable/disable logic remains
**Plans:** 2/2 plans complete
Plans:
- [ ] 30-01-PLAN.md — Extract 6 shared helpers and apply across command files
- [ ] 30-02-PLAN.md — Deduplicate plugin toggle handlers

### Phase 31: Settings Add Button
**Goal**: Users can add new settings directly from the tree without hand-editing JSON
**Depends on**: Phase 30
**Requirements**: SETT-01, SETT-02, SETT-03, SETT-04
**Success Criteria** (what must be TRUE):
  1. A "+" inline button appears on editable Settings section headers and is absent on read-only (Managed) scope headers
  2. Clicking "+" opens a QuickPick listing known settings from the schema, with already-set keys filtered out
  3. A free-text entry option in the QuickPick lets the user type any custom setting key not in the schema
  4. After selecting a key, the input prompt matches the expected type — boolean keys show a toggle QuickPick, string keys show a text input box
  5. The new setting appears in the tree and is persisted to the correct config file immediately after confirmation
**Plans:** 1/1 plans complete
Plans:
- [ ] 31-01-PLAN.md — Add Setting command with schema-aware QuickPick and type-appropriate input

### Phase 32: Drag and Drop Between Scopes
**Goal**: Users can move or copy permission rules, env vars, MCP servers, plugins, settings, and sandbox properties between scopes by dragging
**Depends on**: Phase 31
**Requirements**: DND-01, DND-02, DND-03, DND-04, DND-05, DND-06
**Success Criteria** (what must be TRUE):
  1. Dragging a supported item (PermissionRule, EnvVar, McpServer, Plugin, Setting, SandboxProperty) and dropping it onto a different scope's node or matching section node moves the item to that scope and removes it from the source
  2. Holding Alt/Option while dropping copies the item to the target scope without removing it from the source
  3. Dropping onto a locked or Managed (read-only) scope shows an error notification and leaves the tree unchanged
  4. Dropping an item onto a section of a different entity type is rejected — only same-entity-type drops are accepted
  5. The move and copy operations are executed via the existing moveCommands.ts logic — no parallel write path is introduced
**Plans:** 1 plan
Plans:
- [ ] 32-01-PLAN.md — DnD controller with move/copy, lock awareness, and entity type validation

### Phase 33: Accessibility Labels
**Goal**: All tree nodes expose meaningful accessibility information so screen reader users can navigate the config tree fully
**Depends on**: Phase 32
**Requirements**: A11Y-01, A11Y-02, A11Y-03
**Success Criteria** (what must be TRUE):
  1. Every leaf node (PermissionRule, EnvVar, McpServer, Plugin, Setting, SandboxProperty, SettingKeyValue, HookEntry) has `accessibilityInformation` set with a label that includes the item's scope, value, and override status
  2. Every container node (ScopeNode, SectionNode) has `accessibilityInformation` set with a label that includes scope name, section name, and item count where applicable
  3. Overlapping items include overlap status in their accessibility label (e.g., "overrides User scope value", "duplicated in Project Shared")
**Plans:** 1 plan
Plans:
- [ ] 33-01-PLAN.md — Add accessibilityInformation to all tree node types via ViewModel layer

## Progress

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
| 26. Inline Button Cleanup | v0.9.0 | 1/1 | Complete | 2026-03-12 |
| 27. Hook Overlap Detection | v0.9.0 | 1/1 | Complete | 2026-03-12 |
| 28. Action Parity | v0.9.0 | 2/2 | Complete | 2026-03-13 |
| 29. Permission Overlap Performance | v0.9.0 | 1/1 | Complete | 2026-03-13 |
| 30. Code Simplification | v0.10.0 | 2/2 | Complete | 2026-03-15 |
| 31. Settings Add Button | v0.10.0 | 1/1 | Complete | 2026-03-15 |
| 32. Drag and Drop Between Scopes | v0.10.0 | 0/1 | Not started | - |
| 33. Accessibility Labels | v0.10.0 | 0/1 | Not started | - |

---

*Roadmap created: 2026-02-18*
*Last updated: 2026-03-16 — Phase 33 planned (1 plan)*
