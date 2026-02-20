# Roadmap: Claude Code Config Manager

**Created:** 2026-02-18
**Updated:** 2026-02-20
**Status:** v0.3.x complete (Phases 1–5); v0.4.0 complete (Phases 6–8); v0.4.1 complete (Phase 9); v0.5.0 in progress (Phases 10–15)

---

## Milestones

- ✅ **v0.3.x Toolbar UX Improvements** — Phases 1–5 (shipped 2026-02-19)
- ✅ **v0.4.0 Tree UX Refinements** — Phases 6–8 (shipped 2026-02-20)
- ✅ **v0.4.1 Node Display Polish** — Phase 9 (shipped 2026-02-20)
- ⏳ **v0.5.0 Hardening** — Phases 10–15 (in progress)

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

<details>
<summary>✅ v0.4.1 Node Display Polish (Phase 9) — SHIPPED 2026-02-20</summary>

- [x] Phase 9: Refine Tree Node Rendering (1/1 plan) — completed 2026-02-20

</details>

---

## v0.5.0 Hardening (Phases 10–15)

**Goal:** Fix all identified bugs, reduce technical debt, and harden error handling across the extension.

**Phase Range:** 10–15 (6 phases)
**Requirements:** 18 total across Error Handling, Concurrency & Timing, Path Safety, Resource Management, and Code Quality

---

### Phase 10: Error Handling Foundation

**Requirements:** ERR-01, ERR-02, ERR-03
**Rationale:** Core error handling infrastructure must be in place before other fixes can safely build on it.
**Plans:** 2 plans

Plans:
- [ ] 10-01-PLAN.md — Propagate writeJsonFile errors with scope-aware messages and recovery buttons
- [ ] 10-02-PLAN.md — Surface config and MCP parse errors with Open File navigation

#### Tasks

1. **ERR-01: Propagate writeJsonFile errors**
   - Add proper error propagation from writeJsonFile() to all callers
   - Wrap calls in try-catch with user-facing error messages via vscode.window.showErrorMessage()
   - Test write failures (permission denied, disk full scenarios)

2. **ERR-02: Config parse error handling**
   - Check JSON parse error field in configModel.reload()
   - Show vscode.window.showWarningMessage() for corrupted config files
   - Display file path and parse error details to user

3. **ERR-03: MCP config parse error handling**
   - Check MCP config parse error field in configModel
   - Show warning message for invalid .mcp.json files
   - Include diagnostic information for troubleshooting

#### Success Criteria

- ✓ Write failures display actionable error messages instead of silent failures
- ✓ Corrupted JSON config files trigger visible warnings with file path
- ✓ Invalid .mcp.json files show diagnostic warnings
- ✓ No unhandled promise rejections in file write operations

---

### Phase 11: Tree Error Resilience

**Requirements:** ERR-04, ERR-05
**Rationale:** Tree operations are user-facing and must handle errors gracefully without crashing the extension.

#### Tasks

1. **ERR-04: Tree operation error guards**
   - Wrap findNodeByKeyPath() in try-catch with safe fallback (return undefined)
   - Wrap getChildren() in try-catch with safe fallback (return empty array)
   - Add error logging for debugging while preserving UI stability
   - Test with malformed tree state scenarios

2. **ERR-05: Plugin checkbox rollback**
   - Wrap plugin toggle handler in try-catch
   - On write failure, rollback checkbox UI state to previous value
   - Show error message explaining failure reason
   - Prevent tree from showing incorrect state after failed write

#### Success Criteria

- ✓ Tree operations never throw unhandled exceptions to VS Code
- ✓ Malformed tree state logs errors but renders gracefully
- ✓ Plugin checkbox failures rollback UI state and notify user
- ✓ Tree remains interactive after error conditions

---

### Phase 12: Write Lifecycle & Concurrency

**Requirements:** SYNC-01, SYNC-02, SYNC-03
**Rationale:** Write tracking (SYNC-01) establishes the lifecycle pattern needed for debounce improvements (SYNC-02/03).

#### Tasks

1. **SYNC-01: Track in-flight writes**
   - Add Set<string> to ConfigStore to track in-flight write paths
   - Mark write start in configWriter before writeJsonFile()
   - Mark write end in finally block after writeJsonFile()
   - Suppress file watcher reload() if path is in in-flight set
   - Test rapid edit → external change sequences

2. **SYNC-02: Cleanup orphaned timeouts**
   - Add Map<string, NodeJS.Timeout> to track editor-tree sync timers
   - Clear existing timeout before creating new one for same file
   - Clear all timeouts in deactivate()
   - Test rapid editor changes and extension reload scenarios

3. **SYNC-03: Debounce maximum wait ceiling**
   - Add maxWait parameter to file watcher debounce (e.g., 5000ms)
   - Ensure reload happens at least every N seconds even with rapid changes
   - Prevent indefinite reload suppression during continuous edits
   - Test with rapid external file modification loop

#### Success Criteria

- ✓ Extension writes don't trigger redundant file watcher reloads
- ✓ Rapid editor changes don't accumulate orphaned timers
- ✓ Extension deactivation cleans up all pending timeouts
- ✓ Continuous external changes reload within maximum wait window
- ✓ No race conditions between writer and watcher observable in logs

---

### Phase 13: Path Safety Hardening

**Requirements:** PATH-01, PATH-02, PATH-03
**Rationale:** PATH-01 (path.dirname) is prerequisite for PATH-02 (validation logic). PATH-03 is independent.

#### Tasks

1. **PATH-01: Replace string path operations**
   - Audit codebase for lastIndexOf('/') and similar string parsing
   - Replace with path.dirname(), path.basename(), path.join()
   - Verify cross-platform compatibility (macOS/Linux)
   - Test with edge cases (paths with spaces, special chars)

2. **PATH-02: Validate write paths**
   - Define allowed config directories in constants (managed, user, project scopes)
   - Add validateConfigPath() utility in configWriter
   - Reject writes to paths outside known config directories
   - Test with malicious path inputs (../, symlinks)

3. **PATH-03: Validate revealInFile inputs**
   - Add path validation in revealInFile command handler
   - Check filePath against known config paths list
   - Validate keyPath for type (string[]) and max length
   - Show error message for invalid inputs instead of crashing

#### Success Criteria

- ✓ No path operations use string indexOf/lastIndexOf/substring
- ✓ All path operations use Node.js path module functions
- ✓ Write operations reject paths outside config directories
- ✓ revealInFile rejects invalid file paths and malformed keyPaths
- ✓ Extension handles paths with spaces and special characters correctly

---

### Phase 14: Resource Management

**Requirements:** RES-01, RES-02
**Rationale:** Small independent fixes for resource leaks and cache invalidation.

#### Tasks

1. **RES-01: Dispose tree provider EventEmitter**
   - Implement Disposable interface on ConfigTreeProvider
   - Call _onDidChangeTreeData.dispose() in dispose() method
   - Add tree provider to extension context.subscriptions
   - Test with extension reload scenarios

2. **RES-02: Invalidate plugin metadata cache**
   - Clear plugin metadata cache in ConfigStore.reload()
   - Ensure fresh plugin data after config changes
   - Test with plugin enable/disable sequences
   - Verify cache clears on external config file changes

#### Success Criteria

- ✓ Tree provider disposes EventEmitter on deactivation
- ✓ No memory leaks observable in Extension Host restart cycles
- ✓ Plugin metadata reflects latest state after config reload
- ✓ Cache invalidation logged for debugging

---

### Phase 15: Code Quality Cleanup

**Requirements:** QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05
**Rationale:** Independent cleanup tasks that don't affect core functionality; safe to group together.

#### Tasks

1. **QUAL-01: Remove unused _configStore parameters**
   - Audit editCommands.ts, deleteCommands.ts, openFileCommands.ts
   - Remove unused _configStore parameters from function signatures
   - Update all call sites to match new signatures
   - Verify no runtime errors after removal

2. **QUAL-02: Remove dead code**
   - Delete getAllWatchPaths export from configDiscovery.ts
   - Remove any unreferenced helper functions identified in audit
   - Update imports/exports as needed

3. **QUAL-03: Extract timeout constants**
   - Identify all hardcoded timeout values (e.g., 300, 500, 1000ms)
   - Define named constants in constants.ts (DEBOUNCE_EDITOR_SYNC_MS, etc.)
   - Replace magic numbers with named constants
   - Document timeout purposes in comments

4. **QUAL-04: Use SCOPE_LABELS in delete confirmations**
   - Replace raw ConfigScope enum values in user-facing messages
   - Use SCOPE_LABELS map for human-readable scope names
   - Update confirmation dialogs in deleteCommands.ts
   - Test delete confirmations display "User", "Project Shared", etc.

5. **QUAL-05: Guard keyPath array access**
   - Add bounds checks before keyPath[0], keyPath[1] access
   - Add length validation in deleteCommands and moveCommands
   - Return early or show error for invalid keyPath structures
   - Test with edge cases (empty keyPath, single-element keyPath)

#### Success Criteria

- ✓ No unused parameters in command handlers
- ✓ No dead code exports in codebase
- ✓ All timeout values use named constants with purpose comments
- ✓ Delete confirmations show human-readable scope names
- ✓ keyPath access never throws out-of-bounds errors
- ✓ Code cleanliness improves without functional regressions

---

## Summary

| Phase | Focus | Requirements | Tasks |
|-------|-------|--------------|-------|
| 10 | Error Handling Foundation | 3 | ERR-01, ERR-02, ERR-03 |
| 11 | Tree Error Resilience | 2 | ERR-04, ERR-05 |
| 12 | Write Lifecycle & Concurrency | 3 | SYNC-01, SYNC-02, SYNC-03 |
| 13 | Path Safety Hardening | 3 | PATH-01, PATH-02, PATH-03 |
| 14 | Resource Management | 2 | RES-01, RES-02 |
| 15 | Code Quality Cleanup | 5 | QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05 |

**Total:** 6 phases, 18 requirements, 100% coverage

---

*Roadmap created: 2026-02-18*
*Last updated: 2026-02-20 — v0.5.0 roadmap added*
