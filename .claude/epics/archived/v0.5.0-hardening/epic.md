---
name: v0.5.0-hardening
status: completed
created: 2026-02-20T17:00:00Z
updated: 2026-02-21T00:00:00Z
progress: 100%
prd:
github:
---

# Hardening (v0.5.0)

## Summary

v0.5.0 fixed all identified bugs, reduced technical debt, and hardened error handling across the extension. Every write operation gained error propagation with recovery buttons, race conditions were eliminated through in-flight write tracking, paths were validated against whitelists with traversal/symlink protection, and all user-facing messages were centralized with consistent "Claude Config:" prefixing.

The milestone delivered six phases (10–15) covering error propagation, tree resilience, write lifecycle and concurrency, path safety, resource management, and code quality cleanup. 18 requirements were satisfied (15 fully verified, 3 partial with cosmetic gaps only). Net change: +1,314 / -379 lines of source for 5,241 total TypeScript LOC.

## Requirements delivered

Error Handling:
- **ERR-01**: writeJsonFile propagates errors with scope-aware messages to all 15 write operations
- **ERR-02**: configModel surfaces JSON parse errors with "Open File" navigation on corrupted config
- **ERR-03**: configModel surfaces MCP parse errors with "Open File" navigation on invalid .mcp.json
- **ERR-04**: findNodeByKeyPath and getChildren wrapped in try-catch with safe fallbacks
- **ERR-05**: Plugin checkbox rolls back UI state on write failure via tree refresh

Concurrency & Timing:
- **SYNC-01**: ConfigStore tracks in-flight writes via Set to suppress watcher reloads
- **SYNC-02**: Editor-tree sync timeouts tracked in Map, cleared on new events and deactivation
- **SYNC-03**: File watcher debounce enforces 2s maxWait ceiling for rapid external changes

Path Safety:
- **PATH-01**: All path parsing uses Node.js path.dirname/basename instead of string ops
- **PATH-02**: validateConfigPath applies traversal, symlink, and whitelist checks on every write
- **PATH-03**: revealInFile validates filePath and keyPath through a 7-stage pipeline

Resource Management:
- **RES-01**: ConfigTreeProvider implements Disposable and disposes EventEmitter on cleanup
- **RES-02**: Plugin metadata cache invalidated at start of ConfigStore.reload()

Code Quality:
- **QUAL-01**: Unused _configStore parameters removed from edit/delete/openFile commands
- **QUAL-02**: Dead getAllWatchPaths export removed from configDiscovery
- **QUAL-03**: 6 hardcoded timeout values extracted to named constants with JSDoc
- **QUAL-04**: Delete confirmations use SCOPE_LABELS and "Claude Config:" prefix
- **QUAL-05**: keyPath array access guarded via shared validateKeyPath helper

## Implementation history

- **Phase 10 — Error Handling Foundation** (30min, 2026-02-20): Added showWriteError helper with scope label resolution and Open File/Retry recovery buttons; replaced 11 generic error messages and added try-catch to 4 uncovered write paths; added parse error detection for all config scopes and MCP with line/column extraction. Commits: `5df32d0` (feat), `6c48a4a` (feat), `384e0f9` (feat).
- **Phase 11 — Tree Error Resilience** (15min, 2026-02-20): Wrapped provider-level and 14 node getChildren() in try-catch with safe fallbacks; made onDidChangeCheckboxState async to await showWriteError and trigger full tree refresh for rollback. Commits: `dc82d8a` (feat), `6d25e55` (feat).
- **Phase 12 — Write Lifecycle & Concurrency** (25min, 2026-02-20): Added Set-based in-flight write tracking in configWriter, watcher suppression via isWriteInFlight check, dual-timeout debounce with 300ms regular + 2000ms maxWait ceiling; Map-based sync timeout tracking keyed by source, UI write guards with informational message on concurrent writes, async deactivate with 5s polling for in-flight writes. Commits: `4717bc9` (feat), `3d5b365` (feat), `267a7c2` (feat).
- **Phase 13 — Path Safety Hardening** (8min, 2026-02-20): Replaced all lastIndexOf/substring path parsing with path.dirname/basename; added 7-stage input validation to revealInFile with whitelist; added validateConfigPath with traversal, lstatSync symlink detection, whitelist (excluding managed), and parent-dir checks integrated into trackedWrite. Commits: `f315028` (refactor), `fee2f0b` (feat), `131eec4` (feat).
- **Phase 14 — Resource Management** (4min, 2026-02-20): Implemented vscode.Disposable on ConfigTreeProvider with EventEmitter disposal, registered provider in context.subscriptions, added PluginMetadataService.invalidate() at start of ConfigStore.reload(). Commits: `8eb4e48` (feat), `083dc61` (feat).
- **Phase 15 — Code Quality Cleanup** (23min, 2026-02-20): Removed unused _configStore parameters and dead getAllWatchPaths, extracted 6 timing constants (EDITOR_SYNC_SUPPRESS_MS, TREE_SYNC_SUPPRESS_MS, EDITOR_TREE_SYNC_DEBOUNCE_MS, DEACTIVATION_POLL_INTERVAL_MS, DEACTIVATION_MAX_WAIT_MS, MAX_KEYPATH_DEPTH) with JSDoc; created src/utils/validation.ts with validateKeyPath helper, added MESSAGES object to constants.ts, routed all notifications through MESSAGES with "Claude Config:" prefix and SCOPE_LABELS. Commits: `b8aa7df` (refactor), `0aa1af0` (refactor), `41545b1` (refactor), `c7a8ba1` (refactor).

## Key decisions

- **Error handling at command level, not in configWriter**: Commands own UX decisions, writer stays pure I/O; retry callbacks duplicate the write call for explicit, simple recovery.
- **showWriteError with scope-aware recovery buttons**: Reusable across all command handlers with "Open File" and "Retry" actions; exported from configWriter.ts to keep related error code together.
- **In-flight write tracking via Set<string>**: Simple path lookups over Map<string, number>; finally block always clears the flag to prevent permanent suppression on failure.
- **Dual-timeout debounce (regular + maxWait)**: 300ms regular keeps UI responsive while 2000ms maxWait ceiling guarantees reload during continuous external changes.
- **Write path validation centralized in trackedWrite**: Single enforcement point for all 13 write operations; whitelist built at call time to account for workspace changes; managed scope excluded to enforce read-only.
- **lstatSync for symlink detection**: Detects symlinks on both file and parent; stat errors on non-existent paths ignored since ensureDir creates them.
- **revealInFile 7-stage validation pipeline**: Type checks → traversal → whitelist → existence → proceed; all failures logged with REJECTED prefix.
- **Plugin metadata cache invalidated at start of reload()**: Covers both full and single-folder reloads; prevents stale state after external changes.
- **MESSAGES object with functions for parameterized messages**: Centralized, discoverable; consistent "Claude Config:" prefix across all notifications.
- **validateKeyPath returns boolean for guard pattern**: Simple early-return; logs to console.warn and shows showErrorMessage for bad state.
- **Named constants for all timeout values**: Discoverable in constants.ts with JSDoc explaining purpose and rationale for duration.
- **Deactivation polls in-flight writes up to 5s**: Graceful shutdown prevents data loss on rapid close; 50ms polling interval balances responsiveness and max wait.

## Functionality delivered

- **Code added/modified**: src/config/configWriter.ts (showWriteError, trackedWrite, validateConfigPath, inFlightPaths), src/config/configModel.ts (parse error surfacing, cache invalidation), src/watchers/fileWatcher.ts (watcher suppression, maxWait), src/tree/configTreeProvider.ts (Disposable, try-catch guards), all 14 tree node files (getChildren guards), src/commands/{addCommands,editCommands,deleteCommands,moveCommands,pluginCommands,openFileCommands}.ts (try-catch + MESSAGES/SCOPE_LABELS + validateKeyPath guards), src/commands/openFileCommands.ts (revealInFile validation), src/constants.ts (6 timing constants + MESSAGES + getAllowedWritePaths), src/utils/validation.ts (new), src/extension.ts (write lifecycle wiring, syncTimeouts Map, async deactivate).
- **User-facing behavior**: Actionable error notifications with "Open File"/"Retry" recovery on every write failure; visible warnings for corrupted config files with click-to-navigate; graceful tree rendering under malformed state; plugin checkbox reverts on failed writes; concurrent-write informational message; consistent "Claude Config:" prefix and human-readable scope labels across all notifications and confirmation dialogs.
- **Tests**: Pre-existing test infrastructure missing at ship time; validation covered via code inspection and manual scenarios documented per phase.

## Audit outcome

v0.5.0 shipped with **18/18 requirements functionally complete** and all 6 cross-phase integration points plus all 5 E2E flows (write, error, plugin toggle, file watcher, deactivation) verified. Status: tech debt, no blockers. Two non-blocking gaps identified: Phase 14 missing VERIFICATION.md (implementation confirmed correct via code inspection) and one cosmetic gap in QUAL-04 (pluginCommands.ts:39 delete confirmation missing "Claude Config:" prefix — 1-line fix deferred). 15/18 fully verified, 3/18 partial with cosmetic gaps only.

## Lessons learned

- Centralizing recovery UX via a single showWriteError helper keeps 15 write call sites uniform and avoids bespoke error-handling per command.
- Write tracking, watcher suppression, and maxWait debounce must be designed together — the finally block guarantees watcher resumption even under failure.
- Validation centralized at trackedWrite covers every future write operation without per-writer changes; whitelist must be computed at call time to accept workspace changes.
- Extracting timing constants with JSDoc rationale makes tunable values discoverable and documents the "why" behind every duration.
- When command-level error handling is the right call, configWriter must remain pure I/O and simply throw — callers decide the UX.
