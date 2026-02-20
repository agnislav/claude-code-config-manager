# Architecture Research

**Domain:** VS Code TreeView extension — toolbar UX improvements and scope-level write protection
**Researched:** 2026-02-18
**Confidence:** HIGH (based on direct codebase inspection + official VS Code API documentation)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VS Code TreeView UI                              │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │  Toolbar: [filter icon] [refresh icon]                           │  │
│   │  Tree: ScopeNode > SectionNode > PermissionRuleNode / etc.       │  │
│   └──────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                      ConfigTreeProvider                                  │
│   _sectionFilter: Set<SectionType>   syncFilterContext() → setContext   │
│   toggleSectionFilter() / selectAllSections()                           │
│   getChildren() → ScopeNode → SectionNode → leaf nodes                 │
├─────────────────────────────────────────────────────────────────────────┤
│                      ConfigStore (in-memory model)                       │
│   configs: Map<workspaceFolderKey, ScopedConfig[]>                      │
│   onDidChange: EventEmitter → fires → ConfigTreeProvider.refresh()      │
├──────────────┬────────────────────────────────────────────────────────  │
│ configWriter │ configLoader │ configDiscovery │ overrideResolver         │
│  (pure fns)  │ (pure fns)   │ (pure fns)      │ (pure fns)               │
└──────────────┴────────────────────────────────────────────────────────  ┘
                         ↕ disk (JSON files)
```

### Component Responsibilities (Current State)

| Component | Responsibility | Notes |
|-----------|----------------|-------|
| `extension.ts` | Activate, wire all pieces, register commands | Registers 16+ filter commands via loop |
| `ConfigStore` | In-memory model of all scoped configs, reload, events | `ScopedConfig.isReadOnly` only set for Managed scope |
| `ConfigTreeProvider` | TreeDataProvider + section filter state + context key sync | `_sectionFilter: Set<SectionType>` lives here |
| `ScopeNode` | Passes `sectionFilter` down to `SectionNode` children | Filter is prop-drilled |
| `baseNode` | Computes `contextValue` from `nodeContext.isReadOnly` | Pattern: `{type}.editable|readOnly[.overridden]` |
| `configWriter` | Pure functions, write JSON to disk | No lock awareness; callers check `isReadOnly` |
| `package.json` | 16 command entries (8 pairs normal/.active) + `when` clause icon-swap | Context keys: `claudeConfig_filter_*` |

---

## Recommended Architecture (Post-Milestone)

### Feature 1: QuickPick Multi-Select Filter Replacing Toolbar Icon Buttons

**What changes:** Replace the 16 command / 8 context-key / 8 icon-pair system with a single `claudeConfig.filterSections` command that opens a `vscode.QuickPick` with `canSelectMany: true`.

**Component boundaries:**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `src/tree/configTreeProvider.ts` | Modify | `toggleSectionFilter()` / `selectAllSections()` / `syncFilterContext()` removed or gutted. New method: `setSectionFilter(sections: Set<SectionType>)`. Remove all `vscode.commands.executeCommand('setContext', ...)` calls. |
| `src/extension.ts` | Modify | Remove the `for (const st of Object.values(SectionType))` loop registering 14 filter commands. Remove `filterAllCmd` / `filterAllActiveCmd`. Register single `claudeConfig.filterSections` command. |
| `package.json` | Modify | Delete 16 command entries (`claudeConfig.filter.*`, `claudeConfig.filter.*.active`, `claudeConfig.filterAll`, `claudeConfig.filterAll.active`). Delete all 16 `view/title` filter menu entries. Delete 16 `commandPalette` hidden entries. Add one `claudeConfig.filterSections` command with a filter icon. Add one `view/title` entry for it. Remove `claudeConfig_filter_*` context keys (they become unused). |
| `src/commands/` (new file optional) | New or inline | `filterCommands.ts` — registers `claudeConfig.filterSections` command handler that calls `vscode.window.showQuickPick` with `canSelectMany: true`, maps result back to `Set<SectionType>`, calls `treeProvider.setSectionFilter(...)`. |

**Data flow (new):**

```
User clicks [filter icon]
    ↓
claudeConfig.filterSections command handler
    ↓
vscode.window.showQuickPick(sectionItems, { canSelectMany: true, activeItems: currentlySelected })
    ↓ user picks (or cancels)
ConfigTreeProvider.setSectionFilter(new Set(selectedSections))
    ↓
_sectionFilter updated → refresh() → TreeView re-renders
```

**Key implementation detail:** `QuickPickItem` has a `picked` boolean field. To pre-select currently active filters when reopening the QuickPick, set `picked: this._sectionFilter.has(st)` on each item before showing. This preserves state across invocations without any context keys.

**What is NOT needed anymore:** `syncFilterContext()`, all `claudeConfig_filter_*` setContext calls, FILTER_CTX_KEYS map, the `.active` command variants, and all 8 pairs of icon SVGs (or they can be kept for the single button, using a ThemeIcon instead).

---

### Feature 2: Removing a Toolbar Command

**What changes:** Identify and remove the unwanted command from both `package.json` (commands array, menus/view/title, menus/commandPalette) and `extension.ts` (command registration + subscriptions push).

**Component boundaries:**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `package.json` | Modify | Remove command entry from `contributes.commands[]`, from `menus.view/title[]`, and from `menus.commandPalette[]` |
| `src/extension.ts` | Modify | Remove `vscode.commands.registerCommand(...)` call and remove from `context.subscriptions.push(...)` |
| `src/commands/*.ts` | Modify | Remove the registration function call if command lives in a grouped file, or delete the file if it only contained that command |

**No data flow changes required.** This is purely a surface-area reduction. No other components reference toolbar button registrations.

---

### Feature 3: User Scope Lock Toggle — Preventing Writes

**What changes:** Add a toggle that marks the User scope as write-locked at runtime, preventing any write command from modifying `~/.claude/settings.json`. The lock is ephemeral (session state, not persisted to disk).

**Where lock state should live: ConfigStore**

Rationale: `ConfigStore` is the authoritative source of `ScopedConfig` objects. It already carries `isReadOnly` per `ScopedConfig`. The natural extension is to add a runtime override set that marks additional scopes as locked beyond the Managed-scope-only current behavior. Keeping it in `ConfigStore` means commands, nodes, and the tree provider all have a single place to query lock state — consistent with how `isReadOnly` already flows through `nodeContext.isReadOnly`.

Alternatives rejected:
- **ConfigTreeProvider**: Too UI-layer — write commands don't go through the tree provider.
- **Separate LockService/singleton**: Adds a new dependency edge when ConfigStore already owns scope state.

**Proposed ConfigStore additions:**

```typescript
// In ConfigStore:
private readonly _lockedScopes = new Set<ConfigScope>();

lockScope(scope: ConfigScope): void {
  this._lockedScopes.add(scope);
  this._onDidChange.fire(undefined); // trigger tree refresh
}

unlockScope(scope: ConfigScope): void {
  this._lockedScopes.delete(scope);
  this._onDidChange.fire(undefined);
}

isScopeLocked(scope: ConfigScope): boolean {
  return this._lockedScopes.has(scope);
}
```

**How lock state propagates through the system:**

```
claudeConfig.toggleUserLock command
    ↓
configStore.lockScope(ConfigScope.User) / unlockScope(ConfigScope.User)
    ↓
configStore._onDidChange.fire() → ConfigTreeProvider.refresh()
    ↓
ScopeNode re-constructed: nodeContext.isReadOnly = scopedConfig.isReadOnly || configStore.isScopeLocked(scope)
    ↓
baseNode.computeContextValue() → "scope.readOnly" (was "scope.editable")
    ↓ All child nodes inherit isReadOnly from ScopedConfig via SectionNode/leaf nodes
    ↓
package.json when-clauses: viewItem =~ /\.editable/ → edit/delete/move commands hidden
```

**Critical propagation point:** `ScopeNode` currently passes `scopedConfig.isReadOnly` into `NodeContext`. After this change, `ScopeNode` must receive (or query) the lock state. The cleanest approach is to pass it directly in `ConfigTreeProvider.getSingleRootChildren()` and `getMultiRootChildren()` when constructing `ScopeNode`:

```typescript
// In ConfigTreeProvider:
private getSingleRootChildren(): ConfigTreeNode[] {
  const key = keys[0];
  const allScopes = this.configStore.getAllScopes(key);
  return allScopes
    .filter((s) => s.scope !== ConfigScope.Managed)
    .map((scopedConfig) => {
      const effectiveReadOnly =
        scopedConfig.isReadOnly || this.configStore.isScopeLocked(scopedConfig.scope);
      return new ScopeNode(scopedConfig, allScopes, key, this._sectionFilter, effectiveReadOnly);
    });
}
```

Then `ScopeNode` sets `nodeContext.isReadOnly = effectiveReadOnly` which propagates downward into all child `SectionNode` and leaf node constructors via the existing `isReadOnly` field threading.

**SectionNode / leaf nodes:** These already receive `isReadOnly` from their parent `ScopedConfig`. After the change, they must receive the effective value. Current code passes `scopedConfig` directly into `SectionNode`. To keep things clean, `ScopeNode.getChildren()` should override `isReadOnly` on the scopedConfig reference it passes, or `SectionNode` should accept an `overrideReadOnly` parameter. The simplest approach: create a shallow-cloned `ScopedConfig` with `isReadOnly` overridden when locking:

```typescript
// In ScopeNode.getChildren() when effectiveReadOnly differs from scopedConfig.isReadOnly:
const effectiveScopedConfig = effectiveReadOnly
  ? { ...this.scopedConfig, isReadOnly: true }
  : this.scopedConfig;
new SectionNode(type, effectiveScopedConfig, this.allScopes)
```

**Command-level enforcement:** All write commands already check `nodeContext.isReadOnly` as a guard. Since the tree rebuilds after lock toggle, all nodes will have the correct `isReadOnly` before any user action occurs. No changes needed in `configWriter.ts` — the UI layer blocks writes before they reach configWriter.

**VS Code context key for lock toggle icon swap:** Add one context key `claudeConfig_userScope_locked` (boolean). Set it in `extension.ts` when the toggle command runs. This controls the toolbar button icon (locked vs unlocked padlock icon using `$(lock)` / `$(unlock)` ThemeIcons — no custom SVGs needed).

**Component boundaries for Feature 3:**

| File | Change Type | What Changes |
|------|-------------|--------------|
| `src/config/configModel.ts` | Modify | Add `_lockedScopes: Set<ConfigScope>`, `lockScope()`, `unlockScope()`, `isScopeLocked()` |
| `src/tree/configTreeProvider.ts` | Modify | `getSingleRootChildren()` / `getMultiRootChildren()`: compute `effectiveReadOnly`, pass to `ScopeNode` |
| `src/tree/nodes/scopeNode.ts` | Modify | Accept `effectiveReadOnly` parameter; use it in `NodeContext`; pass effective `ScopedConfig` to `SectionNode` children |
| `src/extension.ts` | Modify | Register `claudeConfig.toggleUserLock` command; call `configStore.lockScope/unlockScope`; set `claudeConfig_userScope_locked` context key |
| `package.json` | Modify | Add `claudeConfig.toggleUserLock` command with `$(lock)` / `$(unlock)` icon pair; add `view/title` entry with `when` clause on `claudeConfig_userScope_locked` |
| `src/types.ts` | No change | `isReadOnly: boolean` in `NodeContext` already covers this |
| `src/config/configWriter.ts` | No change | Pure functions; callers gate on `isReadOnly` |

---

## Data Flow Summary (All Three Features)

### Read path (tree rendering):

```
Config files on disk
    → configDiscovery → configLoader → ConfigStore (reload)
    → ConfigStore.isScopeLocked(scope) [NEW — layered on top of ScopedConfig.isReadOnly]
    → ConfigTreeProvider.getSingleRootChildren()
          effectiveReadOnly = scopedConfig.isReadOnly || configStore.isScopeLocked(scope) [NEW]
    → ScopeNode(scopedConfig, allScopes, key, sectionFilter, effectiveReadOnly) [MODIFIED]
    → ScopeNode.getChildren() → SectionNode(effectiveScopedConfig, ...) [MODIFIED]
    → SectionNode → leaf nodes (SettingNode, PermissionRuleNode, etc.)
          nodeContext.isReadOnly = effectiveScopedConfig.isReadOnly [unchanged logic]
    → baseNode.computeContextValue() → "setting.readOnly" or "setting.editable"
    → VS Code TreeView renders, package.json when-clauses gate context menus
```

### Filter path (new):

```
User clicks [filter icon] in toolbar
    → claudeConfig.filterSections command
    → vscode.window.showQuickPick(sections, { canSelectMany: true })
         items pre-selected via QuickPickItem.picked from current _sectionFilter
    → user selects sections, confirms
    → ConfigTreeProvider.setSectionFilter(new Set(selectedItems.map(i => i.value)))
    → _onDidChangeTreeData.fire() → TreeView re-renders
    [NO setContext calls, NO context keys written]
```

### Write path (commands → disk):

```
User invokes edit/delete/add command on a tree node
    → command handler checks nodeContext.isReadOnly [existing guard]
         if locked: shows warning, returns early
         if not locked: proceeds
    → configWriter function (pure, no lock awareness)
    → writes JSON to disk
    → fileWatcher detects change → configStore.reload() → tree refresh
```

---

## Suggested Build Order

**Build order is dictated by dependency and risk, not feature size.**

### Phase 1: QuickPick Filter (Feature 1)

Build first because:
- It is a net reduction in complexity (removing 16 commands, 8 context keys, icon-swap machinery)
- No new state added to existing components
- Self-contained: only touches `ConfigTreeProvider`, `extension.ts`, and `package.json`
- Validates the QuickPick API integration pattern before Feature 3 uses the same technique (scope QuickPick already exists in `moveCommands.ts`, so the pattern is proven)
- Unblocks a cleaner `package.json` before Feature 3 adds new toolbar entries

### Phase 2: Remove Toolbar Command (Feature 2)

Build second because:
- Zero architectural changes — pure deletion
- Should be done after Feature 1 clears the old filter commands, so `package.json` edits are not interleaved between two PRs touching the same section
- Cheapest feature, lowest risk of regressions

### Phase 3: User Scope Lock Toggle (Feature 3)

Build last because:
- It is the only feature that adds new state to `ConfigStore`
- It requires coordinated changes across 5 files
- It modifies the `ScopeNode` constructor signature, which could cause type errors across node construction sites
- With Features 1 and 2 done first, the codebase is in a cleaner state (fewer commands, no filter noise in `extension.ts`) making the lockScope wiring easier to reason about

---

## Architectural Patterns to Follow

### Pattern 1: Effective ReadOnly as Shallow Override

**What:** When extending `isReadOnly` beyond `ScopedConfig.isReadOnly`, do not mutate the stored `ScopedConfig`. Instead compute `effectiveReadOnly` at tree construction time and pass it through.
**When to use:** Any time a transient/session override needs to layer on top of a persisted property.
**Example:**
```typescript
// ConfigTreeProvider.getSingleRootChildren()
const effectiveReadOnly = scopedConfig.isReadOnly || this.configStore.isScopeLocked(scopedConfig.scope);
const effectiveScopedConfig: ScopedConfig = effectiveReadOnly
  ? { ...scopedConfig, isReadOnly: true }
  : scopedConfig;
new ScopeNode(effectiveScopedConfig, allScopes, key, this._sectionFilter);
```

### Pattern 2: QuickPick with Stateful Pre-Selection

**What:** When a QuickPick replaces a stateful toggle system, preserve current state by setting `picked: true` on already-active items.
**When to use:** Replacing context-key-driven icon swap with a single multi-select dialog.
**Example:**
```typescript
const items = Object.values(SectionType).map((st) => ({
  label: SECTION_LABELS[st],
  value: st,
  picked: this._sectionFilter.size === 0 || this._sectionFilter.has(st),
}));
const picks = await vscode.window.showQuickPick(items, {
  canPickMany: true,
  placeHolder: 'Select sections to show (empty = show all)',
});
if (picks === undefined) return; // user cancelled — preserve existing filter
const newFilter = picks.length === Object.values(SectionType).length
  ? new Set<SectionType>()  // all selected = no filter
  : new Set(picks.map((p) => p.value));
treeProvider.setSectionFilter(newFilter);
```

### Pattern 3: ConfigStore as Lock Authority

**What:** Ephemeral session state that affects read/write permissions lives in `ConfigStore`, not in the tree layer or a separate service.
**When to use:** Any runtime override of scope capabilities that commands need to check.
**Why:** Commands receive `nodeContext.isReadOnly` which is derived from `ScopedConfig` which comes from `ConfigStore`. Keeping lock state in `ConfigStore` keeps the authority chain intact without adding a new dependency.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Propagating Lock via Context Keys Alone

**What people do:** Set a VS Code context key `claudeConfig_userScope_locked` and use it in `when` clauses to hide menu items, without also propagating `isReadOnly` to `nodeContext`.
**Why it's wrong:** Context menus disappear but command handlers still run if invoked via keyboard or command palette. The `isReadOnly` guard in each command handler must also be respected.
**Do this instead:** Propagate `effectiveReadOnly` through `nodeContext` AND use context keys only for icon/visibility; rely on `nodeContext.isReadOnly` in command handlers as the authoritative gate.

### Anti-Pattern 2: Mutating ScopedConfig Stored in ConfigStore

**What people do:** When locking, set `configStore.getAllScopes(key)[n].isReadOnly = true` directly.
**Why it's wrong:** This mutates the stored config object in place. On `configStore.reload()`, the mutation is lost; also creates hidden shared-object bugs between tree nodes that reference the same `ScopedConfig`.
**Do this instead:** Spread-clone at tree construction time (`{ ...scopedConfig, isReadOnly: true }`), keeping `ConfigStore` as the single source of truth for what's on disk.

### Anti-Pattern 3: Keeping the Context-Key + Icon-Pair System Alongside QuickPick

**What people do:** Add the QuickPick command but leave the old 16 filter commands in place "for keyboard users."
**Why it's wrong:** Doubles the surface area, the 16 commands still need context key updates to stay in sync with QuickPick-driven filter changes, and the motivation for the refactor (reducing complexity) is negated.
**Do this instead:** Remove the old system entirely. The QuickPick is keyboard-accessible (Cmd+Shift+P → "Filter Sections"); no icon-based shortcut is lost for keyboard users.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `ConfigStore` ↔ `ConfigTreeProvider` | `onDidChange` event + direct method calls | Lock toggle fires `onDidChange` to trigger refresh |
| `ConfigTreeProvider` ↔ `ScopeNode` | Constructor parameter `effectiveReadOnly` | Currently implicit via `scopedConfig.isReadOnly` |
| `ScopeNode` ↔ `SectionNode` ↔ leaf nodes | `ScopedConfig.isReadOnly` on shared object | Shallow-clone pattern at `ScopeNode.getChildren()` level |
| Commands ↔ `ConfigStore` | Direct method calls | Lock toggle command calls `configStore.lockScope()` |
| `extension.ts` ↔ `ConfigTreeProvider` | Direct method calls | Filter command calls `treeProvider.setSectionFilter()` |

### package.json When-Clause Changes

| Current | After Feature 1 | After Feature 3 |
|---------|-----------------|-----------------|
| 8 `claudeConfig_filter_*` context keys | 0 (removed) | 0 |
| 16 filter commands | 1 (`claudeConfig.filterSections`) | 1 |
| 16 `view/title` filter entries | 1 | 2 (filter + lock toggle) |
| `claudeConfig_userScope_locked` | not present | added |

---

## Sources

- Direct codebase inspection: `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/` (HIGH confidence)
- VS Code Extension API — QuickPick: https://code.visualstudio.com/api/references/vscode-api (MEDIUM confidence via WebSearch verification)
- VS Code UX Guidelines — Quick Picks: https://code.visualstudio.com/api/ux-guidelines/quick-picks (MEDIUM confidence)
- `vscode.window.showQuickPick` `canPickMany` option: confirmed stable in multiple VS Code issues and the Haxe extern docs (MEDIUM confidence, multiple sources agree)

---
*Architecture research for: Claude Code Config Manager — toolbar UX improvements*
*Researched: 2026-02-18*
