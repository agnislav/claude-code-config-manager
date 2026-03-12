# Requirements: Claude Code Config Manager

**Defined:** 2026-03-11
**Core Value:** Every Claude Code setting is visible, editable, and scope-aware in one place — so you never have to hand-edit JSON config files or wonder which scope is winning.

## v0.9.0 Requirements

Requirements for UX Audit milestone. Each maps to roadmap phases.

### Audit

- [x] **AUDIT-01**: Complete audit matrix documenting actual vs expected state for all 14 node types across all audit vectors (icons, descriptions, tooltips, inline buttons, context menus, click behavior, overlap)
- [x] **AUDIT-02**: Document intentional design decisions vs unintentional inconsistencies for each finding

### Trivial Fixes

- [x] **TRIV-01**: Sandbox section header shows item count in description (currently empty string)
- [x] **TRIV-02**: HookEntry description shows hook type (command, prompt, or agent)
- [x] **TRIV-03**: EnvVar nodes show base tooltip with key=value context (not just overlap tooltip)

### Inline Buttons

- [x] **INLN-03**: Dead `&& false` editValue guard removed (cleanup); plugin `&& false` guards documented as intentional design decisions
- [x] **INLN-04**: Uniform inline button ordering applied — fixed positions per action type (edit@0, move@1, copy@2, delete@3) across all entity types

### Overlap

- [x] **OVLP-01**: Hook entries show overlap detection when same hook exists in multiple scopes
- [x] **OVLP-02**: Hook overlap uses color-coded decorations and tooltips consistent with other entity types

### Action Parity

- [ ] **ACTN-01**: EnvVar supports copy-to-scope (matching permissions and settings pattern)
- [ ] **ACTN-02**: MCP Server nodes show enriched inline UX (tooltip with server type/command details, consistent description)
- [ ] **ACTN-03**: MCP Server inline button set reviewed and corrected (currently delete-only; assess add/edit needs)
- [ ] **ACTN-04**: SettingKeyValue nodes support edit action (edit child value)
- [ ] **ACTN-05**: SettingKeyValue nodes support delete action (remove child key)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Deferred UX

- **DEFR-01**: Plugin inline buttons beyond openReadme (checkbox interaction complicates this)
- **DEFR-02**: Hook move/copy between scopes (complex nesting requires hierarchy reconstruction)
- **DEFR-03**: Settings section "Add" button for arbitrary config keys
- **DEFR-04**: Drag-and-drop between scopes
- **DEFR-05**: Accessibility labels via TreeItem.accessibilityInformation
- **DEFR-06**: EnvVar inline edit button (editValue for env vars — separate EditValue phase per ITEMS.md)
- **DEFR-07**: SandboxProperty inline edit button (editValue for sandbox properties — separate EditValue phase per ITEMS.md)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| MCP Server move/copy between scopes | `.mcp.json` is workspace-scoped, not per config scope; structurally invalid |
| Deep-edit inline for complex values | JSON editing in QuickPick is error-prone; revealInFile works |
| Multiselect batch operations | Significant state management complexity; deferred per PROJECT.md |
| Inline text editing (rename in place) | VS Code TreeView does not support this natively |
| Sort controls in toolbar | Minimal value with few items per section; deferred per PROJECT.md |
| Plugin/Sandbox section "Add" buttons | Plugins are registry-discovered; sandbox keys are schema-defined |
| Plugin inline move/copy/delete buttons | Intentionally disabled; copy works via context menu, toggle via checkbox |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | Phase 25 | Complete |
| AUDIT-02 | Phase 25 | Complete |
| TRIV-01 | Phase 25 | Complete |
| TRIV-02 | Phase 25 | Complete |
| TRIV-03 | Phase 25 | Complete |
| INLN-03 | Phase 26 | Complete |
| INLN-04 | Phase 26 | Complete |
| OVLP-01 | Phase 27 | Complete |
| OVLP-02 | Phase 27 | Complete |
| ACTN-01 | Phase 28 | Pending |
| ACTN-02 | Phase 28 | Pending |
| ACTN-03 | Phase 28 | Pending |
| ACTN-04 | Phase 28 | Pending |
| ACTN-05 | Phase 28 | Pending |

**Coverage:**
- v0.9.0 requirements: 14 total (INLN-01/02 deferred as DEFR-06/07)
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-12 after critical review (MCP move/copy invalidated, plugin guards documented as intentional)*
