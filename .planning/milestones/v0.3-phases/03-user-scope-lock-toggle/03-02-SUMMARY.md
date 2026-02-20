---
phase: 03-user-scope-lock-toggle
plan: 02
subsystem: ui
tags: [vscode-extension, treeview, commands, menus, context-menus, typescript]

# Dependency graph
requires:
  - phase: 03-user-scope-lock-toggle
    plan: 01
    provides: ConfigStore lock API, effectiveReadOnly propagation, ScopeNode scope-identity contextValue, LockDecorationProvider
provides:
  - Three lock commands registered in extension.ts (toggleUserLock, lockUserScope, unlockUserScope)
  - Inline icon-swap buttons on User scope tree item via setContext + mutually exclusive when clauses
  - LockDecorationProvider registered alongside PluginDecorationProvider
  - Write guard with info message on all write commands (edit, delete, move, plugin) for locked User scope
  - Copy FROM locked User scope allowed in copySettingToScope, copyPermissionToScope, copyPluginToScope
  - Lock-aware target scope pickers with $(lock) prefix and blocked selection
  - pickScopeFilePath in addCommands excludes locked scopes
  - isReadOnly guard on onDidChangeCheckboxState to block plugin toggle on locked scope
affects: [03-user-scope-lock-toggle plan 03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "setContext + two mutually exclusive when clauses for dual icon-swap inline buttons"
    - "Delegate lock/unlock to configStore.lockScope/unlockScope then sync context key"
    - "Copy FROM locked source: allow non-destructive copies; block moves (destructive)"
    - "Lock-aware pickers: show all non-Managed scopes, prefix locked with $(lock), guard on selection"

key-files:
  created: []
  modified:
    - src/extension.ts
    - package.json
    - src/commands/editCommands.ts
    - src/commands/deleteCommands.ts
    - src/commands/addCommands.ts
    - src/commands/moveCommands.ts
    - src/commands/pluginCommands.ts

key-decisions:
  - "lockUserScope icon = $(lock) (shown when unlocked, click to lock); unlockUserScope icon = $(unlock) (shown when locked, click to unlock) — functional specification bullets take precedence over contradictory design principle bullet in CONTEXT.md"
  - "Managed scope explicitly excluded from target pickers via s.scope !== ConfigScope.Managed — allScopes from configStore.getAllScopes() returns originals (not effectiveReadOnly clones), so isReadOnly alone would already filter Managed; explicit filter added for clarity and correctness"
  - "lockUserScope and unlockUserScope hidden from Command Palette via commandPalette deny-list with when: false; toggleUserLock is the only Command Palette-accessible lock command"

patterns-established:
  - "Lock-aware picker pattern: filter !isReadOnly && !Managed, include locked scopes with $(lock) prefix, guard selection with info message"
  - "Copy-from-locked exception: isReadOnly && scope !== ConfigScope.User before blocking — allows non-destructive reads from locked User"

requirements-completed:
  - LOCK-01
  - LOCK-02
  - LOCK-03
  - LOCK-04
  - LOCK-05

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 3 Plan 02: Command Registration and Lock Toggle Wiring Summary

**Lock toggle inline buttons on User scope tree item via setContext + dual when clauses, write command guards with info messages for locked User scope, and lock-aware move/copy pickers with $(lock) prefix and copy-from-locked exception**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T18:03:03Z
- **Completed:** 2026-02-19T18:06:01Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Registered three lock commands in extension.ts: `toggleUserLock` (Command Palette accessible), `lockUserScope` (inline button, palette hidden), `unlockUserScope` (inline button, palette hidden); all sync the `claudeConfig_userScope_locked` context key for icon swapping
- All write commands (edit, delete, move, plugin delete/toggle) show `showInformationMessage` with "User scope is currently locked. Click the lock icon in the toolbar to unlock." when a locked User scope node is targeted via Command Palette
- All move/copy target pickers display locked scopes with `$(lock)` prefix and block selection with an info message; copy FROM locked User scope is explicitly allowed (non-destructive)
- `pickScopeFilePath` in addCommands now excludes locked scopes from the add-target picker; `onDidChangeCheckboxState` now guards `isReadOnly` to prevent plugin toggle on locked nodes

## Task Commits

Each task was committed atomically:

1. **Task 1: Register lock commands in extension.ts and wire package.json inline buttons** - `6ffe585` (feat)
2. **Task 2: Guard write commands and make move/copy pickers lock-aware** - `b53aef0` (feat)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified

- `src/extension.ts` - Added ConfigScope + LockDecorationProvider imports; claudeConfig_userScope_locked setContext initialization; three lock commands (toggleUserLock, lockCmd, unlockCmd); LockDecorationProvider registration; isReadOnly guard on onDidChangeCheckboxState
- `package.json` - Three new commands in contributes.commands; two inline view/item/context entries with mutually exclusive when clauses; two commandPalette deny-list entries for lockUserScope and unlockUserScope
- `src/commands/editCommands.ts` - Added ConfigScope import; lock-aware guard shows info message for User scope
- `src/commands/deleteCommands.ts` - Added ConfigScope import; lock-aware guard shows info message for User scope
- `src/commands/addCommands.ts` - pickScopeFilePath now excludes locked scopes via !configStore.isScopeLocked(s.scope)
- `src/commands/moveCommands.ts` - Added ConfigScope import; all three handlers updated: lock info for move-from-locked-User source, lock-aware target pickers, copy-from-locked exception for copySettingToScope and copyPermissionToScope
- `src/commands/pluginCommands.ts` - Added ConfigScope import; deletePlugin lock info for User; copyPluginToScope copy-from-locked exception and lock-aware target picker

## Decisions Made

- `lockUserScope` icon = `$(lock)` (shown when unlocked, click to lock); `unlockUserScope` icon = `$(unlock)` (shown when locked, click to unlock) — the first two functional specification bullets in CONTEXT.md describe the interaction clearly and consistently with tooltips; the third "design principle" bullet is contradictory and was overridden
- Managed scope explicitly excluded from target pickers (`s.scope !== ConfigScope.Managed`) in addition to the `!s.isReadOnly` filter for clarity
- `toggleUserLock` intentionally NOT in commandPalette deny-list — it is the canonical Command Palette entry per LOCK-01

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-02 complete: all user-facing lock toggle wiring is done
- Plan 03-03 will cover end-to-end verification and any remaining integration concerns
- LOCK-01 through LOCK-05 all satisfied by this plan

## Self-Check

- [x] `claudeConfig_userScope_locked` context key initialized to false in activate()
- [x] Three lock commands registered with correct setContext calls
- [x] LockDecorationProvider registered in context.subscriptions
- [x] package.json has 3 new commands, 2 inline menu entries with mutually exclusive when clauses, 2 commandPalette deny entries
- [x] toggleUserLock NOT in commandPalette deny-list
- [x] editCommands.ts shows showInformationMessage for locked User scope
- [x] deleteCommands.ts shows showInformationMessage for locked User scope
- [x] moveCommands.ts moveToScope source guard shows lock info for User scope
- [x] copySettingToScope and copyPermissionToScope allow copy FROM locked User
- [x] All target pickers show $(lock) prefix and block locked scope selection
- [x] addCommands.ts pickScopeFilePath excludes locked scopes
- [x] pluginCommands.ts deletePlugin lock info for User; copyPluginToScope copy-from-locked exception
- [x] extension.ts onDidChangeCheckboxState checks isReadOnly
- [x] npm run typecheck passes
- [x] npm run compile succeeds

## Self-Check: PASSED

---
*Phase: 03-user-scope-lock-toggle*
*Completed: 2026-02-19*
