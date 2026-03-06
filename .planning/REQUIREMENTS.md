# Requirements: Claude Code Config Manager

**Defined:** 2026-03-06
**Core Value:** Every Claude Code setting is visible, editable, and scope-aware in one place — so you never have to hand-edit JSON config files or wonder which scope is winning.

## v0.6.0 Requirements

Requirements for v0.6.0 Decouple State from Tree. Each maps to roadmap phases.

### ViewModel Interfaces

- [ ] **VM-01**: ViewModel interfaces defined with per-node-type data shapes covering all 14 node types
- [ ] **VM-02**: NodeContext preserved in ViewModel so command handlers require zero changes

### ViewModel Builder

- [ ] **VM-03**: TreeViewModelBuilder pre-computes override resolution for all entity types (settings, permissions, env vars, plugins, hooks, sandbox, MCP servers)
- [ ] **VM-04**: TreeViewModelBuilder computes display state (labels, descriptions, icons, contextValues) from raw config data

### Node Migration

- [ ] **VM-05**: All 14 tree node types accept ViewModels instead of raw ScopedConfig/allScopes
- [ ] **VM-06**: No tree node file imports from overrideResolver
- [ ] **VM-07**: No tree node file receives ConfigStore or allScopes in constructor
- [ ] **VM-08**: WorkspaceFolderNode has no direct ConfigStore dependency

### Provider Integration

- [ ] **VM-09**: ConfigTreeProvider wires TreeViewModelBuilder into its refresh cycle
- [ ] **VM-10**: Bidirectional editor-tree sync preserved with identical behavior

### Testing

- [ ] **TEST-01**: Unit tests for TreeViewModelBuilder covering all 7 entity types
- [ ] **TEST-02**: Unit tests verify override resolution produces correct display state per scope
- [ ] **TEST-03**: Unit tests verify NodeContext preservation (contextValue strings, keyPaths)

### Cleanup

- [ ] **VM-11**: Dead override resolver imports removed from node files
- [ ] **VM-12**: baseNode simplified — no ScopedConfig-dependent logic

## v0.7.0 Requirements (Planned)

Deferred to next milestone. Research complete, requirements drafted.

### Bug Fixes

- **FIX-01**: Plugin checkbox reverts visual state immediately when User scope is locked
- **FIX-02**: Hook leaf click navigates editor to the correct JSON line

### Overlap Detection

- **OVLP-01**: Items present in multiple scopes show "also in [Scope]" description annotation
- **OVLP-02**: Items present in multiple scopes show scope count badge via FileDecorationProvider
- **OVLP-03**: Hovering an overlapping item shows tooltip with all scope values

## Out of Scope

| Feature | Reason |
|---------|--------|
| Move section filtering into view model | Differentiator, defer to v0.6.x |
| Pre-compute item counts in descriptors | Differentiator, defer to v0.6.x |
| Lock state as ViewModel field | Differentiator, defer to v0.6.x |
| Replace overrideResolver functions | View model calls them, doesn't replace them |
| "Resolved View" merged config mode | Breaks per-scope mental model |
| MCP server overlap detection | Separate config file with different merge semantics |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VM-01 | Phase 16 | Pending |
| VM-02 | Phase 16 | Pending |
| VM-03 | Phase 16 | Pending |
| VM-04 | Phase 16 | Pending |
| VM-05 | Phase 17 | Pending |
| VM-06 | Phase 17 | Pending |
| VM-07 | Phase 17 | Pending |
| VM-08 | Phase 17 | Pending |
| VM-09 | Phase 17 | Pending |
| VM-10 | Phase 17 | Pending |
| TEST-01 | Phase 18 | Pending |
| TEST-02 | Phase 18 | Pending |
| TEST-03 | Phase 18 | Pending |
| VM-11 | Phase 18 | Pending |
| VM-12 | Phase 18 | Pending |

**Coverage:**
- v0.6.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 — Phase mappings added for v0.6.0 (Phases 16-18)*
