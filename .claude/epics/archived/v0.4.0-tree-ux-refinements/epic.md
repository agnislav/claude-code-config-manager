---
name: v0.4.0-tree-ux-refinements
status: completed
created: 2026-02-19T00:00:00Z
updated: 2026-02-20T00:00:00Z
progress: 100%
prd:
github:
---

# Tree UX Refinements (v0.4.0)

## Summary
v0.4.0 refined the tree's default posture and navigation. User scope now locks by default on extension activation — write operations are blocked before the user touches anything — with state-semantic lock icons in the toolbar. Collapse All and Expand All toolbar buttons give one-click control over tree depth, and object-type settings expand in place to reveal individual key/value child nodes instead of displaying a dead-end `{N keys}` description.

The milestone shipped 3 phases (Phases 6–8) and closed 7 requirements. Final toolbar order: lock, collapse, expand, filter — user-validated left-to-right.

## Requirements delivered

### Lock UX (LOCK-11..13)
- **LOCK-11**: User scope is locked by default on extension activation (locked state set before first tree render)
- **LOCK-12**: Lock icons use state semantics — `$(lock)` when locked, `$(unlock)` when unlocked
- **LOCK-13**: Lock toggle button lives in the toolbar (view/title), no longer on the User scope node inline menu

### Toolbar controls (TOOL-01..02)
- **TOOL-01**: Collapse All button collapses all expanded tree nodes to top level
- **TOOL-02**: Expand All button expands all tree nodes to full depth

### Object settings expansion (SETT-01..02)
- **SETT-01**: Object-type settings render as expandable tree nodes instead of `{N keys}` description
- **SETT-02**: Each key/value pair within an object setting appears as a child node (key as label, formatted value as description)

## Implementation history

- **Phase 06 — Lock UX Rework** (1 plan, completed 2026-02-19): Added `configStore.lockScope(ConfigScope.User)` between `reload()` and `ConfigTreeProvider` construction so the locked state holds on first render. Swapped icon semantics on the `lockUserScope` / `unlockUserScope` commands — icon reflects current state, not intended action. Added two toolbar entries at `navigation@-1` (later renumbered to `navigation@0` in Phase 7) and removed the inline lock entries from the User scope node context menu. Commits: `e88fed8`, `bea42e9`.
- **Phase 07 — Collapse/Expand Toolbar Buttons** (1 plan, completed 2026-02-20): Registered `claudeConfig.collapseAll` (delegates to VS Code built-in `workbench.actions.treeView.claudeConfigTree.collapseAll`) and `claudeConfig.expandAll` (walks the tree via `getChildren()` and reveals each expandable node with `expand: true`). Added `collectExpandableNodes` helper. Both commands hidden from Command Palette via `when: false`. Finalized navigation index order — lock@0, collapse@1, expand@2, filter@3. Commit: `1f27a80`.
- **Phase 08 — Object Settings Expansion** (1 plan, completed 2026-02-20): Modified `SettingNode` to conditionally set `TreeItemCollapsibleState.Collapsed` for object-type values, emptied its description string (expand arrow becomes the signal), exported `formatValue` for cross-file reuse, and implemented `getChildren()` returning `SettingKeyValueNode` leaves per entry. Created `src/tree/nodes/settingKeyValueNode.ts` using a symbol-field icon and the shared `formatValue` for consistent rendering. Single-level expansion only — nested objects within expanded settings render as non-expandable leaves with `{N keys}` / `[N items]` descriptions.

## Key decisions

- **Lock by default with `lockScope` before tree provider construction** — Ensures the first render sees the locked state; `setContext` initial value flipped to `true`.
- **State semantics for lock icons** — Icon reflects current state (locked shows `$(lock)`, unlocked shows `$(unlock)`), consistent with VS Code toggle patterns (filter/filter-filled). Overrode an initial "action semantics" plan after user UAT.
- **Toolbar order: lock, filter, collapse, expand** — User-validated order during UAT; `navigation@` indices 0–3. (Phase 7 finalized the index numbering after Phase 6 used `navigation@-1` as a placeholder.)
- **Collapse All delegates to VS Code built-in** — Keeps behavior consistent with every other VS Code tree. Expand All uses the `treeView.reveal(node, { expand: true })` pattern for full-depth walk.
- **Both collapse/expand commands toolbar-only** — Hidden from Command Palette via `when: false` — they're only useful as toolbar buttons.
- **Object settings single-level expansion** — Avoids recursive complexity. Nested objects within expanded settings show `{N keys}` as leaves rather than recursively expanding.
- **Empty description on expandable object settings** — The expand arrow itself is the visual signal; `{N keys}` text would duplicate that information.
- **`formatValue` exported from `settingNode.ts`** — Shared by `SettingKeyValueNode` for consistent value rendering (nested objects as `{N keys}`, arrays as `[N items]`, null as `null`).
- **Object settings lose click-to-reveal** — `baseNode.applyClickCommand()` skips expandable nodes because the click gesture now expands/collapses; this was accepted as intentional.
- **Lock toggle command hiding** — `lockUserScope` and `unlockUserScope` remain palette-hidden; `toggleUserLock` stays the canonical palette entry from v0.3.

## Functionality delivered

- **Code added/modified**:
  - Created: `src/tree/nodes/settingKeyValueNode.ts`
  - Modified: `src/extension.ts`, `src/tree/nodes/settingNode.ts`, `package.json`

- **User-facing behavior**:
  - User scope starts locked on every activation; lock icon in toolbar reflects current state
  - Collapse All and Expand All toolbar buttons with predictable left-to-right order (lock, collapse, expand, filter)
  - Object-type settings open to reveal individual keys and formatted values as child nodes

## Audit outcome
7 of 7 requirements satisfied across all 3 phases (100%). All 5 cross-phase integration points pass — toolbar ordering (Phase 6 + 7), Expand All walking through SettingNode's Collapsed state (Phase 7 + 8), SettingKeyValueNode inheriting `isReadOnly` from locked scope (Phase 6 + 8), package.json consistency (all three phases), and activation sequence in `extension.ts` (Phase 6 + 7). Status at ship: **passed**. Non-blocking tech debt: REQUIREMENTS.md LOCK-12 wording uses pre-override action semantics (documentation only — implementation follows state semantics per user UAT), and Phase 7 VERIFICATION.md lists 6 manual testing items not yet executed.

## Lessons learned

- Lock-by-default is a higher-value default than lock-off — users lose nothing and avoid accidental writes to global config. Must call `lockScope` before the tree provider is constructed.
- State-semantic icons (icon = current state) match VS Code's own toggle conventions better than action-semantic icons (icon = action when clicked).
- Delegating to VS Code built-in commands (e.g., `workbench.actions.treeView.*.collapseAll`) keeps behavior consistent with the rest of the IDE at zero maintenance cost.
- When introducing expandable nodes, clear the description text — the expand arrow already signals expandability, and duplicating that information (`{N keys}`) creates visual noise.
- Exporting shared formatters from a base node file keeps value rendering consistent as new leaf types are added.
