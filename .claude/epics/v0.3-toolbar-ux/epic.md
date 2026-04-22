---
name: v0.3-toolbar-ux
status: completed
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:00:00Z
progress: 100%
prd:
github:
---

# Toolbar UX Improvements (v0.3.x)

## Summary
v0.3.x replaced the cluttered filter and refresh toolbar with focused, predictable controls. The eight per-section filter icon buttons collapsed into a single QuickPick multi-select picker, the refresh button was removed entirely (file watcher auto-syncs), a User-scope lock toggle was introduced to prevent accidental writes to global config, and move inline buttons joined copy inline buttons on tree items so move and copy became discoverable side-by-side.

The milestone shipped 5 phases and closed 33 requirements across filter, refresh, lock, and move behavior. Post-milestone fixes corrected the move icon to `$(arrow-swap)`, changed copy icons to `$(add)`, disabled pane auto-activation, and temporarily disabled plugin and editValue inline buttons pending further work.

## Requirements delivered

### Filter (FILT-01..10)
- **FILT-01**: QuickPick opens with 7 section items plus an "All" shortcut at position 0
- **FILT-02**: Pre-selects currently active sections when reopening
- **FILT-03**: Filter selections apply immediately (live-apply UX, confirmed during Phase 4)
- **FILT-04**: Accepting a subset filters the tree to those sections
- **FILT-05**: Accepting "All" or empty shows all sections
- **FILT-06**: "All" shortcut deselects all others on click (mutual exclusivity)
- **FILT-07**: Old per-section filter commands removed from package.json
- **FILT-08**: Old `claudeConfig_filter_*` context keys removed
- **FILT-09**: Filter resets on VS Code restart (ephemeral)
- **FILT-10**: QuickPick disposed on hide (no listener leak)

### Refresh removal (REFR-01..03)
- **REFR-01**: Refresh toolbar button removed from package.json
- **REFR-02**: Refresh command entry removed from view/title menu
- **REFR-03**: Refresh command remains available via Command Palette

### User-scope lock (LOCK-01..13)
- **LOCK-01**: Lock toggle command registered as `claudeConfig.toggleUserLock`
- **LOCK-02**: Dual icon-swap on toolbar — `$(lock)` / `$(unlock)`
- **LOCK-03**: Locked User scope items remain visible with context menus
- **LOCK-04**: Locked User scope disabled in move/copy pickers
- **LOCK-05**: Direct edits blocked on locked scope with informational message
- **LOCK-06**: Lock state in `ConfigStore._lockedScopes`, survives reloads
- **LOCK-07**: Lock propagated via `effectiveReadOnly` shallow-clone
- **LOCK-08**: `contextValue` includes lock segment (`scope.user.editable` / `scope.user.readOnly`)
- **LOCK-09**: Lock state ephemeral (resets on restart)
- **LOCK-10**: `onDidChangeTreeData` fires after lock toggle

### Move inline button (MOVE-01..03)
- **MOVE-01**: Move inline button appears alongside copy button on editable tree items
- **MOVE-02**: Clicking move invokes the move-to-scope command
- **MOVE-03**: Move `when` clauses match the copy `contextValue` patterns

## Implementation history

- **Phase 01 — QuickPick Multi-Select Filter** (~3 plans, completed 2026-02-19): Removed all 8 legacy filter toolbar buttons, their 16 command registrations, and the `syncFilterContext` / `FILTER_CTX_KEYS` machinery. Added a single `$(filter)` / `$(filter-filled)` toolbar entry backed by `vscode.createQuickPick` with pre-selection, mutual exclusivity, TreeView description count ("N/7"), live-apply on selection change, and Escape-to-restore. A cleanup plan (01-03) then fixed three UAT gaps — QuickPick width reduced by moving codicons to the description field, live-apply refined, and `setTreeView()` wired to `updateFilterUI()` so the tree description renders on first load.
- **Phase 02 — Remove Refresh Toolbar Button** (1 plan, completed 2026-02-19): Deleted the `view/title` menu entry for `claudeConfig.refresh` from package.json. Command and handler preserved; Command Palette access intact; `ConfigFileWatcher` auto-refresh unaffected. Commit: `feat(phase-02)`.
- **Phase 03 — User Scope Lock Toggle** (2 plans, completed 2026-02-19): Plan 01 added `_lockedScopes: Set<ConfigScope>` to ConfigStore with `lockScope`/`unlockScope`/`isScopeLocked` methods, the `effectiveReadOnly` shallow-clone pattern in ConfigTreeProvider, scope-identity `contextValue` on ScopeNode, and a `LockDecorationProvider` dimming the User scope label via `disabledForeground`. Plan 02 registered the three lock commands (`toggleUserLock`, `lockUserScope`, `unlockUserScope`), wired write guards with informational messages across edit/delete/move/plugin commands, and normalized move/copy pickers to be lock-aware. Commits: `718822c`, `74d4238`, `6ffe585`, `b53aef0`.
- **Phase 04 — Fix Filter Cancel + Tech Debt** (1 plan, completed 2026-02-19): Confirmed FILT-03 live-apply as intended (no revert on Escape), removed `toggleSectionFilter()` and `selectAllSections()` dead code from ConfigTreeProvider, and normalized all four target scope pickers to hide locked scopes at query time instead of show-then-block. Backfilled `requirements_completed` frontmatter on Phase 1 summaries. Commits: `4d02b36`, `e2e5f4f`.
- **Phase 05 — Add Move Inline Button** (1 plan, completed 2026-02-19): Extended `moveToScope` with plugin support via `setPluginEnabled` + `removePlugin`, inserted a modal confirmation dialog before the scope picker, and added three inline button entries in package.json for permissionRule, setting, and plugin items. Renumbered plugin inline slots (readme@0, move@1, copy@2, delete@3). Commits: `61412ed`, `06556eb`.

## Key decisions

- **QuickPick for filters** — Native VS Code component with multi-select checkboxes; better than submenu or webview for familiarity.
- **Remove refresh button entirely** — File watcher already auto-syncs; manual refresh adds no value, only toolbar clutter. Command remains in the palette.
- **Lock state as ephemeral `Set<ConfigScope>` on ConfigStore** — Not on ScopedConfig, so lock never writes to disk and survives `reload()` but resets on restart.
- **`effectiveReadOnly` shallow-clone propagation** — `locked && !scopedConfig.isReadOnly ? { ...scopedConfig, isReadOnly: true } : scopedConfig` applied before ScopeNode construction; `allScopes` kept unmodified so override resolution still sees real data.
- **Lock blocks target selection, not menu visibility** — Items stay visible with context menus; only write commands surface the "User scope is currently locked" info message.
- **Copy-from-locked exception** — Copy is non-destructive to the source, so locked User scope remains a valid copy source while move (destructive) is blocked.
- **Lock-aware pickers: hide locked scopes at query time** — Phase 4 normalized move/copy pickers to filter `!isScopeLocked(s.scope)` rather than show-then-block with a `$(lock)` prefix. Consistent with `addCommands.pickScopeFilePath`.
- **Custom URI scheme `claude-config-lock`** — Enables `FileDecorationProvider` dimming on locked User scope without a separate `onDidChangeFileDecorations` EventEmitter (lock toggle already fires `configStore.onDidChange`).
- **Inline button ordering: move@0, copy@1, delete@2** — Plugins use readme@0, move@1, copy@2, delete@3. Established the convention that non-destructive actions come before destructive ones.
- **Modal confirmation before move** — Destructive operation requires explicit user intent before the scope picker opens.
- **toggleUserLock in Command Palette, lockUserScope/unlockUserScope hidden** — Only the canonical toggle is palette-accessible; icon-swap variants use `when: false` to stay toolbar-only.

## Functionality delivered

- **Code added/modified**:
  - Created: `src/tree/lockDecorations.ts` (LOCK_URI_SCHEME + LockDecorationProvider)
  - Modified: `src/extension.ts`, `src/tree/configTreeProvider.ts`, `src/tree/nodes/scopeNode.ts`, `src/config/configModel.ts`, `src/commands/editCommands.ts`, `src/commands/deleteCommands.ts`, `src/commands/addCommands.ts`, `src/commands/moveCommands.ts`, `src/commands/pluginCommands.ts`, `package.json`

- **User-facing behavior**:
  - Single `$(filter)` toolbar button with multi-select QuickPick replacing 8 per-section buttons
  - TreeView description shows "N/7" while filtered, empty when unfiltered
  - `$(lock)` / `$(unlock)` toggle in toolbar with informational block messages on locked writes
  - Locked User scope visibly dimmed via `disabledForeground` ThemeColor
  - Move inline icon button on permissionRule, plugin, and setting items alongside copy
  - Modal confirmation dialog before destructive moves
  - Refresh still available via Command Palette; no more toolbar entry

## Audit outcome
33 of 33 requirements satisfied across all 8 phases (Phases 1–5 for v0.3, with Phases 6–8 spilling into v0.4.0). All 18 cross-phase integration points pass, all 6 E2E flows pass, `npm run typecheck` exits clean. Status at ship: `tech_debt` (no blockers) — accumulated documentation debt only: stale VERIFICATION.md prose for FILT-03, navigation-index drift in SUMMARY vs package.json, missing REQUIREMENTS.md file (reconstructed from VERIFICATION + SUMMARY frontmatter), and intentionally disabled plugin/editValue inline buttons (`&& false` in package.json) deferred to a future milestone.

## Lessons learned

- Live-apply QuickPick UX was initially specified as cancel-restore but confirmed during Phase 4 as better — immediate feedback is the intended interaction for filter pickers.
- Dead-code cleanup should follow any replacement pattern immediately (the zero-caller `toggleSectionFilter` / `selectAllSections` lingered from Plan 01-02 until Phase 4 removed them).
- Filtering locked scopes out at query time is cleaner UX than showing them with a `$(lock)` prefix and blocking post-selection.
- Custom URI schemes with state-encoded `query` fields let a single FileDecorationProvider communicate dynamic state (locked/unlocked) without a dedicated EventEmitter.
- When introducing a toggle with icon-swap, keep the icon-swap commands hidden from the Command Palette and expose a single canonical toggle command instead.
