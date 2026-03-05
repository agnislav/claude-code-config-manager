# Architecture Research

**Domain:** VS Code TreeView extension — visual overlap indicators, plugin lock enforcement, hook leaf navigation
**Researched:** 2026-03-05
**Confidence:** HIGH (based on direct codebase inspection of all affected files + VS Code API knowledge)

---

## System Overview (Current State)

```
Config Files on disk
  -> configDiscovery -> configLoader -> ConfigStore (in-memory, emits change events)
  -> overrideResolver (compute effective values per scope)
  -> ConfigTreeProvider (build tree, cache children, manage parent map)
  -> Tree nodes: ScopeNode > SectionNode > leaf nodes (PluginNode, HookEntryNode, etc.)
  -> VS Code TreeView UI (checkbox toggles, click-to-reveal, context menus)

Write path:
  Command handler (checks isReadOnly) -> configWriter -> disk -> fileWatcher -> ConfigStore.reload()
```

---

## Feature 1: Visual Overlap Indicators

### Problem

When the same config entity (env var, plugin, setting, MCP server, hook event) exists in multiple scopes, only the lower-precedence scope shows "overridden by X." There is no visual indicator on the higher-precedence (winning) scope that it is shadowing something below. Users cannot see at a glance which entities overlap across scopes.

### What "Overlap" Means vs "Override"

The existing override system answers: "Is this value being overridden by a higher-precedence scope?" Overlap is the inverse question: "Does this value shadow something in a lower-precedence scope?" Both directions need visibility.

Current override resolver functions return `{ isOverridden, overriddenByScope }` — indicating the current scope's value is being overridden from above. Overlap detection needs the opposite: "does a lower-precedence scope also define this?"

### Architecture: Where Overlap Detection Lives

**Recommended: Add `resolveOverlap*` functions to `overrideResolver.ts`**

Rationale: `overrideResolver.ts` already contains all cross-scope resolution logic. Adding overlap detection here keeps the pattern consistent — pure functions that take `(entityId, currentScope, allScopes)` and return overlap metadata.

**New function signatures:**

```typescript
// In overrideResolver.ts:
export function resolveScalarOverlap(
  key: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): { overlaps: boolean; overlappedScopes: ConfigScope[] };

export function resolveEnvOverlap(
  envKey: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): { overlaps: boolean; overlappedScopes: ConfigScope[] };

export function resolvePluginOverlap(
  pluginId: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): { overlaps: boolean; overlappedScopes: ConfigScope[] };

// Similar for hooks, MCP servers, sandbox, permissions
```

These functions check lower-precedence scopes (higher index in SCOPE_PRECEDENCE) for the same entity. Logic is the mirror of the existing `resolve*Override` functions.

### Architecture: How Overlap Flows Through Tree Nodes

**Option A (recommended): Extend `NodeContext` with overlap fields**

```typescript
// In types.ts:
export interface NodeContext {
  // ... existing fields ...
  hasOverlap: boolean;           // NEW: this entity shadows something below
  overlappedScopes?: ConfigScope[]; // NEW: which scopes are shadowed
}
```

This is consistent with how `isOverridden` and `overriddenByScope` already exist in `NodeContext`.

**Option B (rejected): Separate decoration provider**

A `FileDecorationProvider` could apply overlap badges via `resourceUri`. However, not all leaf nodes use custom `resourceUri` schemes (only PluginNode and ScopeNode do today). Adding `resourceUri` to every leaf type just for overlap badges adds more complexity than extending `NodeContext`.

### Visual Representation

**Recommended: Description suffix + tooltip, mirroring existing override pattern**

The existing override indicator in `baseNode.applyOverrideStyle()` appends `(overridden by {scope})` to the description. The overlap indicator should follow the same pattern:

```typescript
// In baseNode.ts, new method:
protected applyOverlapStyle(): void {
  if (this.nodeContext.hasOverlap && this.nodeContext.overlappedScopes?.length) {
    const scopeLabels = this.nodeContext.overlappedScopes
      .map(s => SCOPE_LABELS[s])
      .join(', ');
    this.description = `${this.description ?? ''} (also in ${scopeLabels})`.trim();
  }
}
```

Call `applyOverlapStyle()` from `finalize()` in `baseNode.ts`, after `applyOverrideStyle()`.

### Component Boundaries

| File | Change Type | What Changes |
|------|-------------|--------------|
| `src/types.ts` | Modify | Add `hasOverlap: boolean` and `overlappedScopes?: ConfigScope[]` to `NodeContext` |
| `src/config/overrideResolver.ts` | Modify | Add `resolveScalarOverlap`, `resolveEnvOverlap`, `resolvePluginOverlap`, `resolveSandboxOverlap`, `resolvePermissionOverlap` (overlap variants), possibly `resolveHookOverlap`, `resolveMcpOverlap` |
| `src/tree/nodes/baseNode.ts` | Modify | Add `applyOverlapStyle()` method; call from `finalize()` after `applyOverrideStyle()`. Update `computeTooltip()` to include overlap info. Update `computeContextValue()` to include `overlapped` segment if needed. |
| `src/tree/nodes/settingNode.ts` | Modify | Call `resolveScalarOverlap` in constructor, pass results into `NodeContext` |
| `src/tree/nodes/envVarNode.ts` | Modify | Call `resolveEnvOverlap` in constructor |
| `src/tree/nodes/pluginNode.ts` | Modify | Call `resolvePluginOverlap` in constructor |
| `src/tree/nodes/sandboxPropertyNode.ts` | Modify | Call `resolveSandboxOverlap` in constructor |
| `src/tree/nodes/permissionRuleNode.ts` | Modify | Call overlap variant in constructor |
| `src/tree/nodes/hookEventNode.ts` | Modify | Call `resolveHookOverlap` in constructor (overlap at event type level, not individual hook) |
| `src/tree/nodes/mcpServerNode.ts` | Modify | Call `resolveMcpOverlap` in constructor |
| `src/tree/nodes/sectionNode.ts` | No change | Already passes `allScopes` to leaf node constructors |

### Data Flow

```
ConfigStore.getAllScopes(key)
  -> overrideResolver.resolveScalarOverlap(key, scope, allScopes)
       checks SCOPE_PRECEDENCE indexes > currentScope's index for same key
       returns { overlaps: true, overlappedScopes: [ConfigScope.User] }
  -> NodeContext { hasOverlap: true, overlappedScopes: [...] }
  -> baseNode.finalize() -> applyOverlapStyle() -> description suffix
  -> baseNode.computeTooltip() -> includes overlap info
```

---

## Feature 2: Plugin Checkbox Lock Enforcement

### Problem

When User scope is locked (via the lock toggle toolbar button), plugin checkboxes in the User scope can still be toggled. The `onDidChangeCheckboxState` handler in `extension.ts` checks `isReadOnly` and shows a message, but VS Code has already visually toggled the checkbox in the UI. The user sees a checkbox flip followed by an info message, then the tree refreshes reverting the checkbox — a jarring UX.

### Root Cause Analysis

The VS Code TreeView checkbox API does not support preventing a toggle before it happens. `onDidChangeCheckboxState` fires after the UI state has already changed. The current code at `extension.ts:127-156` does:

1. Checkbox toggles visually (VS Code internal)
2. `onDidChangeCheckboxState` fires
3. Handler checks `isReadOnly` -> shows message, skips write
4. No `treeProvider.refresh()` call in the skip path -> **checkbox stays in wrong state**

The `continue` statement on line 138 skips the write but does not refresh the tree, leaving the checkbox visually toggled but with no corresponding disk change. Eventually a file watcher event or other action may trigger a refresh, but the immediate state is incorrect.

### Architecture: The Fix

**Add `treeProvider.refresh()` after the `isReadOnly` early return in the `onDidChangeCheckboxState` handler.**

This is the minimal, correct fix. After showing the lock message, refresh the tree to rebuild all nodes from disk state, which reverts the checkbox to its correct checked/unchecked state.

```typescript
// In extension.ts, onDidChangeCheckboxState handler:
treeView.onDidChangeCheckboxState(async (e) => {
  for (const [item, state] of e.items) {
    const node = item as ConfigTreeNode;
    if (node.nodeType !== 'plugin') continue;
    const { filePath, keyPath, isReadOnly } = node.nodeContext;
    if (isReadOnly || !filePath || keyPath.length < 2) {
      if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
        vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
      }
      treeProvider.refresh(); // <-- ADD THIS: revert checkbox visual state
      return;                 // <-- CHANGE from 'continue' to 'return'
    }
    // ... rest of handler
  }
});
```

**Why `return` instead of `continue`:** If any item in the batch is read-only, we should refresh the entire tree to revert all checkbox states in that batch, then stop processing. Processing further items in a partially-reverted tree could lead to inconsistent state.

### Alternative Considered and Rejected

**Remove checkbox entirely when locked, use icon-only representation:** This would require conditionally setting `checkboxState` based on `isReadOnly`. While technically clean, it would cause the visual layout to shift when locking/unlocking (checkboxes appearing/disappearing), which is more disruptive than the current approach of keeping checkboxes visible but reverting unauthorized toggles.

### Component Boundaries

| File | Change Type | What Changes |
|------|-------------|--------------|
| `src/extension.ts` | Modify | Add `treeProvider.refresh()` in the `isReadOnly` early-return path of `onDidChangeCheckboxState` handler. Change `continue` to `return`. |

**One file, two lines changed.** This is the entire fix.

---

## Feature 3: Hook Leaf Click Navigation Fix

### Problem

When clicking a `HookKeyValueNode` (a leaf child of `HookEntryNode`), the editor opens the config file but the cursor lands on the wrong line. The `revealInFile` command receives the `keyPath` from `nodeContext` and calls `findKeyLine()` to locate the JSON key.

### Root Cause Analysis

`HookKeyValueNode` has keyPath: `['hooks', eventType, matcherIndex, hookIndex, propertyKey]`

Example: `['hooks', 'PreToolUse', '0', '0', 'command']`

`findKeyLine()` in `jsonLocation.ts` walks the keyPath segments sequentially. For numeric segments, it uses `findArrayElement()` which counts elements at the array level. The issue is in how `findKeyLine` processes the hook JSON structure:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo hello",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

The keyPath `['hooks', 'PreToolUse', '0', '0', 'command']` navigates:
1. `hooks` -> found at indent 2 (correct)
2. `PreToolUse` -> found at indent 4 (correct)
3. `0` (matcherIndex) -> `findArrayElement` finds the first `{...}` object in the `PreToolUse` array (correct)
4. `0` (hookIndex) -> This is the problem. After finding the matcher object at step 3, `searchFromLine` points to the opening `{` of the matcher. Now `findArrayElement` looks for a `[` bracket, but the next relevant `[` is the inner `"hooks": [` array. However, `findArrayElement` does a naive search for `[` on any line after `searchFromLine`, and may find the wrong bracket.
5. `command` -> If step 4 landed wrong, this also lands wrong.

The structural issue: `findArrayElement` searches forward from `searchFromLine` for the first `[` character, but the matcher object contains a `"hooks"` key whose value is an array. The function needs to find the `[` that is the value of the property at the current context level, but it has no concept of JSON nesting depth.

Additionally, the keyPath structure `['hooks', eventType, matcherIndex, hookIndex, propertyKey]` treats `matcherIndex` as an index into the event type's array and `hookIndex` as an index into the matcher's `hooks` array. But `findKeyLine` has no awareness that between `matcherIndex` and `hookIndex`, there needs to be a descent into the `hooks` property of the matcher object. The keyPath skips the intermediate `hooks` key.

### Architecture: The Fix

**Option A (recommended): Fix the keyPath to include the intermediate `hooks` key**

The `HookEntryNode` constructor currently builds keyPath as:
```typescript
keyPath: ['hooks', eventType, String(matcherIndex), String(hookIndex)]
```

But the actual JSON path is:
```
hooks -> PreToolUse -> [matcherIndex] -> hooks -> [hookIndex]
```

The keyPath should be:
```typescript
keyPath: ['hooks', eventType, String(matcherIndex), 'hooks', String(hookIndex)]
```

And `HookKeyValueNode` should be:
```typescript
keyPath: ['hooks', eventType, String(matcherIndex), 'hooks', String(hookIndex), propertyKey]
```

This makes the keyPath accurately reflect the JSON structure, allowing `findKeyLine()` to navigate correctly without any changes to the JSON location utility.

**Impact on other consumers of keyPath:** The keyPath is used in:
1. `findKeyLine()` for reveal-in-file navigation (fixed by this change)
2. `baseNode.computeId()` for tree node identity (IDs change, but this is safe since they are recomputed on every refresh)
3. `findNodeByKeyPath()` for editor-to-tree sync (must verify this still works)
4. `findKeyPathAtLine()` for reverse lookup (editor line -> keyPath) — this function walks backward through JSON indentation, and already correctly produces paths that include intermediate object keys. The current tree keyPath is the one that is wrong, not `findKeyPathAtLine()`.

**Critical verification:** `findKeyPathAtLine()` already produces `['hooks', 'PreToolUse', '0', 'hooks', '0', 'command']` when the cursor is on the `"command"` line inside a hook entry. This means the editor-to-tree sync is currently broken too, because `findNodeByKeyPath` tries to match this against the tree's `['hooks', 'PreToolUse', '0', '0', 'command']` which does not match. Fixing the tree keyPath fixes both directions simultaneously.

**Option B (rejected): Modify `findKeyLine()` to handle keyPath gaps**

Adding special-case logic to `findKeyLine()` for hook structures couples the JSON parser to domain knowledge about hook config shape. This violates the function's design as a generic JSON key path walker.

### Component Boundaries

| File | Change Type | What Changes |
|------|-------------|--------------|
| `src/tree/nodes/hookEntryNode.ts` | Modify | Change keyPath from `['hooks', eventType, String(matcherIndex), String(hookIndex)]` to `['hooks', eventType, String(matcherIndex), 'hooks', String(hookIndex)]` |
| `src/tree/nodes/hookKeyValueNode.ts` | Modify | Change keyPath from `['hooks', eventType, String(matcherIndex), String(hookIndex), propertyKey]` to `['hooks', eventType, String(matcherIndex), 'hooks', String(hookIndex), propertyKey]` |

**Two files, one line each.** The `findKeyLine()` and `findKeyPathAtLine()` utilities require no changes.

### Data Flow (Fixed)

```
HookKeyValueNode click
  -> command: claudeConfig.revealInFile
  -> args: [filePath, ['hooks', 'PreToolUse', '0', 'hooks', '0', 'command']]
  -> findKeyLine(filePath, keyPath):
       'hooks'      -> findObjectKey at indent 2 -> found line 2
       'PreToolUse' -> findObjectKey at indent 4 -> found line 3
       '0'          -> findArrayElement index 0 -> found line 4 (opening { of matcher)
       'hooks'      -> findObjectKey at indent 8 -> found line 6 (the matcher's "hooks" key)
       '0'          -> findArrayElement index 0 -> found line 7 (opening { of hook entry)
       'command'    -> findObjectKey at indent 12 -> found line 9 (correct!)
  -> editor cursor placed at line 9

Editor-to-tree sync (reverse):
  -> cursor on line 9 ("command": "echo hello")
  -> findKeyPathAtLine -> walks backward through indentation
  -> produces ['hooks', 'PreToolUse', '0', 'hooks', '0', 'command']
  -> findNodeByKeyPath matches HookKeyValueNode (keyPaths now agree)
  -> tree node highlighted (correct!)
```

---

## Suggested Build Order

### Phase 1: Hook Leaf Navigation Fix (Feature 3)

Build first because:
- Smallest change (2 lines in 2 files)
- Zero risk of regression to other features
- Fixes both click-to-reveal AND editor-to-tree sync for hooks simultaneously
- No new APIs, no new state, no UI changes
- Can be verified in isolation with a simple manual test

### Phase 2: Plugin Checkbox Lock Enforcement (Feature 2)

Build second because:
- Small change (2 lines in 1 file)
- Low risk, but needs manual testing with lock toggle + checkbox interaction
- Depends on understanding the tree refresh lifecycle, which Phase 1 exercises
- Self-contained: does not interact with overlap indicators

### Phase 3: Visual Overlap Indicators (Feature 1)

Build last because:
- Largest change: touches `types.ts`, `overrideResolver.ts`, `baseNode.ts`, and 7 leaf node files
- Adds new fields to `NodeContext` (schema change)
- Adds new functions to `overrideResolver.ts` (new logic)
- Benefits from the codebase being stable after Phases 1 and 2
- Can be tested incrementally: implement for one entity type first (e.g., env vars), verify, then extend to all types

---

## Architectural Patterns to Follow

### Pattern 1: KeyPath Must Match JSON Structure Exactly

**What:** Tree node `keyPath` arrays must mirror the actual JSON key path from root to the target property, including intermediate object keys and array indices.
**When to use:** Always, for any node whose keyPath is used in `findKeyLine()` or `findNodeByKeyPath()`.
**Why:** `findKeyLine()` is a generic JSON walker that descends one level per keyPath segment. Skipping intermediate keys breaks navigation.

### Pattern 2: Symmetric Override/Overlap in overrideResolver

**What:** For every `resolve*Override()` function that checks higher-precedence scopes, add a corresponding `resolve*Overlap()` function that checks lower-precedence scopes.
**When to use:** When adding overlap detection for a new entity type.
**Why:** Keeps cross-scope resolution logic centralized. Both directions use the same `SCOPE_PRECEDENCE` ordering and the same entity-matching logic; only the comparison direction differs.

### Pattern 3: Tree Refresh as Checkbox Revert

**What:** When a checkbox toggle must be rejected (read-only scope), call `treeProvider.refresh()` to rebuild all nodes from disk state, which naturally reverts the checkbox.
**When to use:** Any `onDidChangeCheckboxState` handler that needs to reject a change.
**Why:** VS Code does not expose a way to prevent checkbox toggles before they happen. The only reliable revert mechanism is a full tree refresh that reconstructs `TreeItem.checkboxState` from the authoritative config data.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Domain-Specific Logic in findKeyLine

**What:** Adding hooks-specific (or any entity-specific) parsing logic to `findKeyLine()`.
**Why bad:** `findKeyLine()` is designed as a generic JSON key path walker. Adding domain knowledge couples it to config schema changes. Every schema change would require updating the walker.
**Instead:** Fix the keyPath at the source (tree node constructors) so the generic walker works correctly.

### Anti-Pattern 2: Overlap Detection in Tree Nodes

**What:** Computing overlap by iterating `allScopes` inside each leaf node constructor.
**Why bad:** Duplicates logic across 7+ node files. Each node would independently implement the "check lower-precedence scopes" pattern, with subtle variations.
**Instead:** Centralize in `overrideResolver.ts` and call from node constructors, same as the existing override pattern.

### Anti-Pattern 3: Conditional Checkbox Removal for Lock

**What:** Setting `checkboxState = undefined` when `isReadOnly` to hide the checkbox entirely.
**Why bad:** Visual layout shifts when locking/unlocking. Plugins with no checkbox look like non-plugin nodes. The absence of a checkbox does not clearly communicate "this scope is locked" — it communicates "this is not a toggleable item."
**Instead:** Keep the checkbox visible, revert unauthorized toggles via `treeProvider.refresh()`, and show an informational message.

---

## Integration Points

### New vs Modified Components

| Component | Status | Notes |
|-----------|--------|-------|
| `overrideResolver.ts` | Modified | Add 5-7 overlap functions (mirrors of existing override functions) |
| `types.ts` (NodeContext) | Modified | Add `hasOverlap`, `overlappedScopes` fields |
| `baseNode.ts` | Modified | Add `applyOverlapStyle()`, update `computeTooltip()` |
| `hookEntryNode.ts` | Modified | Fix keyPath (add intermediate `hooks` segment) |
| `hookKeyValueNode.ts` | Modified | Fix keyPath (add intermediate `hooks` segment) |
| `extension.ts` | Modified | Add `treeProvider.refresh()` in checkbox reject path |
| All leaf nodes (7 files) | Modified | Call overlap resolver, pass results to NodeContext |
| `jsonLocation.ts` | No change | Generic walker works correctly with fixed keyPaths |
| `configModel.ts` | No change | No new state needed |
| `configWriter.ts` | No change | No write behavior changes |
| `configTreeProvider.ts` | No change | Already passes `allScopes` through the node hierarchy |
| `sectionNode.ts` | No change | Already passes `allScopes` to leaf constructors |

### Cross-Feature Dependencies

```
Feature 3 (hook keyPath fix) -- independent, no deps
Feature 2 (plugin lock fix) -- independent, no deps
Feature 1 (overlap indicators) -- independent, no deps

No cross-feature dependencies. All three can be built in any order.
Build order recommendation is based on risk and size, not dependency.
```

---

## Sources

- Direct codebase inspection of all affected source files (HIGH confidence)
- VS Code TreeView checkbox API: [Allow TreeItems to have optional checkboxes](https://github.com/microsoft/vscode/issues/116141) (MEDIUM confidence)
- VS Code Tree View API guide: [Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view) (MEDIUM confidence)
- VS Code TreeView checkbox state management: [Test tree checkbox API](https://github.com/microsoft/vscode/issues/183549) (MEDIUM confidence)

---
*Architecture research for: Claude Code Config Manager v0.6.0 Visual Fidelity*
*Researched: 2026-03-05*
