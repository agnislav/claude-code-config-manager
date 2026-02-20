# Stack Research

**Domain:** VS Code Extension — TreeView UX improvements (QuickPick filter, toolbar cleanup, scope lock)
**Researched:** 2026-02-18
**Confidence:** HIGH (all claims verified against local `@types/vscode@1.90.0` + official VS Code docs)

---

## Context

This is a subsequent-milestone research document. The extension already exists with a fully working
TreeView, `contextValue` patterns, `setContext`/`when`-clause toolbar icon-swap, `configWriter`, and
`fileWatcher`. This document covers only the three new capabilities:

1. Replace 8 toolbar filter icon buttons with a single filter icon that opens a QuickPick multi-select
2. Remove existing toolbar commands/buttons cleanly
3. Add a per-scope lock toggle that prevents write operations to that scope

No new runtime dependencies are needed. All required APIs are in `vscode` itself, which is already
external to the esbuild bundle.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `vscode.window.createQuickPick<T>()` | VS Code 1.15+ (well before 1.90 min) | Multi-select filter UI | `showQuickPick` cannot pre-select items when `canPickMany:true`; `createQuickPick` gives full control over `selectedItems`, lifecycle, and dispose |
| `vscode.commands.executeCommand('setContext', ...)` | All VS Code versions | Drive toolbar `when` clauses and contextValue-based menu visibility | Already used by this extension's `syncFilterContext()`; same mechanism drives the lock indicator |
| `vscode.TreeItem.contextValue` (string with dot-segments) | All VS Code versions | Encode lock state per scope node for conditional menu actions | Already used via `computeContextValue()` in `baseNode.ts`; just add a `.locked` segment |

### Supporting Libraries

None. All required APIs are part of the `vscode` extension host API (external, not bundled).

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@types/vscode@^1.90.0` | Type definitions for all QuickPick APIs | Already installed as dev dep; all interfaces verified below |
| esbuild | Bundle; no change needed | `vscode` stays external; no new bundled deps introduced |

---

## Feature 1: QuickPick Multi-Select Filter

### API

**Use `window.createQuickPick<T>()`**, not `window.showQuickPick()`.

`showQuickPick` with `canPickMany: true` does not support pre-selecting items via the `picked` property
when called via `createQuickPick`. The `picked` property on `QuickPickItem` is **only honored by
`showQuickPick`**, not by `createQuickPick`. This is a documented API design decision by the VS Code
team (closed WONTFIX, issues #119834 and #138070).

For `createQuickPick`, pre-selection is done via `quickPick.selectedItems = [...]`.

**Key properties and events (verified in `@types/vscode@1.90.0`, line 13142):**

```typescript
// Property naming: note the asymmetry between showQuickPick and createQuickPick
// showQuickPick options:   canPickMany: boolean   (QuickPickOptions, line 2035)
// createQuickPick instance: canSelectMany: boolean (QuickPick<T>, line 13199)

const qp = vscode.window.createQuickPick<vscode.QuickPickItem>();
qp.title = 'Show Sections';
qp.placeholder = 'Select sections to display';
qp.canSelectMany = true;                  // enables multi-select checkboxes
qp.items = allSections;                   // QuickPickItem[]
qp.selectedItems = currentlySelected;     // QuickPickItem[] — pre-select active filters
qp.onDidAccept(() => {
  const selected = qp.selectedItems;      // readonly QuickPickItem[]
  // apply filter from selected
  qp.dispose();
});
qp.onDidHide(() => qp.dispose());
qp.show();
```

**Relevant API surface (all verified in `@types/vscode@1.90.0`):**

| Member | Type | Purpose |
|--------|------|---------|
| `window.createQuickPick<T>()` | `() => QuickPick<T>` | Factory; generic over QuickPickItem |
| `QuickPick.canSelectMany` | `boolean` | Enables multi-select checkboxes; default `false` |
| `QuickPick.items` | `readonly T[]` (read/write) | The full list of items |
| `QuickPick.selectedItems` | `readonly T[]` (read/write) | Currently checked items; set this to pre-select |
| `QuickPick.activeItems` | `readonly T[]` (read/write) | Highlighted (not selected) items |
| `QuickPick.onDidAccept` | `Event<void>` | User pressed Enter or clicked OK |
| `QuickPick.onDidChangeSelection` | `Event<readonly T[]>` | Fires on each checkbox toggle |
| `QuickPick.onDidHide` | `Event<void>` | Fires on Escape/blur; always dispose here |
| `QuickPick.placeholder` | `string \| undefined` | Text in filter input when empty |
| `QuickPick.title` | `string \| undefined` | Title bar text |
| `QuickPick.dispose()` | `void` | Required cleanup |

**QuickPickItem shape:**

```typescript
interface QuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;      // Ignored by createQuickPick — use selectedItems instead
  alwaysShow?: boolean;
  kind?: QuickPickItemKind; // Default | Separator
  iconPath?: ThemeIcon | Uri | { light: Uri; dark: Uri };
  buttons?: QuickInputButton[];
}
```

**Implementation pattern for this extension:**

```typescript
// In a new src/commands/filterCommands.ts
export function registerFilterCommands(
  context: vscode.ExtensionContext,
  treeProvider: ConfigTreeProvider,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeConfig.openFilterPicker', () => {
      const allSectionTypes = Object.values(SectionType);
      const currentFilter = treeProvider.sectionFilter; // ReadonlySet<SectionType>

      const items: vscode.QuickPickItem[] = allSectionTypes.map((st) => ({
        label: SECTION_LABELS[st],  // human-readable label
        description: st,            // machine ID for round-trip
      }));

      const qp = vscode.window.createQuickPick();
      qp.title = 'Filter Sections';
      qp.placeholder = 'Select sections to show (empty = show all)';
      qp.canSelectMany = true;
      qp.items = items;
      // Pre-select currently active filters
      qp.selectedItems = items.filter((i) => currentFilter.has(i.description as SectionType));

      qp.onDidAccept(() => {
        const selected = new Set(qp.selectedItems.map((i) => i.description as SectionType));
        treeProvider.setSectionFilter(selected);  // new method replacing toggleSectionFilter
        qp.dispose();
      });
      qp.onDidHide(() => qp.dispose());
      qp.show();
    }),
  );
}
```

**VS Code version requirement:** `window.createQuickPick` has been present since VS Code 1.15
(introduced with `QuickInput` API proposal, stabilized ~1.22). Well before the 1.90 minimum.
Confidence: HIGH (verified in `@types/vscode@1.90.0` type definitions locally).

**Gotcha — `canPickMany` vs `canSelectMany` naming:**
- `QuickPickOptions.canPickMany` — option for `showQuickPick()` (line 2035 in types)
- `QuickPick<T>.canSelectMany` — property on `createQuickPick()` instance (line 13199 in types)
These are different names on different APIs. Using the wrong one causes a silent no-op (TypeScript
catches it only if the type is not `any`).

**Gotcha — `picked` property ignored by `createQuickPick`:**
The `QuickPickItem.picked` property documentation (line 1960 in types) explicitly states:
> "This is only honored when using the showQuickPick API. To do the same thing with the createQuickPick
> API, simply set the selectedItems to the items you want selected initially."
Setting `picked: true` on items passed to `createQuickPick` will display checkmarks but not actually
pre-select them. Always set `selectedItems` directly.

---

## Feature 2: Remove Toolbar Commands/Buttons

### API

Toolbar button removal requires changes only in `package.json` (the manifest), not in TypeScript code.
The VS Code extension manifest is static — there is no runtime API to add or remove toolbar buttons.
Button visibility is controlled exclusively via `when` clauses evaluated by the VS Code host.

**Removal strategy (two options):**

**Option A — Full removal** (preferred for the 8 individual filter buttons):
Delete the command entries from `contributes.commands` and delete the `view/title` menu entries from
`contributes.menus`. Also deregister the TypeScript command handlers in `extension.ts` (remove from
`context.subscriptions`). Command registrations are cheap but unused commands waste startup time and
pollute the command palette.

**Option B — Conditional hiding via `when: "false"`:**
Already used for internal commands in `commandPalette`. Set `when: "false"` on the `view/title` menu
entry to hide the button without removing the command. Do not use this for the filter buttons being
replaced — it leaves dead code and ghost command registrations.

**Mechanics of `view/title` group ordering:**
The `group` value `"navigation@N"` controls button order in the toolbar. The navigation group is always
the primary (leftmost) toolbar area. After removing the 8 filter buttons (groups `navigation@0`
through `navigation@7`), renumber the single replacement filter button and the refresh button.
Refresh currently uses `navigation@99` — this ensures it stays rightmost regardless of numbering.

**What to keep/remove for this extension:**

Remove from `contributes.commands`:
- `claudeConfig.filterAll`, `claudeConfig.filterAll.active`
- `claudeConfig.filter.permissions`, `claudeConfig.filter.permissions.active`
- `claudeConfig.filter.sandbox`, `claudeConfig.filter.sandbox.active`
- `claudeConfig.filter.hooks`, `claudeConfig.filter.hooks.active`
- `claudeConfig.filter.mcpServers`, `claudeConfig.filter.mcpServers.active`
- `claudeConfig.filter.env`, `claudeConfig.filter.env.active`
- `claudeConfig.filter.plugins`, `claudeConfig.filter.plugins.active`
- `claudeConfig.filter.settings`, `claudeConfig.filter.settings.active`

Add one new command:
```json
{
  "command": "claudeConfig.openFilterPicker",
  "title": "Filter Sections...",
  "category": "Claude Config",
  "icon": "$(filter)"
}
```

Add to `view/title`:
```json
{
  "command": "claudeConfig.openFilterPicker",
  "when": "view == claudeConfigTree",
  "group": "navigation@0"
}
```

Remove from `commandPalette` the 16 filter commands (or keep hidden if commands are kept).

**Context key cleanup:** Remove the `claudeConfig_filter_*` context keys from `syncFilterContext()`.
These become unnecessary once the QuickPick manages state internally. The `treeProvider.sectionFilter`
Set remains as the source of truth; the QuickPick reads it on open and writes it on accept.

---

## Feature 3: Scope-Level Lock Toggle

### Design Principle

The lock is a UI-side write guard managed entirely within the extension. It does not modify file
system permissions. It is a per-session, per-scope boolean held in `ConfigTreeProvider` (or a
dedicated `LockStore`). Locked scopes reject write commands with a user-visible error notification.

### API Components

**3a. Lock state storage:**
A `Set<ConfigScope>` held in `ConfigTreeProvider` or a separate `ScopeLockStore` singleton. Because
scope state is already managed in `ConfigTreeProvider` via `_sectionFilter`, follow the same pattern:

```typescript
// In ConfigTreeProvider
private readonly _lockedScopes = new Set<ConfigScope>();

isLocked(scope: ConfigScope): boolean {
  return this._lockedScopes.has(scope);
}

toggleLock(scope: ConfigScope): void {
  if (this._lockedScopes.has(scope)) {
    this._lockedScopes.delete(scope);
  } else {
    this._lockedScopes.add(scope);
  }
  this.syncLockContext();
  this.refresh(); // Redraw scope nodes with updated contextValue
}

private syncLockContext(): void {
  for (const scope of Object.values(ConfigScope)) {
    vscode.commands.executeCommand(
      'setContext',
      `claudeConfig_locked_${scope}`,
      this._lockedScopes.has(scope as ConfigScope),
    );
  }
}
```

**3b. ScopeNode contextValue update:**
Add `.locked` or `.unlocked` segment to the contextValue in `ScopeNode.computeContextValue()`.
The lock state must be passed into `ScopeNode` at construction (add `lockedScopes: ReadonlySet<ConfigScope>` parameter):

```typescript
// ScopeNode.computeContextValue()
protected computeContextValue(): string {
  const base = super.computeContextValue();      // e.g. "scope.editable"
  const locked = this.lockedScopes.has(this.scopedConfig.scope);
  const lockSegment = locked ? 'locked' : 'unlocked';
  // base already handles .missing suffix; insert before it or append
  return `${base}.${lockSegment}`;              // e.g. "scope.editable.unlocked"
}
```

**3c. Lock toggle command and inline icon button:**

```json
// In contributes.commands:
{
  "command": "claudeConfig.toggleScopeLock",
  "title": "Toggle Scope Lock",
  "category": "Claude Config",
  "icon": "$(lock)"
}

// In contributes.menus view/item/context:
{
  "command": "claudeConfig.toggleScopeLock",
  "when": "view == claudeConfigTree && viewItem =~ /^scope\\./ && viewItem =~ /\\.unlocked/",
  "group": "inline@0"
},
{
  "command": "claudeConfig.toggleScopeLock",
  "when": "view == claudeConfigTree && viewItem =~ /^scope\\./ && viewItem =~ /\\.locked/",
  "group": "inline@0"
}
```

Use `$(lock)` icon for locked, `$(unlock)` for unlocked. Since `contextValue` already encodes the
state, a single command suffices; icon variation requires two command entries with different icons
(same icon-swap pattern the extension already uses for filter buttons). Alternatively, keep a single
command and accept a single icon — `$(lock)` always — that conveys "click to toggle lock".

```json
// Simpler: single entry, single icon
{
  "command": "claudeConfig.toggleScopeLock",
  "when": "view == claudeConfigTree && viewItem =~ /^scope\\./",
  "group": "inline@0"
}
```

**3d. Write guard in command handlers:**
In every command that calls `configWriter` functions, check the lock before executing:

```typescript
// Utility function
function assertNotLocked(scope: ConfigScope, treeProvider: ConfigTreeProvider): boolean {
  if (treeProvider.isLocked(scope)) {
    vscode.window.showWarningMessage(
      `Scope "${SCOPE_LABELS[scope]}" is locked. Unlock it first to make changes.`
    );
    return false;
  }
  return true;
}

// Usage in addCommands.ts, editCommands.ts, deleteCommands.ts, moveCommands.ts:
if (!assertNotLocked(node.nodeContext.scope, treeProvider)) return;
```

**3e. Lock persistence (optional but recommended):**
The lock state is session-only by default. For persistence across sessions, use
`vscode.ExtensionContext.workspaceState` (workspace-scoped key-value store):

```typescript
// On activate:
const lockedScopes = new Set<ConfigScope>(
  context.workspaceState.get<ConfigScope[]>('claudeConfig.lockedScopes', [])
);

// On toggle:
await context.workspaceState.update(
  'claudeConfig.lockedScopes',
  [...treeProvider.lockedScopes]
);
```

`ExtensionContext.workspaceState` is available since VS Code 1.0. No version concern.

**3f. Managed scope is already read-only:**
`ConfigScope.Managed` already sets `isReadOnly: true` on `ScopedConfig` and renders as
`scope.readOnly` in `contextValue`. The lock toggle should be restricted to non-managed scopes.
Use `when` clause: `viewItem =~ /^scope\.editable/` to exclude read-only (managed) scope nodes from
showing the lock button.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `window.createQuickPick` | `window.showQuickPick` with `canPickMany: true` | Cannot pre-select items; no control over picker lifecycle; dispose is automatic |
| Remove 16 filter commands entirely | Keep with `when: "false"` on view/title | Dead code; 16 ghost command registrations on startup; misleading codebase |
| Set-based `_lockedScopes` in `ConfigTreeProvider` | Separate `ScopeLockStore` class | Scope filter already lives in `ConfigTreeProvider`; same pattern; avoids new class boundary |
| `workspaceState` for lock persistence | `globalState` | Locks are workspace-local intent; user probably wants different locks per project |
| Single toggle command for lock | Two commands (lock + unlock with different icons) | Icon-swap approach doubles command count for no UX gain; users expect click-to-toggle |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `QuickPickItem.picked` with `createQuickPick` | Silently ignored; items show checkmarks but are not selected (VS Code API design decision, will not be fixed) | `quickPick.selectedItems = [...]` |
| `QuickPickOptions.canPickMany` on `createQuickPick` | `canPickMany` is for `showQuickPick`; `createQuickPick` uses `canSelectMany` | `quickPick.canSelectMany = true` |
| `window.showQuickPick` for the filter UI | Cannot pre-select, cannot control dispose timing | `window.createQuickPick()` |
| File system `chmod` for scope locking | Not what users expect; breaks on read-only file systems and managed policies | In-memory lock Set + write guard in commands |

---

## Stack Patterns by Variant

**If the lock icon needs to visually toggle (lock/unlock icons):**
- Use two `view/item/context` menu entries with the icon-swap pattern (already used by existing filter
  buttons): one entry `when: "... viewItem =~ /\.locked/"` with `$(lock)` icon, another `when: "...
  viewItem =~ /\.unlocked/"` with `$(unlock)` icon. Same command for both.

**If filters should apply live (while picker is open):**
- Subscribe to `onDidChangeSelection` instead of only `onDidAccept`. Call `treeProvider.setSectionFilter()`
  on each checkbox toggle. This gives instant preview in the TreeView without closing the picker.
  `onDidHide` should restore the original filter if the user presses Escape.

**If lock state should be global (user-scoped, not workspace):**
- Replace `context.workspaceState` with `context.globalState`. Semantics change: the lock applies
  to the User scope across all workspaces.

---

## Version Compatibility

| API | Introduced | Min for this project | Compatible |
|-----|-----------|---------------------|------------|
| `window.createQuickPick()` | VS Code ~1.22 (stabilized) | 1.90.0 | YES |
| `QuickPick.canSelectMany` | VS Code ~1.22 | 1.90.0 | YES |
| `QuickPick.selectedItems` (writable) | VS Code ~1.22 | 1.90.0 | YES |
| `commands.executeCommand('setContext', ...)` | VS Code 1.0 | 1.90.0 | YES |
| `TreeItem.contextValue` regex `=~` | VS Code ~1.38 | 1.90.0 | YES |
| `ExtensionContext.workspaceState` | VS Code 1.0 | 1.90.0 | YES |
| `view/item/context` `inline` group | VS Code ~1.25 | 1.90.0 | YES |

All APIs are available in VS Code 1.90.0+. No new minimum version requirement.

---

## Installation

No new packages required. All APIs are in `vscode` (external, not bundled).

```bash
# No changes to package.json dependencies
# Only changes: package.json contributes section + new/modified TypeScript source files
```

---

## Sources

- Local `@types/vscode@1.90.0` — QuickPick interface (line 13142), `canSelectMany` (line 13199),
  `selectedItems` (line 13229), `onDidAccept` (line 13169), `QuickPickItem.picked` documentation
  (line 1960), `showQuickPick` overloads (line 11398, 11418), `createQuickPick` (line 11479).
  Confidence: HIGH (authoritative, version-locked to project minimum)
- VS Code GitHub issue #119834 — `QuickPickItem.picked` not working with `createQuickPick`, official
  workaround from VS Code team member: use `selectedItems`. Confidence: HIGH
- VS Code GitHub issue #138070 — Same bug, documented design decision "we didn't want two ways to do
  the same thing". Confidence: HIGH
- Official VS Code docs, when-clause-contexts — `setContext`, `=~` regex matching in `viewItem` when
  clauses. Confidence: HIGH
- Official VS Code docs, Tree View API — `contextValue`, `view/item/context`, inline group.
  Confidence: HIGH
- VS Code GitHub issue #64014 — Type asymmetry between `showQuickPick` (`canPickMany`) and
  `createQuickPick` (`canSelectMany`). Confirmed the naming discrepancy. Confidence: HIGH

---

*Stack research for: VS Code extension toolbar UX — QuickPick filter, toolbar cleanup, scope lock*
*Researched: 2026-02-18*
