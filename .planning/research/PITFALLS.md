# Pitfalls Research

**Domain:** VS Code extension — toolbar UX improvements (QuickPick multi-select filters, command removal, TreeView write protection)
**Researched:** 2026-02-18
**Confidence:** HIGH (VS Code API behaviors verified against official docs and tracked GitHub issues)

---

## Critical Pitfalls

### Pitfall 1: QuickPick `picked` Pre-selection Does Not Work with `createQuickPick`

**What goes wrong:**
When replacing toolbar icon buttons with a `createQuickPick` multi-select, developers set `picked: true` on `QuickPickItem` objects to pre-check the currently active filters. The checkmarks appear in the UI but the items are NOT actually in `selectedItems` — so the `onDidAccept` handler reads an empty array, discarding the current filter state.

**Why it happens:**
`QuickPickItem.picked` is a static hint designed for `window.showQuickPick()` only. The `createQuickPick()` API uses a reactive model where `selectedItems` is the source of truth. Setting `picked: true` on items does not populate `selectedItems` — it must be set explicitly on the `QuickPick` instance after items are assigned. This mismatch is a documented VS Code bug (issue #119834) that was closed without a code fix.

**How to avoid:**
After assigning `qp.items`, immediately set `qp.selectedItems` to the array of pre-checked items:
```typescript
const qp = vscode.window.createQuickPick<vscode.QuickPickItem>();
qp.canSelectMany = true;
qp.items = allSections.map(st => ({ label: SECTION_LABELS[st], id: st, picked: isActive(st) }));
// Critical: set selectedItems explicitly — picked: true alone does NOT work
qp.selectedItems = qp.items.filter(i => (i as any).picked);
qp.show();
```

**Warning signs:**
- QuickPick opens with checkmarks visible but `qp.selectedItems` is empty on first accept.
- Accepting with no changes resets all filters to "none selected."
- Pre-checked state is inconsistent between `showQuickPick` and `createQuickPick` code paths.

**Phase to address:**
Feature implementation phase — must be verified in the initial QuickPick prototype before wiring to filter state.

---

### Pitfall 2: `onDidAccept` Fires Before `onDidChangeSelection` Completes

**What goes wrong:**
With `canSelectMany = true`, if a user presses Enter immediately after toggling a checkbox, the `onDidAccept` handler reads `qp.selectedItems` before `onDidChangeSelection` has settled on the final selection. The last toggled item may be missing from the accepted selection.

**Why it happens:**
The VS Code QuickPick event pipeline does not guarantee that all queued `onDidChangeSelection` callbacks have been flushed before `onDidAccept` fires (documented in eclipse-theia/theia#6221 and VS Code issue #46587). The UI update and the event are decoupled.

**How to avoid:**
Track selection state in a separate variable updated by `onDidChangeSelection`, and read from that variable in `onDidAccept` instead of `qp.selectedItems`:
```typescript
let currentSelection: readonly vscode.QuickPickItem[] = qp.selectedItems;
qp.onDidChangeSelection(items => { currentSelection = items; });
qp.onDidAccept(() => {
  applyFilter(currentSelection); // safe — not qp.selectedItems
  qp.hide();
});
```

**Warning signs:**
- Intermittent filter reset when user presses Enter quickly after clicking a checkbox.
- Behavior differs in manual testing vs. automated tests (timing-dependent).
- Bug only reproduces with fast keyboard users; mouse-only users miss it.

**Phase to address:**
Feature implementation phase — add an explicit selection-tracking variable before wiring `onDidAccept`.

---

### Pitfall 3: QuickPick Instance Not Disposed — Listener Accumulation

**What goes wrong:**
Each call to `createQuickPick` registers event listeners (`onDidChangeSelection`, `onDidAccept`, `onDidHide`). If the QuickPick is not disposed after hiding, the listeners remain attached to the VS Code internal event bus. Opening the filter picker repeatedly (common with toolbar buttons) leaks listener instances, eventually causing duplicate filter applications per accept event.

**Why it happens:**
`qp.hide()` removes the UI but does NOT release internal event listeners. `qp.dispose()` is the only call that releases all resources. The official sample explicitly uses `qp.onDidHide(() => qp.dispose())` — omitting it is easy in prototypes.

**How to avoid:**
Always wire `onDidHide` to `dispose`:
```typescript
qp.onDidHide(() => qp.dispose());
```
Never reuse a disposed QuickPick instance — create a new one each time the command is invoked.

**Warning signs:**
- Filter applied multiple times per accept click (multiplies with each open/close cycle).
- Memory usage grows after repeatedly opening the QuickPick.
- `qp.show()` after `qp.dispose()` silently fails or opens a broken picker.

**Phase to address:**
Feature implementation phase — required from the first working implementation.

---

### Pitfall 4: Orphaned `setContext` Keys After Command Removal

**What goes wrong:**
The current filter system uses 9 `setContext` keys (`claudeConfig_filter_all`, `claudeConfig_filter_permissions`, etc.) to drive toolbar icon swapping via `when` clauses. When the toolbar filter commands are removed and replaced with a QuickPick approach, those `setContext` calls in `configTreeProvider.ts` become orphaned — the keys still exist in the VS Code context store after reload, causing the old `when` clauses in menu entries to evaluate against stale truthy values if any old package.json entries survive the cleanup.

**Why it happens:**
VS Code context keys set via `setContext` are global singletons within the extension host session. There is no VS Code API to delete or reset a context key. Keys persist until the extension host process restarts. During development, reloading the Extension Development Host resets them — so the issue is invisible in dev but real for users upgrading from an older version without restarting VS Code.

**How to avoid:**
- Remove all `setContext` calls for filter keys from `syncFilterContext()` at the same time the corresponding `when` clauses are removed from `package.json`.
- If any filter state needs to survive to a QuickPick approach, re-express it without `setContext` (e.g., store in extension state or keep in-memory only, triggering a tree refresh instead).
- After removal, audit `package.json` `when` clauses for any remaining references to `claudeConfig_filter_*` keys.

**Warning signs:**
- Toolbar buttons for removed commands still appear (or disappear incorrectly) after upgrading the extension.
- `when` clause references a context key that no longer has a corresponding `setContext` call.
- The `syncFilterContext()` method still exists after filter commands are removed (sign that cleanup is incomplete).

**Phase to address:**
Command removal phase — must be done atomically: remove `setContext` calls, remove `when` clauses, and remove command registrations in the same commit.

---

### Pitfall 5: Removing Commands Breaks User Keybindings Without Visible Error

**What goes wrong:**
If a user has manually bound any of the 16 filter commands (e.g., `claudeConfig.filter.permissions`) to a keyboard shortcut in their `keybindings.json`, removing those commands from `package.json` causes VS Code to silently ignore the keybinding. The user sees no error — the shortcut simply stops working. If any other extension or workspace setting references these commands, VS Code logs `command 'X' not found` in the Output console, which users rarely check.

**Why it happens:**
VS Code does not validate `keybindings.json` entries against installed extensions at runtime. When a command is unregistered, existing keybindings targeting it become dead references. The Command Palette does surface a "not found" message, but inline icon buttons and keybindings silently fail.

**How to avoid:**
- Deprecate commands before removing: mark them `when: false` in `commandPalette` (already done for filter commands) so they are invisible but still registered. Keep the handler as a no-op for one major version.
- If removal is required immediately (e.g., the commands are being replaced entirely), document the change in `CHANGELOG.md` under a breaking changes section.
- The current filter commands are already hidden from the Command Palette (`when: false` in `commandPalette` menu), so the user-facing impact is limited to anyone who discovered and manually bound them.

**Warning signs:**
- Extension version bump removes `commands` entries from `package.json` without a deprecation period.
- `CHANGELOG.md` has no mention of removed commands.
- The filter commands are registered in `extension.ts` (they currently are) — removal from `package.json` without removing from `extension.ts` creates a command registration with no contribution point (harmless but messy).

**Phase to address:**
Command removal phase — treat as a breaking API change even if the commands were toolbar-only.

---

### Pitfall 6: User Scope Lock Collides with Managed Scope's Permanent `isReadOnly`

**What goes wrong:**
The User scope lock feature toggles `isReadOnly` dynamically on a `ScopedConfig` object. The existing codebase treats `isReadOnly: true` on Managed scope as a permanent, file-system-enforced condition. If the lock toggle is implemented by mutating `ScopedConfig.isReadOnly` directly (or by a flag on `ConfigStore` that is checked in the same path), the Managed scope's read-only status could be accidentally toggled, or the User lock could be unintentionally cleared on `ConfigStore.reload()` because `reload()` rebuilds `ScopedConfig` objects from disk.

**Why it happens:**
`ScopedConfig.isReadOnly` is set during construction in `configModel.ts` based on scope identity (Managed is always `true`; others are `false`). There is no separate "user-requested lock" field — the same `isReadOnly` field drives both permanent and voluntary restrictions. If the lock state is stored only in the `ScopedConfig` instance and `ConfigStore.reload()` reconstructs `ScopedConfig` objects, the lock is lost on every file-watcher-triggered reload.

**How to avoid:**
Implement the User lock as a separate flag in `ConfigStore` that is:
1. Not part of `ScopedConfig` (which is a pure data object rebuilt on reload).
2. Checked alongside `ScopedConfig.isReadOnly` when computing `NodeContext.isReadOnly` for tree nodes.
3. Preserved across reloads (the flag lives in `ConfigStore`, not in a `ScopedConfig` instance).

Example approach:
```typescript
class ConfigStore {
  private _userScopeLocked = false;
  get userScopeLocked(): boolean { return this._userScopeLocked; }
  toggleUserLock(): void {
    this._userScopeLocked = !this._userScopeLocked;
    this._onDidChange.fire();
  }
}
```
Then in `ScopeNode` (or wherever `NodeContext.isReadOnly` is set):
```typescript
isReadOnly: scopedConfig.isReadOnly || (scope === ConfigScope.User && configStore.userScopeLocked)
```

**Warning signs:**
- Lock disappears when an external file change triggers the file watcher.
- Managed scope temporarily becomes editable (or User scope stays locked permanently) after `configStore.reload()`.
- The `isReadOnly` field of `ScopedConfig` is modified directly rather than derived at node construction time.

**Phase to address:**
Lock feature implementation phase — design the data model before writing any UI code.

---

## Moderate Pitfalls

### Pitfall 7: `contextValue` Change Requires `onDidChangeTreeData` Fire to Update Menu Visibility

**What goes wrong:**
When the User scope lock is toggled, the `ScopeNode` and all its child nodes need their `contextValue` updated from `*.editable` to `*.readOnly` (or vice versa). If `onDidChangeTreeData` is not fired immediately after the lock toggle, the inline edit/delete/move buttons remain visible on child nodes even though `isReadOnly` is now `true`.

**Why it happens:**
VS Code does not automatically re-evaluate `view/item/context` menu `when` clauses when a tree item's `contextValue` changes — it only re-renders affected nodes when `onDidChangeTreeData` fires. This is a known VS Code limitation (issue #140010, closed as fixed in VS Code 1.56+, but the fix requires the extension to trigger a refresh). Static `contextValue` strings set at node construction time are not reactive.

**How to avoid:**
The `ConfigStore.onDidChange` event already fires on any state mutation, and `ConfigTreeProvider.refresh()` already responds to it by clearing caches and firing `onDidChangeTreeData`. Ensure the lock toggle calls `configStore._onDidChange.fire()` (or uses the public emit method) so the existing refresh pipeline handles the re-render.

Do NOT try to update individual nodes in-place — fire a full `onDidChangeTreeData(undefined)` to invalidate all nodes under the affected scope.

**Warning signs:**
- Lock icon on ScopeNode updates immediately, but child nodes' inline buttons remain visible.
- Manual collapse/expand of the scope node makes the buttons disappear (forces re-render).
- The lock toggle command does not call `configStore.reload()` or `_onDidChange.fire()`.

**Phase to address:**
Lock feature implementation phase.

---

### Pitfall 8: Regex in `when` Clauses Is Not Standard JavaScript Regex

**What goes wrong:**
The existing `package.json` `when` clauses use regex patterns like `viewItem =~ /\.editable/` to match `contextValue` strings. When extending these patterns for the lock feature (e.g., distinguishing `scope.editable` from `scope.readOnly`), developers write patterns that work in JavaScript but fail silently in VS Code because the `when` clause parser uses a different escape ruleset.

**Why it happens:**
VS Code `when` clause regex literals require double-escaped special characters: a regex to match `file://` in JavaScript is `/file:\/\//` but in a `when` clause must be `/file:\\/\\//`. The VS Code parser also does not support `g` or `y` flags. Errors in `when` clause regex are not reported in the Output console — the condition simply evaluates to `false`, making menu items disappear silently.

**How to avoid:**
- Test all regex patterns in the VS Code Extension Development Host after every change to a `when` clause.
- Use simple substring patterns where possible (e.g., `viewItem =~ /readOnly/` not `/readOnly$/`).
- For the lock feature, add `userLocked` as a new `contextValue` segment and use plain substring matching rather than anchored patterns.
- Validate `package.json` with the VS Code extension packaging tool (`vsce package`) which parses manifests.

**Warning signs:**
- Context menu items disappear after adding a new `when` clause that contains regex.
- Pattern works when tested in a JS REPL but the menu item never shows in VS Code.
- The `when` clause contains `\.` or `\/` without double-escaping.

**Phase to address:**
Both command removal phase and lock feature implementation phase.

---

### Pitfall 9: QuickPick Filter State Is Not Persisted Across VS Code Sessions

**What goes wrong:**
When filter state moves from toolbar toggle buttons (persistent visual state via `setContext`) to a QuickPick modal, the selected filters are reset every time VS Code restarts or the extension is reloaded. Users who set a permanent "show only MCP Servers" filter lose that preference on restart.

**Why it happens:**
The current icon-swap approach stores filter state in `ConfigTreeProvider._sectionFilter` (in-memory) and reflects it via `setContext` — neither is persisted. The QuickPick approach has the same issue unless the filter state is explicitly written to extension storage (`ExtensionContext.globalState` or `workspaceState`).

**How to avoid:**
Decide explicitly whether filter state should persist. If yes, store active filters in `context.globalState` on each filter change and restore them during `activate()`. If no, document this as intentional. Do not assume the QuickPick approach is regression-equivalent to the toolbar approach without checking persistence behavior.

**Warning signs:**
- Filter preference is lost after reloading the extension (F5 in dev, or after VS Code update).
- The QuickPick opens with nothing pre-selected even when the user set a filter in the previous session.

**Phase to address:**
Feature design phase — decide persistence policy before implementation.

---

### Pitfall 10: Lock Toggle Command Not Excluded from `commandPalette`

**What goes wrong:**
The new "Toggle User Lock" command appears in the VS Code Command Palette, allowing users to invoke it without a selected tree node. Because the command handler checks `node.nodeContext`, calling it from the palette (where `node` is `undefined`) silently does nothing — but it creates a confusing entry in the palette that does not match user expectations.

**Why it happens:**
By convention (already established in this codebase), commands that are tree-node-specific are hidden from the palette with `"when": "false"` in the `commandPalette` menu. New commands added by a developer unfamiliar with this convention will appear in the palette by default.

**How to avoid:**
Add the lock toggle command to the `commandPalette` menu section in `package.json` with `"when": "false"`. This follows the pattern already used by `claudeConfig.editValue`, `claudeConfig.deleteItem`, `claudeConfig.moveToScope`, etc.

**Warning signs:**
- A new command ID appears in `package.json` `commands` section but is missing from the `commandPalette` menu section.
- The `when` clause for the command in `view/title` or `view/item/context` references a tree-node context, but no corresponding `commandPalette` suppression exists.

**Phase to address:**
Lock feature implementation phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse `ScopedConfig.isReadOnly` for User lock | Simpler code — one field | Lock resets on every `configStore.reload()` call (file watcher trigger) | Never — creates a silent data loss |
| Use `qp.selectedItems` directly in `onDidAccept` | Less boilerplate | Intermittent missed selection on fast keyboard input | Never — timing bug is non-deterministic |
| Skip `qp.onDidHide(() => qp.dispose())` | One fewer line | Listener accumulation per QuickPick open/close cycle | Never for production code |
| Leave orphaned `setContext` calls after command removal | Less refactoring | Stale context keys interfere with any future `when` clauses using similar key names | Never — remove atomically |
| Keep both `.filter.X` and `.filter.X.active` commands during transition | Backward compatibility | Two dead command registrations confuse future developers | Acceptable for one release cycle only |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `createQuickPick` + pre-selection | Set `picked: true` on items and expect `selectedItems` to be populated | Set `qp.selectedItems = items.filter(i => i.picked)` explicitly after `qp.items = items` |
| `setContext` + command removal | Remove command registrations but leave `setContext` calls | Remove both atomically; audit all `when` clauses referencing removed keys |
| `contextValue` + lock toggle | Mutate node properties in-place without re-firing `onDidChangeTreeData` | Toggle lock in `ConfigStore`, which fires `onDidChange`, which triggers `ConfigTreeProvider.refresh()` |
| `view/item/context` menu + `enablement` | Use `command.enablement` to grey out buttons dynamically | Use `contextValue` substring matching in `when` clauses — `enablement` in tree item context is buggy (VS Code issue #110421) |
| Lock + Managed scope `isReadOnly` | Check only `nodeContext.isReadOnly` which conflates permanent and voluntary locks | Use a separate `configStore.userScopeLocked` flag; node context assembles final `isReadOnly` from both sources |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full tree refresh on every lock toggle | Tree flickers and scrolls to top on each lock/unlock | The existing `refresh()` path clears caches and fires a full tree rebuild — acceptable for infrequent lock toggles | Not a scalability concern at this extension's scale, but noticeable if toggle is animated |
| `syncFilterContext()` called on each `setContext` | 9 async `executeCommand('setContext', ...)` calls per filter toggle | If filter toolbar is replaced by QuickPick, remove `syncFilterContext()` entirely — it becomes dead weight | Negligible performance impact but is dead code after removal |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| QuickPick closes on Escape without preserving previous filter | User clicks lock icon accidentally, hits Escape, loses filter state | Capture filter state before showing QuickPick; restore on `onDidHide` if `onDidAccept` was not called |
| Lock icon position inconsistent with other toolbar icons | User expects lock to be near the scope it protects (tree item level) | Add lock toggle to `view/title` toolbar (consistent with Refresh position) OR as a `view/item/context` inline button on the User `ScopeNode` specifically |
| "Show All Sections" button replaced by QuickPick with no visible count | User cannot tell how many filters are active at a glance | Add a description to the toolbar button (e.g., "Filters (2/7)") or use a badge; QuickPick title can show current count |
| Managed scope shows no lock icon when User scope is locked | Users confused about which scope is the bottleneck | Use a distinct icon or description on User scope node when locked; Managed scope's lock is permanent and needs no toggle |

---

## "Looks Done But Isn't" Checklist

- [ ] **QuickPick pre-selection:** Verify `qp.selectedItems` is explicitly set — not just `picked: true` on items. Test by toggling one filter, closing the picker, reopening it, and confirming the correct items are pre-checked.
- [ ] **QuickPick disposal:** Verify `qp.onDidHide(() => qp.dispose())` is wired. Test by opening the filter picker 10 times and checking the `Output` channel for errors or duplicate filter applications.
- [ ] **Lock survives reload:** Verify lock state persists across a file-watcher-triggered `configStore.reload()`. Test by locking User scope, then editing a config file externally (triggers reload), and confirming the lock is still shown.
- [ ] **Lock does not affect Managed scope:** Verify `ConfigScope.Managed` nodes remain `isReadOnly: true` regardless of `userScopeLocked` flag. Check all edit/delete/move commands reject Managed scope nodes.
- [ ] **Removed commands gone from `commandPalette`:** After removing filter commands, run `vsce package` and inspect the bundled `package.json` — confirm no `claudeConfig.filter.*` entries remain in `commands` or `menus.view/title`.
- [ ] **Orphaned `setContext` calls removed:** Search for `claudeConfig_filter_` in `src/` after removal — zero results expected.
- [ ] **Lock command hidden from palette:** Verify the lock toggle command has `"when": "false"` in `commandPalette`. Test by opening Command Palette and typing the command ID — it should not appear.
- [ ] **`when` clause regex double-escaping:** After any `package.json` edit, test each new `when` clause in the Extension Development Host and confirm the correct menu items appear/hide.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| QuickPick pre-selection bug in released version | LOW | One-line fix: add `qp.selectedItems = qp.items.filter(i => (i as any).picked)` after items assignment; release patch version |
| Orphaned `setContext` keys causing toolbar artifacts | LOW | Remove `setContext` calls in a patch; context resets on VS Code restart or extension reload |
| Lock state lost on reload (wrong data model) | HIGH | Refactor `ConfigStore` to hold lock state separately; update all node constructors to read from store; retrigger refresh |
| Lock accidentally toggles Managed scope | MEDIUM | Add explicit `if (scope === ConfigScope.Managed) return;` guard in toggle command handler |
| Removed commands break user keybindings | LOW–MEDIUM | Cannot be fixed server-side; document in CHANGELOG; provide migration instructions; consider re-registering command as a no-op for one version |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| QuickPick `picked` pre-selection (P1) | QuickPick implementation | Open filter picker, confirm pre-checks match active filters |
| `onDidAccept` timing (P2) | QuickPick implementation | Rapid keyboard test: toggle + Enter within 50ms |
| QuickPick not disposed (P3) | QuickPick implementation | Open/close picker 20x; check for duplicate filter applications |
| Orphaned `setContext` keys (P4) | Command removal | `grep -r "claudeConfig_filter_" src/` returns 0 results |
| Command removal breaks keybindings (P5) | Command removal | Review CHANGELOG for breaking change documentation |
| Lock vs. Managed `isReadOnly` collision (P6) | Lock feature data model design | Unit test: lock User scope, verify Managed scope child nodes still `isReadOnly: true` |
| `contextValue` stale after lock toggle (P7) | Lock feature UI wiring | Toggle lock; confirm child node inline buttons update without expand/collapse |
| `when` clause regex escaping (P8) | Both phases — any `package.json` edit | Manual test in Extension Development Host after each `package.json` change |
| Filter state not persisted (P9) | Feature design decision | Reload extension; confirm filter state behavior matches documented policy |
| Lock command in Command Palette (P10) | Lock feature implementation | Open Command Palette; search for lock command ID; it should not appear |

---

## Sources

- [VS Code QuickPick UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/quick-picks) — official UX guidance
- [VS Code issue #119834 — QuickPickItem.picked does not work with createQuickPick](https://github.com/microsoft/vscode/issues/119834) — confirmed bug, no code fix
- [VS Code issue #103084 — Using picked in QuickPick does not pre-select](https://github.com/microsoft/vscode/issues/103084) — duplicate confirmation
- [eclipse-theia/theia issue #6221 — QuickPick onDidChangeSelection fires after onDidAccept](https://github.com/eclipse-theia/theia/issues/6221) — event ordering issue
- [VS Code quickinput-sample — official dispose pattern](https://github.com/microsoft/vscode-extension-samples/blob/main/quickinput-sample/src/extension.ts) — `onDidHide(() => dispose())` pattern
- [VS Code issue #140010 — when clause for view/item/context not auto-reevaluated](https://github.com/microsoft/vscode/issues/140010) — requires `onDidChangeTreeData` to refresh menu visibility
- [VS Code issue #110421 — Command enablement buggy with tree items](https://github.com/microsoft/vscode/issues/110421) — use `contextValue` + `when` clauses, not `enablement`
- [VS Code when clause contexts reference](https://code.visualstudio.com/api/references/when-clause-contexts) — regex escaping rules
- Project codebase: `src/tree/nodes/baseNode.ts` — existing `contextValue` pattern (`{nodeType}.{editable|readOnly}[.overridden]`)
- Project codebase: `.planning/codebase/CONCERNS.md` — existing technical debt inventory

---
*Pitfalls research for: VS Code extension toolbar UX improvements (QuickPick filter, command removal, TreeView write protection)*
*Researched: 2026-02-18*
