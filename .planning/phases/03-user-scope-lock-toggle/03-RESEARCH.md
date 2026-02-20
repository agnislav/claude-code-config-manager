# Phase 3: User Scope Lock Toggle — Research

**Researched:** 2026-02-19
**Domain:** VS Code TreeView contextValue patterns, FileDecorationProvider, setContext, inline tree item actions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Blocked action feedback
- Locked User scope behaves like Managed scope: context menus for write actions (edit, delete, add) are hidden via `contextValue` read-only pattern — no menus appear, not "shown but blocked"
- If someone triggers an edit command via Command Palette on a locked item, show a brief info message: "User scope is currently locked. Click the lock icon in the toolbar to unlock." (helpful hint tone with actionable guidance)
- No modal dialogs — just `vscode.window.showInformationMessage()`

#### Lock discoverability
- **Unlocked (default):** No lock icon on the User scope node. `$(lock)` inline hover button on the User scope tree item (click to lock)
- **Locked:** `$(lock)` icon NOT added to node (keep original scope icon). `$(unlock)` inline hover button on the User scope tree item (click to unlock). User scope node text is dimmed via FileDecorationProvider
- Icon reflects current state, not available action: `$(unlock)` = unlocked, `$(lock)` = locked
- Tooltip on inline buttons: "User scope: unlocked (click to lock)" / "User scope: locked (click to unlock)"
- **Placement:** Inline action on User scope tree item (`view/item/context` with `group: "inline"`), NOT a toolbar button. Lock icon only appears when hovering over the User scope row.

#### Move/copy locked behavior
- User scope shown in target scope picker with `$(lock)` prefix: "$(lock) User" — not filtered out
- If user selects locked User scope as target: show info message "User scope is locked" and cancel the operation
- **Move FROM locked User scope:** Blocked (move deletes from source = write operation)
- **Copy FROM locked User scope:** Allowed (copy is non-destructive)
- **Move/copy TO locked User scope:** Blocked

#### Scope indicator in tree
- When locked: User scope node text is dimmed via FileDecorationProvider (same mechanism Git uses for deleted files)
- Dimming applies to the scope node only, not children
- No '(locked)' description text — dim color alone is sufficient
- Original scope icon is preserved (no icon replacement)
- Child nodes under locked User scope: no visual change

### Claude's Discretion
- Exact ThemeColor for dimmed state (should match VS Code's existing "ignored" or "disabled" color conventions)
- FileDecorationProvider implementation details (resourceUri scheme, decoration caching)
- Exact wording of Command Palette lock message beyond the agreed tone
- How to handle edge case: locking while a User scope edit is in progress

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOCK-01 | Lock toggle command registered as `claudeConfig.toggleUserLock` | Standard `vscode.commands.registerCommand`; needs entry in `contributes.commands` and `commandPalette` deny-list entry. CONTEXT overrides LOCK-02: inline button, not toolbar. |
| LOCK-02 | Dual icon-swap on toolbar — `$(unlock)` when unlocked, `$(lock)` when locked — via `setContext` + `when` clauses | **CONTEXT.md OVERRIDES THIS**: placement is inline on User scope tree item, not toolbar. Two `view/item/context` inline entries with mutually exclusive `when` clauses on scope+lock state replace the toolbar approach. `setContext` is still required to drive the `when` clauses. |
| LOCK-03 | When locked, User scope tree items remain fully visible with all context menus present | **CONTEXT.md OVERRIDES THIS**: write action context menus are HIDDEN (not shown) when locked. User scope items show only read-only menus, same as Managed scope. `contextValue` read-only pattern in `baseNode.computeContextValue()` already handles this. |
| LOCK-04 | When locked, User scope is disabled/unselectable in move-to-scope and copy-to-scope QuickPick dialogs | **CONTEXT.md OVERRIDES THIS**: User scope IS shown in picker but with `$(lock)` prefix label; selection is allowed but triggers an info message and cancels. For MOVE FROM locked User: blocked. For COPY FROM locked User: allowed. |
| LOCK-05 | When locked, direct edits (edit value, delete, add) on User scope items are blocked with informative message | CONTEXT: blocking via hidden context menus (contextValue read-only pattern). Command Palette path blocked with `showInformationMessage`. Message text: "User scope is currently locked. Click the lock icon in the toolbar to unlock." |
| LOCK-06 | Lock state lives in `ConfigStore._lockedScopes: Set<ConfigScope>` — survives file watcher reloads | File watcher calls `configStore.reload()` which rebuilds `ScopedConfig` objects from disk; `_lockedScopes` is a separate field not rebuilt by `reload()`, so it naturally survives. |
| LOCK-07 | Lock state propagated to tree nodes via `effectiveReadOnly` shallow-clone pattern on `ScopedConfig` | In `configTreeProvider.getSingleRootChildren()` and `getMultiRootChildren()`, compute `effectiveReadOnly` before passing to `ScopeNode`; shallow-clone `ScopedConfig` with `isReadOnly: scopedConfig.isReadOnly || configStore.isScopeLocked(scope)`. |
| LOCK-08 | `contextValue` of User scope nodes includes lock segment for conditional menu visibility via `when` clauses | `baseNode.computeContextValue()` already computes `{nodeType}.{editable|readOnly}[.overridden]`. No new segment needed — lock propagation via LOCK-07 makes the scope's `isReadOnly: true`, which causes `computeContextValue()` to emit `readOnly` automatically. Inline lock/unlock buttons need a `scope.user` segment in ScopeNode's contextValue to be targetable. |
| LOCK-09 | Lock state is ephemeral — resets to unlocked on VS Code session start | `_lockedScopes` initialized as empty `Set` in `ConfigStore` constructor; never written to `context.globalState` or `context.workspaceState`. |
| LOCK-10 | `onDidChangeTreeData` fires after lock toggle to refresh tree node states | `configStore.lockScope()` and `configStore.unlockScope()` must emit `configStore.onDidChange`; `ConfigTreeProvider` subscribes to `onDidChange` and calls `this.refresh()` which fires `_onDidChangeTreeData`. |
</phase_requirements>

---

## Summary

Phase 3 adds a session-scoped lock on the User scope. When locked, the User scope's tree nodes become read-only (context menus for write actions disappear) by threading `isReadOnly: true` through the shallow-cloned `ScopedConfig` that reaches `ScopeNode` and all its descendants. The lock state lives in `ConfigStore._lockedScopes: Set<ConfigScope>` — it is initialized empty on construction, never persisted, and never rebuilt by `reload()`, so file-watcher reloads leave it intact.

The user-visible affordances are: (a) a dimmed User scope label via `FileDecorationProvider` using a custom URI scheme; (b) two mutually exclusive inline buttons on the User scope tree item — `$(lock)` when unlocked (click to lock), `$(unlock)` when locked (click to unlock) — controlled by a `setContext` key `claudeConfig_userScope_locked`; (c) an info message on any Command Palette write attempt against a locked User scope item; and (d) in the move/copy QuickPick, the locked User scope appears with a `$(lock)` prefix but selecting it as a write target shows an info message and cancels.

**CRITICAL DISCREPANCY:** LOCK-02 in REQUIREMENTS says "toolbar icon-swap" but CONTEXT.md (locked decisions) says "inline button on the User scope tree item, NOT a toolbar button." CONTEXT.md decisions take precedence per the research protocol. The planner must use `view/item/context` with `group: "inline"` for the lock buttons, not `view/title`. The `setContext` mechanism is still required because the two inline entries need mutually exclusive `when` clauses.

**Primary recommendation:** Implement lock buttons as `view/item/context` inline actions on the User scope node using two `when`-clause variants (locked vs unlocked), not as `view/title` toolbar buttons. Use `effectiveReadOnly` shallow-clone in `configTreeProvider` to propagate read-only state to all descendant nodes without modifying any node class. Use an `EventEmitter`-backed `FileDecorationProvider` with a custom URI scheme on `ScopeNode` to dim the locked scope label.

---

## Standard Stack

### Core

| Artifact | Location | Purpose | Notes |
|----------|----------|---------|-------|
| `ConfigStore` | `src/config/configModel.ts` | Holds lock state, emits change events | Add `_lockedScopes`, `lockScope`, `unlockScope`, `isScopeLocked` |
| `ConfigTreeProvider` | `src/tree/configTreeProvider.ts` | Computes `effectiveReadOnly` before creating `ScopeNode` | Shallow-clone `ScopedConfig` here |
| `ScopeNode` | `src/tree/nodes/scopeNode.ts` | Sets `resourceUri` for lock dimming decoration | Set custom URI when User scope |
| `baseNode.computeContextValue()` | `src/tree/nodes/baseNode.ts` | `readOnly` segment in contextValue hides write menus | No change needed — flows naturally from `isReadOnly` |
| `extension.ts` | `src/extension.ts` | Registers `claudeConfig.toggleUserLock`, calls `setContext` | New command registration |
| `package.json` | project root | `contributes.commands`, `view/item/context` inline entries, `commandPalette` deny-list | Two inline entries with `when` clauses |
| `LockDecorationProvider` | `src/tree/nodes/scopeNode.ts` or new `src/tree/lockDecorations.ts` | FileDecorationProvider for User scope dimming | Needs `EventEmitter`-backed `onDidChangeFileDecorations` |
| `moveCommands.ts` | `src/commands/moveCommands.ts` | Move/copy lock-aware scope picker | Modify to add `$(lock)` label prefix and block write targets |
| `editCommands.ts`, `deleteCommands.ts`, `addCommands.ts` | `src/commands/` | Command Palette path guard | Check `nodeContext.isReadOnly`, show info message |

### No New Dependencies

All implementation uses existing VS Code APIs. No npm packages added.

---

## Architecture Patterns

### Recommended Change Locations

```
src/
├── config/configModel.ts        # Add _lockedScopes, lockScope, unlockScope, isScopeLocked
├── tree/
│   ├── configTreeProvider.ts    # effectiveReadOnly shallow-clone in getSingleRootChildren/getMultiRootChildren
│   ├── nodes/scopeNode.ts       # Set resourceUri on User scope node for decoration
│   └── lockDecorations.ts       # (new) LockDecorationProvider — or co-locate in scopeNode.ts
├── commands/
│   ├── moveCommands.ts          # Lock-aware scope picker: $(lock) prefix, write-target guard
│   ├── editCommands.ts          # Command Palette path: showInformationMessage when isReadOnly
│   ├── deleteCommands.ts        # Command Palette path: showInformationMessage when isReadOnly
│   └── addCommands.ts           # Command Palette path: showInformationMessage when isReadOnly
└── extension.ts                 # Register claudeConfig.toggleUserLock, wire LockDecorationProvider
```

### Pattern 1: Lock State in ConfigStore

**What:** `_lockedScopes` is a `Set<ConfigScope>` field initialized in the constructor (empty). `reload()` rebuilds configs from disk but does not touch `_lockedScopes`. Lock/unlock methods emit `onDidChange` to trigger tree refresh.

**When to use:** Any time the tree needs to know if a scope is locked.

```typescript
// Source: direct codebase analysis (configModel.ts)
private _lockedScopes: Set<ConfigScope> = new Set();

lockScope(scope: ConfigScope): void {
  this._lockedScopes.add(scope);
  this._onDidChange.fire(undefined);
}

unlockScope(scope: ConfigScope): void {
  this._lockedScopes.delete(scope);
  this._onDidChange.fire(undefined);
}

isScopeLocked(scope: ConfigScope): boolean {
  return this._lockedScopes.has(scope);
}
```

Why `_onDidChange.fire(undefined)` and not a scoped key? The existing pattern fires `undefined` for full tree refreshes (file watcher full reload fires `undefined`; scoped reloads fire the workspace folder key). Lock toggles affect the whole tree display, so `fire(undefined)` is correct — it causes `ConfigTreeProvider.refresh()` to clear caches and rebuild.

### Pattern 2: effectiveReadOnly Shallow-Clone in ConfigTreeProvider

**What:** Before passing a `ScopedConfig` to `ScopeNode`, check if the scope is locked. If locked, create a shallow clone with `isReadOnly: true`. The clone flows to all child node constructors via `ScopeNode.getChildren()` → `SectionNode` → leaf nodes. No child class needs to know about locking.

**When to use:** In `getSingleRootChildren()` and `getMultiRootChildren()` where `ScopeNode` is constructed.

```typescript
// Source: direct codebase analysis (configTreeProvider.ts getSingleRootChildren)
private getSingleRootChildren(): ConfigTreeNode[] {
  const keys = this.configStore.getWorkspaceFolderKeys();
  if (keys.length === 0) return [];

  const key = keys[0];
  const allScopes = this.configStore.getAllScopes(key);

  return allScopes
    .filter((s) => s.scope !== ConfigScope.Managed)
    .map((scopedConfig) => {
      const effectiveReadOnly = scopedConfig.isReadOnly || this.configStore.isScopeLocked(scopedConfig.scope);
      const effective: ScopedConfig = effectiveReadOnly !== scopedConfig.isReadOnly
        ? { ...scopedConfig, isReadOnly: effectiveReadOnly }
        : scopedConfig;
      return new ScopeNode(effective, allScopes, key, this._sectionFilter);
    });
}
```

Key point: `allScopes` (the second arg to `ScopeNode`) is passed unmodified — it is used by child nodes for override resolution and must reflect the real configs, not the effective read-only state.

### Pattern 3: Inline Lock/Unlock Buttons via contextValue + when Clauses

**What:** Two `view/item/context` entries in `package.json`, both with `group: "inline"`, one shown when unlocked and one when locked. The `when` clause differentiates them using both the tree item's `contextValue` (scope.user) and the global context key `claudeConfig_userScope_locked`.

**When to use:** This is the only supported way to show different icons on the same tree item based on dynamic state without rebuilding the tree.

```json
// Source: VS Code Extension API docs + existing package.json patterns
{
  "command": "claudeConfig.toggleUserLock",
  "when": "view == claudeConfigTree && viewItem =~ /^scope\\.user/ && !claudeConfig_userScope_locked",
  "group": "inline@0",
  "title": "Lock User scope",
  "icon": "$(lock)"
},
{
  "command": "claudeConfig.toggleUserLock",
  "when": "view == claudeConfigTree && viewItem =~ /^scope\\.user/ && claudeConfig_userScope_locked",
  "group": "inline@0",
  "title": "Unlock User scope",
  "icon": "$(unlock)"
}
```

The SAME command `claudeConfig.toggleUserLock` is used for both entries — it toggles based on current state. The command needs `icon` specified in `contributes.commands` for toolbar use; for inline `view/item/context` use, the icon on the menu entry itself is what matters (VS Code uses the menu entry's icon for inline display).

**IMPORTANT:** For `view/item/context` inline entries to show an icon, the command must have an `"icon"` in `contributes.commands` OR the menu entry contributes the icon inline. Current VS Code practice: the `"icon"` in `contributes.commands` is used. Both `$(lock)` and `$(unlock)` come from the same command — since only one entry is visible at a time (via `when` clauses), one icon definition in `contributes.commands` is insufficient. The standard approach is to register **two separate commands**: one for lock, one for unlock, each with its own icon. They both call the same underlying toggle logic.

**Revised approach:**
- `claudeConfig.lockUserScope` with `"icon": "$(lock)"` — shows when unlocked
- `claudeConfig.unlockUserScope` with `"icon": "$(unlock)"` — shows when locked
- Both can share the same handler logic via a common helper in `extension.ts`
- OR: One command `claudeConfig.toggleUserLock` but the command's icon is set to `$(lock)` (the "current state" icon), and the inline `when` clause determines which variant shows — this requires two separate command IDs in `contributes.commands` to get two different icons.

**Confirmed approach (from existing codebase precedent — filter buttons):** The filter section already uses two separate commands (`claudeConfig.filterSections` with `$(filter)` and `claudeConfig.filterSections.active` with `$(filter-filled)`) shown in `view/title` with mutually exclusive `when` clauses. Apply same two-command pattern here for inline lock/unlock.

### Pattern 4: FileDecorationProvider for Dimming

**What:** The existing `PluginDecorationProvider` (in `pluginNode.ts`) is the reference. It uses `onDidChangeFileDecorations = undefined` because plugin enable/disable state is encoded in the `resourceUri` query string at node construction time. For the lock decoration, state changes dynamically (lock toggle after tree is built), so we need an `EventEmitter`-backed `onDidChangeFileDecorations` to notify VS Code to re-query decorations.

**When to use:** User scope node must set `this.resourceUri` to a custom URI encoding the scope. When lock state changes, the `LockDecorationProvider` fires its emitter with the User scope URI.

```typescript
// Source: direct codebase analysis (pluginNode.ts reference) + VS Code API docs
export const LOCK_URI_SCHEME = 'claude-config-lock';

export class LockDecorationProvider implements vscode.FileDecorationProvider {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  notifyLockChange(scope: ConfigScope): void {
    const uri = vscode.Uri.from({ scheme: LOCK_URI_SCHEME, path: `/${scope}` });
    this._onDidChangeFileDecorations.fire([uri]);
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== LOCK_URI_SCHEME) return undefined;
    // The query encodes lock state: 'locked' or 'unlocked'
    if (uri.query === 'locked') {
      return { color: new vscode.ThemeColor('disabledForeground') };
    }
    return undefined;
  }
}
```

**ThemeColor recommendation:** Use `'disabledForeground'` — already used throughout this codebase for "inactive" state (overridden items, disabled plugins, overridden settings). This is the project's established convention and matches VS Code's "disabled" appearance pattern. The decision note says "should match VS Code's existing 'ignored' or 'disabled' color conventions" — `disabledForeground` is the existing codebase standard and satisfies this.

**Alternative considered:** `'gitDecoration.ignoredResourceForeground'` — this is what Git uses for gitignored files in the Explorer. It is more semantically "ignored" than "disabled," but it is not used anywhere in this codebase and may vary more across themes. Not recommended.

**Decoration caching approach:** Encode lock state in the `resourceUri.query` string at `ScopeNode` construction time (same as `PluginNode` pattern). When lock state changes and tree is refreshed (`onDidChange` → `refresh()` clears caches → `ScopeNode` is reconstructed with new `resourceUri.query`), the `FileDecoration` is naturally updated via the new URI. The `EventEmitter`-backed approach (firing the emitter without tree refresh) is an optimization to dim the node without a full tree rebuild — but since lock toggle already triggers `configStore.onDidChange` which triggers `treeProvider.refresh()`, the decoration will update anyway. The `EventEmitter` is not strictly required if `refresh()` always reconstructs `ScopeNode`.

**Simpler implementation:** Because lock toggle fires `configStore.onDidChange` → `treeProvider.refresh()` → tree fully rebuilds → `ScopeNode` reconstructed with `resourceUri.query = 'locked'` → `provideFileDecoration()` called by VS Code for new URI — `onDidChangeFileDecorations = undefined` works (same as `PluginDecorationProvider`). Lock state is baked into the URI at construction time.

### Pattern 5: Command Palette Guard in Command Handlers

**What:** Each write command handler (`editValue`, `deleteItem`, `addPermissionRule`, etc.) already checks `if (isReadOnly || !filePath) return`. When User scope is locked and `effectiveReadOnly` is threaded correctly (LOCK-07), `nodeContext.isReadOnly` will be `true` for locked User scope nodes. The existing guard already blocks the operation. The only missing piece is changing the fallback message from `showWarningMessage('This setting is read-only.')` / `'Cannot delete read-only items.'` to `showInformationMessage('User scope is currently locked. Click the lock icon in the toolbar to unlock.')` when the blocked reason is the lock.

**Challenge:** The existing `isReadOnly` check doesn't distinguish "Managed scope (always read-only)" from "User scope (lock-temporarily-read-only)". To show the helpful lock message, the handler needs to know which. Two approaches:

1. **Pass scope to handlers:** Check `node.nodeContext.scope === ConfigScope.User && isReadOnly` to infer it's a lock (Managed is filtered differently). But this conflates reasons — if Managed scope were somehow triggered, it would show the wrong message.
2. **Add `isLocked` to `NodeContext`:** Add an optional `isLocked?: boolean` to `NodeContext` and thread it through when `effectiveReadOnly` is from the lock. This is the cleanest differentiation.
3. **Check scope in handler:** `if (isReadOnly && node.nodeContext.scope === ConfigScope.User) { showInformationMessage(lockMessage) } else { showWarningMessage(readOnlyMessage) }`. Simple and correct for this extension's scope set.

**Recommended approach:** Option 3 (check scope in handler). No new fields required, minimal change, correct for all current scope types. The Managed scope is never the target of Command Palette write commands in practice (it's hidden from most menus already). If User scope is read-only, it's because it's locked.

### Pattern 6: Move/Copy Lock-Aware Scope Picker

**What:** The CONTEXT.md decision says:
- Show locked User scope in picker with `$(lock)` prefix
- Selecting locked User scope as write target: show info message, cancel
- Move FROM locked User: blocked (move is a write)
- Copy FROM locked User: allowed

Current `moveCommands.ts` line 42-44 filters targets: `allScopes.filter((s) => s.scope !== scope && !s.isReadOnly)`. With `effectiveReadOnly` approach, locked User scope will have `isReadOnly: true` in the `allScopes` array? No — `allScopes` is passed unmodified from `configStore.getAllScopes()` (the original, not shallow-cloned). The shallow-clone is only done in `ConfigTreeProvider` for tree display.

**Implementation:** `moveCommands.ts` must call `configStore.isScopeLocked(s.scope)` directly to build the picker:

```typescript
// For target scope picker in moveToScope:
const targetScopes = allScopes.filter((s) => s.scope !== scope);
// Include all non-Managed scopes, including locked User scope (shown with lock prefix)

const pickItems = targetScopes.map((s) => {
  const locked = configStore.isScopeLocked(s.scope);
  const label = locked ? `$(lock) ${SCOPE_LABELS[s.scope]}` : SCOPE_LABELS[s.scope];
  return { label, description: s.filePath ?? '', value: s, isLocked: locked };
});

const pick = await vscode.window.showQuickPick(pickItems, { placeHolder: 'Move to which scope?' });
if (!pick) return;

if (pick.isLocked) {
  vscode.window.showInformationMessage('User scope is locked.');
  return;
}
```

**Move FROM locked User:** The handler already checks `if (isReadOnly || !filePath)` at the top — this check uses `nodeContext.isReadOnly` which is `true` when User is locked (from effectiveReadOnly threading). This blocks the move. Change the error message to the lock info message when `scope === ConfigScope.User`.

**Copy FROM locked User:** The CONTEXT says copy is non-destructive and allowed. `copySettingToScope` and `copyPermissionToScope` do NOT delete from source. Their `isReadOnly` check at the top (`if (isReadOnly || !filePath)`) would block copy if User scope is locked via `effectiveReadOnly`. This is a problem. Resolution: copy commands must NOT use the `effectiveReadOnly` path to block. Options:
- Don't block copy in the `isReadOnly` guard — instead, check `configStore.isScopeLocked()` directly and allow copy regardless.
- Or: remove the `isReadOnly` check from copy handlers entirely (copy is always safe from a read-only source, since it doesn't modify the source).

**Recommended:** In copy command handlers, replace `if (isReadOnly || !filePath)` with `if (!filePath)` only. The read-only check on source is inappropriate for copy — you should be able to copy from Managed scope too. This is a pre-existing bug the lock feature exposes.

### Anti-Patterns to Avoid

- **Adding lock-specific fields to `ScopedConfig`:** Don't add `isLocked` to `ScopedConfig`. Lock state belongs in `ConfigStore`. The `effectiveReadOnly` shallow-clone at the `ConfigTreeProvider` layer is the right boundary — keep the config model free of UI concerns.
- **Checking lock state in leaf node constructors:** All leaf nodes (`PermissionRuleNode`, `EnvVarNode`, etc.) receive `scopedConfig.isReadOnly` and use it for `contextValue`. They don't need to know about locking — the shallow-clone propagates `isReadOnly: true` transitively.
- **Using `view/title` for lock buttons:** CONTEXT.md explicitly says inline on the User scope tree item, not toolbar. This is a locked decision. The inline approach associates the lock visually with the scope it controls.
- **Using `onDidChangeFileDecorations` emitter without tree refresh:** The simpler path (encode lock state in `resourceUri` query at construction time) works because lock toggle always triggers a tree refresh. Avoid the emitter complexity.
- **Filtering locked User scope out of move/copy picker entirely:** CONTEXT.md says show it with `$(lock)` prefix, not hide it. The user sees it and gets feedback when they select it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scope label dimming | Custom tree item label renderer | `FileDecorationProvider` + `resourceUri` | VS Code's built-in mechanism; already used by `PluginDecorationProvider` in this codebase |
| Dynamic button icon swap | Rebuilding the tree with different icons | Two separate commands + `setContext` + mutually exclusive `when` clauses | VS Code's established pattern; used for filter button already (`claudeConfig.filterSections` / `claudeConfig.filterSections.active`) |
| Lock persistence | `workspaceState.update()` | Nothing (ephemeral in-memory `Set`) | LOCK-09 requires no persistence. Any persistence would require cleanup on restart. |
| Deep-clone `ScopedConfig` | Deep clone all nested data | Shallow spread `{ ...scopedConfig, isReadOnly: true }` | Only `isReadOnly` changes; config data is immutable during a session (only reload rebuilds it) |

**Key insight:** The codebase already has all the patterns needed. `PluginDecorationProvider` is the reference for `FileDecorationProvider`. The filter buttons are the reference for dual-command icon-swap. `computeContextValue()` in `baseNode.ts` is the reference for `readOnly` context values. No new patterns introduced.

---

## Common Pitfalls

### Pitfall 1: LOCK-02 / LOCK-03 Conflict with CONTEXT.md

**What goes wrong:** Planner implements LOCK-02 as toolbar buttons and LOCK-03 as "context menus remain present but write actions are shown-then-blocked," following the REQUIREMENTS verbatim. This contradicts the locked CONTEXT.md decisions.

**Why it happens:** REQUIREMENTS were written before the CONTEXT.md discussion refined behavior. CONTEXT.md decisions supersede.

**How to avoid:** LOCK-02 → inline `view/item/context` buttons, not toolbar. LOCK-03 → write menus are HIDDEN (contextValue read-only pattern), not shown-but-blocked.

**Warning signs:** Plan includes `view/title` entries for lock commands, or includes `showWarningMessage` / `showErrorMessage` for context-menu-triggered write attempts on locked items.

### Pitfall 2: `allScopes` Array Also Needs to Stay Unmodified

**What goes wrong:** Developer shallow-clones `ScopedConfig` in `getSingleRootChildren` and also passes the cloned version as the second argument to `ScopeNode` (the `allScopes` argument used for override resolution).

**Why it happens:** Seems natural to pass consistent data.

**How to avoid:** The `allScopes` second argument must remain unmodified (original from `configStore.getAllScopes()`). Override resolution needs real config data. Only the first argument (`scopedConfig`) gets the shallow-clone.

**Warning signs:** Override indicators disappear or show incorrectly for locked User scope items.

### Pitfall 3: Copy FROM Locked User Is Blocked by Existing `isReadOnly` Guard

**What goes wrong:** Copy commands have `if (isReadOnly || !filePath) return` at the top. If User is locked and `effectiveReadOnly` is threaded, `nodeContext.isReadOnly` is `true` → copy is blocked, contradicting CONTEXT.md decision "Copy FROM locked User: allowed."

**Why it happens:** The read-only guard in copy commands was written assuming read-only = Managed scope (always block). Locking adds a new read-only source that shouldn't block copy.

**How to avoid:** Remove `isReadOnly` check from the source-side guard in copy commands. The source being read-only does not prevent a non-destructive copy. Replace with `if (!filePath) return` only. If Command Palette is used on a locked User scope item for copy, allow it through (copy is non-destructive).

**Warning signs:** Copying from locked User scope shows a warning/info message instead of proceeding.

### Pitfall 4: ScopeNode contextValue Must Include User Scope Identifier

**What goes wrong:** The inline lock/unlock buttons' `when` clause needs to match only User scope nodes. The current `ScopeNode.computeContextValue()` returns strings like `scope.editable` or `scope.readOnly.missing`. There is no `user` segment. The `when` clause `viewItem =~ /^scope\\.user/` would not match.

**Why it happens:** `contextValue` pattern currently encodes `nodeType.editability[.extras]`. Scope identity is not encoded.

**How to avoid:** `ScopeNode.computeContextValue()` must include the scope enum value. Override `computeContextValue()` in `ScopeNode` to emit `scope.user.editable`, `scope.user.readOnly`, `scope.projectShared.editable`, etc.

**Warning signs:** The inline lock/unlock buttons appear on all scope nodes, not just the User scope.

### Pitfall 5: `setContext` Key Not Initialized on Extension Activation

**What goes wrong:** `claudeConfig_userScope_locked` context key has no value until the user clicks lock for the first time. Before that, `when` clause evaluation may be undefined/falsy, causing the inline button `when` clause for the locked state to never show (expected) but also potentially the unlocked button clause to fail on first render.

**Why it happens:** VS Code context keys start as `undefined` which is falsy. The unlocked `when` clause uses `&& !claudeConfig_userScope_locked` — `!undefined` is `true`, so this works correctly by default. The locked variant uses `&& claudeConfig_userScope_locked` — starts as `false`, so it doesn't show. This is actually correct behavior.

**How to avoid:** No action needed. Initialize `claudeConfig_userScope_locked` to `false` in `activate()` via `setContext` for explicitness, but the behavior is correct without it. The existing `claudeConfig_filterActive` context key follows the same implicit-false pattern.

### Pitfall 6: File Watcher Reload Overwriting Lock State

**What goes wrong:** `configStore.reload()` is called by the file watcher. Developer adds `this._lockedScopes.clear()` inside `reload()`, thinking it should reset state on disk changes.

**Why it happens:** Misunderstanding LOCK-06. LOCK-06 says lock state "survives file watcher reloads" — it must NOT be reset by `reload()`.

**How to avoid:** Do not touch `_lockedScopes` in `reload()`. `reload()` only touches `this.configs` and `this.discoveredPaths` maps. `_lockedScopes` lives independently.

---

## Code Examples

Verified patterns from codebase analysis:

### ConfigStore — Lock State Methods

```typescript
// Source: direct analysis of src/config/configModel.ts structure
// Add to ConfigStore class:
private _lockedScopes: Set<ConfigScope> = new Set();

lockScope(scope: ConfigScope): void {
  this._lockedScopes.add(scope);
  this._onDidChange.fire(undefined);
}

unlockScope(scope: ConfigScope): void {
  this._lockedScopes.delete(scope);
  this._onDidChange.fire(undefined);
}

isScopeLocked(scope: ConfigScope): boolean {
  return this._lockedScopes.has(scope);
}
```

### ConfigTreeProvider — effectiveReadOnly Shallow-Clone

```typescript
// Source: direct analysis of src/tree/configTreeProvider.ts getSingleRootChildren
private getSingleRootChildren(): ConfigTreeNode[] {
  const keys = this.configStore.getWorkspaceFolderKeys();
  if (keys.length === 0) return [];
  const key = keys[0];
  const allScopes = this.configStore.getAllScopes(key);

  return allScopes
    .filter((s) => s.scope !== ConfigScope.Managed)
    .map((scopedConfig) => {
      const locked = this.configStore.isScopeLocked(scopedConfig.scope);
      const effective: ScopedConfig = locked && !scopedConfig.isReadOnly
        ? { ...scopedConfig, isReadOnly: true }
        : scopedConfig;
      return new ScopeNode(effective, allScopes, key, this._sectionFilter);
    });
}
```

### ScopeNode — contextValue with Scope Identity + resourceUri for Lock Decoration

```typescript
// Source: direct analysis of src/tree/nodes/scopeNode.ts
protected override computeContextValue(): string {
  // Include scope identity so inline button when clause can target only User scope
  const base = `scope.${this.scopedConfig.scope}`;
  const editability = this.scopedConfig.isReadOnly ? 'readOnly' : 'editable';
  const parts = [base, editability];
  if (!this.scopedConfig.fileExists) parts.push('missing');
  return parts.join('.');
  // Results: scope.user.editable, scope.user.readOnly, scope.projectShared.editable, etc.
}
```

```typescript
// Set resourceUri for lock dimming in ScopeNode constructor:
if (this.scopedConfig.scope === ConfigScope.User) {
  this.resourceUri = vscode.Uri.from({
    scheme: 'claude-config-lock',
    path: '/user',
    query: this.scopedConfig.isReadOnly ? 'locked' : 'unlocked',
  });
}
```

### LockDecorationProvider

```typescript
// Source: modeled on PluginDecorationProvider in src/tree/nodes/pluginNode.ts
export const LOCK_URI_SCHEME = 'claude-config-lock';

export class LockDecorationProvider implements vscode.FileDecorationProvider {
  // No EventEmitter needed: tree refresh (triggered by lock toggle) rebuilds ScopeNode
  // with new resourceUri.query, so provideFileDecoration is called with updated URI.
  readonly onDidChangeFileDecorations = undefined;

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== LOCK_URI_SCHEME) return undefined;
    if (uri.query === 'locked') {
      return { color: new vscode.ThemeColor('disabledForeground') };
    }
    return undefined;
  }
}
```

### extension.ts — Toggle Command + setContext

```typescript
// Source: direct analysis of src/extension.ts patterns (setContext, registerCommand)
const toggleLockCmd = vscode.commands.registerCommand(
  'claudeConfig.toggleUserLock',
  () => {
    const isLocked = configStore.isScopeLocked(ConfigScope.User);
    if (isLocked) {
      configStore.unlockScope(ConfigScope.User);
    } else {
      configStore.lockScope(ConfigScope.User);
    }
    // setContext drives which inline button is visible
    vscode.commands.executeCommand(
      'setContext',
      'claudeConfig_userScope_locked',
      !isLocked,
    );
  },
);
```

### package.json — Two Commands + Two Inline Entries

```json
// contributes.commands — two separate commands for two icons:
{
  "command": "claudeConfig.lockUserScope",
  "title": "Lock User Scope",
  "category": "Claude Config",
  "icon": "$(lock)"
},
{
  "command": "claudeConfig.unlockUserScope",
  "title": "Unlock User Scope",
  "category": "Claude Config",
  "icon": "$(unlock)"
}
```

```json
// view/item/context — two inline entries, mutually exclusive when clauses:
{
  "command": "claudeConfig.lockUserScope",
  "when": "view == claudeConfigTree && viewItem =~ /^scope\\.user/ && !claudeConfig_userScope_locked",
  "group": "inline@0"
},
{
  "command": "claudeConfig.unlockUserScope",
  "when": "view == claudeConfigTree && viewItem =~ /^scope\\.user/ && claudeConfig_userScope_locked",
  "group": "inline@0"
}
```

```json
// commandPalette — hide tree-item-only commands from palette:
{ "command": "claudeConfig.lockUserScope", "when": "false" },
{ "command": "claudeConfig.unlockUserScope", "when": "false" }
```

Note: `claudeConfig.toggleUserLock` (LOCK-01) is still registered in `extension.ts` as the shared handler. Whether to expose it via Command Palette depends on whether it's useful without a node target. Since lock is User-scope-specific and the command takes no arguments, it CAN be in the Command Palette as a direct toggle. Register in `contributes.commands` (for Command Palette) as `claudeConfig.toggleUserLock`. The `lockUserScope` and `unlockUserScope` commands are thin wrappers or aliases pointing to the same handler, suppressed from Command Palette.

**Simpler alternative:** Use a single `claudeConfig.toggleUserLock` command with icon `$(lock)` in contributes.commands. For inline display, register two additional commands `claudeConfig.lockUserScope` (icon `$(lock)`) and `claudeConfig.unlockUserScope` (icon `$(unlock)`), both hidden from Command Palette, both delegating to `configStore.lockScope`/`unlockScope`. This mirrors exactly the `filterSections` / `filterSections.active` pattern already in the codebase.

### Command Palette Guard in Write Handlers

```typescript
// Source: direct analysis of src/commands/editCommands.ts
// Replace current: vscode.window.showWarningMessage('This setting is read-only.')
// With scope-aware version:
if (isReadOnly || !filePath) {
  if (node.nodeContext.scope === ConfigScope.User && isReadOnly) {
    vscode.window.showInformationMessage(
      'User scope is currently locked. Click the lock icon in the toolbar to unlock.'
    );
  } else {
    vscode.window.showWarningMessage('This setting is read-only.');
  }
  return;
}
```

Apply same pattern to `deleteCommands.ts` and relevant paths in `addCommands.ts`.

### Move/Copy Scope Picker — Lock-Aware

```typescript
// Source: direct analysis of src/commands/moveCommands.ts lines 42-58
// For moveToScope target picker:
const targetScopes = allScopes.filter(
  (s) => s.scope !== scope && s.scope !== ConfigScope.Managed,
);

const pickItems = targetScopes.map((s) => {
  const locked = configStore.isScopeLocked(s.scope);
  return {
    label: locked ? `$(lock) ${SCOPE_LABELS[s.scope]}` : SCOPE_LABELS[s.scope],
    description: s.filePath ?? '',
    value: s,
    isLocked: locked,
  };
});

const pick = await vscode.window.showQuickPick(pickItems, {
  placeHolder: 'Move to which scope?',
});
if (!pick) return;

if (pick.isLocked) {
  vscode.window.showInformationMessage('User scope is locked.');
  return;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No lock concept | User scope ephemeral lock via `ConfigStore._lockedScopes` | Phase 3 | Session-scoped write protection for User config |
| Toolbar toolbar-only icon swap | Two-command pattern for inline tree item (mirrors filter button pattern) | Phase 3 | Lock visual is co-located with what it controls |
| `PluginDecorationProvider` with static `onDidChangeFileDecorations = undefined` | `LockDecorationProvider` with same static pattern (lock state baked into URI at tree refresh time) | Phase 3 | Consistent with existing decoration pattern |

**Existing pattern leveraged:** `claudeConfig.filterSections` / `claudeConfig.filterSections.active` — two commands, two `view/title` entries, `setContext` key `claudeConfig_filterActive`. Lock implementation mirrors this exactly, shifted to `view/item/context` inline scope.

---

## Open Questions

1. **LOCK-01: Should `claudeConfig.toggleUserLock` be accessible via Command Palette?**
   - What we know: LOCK-01 says "Lock toggle command registered as `claudeConfig.toggleUserLock`". The command takes no node argument. It's a direct toggle of User scope lock state.
   - What's unclear: Should it appear in Command Palette? The filter command does NOT appear (it's hidden with `when: false`). But a lock/unlock action might be useful from Command Palette.
   - Recommendation: Expose `claudeConfig.toggleUserLock` in Command Palette (no `commandPalette` deny-list entry). The `lockUserScope` / `unlockUserScope` inline variants are hidden. This satisfies LOCK-01 literally.

2. **Inline icon: same command or two commands?**
   - What we know: CONTEXT says one toggle command; the `view/item/context` needs two different icons. VS Code inline icons come from `contributes.commands` icon, not from the menu entry directly.
   - What's unclear: Can a single command show different icons in two different `view/item/context` when-clause entries?
   - Recommendation: Use two commands (`lockUserScope`, `unlockUserScope`) as the inline affordances, both hidden from Command Palette. The toggle (`toggleUserLock`) exposed via Command Palette. This is the same pattern as `filterSections` / `filterSections.active`. Verified working in this codebase.

3. **Copy from locked User scope: should the guard in copy handlers be changed for all read-only sources, or only User scope?**
   - What we know: CONTEXT says copy from locked User is allowed. The current `isReadOnly` guard would block it.
   - What's unclear: Is the intent to allow copy from Managed scope too (currently blocked)? Managed scope items could be conceptually copyable.
   - Recommendation: For Phase 3 scope, only fix the User scope case. In copy handlers, replace `if (isReadOnly || !filePath)` with: if read-only AND scope is User AND locked → allow through (skip the guard). If read-only AND scope is Managed → keep warning. This is minimal and targeted.

---

## Sources

### Primary (HIGH confidence)

- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/config/configModel.ts` — Direct inspection of `ConfigStore` class, `_onDidChange` emitter, `reload()` method
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/tree/configTreeProvider.ts` — Direct inspection of `getSingleRootChildren`, `getMultiRootChildren`, `setContext` usage pattern
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/tree/nodes/baseNode.ts` — Direct inspection of `computeContextValue()` pattern
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/tree/nodes/scopeNode.ts` — Direct inspection of `ScopeNode` constructor, current `computeContextValue()` override
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/tree/nodes/pluginNode.ts` — Reference implementation of `FileDecorationProvider` pattern (`PluginDecorationProvider`)
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/commands/moveCommands.ts` — Direct inspection of `moveToScope` and `copySettingToScope` handlers, target filter logic
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/commands/editCommands.ts` — Direct inspection of `isReadOnly` guard
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/commands/deleteCommands.ts` — Direct inspection of `isReadOnly` guard
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/package.json` — Direct inspection of `view/item/context` inline pattern (`group: "inline@0"`, `"inline@1"`), `when` clause regex patterns, `commandPalette` deny-list pattern, filter button two-command pattern
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/extension.ts` — Direct inspection of `setContext` usage (`claudeConfig_filterActive`), command registration pattern, `FileDecorationProvider` registration
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/.planning/phases/03-user-scope-lock-toggle/03-CONTEXT.md` — Locked user decisions (supersede REQUIREMENTS on discrepant points)
- VS Code Extension API (Context7 `/websites/code_visualstudio_api`) — `FileDecorationProvider.provideFileDecoration`, `FileDecoration`, `ThemeColor`, `setContext`, `view/item/context` inline group, `viewItem` when clause

### Secondary (MEDIUM confidence)

- Context7 query results for VS Code Extension API — confirmed `provideFileDecoration` signature, `ThemeColor` constructor, `setContext` command, `view/item/context` group "inline" behavior — aligns with codebase observation

---

## Metadata

**Confidence breakdown:**
- Lock state in ConfigStore (LOCK-06, LOCK-09): HIGH — codebase shows `reload()` rebuilds configs only; `_lockedScopes` as independent Set is trivially correct
- effectiveReadOnly shallow-clone (LOCK-07): HIGH — existing ScopedConfig is already shallow (all config data is read from disk and not mutated after load); spread operator is safe
- contextValue pattern (LOCK-08): HIGH — `baseNode.computeContextValue()` is fully understood; `isReadOnly` flag drives `readOnly` segment automatically
- ScopeNode contextValue override with scope identity: HIGH — current code override already exists in `ScopeNode.computeContextValue()`; adding scope enum value is straightforward
- Inline button two-command pattern: HIGH — `filterSections` / `filterSections.active` is proven working reference in this exact codebase
- FileDecorationProvider static pattern: HIGH — `PluginDecorationProvider` with `onDidChangeFileDecorations = undefined` works because tree refresh rebuilds URIs
- Move/copy lock-aware picker: HIGH — straightforward modification to existing `moveCommands.ts` filter logic
- ThemeColor `'disabledForeground'` for locked dimming: HIGH — used in 5+ places in this codebase for inactive/overridden state; matches VS Code "disabled" convention
- Copy-from-locked-User guard fix: MEDIUM — behavior is clear but requires care to not break copy from other read-only sources

**Research date:** 2026-02-19
**Valid until:** Stable — VS Code TreeView API, contextValue pattern, and FileDecorationProvider stable across VS Code versions 1.90+. Valid indefinitely for this extension's target version range.
