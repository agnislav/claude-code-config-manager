---
phase: 03-user-scope-lock-toggle
plan: 01
subsystem: ui
tags: [vscode-extension, treeview, configstore, decorations, typescript]

# Dependency graph
requires:
  - phase: 02-remove-refresh-toolbar
    provides: clean package.json with no stale toolbar entries
provides:
  - ConfigStore lock state API (_lockedScopes, lockScope, unlockScope, isScopeLocked)
  - effectiveReadOnly shallow-clone propagation in ConfigTreeProvider (single-root and multi-root)
  - ScopeNode contextValue with scope identity (scope.user.editable, scope.user.readOnly, etc.)
  - LockDecorationProvider that dims locked User scope node with disabledForeground ThemeColor
affects: [03-user-scope-lock-toggle plans 03-02, 03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lock state as ephemeral Set<ConfigScope> in ConfigStore — survives reload, resets on restart"
    - "effectiveReadOnly shallow-clone: { ...scopedConfig, isReadOnly: true } before ScopeNode construction"
    - "Custom URI scheme (claude-config-lock) for FileDecorationProvider dim effect on tree nodes"
    - "contextValue with scope identity: scope.{scope}.{editable|readOnly}[.missing]"

key-files:
  created:
    - src/tree/lockDecorations.ts
  modified:
    - src/config/configModel.ts
    - src/tree/configTreeProvider.ts
    - src/tree/nodes/scopeNode.ts

key-decisions:
  - "Lock state is a private Set<ConfigScope> on ConfigStore, not on ScopedConfig — prevents disk writes and enables ephemeral session-only locking"
  - "reload() intentionally does not touch _lockedScopes — lock state survives file watcher reloads (LOCK-06)"
  - "allScopes passed to ScopeNode stays unmodified; only the scopedConfig argument is shallow-cloned for effectiveReadOnly (LOCK-10)"
  - "onDidChangeFileDecorations = undefined on LockDecorationProvider — lock toggle fires configStore.onDidChange which triggers full tree rebuild, so no separate EventEmitter needed"

patterns-established:
  - "effectiveReadOnly: locked && !scopedConfig.isReadOnly ? { ...scopedConfig, isReadOnly: true } : scopedConfig"
  - "Custom URI scheme for tree node decoration: vscode.Uri.from({ scheme, path, query }) with query encoding state"

requirements-completed:
  - LOCK-06
  - LOCK-07
  - LOCK-08
  - LOCK-09
  - LOCK-10

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 3 Plan 01: Lock State Infrastructure Summary

**Ephemeral Set<ConfigScope> lock API on ConfigStore with effectiveReadOnly shallow-clone propagation to ScopeNode, scope-identity contextValue for per-scope inline button targeting, and LockDecorationProvider dimming locked User scope via disabledForeground ThemeColor**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T17:58:30Z
- **Completed:** 2026-02-19T18:00:13Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- ConfigStore now has `_lockedScopes: Set<ConfigScope>` with `lockScope`/`unlockScope`/`isScopeLocked` methods; `reload()` intentionally skips `_lockedScopes` so lock state survives file watcher reloads
- ConfigTreeProvider computes effectiveReadOnly via shallow-clone `{ ...scopedConfig, isReadOnly: true }` for locked scopes, applied in both `getSingleRootChildren()` and `WorkspaceFolderNode.getChildren()`, with `allScopes` left unmodified for override resolution
- ScopeNode `computeContextValue()` now produces `scope.{scope}.{editable|readOnly}[.missing]` (e.g., `scope.user.editable`) enabling User-scope-only inline button `when` clauses
- New `src/tree/lockDecorations.ts` exports `LOCK_URI_SCHEME` and `LockDecorationProvider` that dims the User scope node label with `disabledForeground` ThemeColor when locked; `onDidChangeFileDecorations = undefined` matches existing `PluginDecorationProvider` pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Add lock state to ConfigStore and effectiveReadOnly propagation** - `718822c` (feat)
2. **Task 2: Update ScopeNode contextValue with scope identity and create LockDecorationProvider** - `74d4238` (feat)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified

- `src/config/configModel.ts` - Added `_lockedScopes: Set<ConfigScope>` field, `lockScope`/`unlockScope`/`isScopeLocked` methods, `_lockedScopes.clear()` in `dispose()`
- `src/tree/configTreeProvider.ts` - effectiveReadOnly shallow-clone in `getSingleRootChildren()`; `WorkspaceFolderNode` constructor accepts `configStore` and applies same pattern in `getChildren()`
- `src/tree/nodes/scopeNode.ts` - `computeContextValue()` returns `scope.{scope}.{editable|readOnly}[.missing]`; constructor sets `resourceUri` with `claude-config-lock` scheme for User scope
- `src/tree/lockDecorations.ts` - (new) `LOCK_URI_SCHEME = 'claude-config-lock'` and `LockDecorationProvider` with `disabledForeground` ThemeColor decoration

## Decisions Made

- `reload()` does not touch `_lockedScopes` — this is intentional, matching LOCK-06 requirement that lock state survives file watcher reloads
- `onDidChangeFileDecorations = undefined` on `LockDecorationProvider` — no EventEmitter needed because the lock toggle fires `configStore.onDidChange` → tree rebuilds → `ScopeNode` is reconstructed with updated `resourceUri.query`
- `allScopes` (second arg to `ScopeNode`) remains the unmodified original from `configStore.getAllScopes(key)` — override resolution must reflect real config data, not the effective read-only state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Lock state infrastructure is complete and ready for Plan 03-02
- Plan 03-02 will register `LockDecorationProvider` in `extension.ts`, add `lockUserScope`/`unlockUserScope` commands, and wire the lock/unlock toggle with dual icon-swap via `setContext`
- All existing `when` clauses in `package.json` still match the new contextValue format (`/^scope\./` matches `scope.user.editable`; `/^scope\..+\.missing/` matches `scope.user.editable.missing`)

## Self-Check

- [x] `configModel.ts` contains `_lockedScopes`, `lockScope`, `unlockScope`, `isScopeLocked` and `reload()` does NOT reference `_lockedScopes`
- [x] `configTreeProvider.ts` calls `isScopeLocked()` in both `getSingleRootChildren` and `WorkspaceFolderNode.getChildren`, and passes unmodified `allScopes` to `ScopeNode`
- [x] `scopeNode.ts` `computeContextValue()` includes scope identity (`scope.user.editable`, etc.)
- [x] `lockDecorations.ts` exports `LOCK_URI_SCHEME` and `LockDecorationProvider`
- [x] `npm run typecheck` passes with no errors
- [x] `npm run compile` succeeds (esbuild bundle)
- [x] Existing `package.json` when clauses still work

## Self-Check: PASSED

---
*Phase: 03-user-scope-lock-toggle*
*Completed: 2026-02-19*
