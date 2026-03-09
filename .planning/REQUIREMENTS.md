# Requirements: Claude Code Config Manager

**Defined:** 2026-03-08
**Core Value:** Every Claude Code setting is visible, editable, and scope-aware in one place — so you never have to hand-edit JSON config files or wonder which scope is winning.

## v0.7.0 Requirements

Requirements for Visual Fidelity milestone. Each maps to roadmap phases.

### Overlap

- [x] **OVLP-01**: User sees tooltip listing all scopes where a config entity (setting, env var, plugin, MCP server, sandbox property) also appears, showing each scope's value and override status
- [x] **OVLP-02**: Overlap detection works independently from override detection (new fields, not reusing isOverridden)

### Lock

- [ ] **LOCK-01**: When User scope is locked, plugin nodes show checkmark icon for enabled plugins instead of checkbox
- [ ] **LOCK-02**: When User scope is locked, disabled plugins show no icon instead of checkbox
- [ ] **LOCK-03**: Lock state change refreshes plugin node display between checkbox and icon modes

### Navigation

- [x] **NAV-01**: Clicking a hook entry node navigates the editor to the correct JSON line (fix keyPath to include intermediate `hooks` segment)

### Cleanup

- [x] **CLEN-01**: Dead HookKeyValueVM, HookKeyValueNode, and buildHookKeyValueVM code removed

## Future Requirements

### Overlap Enhancements

- **OVLP-03**: Description text showing "also in [Scope]" on tree item
- **OVLP-04**: FileDecoration badge ("2x") for entities in multiple scopes

### UI Improvements

- **UI-01**: Add "go to (scope/entity)" to the command palette
- **UI-02**: Multiselect for batch copy and move operations

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cross-scope entity merging (single node showing all scopes) | Breaks scope-first tree model and mental model |
| Disabled checkbox rendering on locked items | VS Code API has no disabled checkbox state |
| Full tree diff/virtual DOM on refresh | VS Code TreeView has no partial-update API; tree is small enough |
| Badge/decoration for override direction | Existing dimming + description suffix already communicates this |
| Animated checkbox revert | No animation API in VS Code TreeView |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OVLP-01 | Phase 21 | Complete |
| OVLP-02 | Phase 21 | Complete |
| LOCK-01 | Phase 20 | Pending |
| LOCK-02 | Phase 20 | Pending |
| LOCK-03 | Phase 20 | Pending |
| NAV-01 | Phase 19 | Complete |
| CLEN-01 | Phase 19 | Complete |

**Coverage:**
- v0.7.0 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 — traceability updated with phase mappings*
