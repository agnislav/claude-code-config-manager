# Requirements: Claude Code Config Manager

**Defined:** 2026-03-15
**Core Value:** Every Claude Code setting is visible, editable, and scope-aware in one place

## v0.10.0 Requirements

Requirements for v0.10.0 Simplify & Power Features. Each maps to roadmap phases.

### Simplification

- [ ] **SIMP-01**: Try/catch retry dispatch blocks extracted into named closures (5 locations)
- [ ] **SIMP-02**: Read-only guard extracted into `guardReadOnly()` helper (8 locations)
- [ ] **SIMP-03**: Target scope selection extracted into `pickEditableTargetScope()` helper (5 locations)
- [ ] **SIMP-04**: Overwrite confirmation extracted into `confirmOverwrite()` helper (3 locations)
- [ ] **SIMP-05**: `formatSandboxValue()` merged into `formatValue()` with style parameter
- [ ] **SIMP-06**: Timestamp formatting extracted into `formatTimestamp()` helper (3 locations)
- [ ] **SIMP-07**: Plugin checkbox + toggle handlers deduplicated via `togglePluginEnabled()`

### Settings Add

- [ ] **SETT-01**: Inline "+" button on editable Settings section headers
- [ ] **SETT-02**: QuickPick showing known settings from schema, filtered by already-set keys
- [ ] **SETT-03**: Free-text fallback option for custom setting keys
- [ ] **SETT-04**: Type-appropriate value input (boolean toggle, string input, etc.)

### Drag and Drop

- [ ] **DND-01**: TreeDragAndDropController implementation on ConfigTreeProvider
- [ ] **DND-02**: Draggable items: PermissionRule, EnvVar, McpServer, Plugin, Setting, SandboxProperty
- [ ] **DND-03**: Drop targets: ScopeNode and SectionNode (same entity type only)
- [ ] **DND-04**: Move by default, Alt/Option modifier copies
- [ ] **DND-05**: Reuse existing move/copy logic from moveCommands.ts
- [ ] **DND-06**: Lock-aware — reject drops onto locked or read-only scopes

### Accessibility

- [ ] **A11Y-01**: accessibilityInformation on all leaf node types (scope, value, override status)
- [ ] **A11Y-02**: accessibilityInformation on container nodes (scope name, section, item count)
- [ ] **A11Y-03**: Overlap status conveyed in accessibility labels

## Future Requirements

### Deferred

- **OVLP-03**: Overlap description text ("also in [Scope]") on tree items
- **OVLP-04**: Overlap FileDecoration badge ("2x") for multi-scope entities
- **DEFR-01**: Plugin inline buttons beyond openReadme
- **DEFR-02**: Hook move/copy between scopes
- **DEFR-06**: EnvVar inline edit button
- **DEFR-07**: SandboxProperty inline edit button

## Out of Scope

| Feature | Reason |
|---------|--------|
| Marketplace publishing | Personal tool, not targeting public release |
| Windows support | macOS/Linux only, matches Claude Code platform support |
| Command palette "go to" | Deferred to future milestone (pending todo) |
| Multiselect batch operations | Deferred to future milestone (pending todo) |
| Drag-and-drop reordering within scope | Only cross-scope DnD in this milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SIMP-01 | Phase 30 | Pending |
| SIMP-02 | Phase 30 | Pending |
| SIMP-03 | Phase 30 | Pending |
| SIMP-04 | Phase 30 | Pending |
| SIMP-05 | Phase 30 | Pending |
| SIMP-06 | Phase 30 | Pending |
| SIMP-07 | Phase 30 | Pending |
| SETT-01 | Phase 31 | Pending |
| SETT-02 | Phase 31 | Pending |
| SETT-03 | Phase 31 | Pending |
| SETT-04 | Phase 31 | Pending |
| DND-01 | Phase 32 | Pending |
| DND-02 | Phase 32 | Pending |
| DND-03 | Phase 32 | Pending |
| DND-04 | Phase 32 | Pending |
| DND-05 | Phase 32 | Pending |
| DND-06 | Phase 32 | Pending |
| A11Y-01 | Phase 33 | Pending |
| A11Y-02 | Phase 33 | Pending |
| A11Y-03 | Phase 33 | Pending |

**Coverage:**
- v0.10.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after initial definition*
