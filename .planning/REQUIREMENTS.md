# Requirements: Claude Code Config Manager

**Defined:** 2026-02-20
**Core Value:** Every Claude Code setting is visible, editable, and scope-aware in one place — so you never have to hand-edit JSON config files or wonder which scope is winning.

## v0.5.0 Requirements

Requirements for hardening release. Each maps to roadmap phases.

### Error Handling

- [ ] **ERR-01**: writeJsonFile() propagates errors to all callers with user-facing error messages
- [ ] **ERR-02**: configModel checks JSON parse error field and shows warning for corrupted config files
- [ ] **ERR-03**: configModel checks MCP config parse error field and shows warning for invalid .mcp.json
- [ ] **ERR-04**: Tree node operations (findNodeByKeyPath, getChildren) wrapped in try-catch with safe fallbacks
- [ ] **ERR-05**: Plugin checkbox handler rolls back UI state on write failure

### Concurrency & Timing

- [ ] **SYNC-01**: ConfigStore tracks in-flight writes to suppress file watcher reload during write operations
- [ ] **SYNC-02**: Editor-tree sync orphaned timeouts are tracked and cleaned up on new events and deactivation
- [ ] **SYNC-03**: File watcher debounce enforces maximum wait ceiling (reload at least every N seconds)

### Path Safety

- [ ] **PATH-01**: All path parsing uses path.dirname()/path.basename() instead of string lastIndexOf operations
- [ ] **PATH-02**: File write operations validate resolved paths against known config directories
- [ ] **PATH-03**: revealInFile command validates filePath against known config paths and keyPath for type/length

### Resource Management

- [ ] **RES-01**: ConfigTreeProvider implements Disposable and disposes EventEmitter on cleanup
- [ ] **RES-02**: Plugin metadata cache invalidated on config reload

### Code Quality

- [ ] **QUAL-01**: Unused _configStore parameters removed from editCommands, deleteCommands, openFileCommands
- [ ] **QUAL-02**: Dead code removed (getAllWatchPaths export in configDiscovery.ts)
- [ ] **QUAL-03**: Hardcoded timeout values extracted to named constants
- [ ] **QUAL-04**: User-facing delete confirmation uses SCOPE_LABELS instead of raw enum value
- [ ] **QUAL-05**: keyPath array access guarded with bounds checks in deleteCommands and moveCommands

## Future Requirements

Deferred to later milestone. Tracked but not in current roadmap.

### Performance

- **PERF-01**: Replace sync file I/O with async in diagnostics validation
- **PERF-02**: Add memoization to override resolver functions

### Features (from pending todos)

- **FEAT-01**: Add "go to (scope/entity)" to the command palette
- **FEAT-02**: Multiselect for batch copy and move operations

### Design Improvements

- **DES-01**: Reduce tight coupling between tree nodes and ConfigStore
- **DES-02**: Add JSDoc documentation for exported functions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pagination for large configs | No measured performance impact; theoretical concern only |
| JSON prototype pollution filtering | Modern Node.js JSON.parse() mitigates this; config files are locally authored |
| Windows path support | macOS/Linux only per project constraints |
| Plugin ID format validation | Plugin IDs come from Claude Code ecosystem, not user-authored |
| jsonc-parser for line detection | Would add runtime dependency; current regex works for standard JSON |
| Comprehensive edge case tests | Testing infrastructure improvement — separate milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ERR-01 | — | Pending |
| ERR-02 | — | Pending |
| ERR-03 | — | Pending |
| ERR-04 | — | Pending |
| ERR-05 | — | Pending |
| SYNC-01 | — | Pending |
| SYNC-02 | — | Pending |
| SYNC-03 | — | Pending |
| PATH-01 | — | Pending |
| PATH-02 | — | Pending |
| PATH-03 | — | Pending |
| RES-01 | — | Pending |
| RES-02 | — | Pending |
| QUAL-01 | — | Pending |
| QUAL-02 | — | Pending |
| QUAL-03 | — | Pending |
| QUAL-04 | — | Pending |
| QUAL-05 | — | Pending |

**Coverage:**
- v0.5.0 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18 ⚠️

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after initial definition*
