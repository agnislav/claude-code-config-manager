# Requirements: Claude Code Config Manager

**Defined:** 2026-03-10
**Core Value:** Every Claude Code setting is visible, editable, and scope-aware in one place — so you never have to hand-edit JSON config files or wonder which scope is winning.

## v0.8.0 Requirements

Requirements for Tree Display Polish milestone. Each maps to roadmap phases.

### Plugins

- [ ] **PLUG-01**: Plugin nodes show only checkbox without plugin icon when User scope is unlocked

### Permissions

- [ ] **PERM-01**: Permission rules display as flat list directly under Permissions section node (no Allow/Ask/Deny group nodes)
- [ ] **PERM-02**: Permission rule icons reflect their permission type (allow/deny/ask) using distinct visual icons
- [ ] **PERM-03**: Flat permission list maintains correct contextValue for edit/delete/move operations
- [ ] **PERM-04**: Inline button on permission rules to switch between Allow/Ask/Deny groups via QuickPick dropdown

## Future Requirements

- Add "go to (scope/entity)" to the command palette (ui)
- Multiselect for batch copy and move operations (ui)
- Re-enable plugin inline buttons (move/copy/delete)
- Sort items in the tree

## Out of Scope

| Feature | Reason |
|---------|--------|
| Overlap description text on tree items (OVLP-03) | Deferred enhancement |
| Overlap FileDecoration badge "2x" (OVLP-04) | Deferred enhancement |
| Replace sync file I/O with async in diagnostics | Internal quality, deferred |
| Add JSDoc for exported functions | Internal quality, deferred |
| EditValue inline improvements | Deferred to separate phase |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLUG-01 | — | Pending |
| PERM-01 | — | Pending |
| PERM-02 | — | Pending |
| PERM-03 | — | Pending |
| PERM-04 | — | Pending |

**Coverage:**
- v0.8.0 requirements: 5 total
- Mapped to phases: 0
- Unmapped: 5 ⚠️

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after initial definition*
