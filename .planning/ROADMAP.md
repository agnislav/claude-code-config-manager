# Roadmap: Claude Code Config Manager

**Created:** 2026-02-18
**Updated:** 2026-03-06
**Status:** v0.3.x-v0.5.0 complete (Phases 1-15), v0.6.0 in progress (Phases 16-18)

---

## Milestones

- ✅ **v0.3.x Toolbar UX Improvements** — Phases 1-5 (shipped 2026-02-19)
- ✅ **v0.4.0 Tree UX Refinements** — Phases 6-8 (shipped 2026-02-20)
- ✅ **v0.4.1 Node Display Polish** — Phase 9 (shipped 2026-02-20)
- ✅ **v0.5.0 Hardening** — Phases 10-15 (shipped 2026-02-21)
- **v0.6.0 Decouple State from Tree** — Phases 16-18 (in progress)

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

---

### v0.6.0 Decouple State from Tree (In Progress)

**Milestone Goal:** Reduce tight coupling between tree nodes and ConfigStore so the data model is cleanly separated from the presentation layer.

- [ ] **Phase 16: ViewModel Layer** - Define ViewModel interfaces and build TreeViewModelBuilder
- [ ] **Phase 17: Node Migration** - Migrate all 14 node types and wire builder into tree provider
- [ ] **Phase 18: Verification and Cleanup** - Unit tests for builder, dead import removal, baseNode simplification

## Phase Details

### Phase 16: ViewModel Layer
**Goal**: A complete ViewModel type system and builder exist that can transform ConfigStore data into display-ready descriptors for all node types
**Depends on**: Nothing (additive code, no existing files modified)
**Requirements**: VM-01, VM-02, VM-03, VM-04
**Success Criteria** (what must be TRUE):
  1. ViewModel interfaces exist for all 14 node types with per-type data shapes (labels, descriptions, icons, contextValues, collapsible state)
  2. NodeContext is embedded in every ViewModel so command handlers can extract scope, keyPath, and filePath without changes
  3. TreeViewModelBuilder.build() accepts ConfigStore data and returns a complete ViewModel tree covering all 7 entity types (settings, permissions, env vars, plugins, hooks, sandbox, MCP servers)
  4. Builder pre-computes override resolution and display state (formatting, icons, descriptions) so no downstream consumer needs to call overrideResolver directly
**Plans**: TBD

### Phase 17: Node Migration
**Goal**: All tree nodes accept ViewModels instead of raw config data, and ConfigTreeProvider drives rendering through the builder
**Depends on**: Phase 16
**Requirements**: VM-05, VM-06, VM-07, VM-08, VM-09, VM-10
**Success Criteria** (what must be TRUE):
  1. All 14 tree node constructors accept ViewModel descriptors and no node file imports from overrideResolver or receives ConfigStore/allScopes
  2. WorkspaceFolderNode (inline in configTreeProvider.ts) has no direct ConfigStore dependency
  3. ConfigTreeProvider calls TreeViewModelBuilder in its refresh cycle and passes ViewModels to node constructors
  4. Bidirectional editor-tree sync works identically to before the refactor (parentMap population, reveal() navigation, contextValue menu bindings all preserved)
**Plans**: TBD

### Phase 18: Verification and Cleanup
**Goal**: The decoupling is verified by automated tests and all dead coupling artifacts are removed
**Depends on**: Phase 17
**Requirements**: TEST-01, TEST-02, TEST-03, VM-11, VM-12
**Success Criteria** (what must be TRUE):
  1. Unit tests exist for TreeViewModelBuilder covering all 7 entity types with assertions on computed ViewModels
  2. Unit tests verify override resolution produces correct display state (labels, icons, contextValues) per scope
  3. Unit tests verify NodeContext preservation (contextValue strings match expected patterns, keyPaths are correct type and depth)
  4. Zero imports of overrideResolver remain in any file under src/tree/nodes/
  5. baseNode.ts contains no ScopedConfig-dependent logic
**Plans**: TBD

---

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
| 16. ViewModel Layer | v0.6.0 | 0/? | Not started | - |
| 17. Node Migration | v0.6.0 | 0/? | Not started | - |
| 18. Verification and Cleanup | v0.6.0 | 0/? | Not started | - |

---

*Roadmap created: 2026-02-18*
*Last updated: 2026-03-06 — v0.6.0 Decouple State from Tree roadmap added (Phases 16-18)*
