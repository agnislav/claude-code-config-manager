# Feature Research

**Domain:** VS Code TreeView extension -- visual fidelity (overlap indicators, lock enforcement, navigation fix)
**Researched:** 2026-03-05
**Confidence:** HIGH (codebase inspection + VS Code API documentation + bug reproduction analysis)

---

## Context

This research covers three features for v0.6.0 "Visual Fidelity" milestone on an existing, fully functional VS Code extension (5,241 LOC TypeScript, shipped through v0.5.0):

1. **Visual overlap indicators** -- show when config entities (permissions, env vars, hooks, MCP servers, plugins, settings) exist in multiple scopes simultaneously
2. **Plugin checkbox lock enforcement** -- prevent checkbox visual state from toggling when User scope is locked
3. **Hook leaf navigation fix** -- clicking hook key-value leaf nodes should navigate editor to the correct JSON line

All three features modify existing infrastructure rather than adding new subsystems. The existing codebase already has override detection, scope locking, and reveal-in-file -- these features fix gaps in how those systems communicate state to the user.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that address broken or misleading behavior. Missing = user loses trust in the UI.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Plugin checkbox does not toggle when scope is locked | Checkbox flickers (toggles then reverts on next refresh) creating false state feedback. Every other locked-scope operation correctly blocks with a message -- plugins are the exception. | LOW | `extension.ts` checkbox handler, `configTreeProvider.ts` refresh |
| Hook leaf click navigates to correct JSON line | All other leaf node types (permissions, env vars, settings, sandbox properties) navigate correctly. Hooks are the only broken case -- user clicks a hook property and the editor either doesn't scroll or lands on the wrong line. | MEDIUM | `jsonLocation.ts` findKeyLine, `hookKeyValueNode.ts` keyPath, `hookEntryNode.ts` keyPath |
| Override indicator on overridden items | Already implemented for settings (dimmed icon + description text), permissions (cross-category conflict detection), env vars, sandbox properties, and plugins. The `overrideResolver.ts` produces `isOverridden` data and `baseNode.ts` applies styling via `applyOverrideStyle()`. This is table stakes because it already exists -- extending it is about consistency. | LOW | Existing `overrideResolver.ts`, `baseNode.ts` applyOverrideStyle |

---

### Differentiators (Overlap Visibility Beyond Overrides)

Features that go beyond fixing bugs to provide genuine multi-scope visibility. Not expected but add substantial value for the "all scopes in one place" value proposition.

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| "Also defined in" annotation on non-overridden items | When the same entity exists in multiple scopes but is NOT overridden (same-category permission rule, or lower-precedence scope has the same setting), the user currently has no way to see this without expanding every scope. An annotation like "(also in User)" on a Project Local setting surfaces cross-scope presence. | MEDIUM | New cross-scope lookup in `overrideResolver.ts` or per-node constructor; changes to description text in node constructors |
| Scope count badge via FileDecorationProvider | Use the existing `FileDecorationProvider` pattern (already used for plugin enabled/disabled dimming) to show a short badge like "2" or "3" indicating how many scopes define the same entity. Badge text is limited to 2 characters by the VS Code API. | MEDIUM | New `FileDecorationProvider`, custom URI scheme per entity type, `onDidChangeFileDecorations` event |
| Tooltip showing all scope values for an entity | When hovering over an entity that exists in multiple scopes, show a MarkdownString tooltip listing each scope's value. e.g., "User: `true` / Project Local: `false` (winning)". This gives complete cross-scope context without navigating between scopes. | MEDIUM | Cross-scope data lookup at tooltip computation time; override `computeTooltip()` in relevant node classes |
| Color-coded override indicators via FileDecorationProvider | Use `ThemeColor` in FileDecoration to color the label text of overridden items (e.g., `disabledForeground` for overridden, `errorForeground` for conflicting permissions). The extension already uses this pattern for disabled plugins. | LOW | Extension of existing `PluginDecorationProvider` pattern; new or expanded `FileDecorationProvider` |

---

### Anti-Features (Commonly Considered, Should NOT Build)

| Anti-Feature | Why It Seems Reasonable | Why Problematic | Alternative |
|--------------|------------------------|-----------------|-------------|
| Separate "Resolved View" mode showing merged config | "Show me the final effective config across all scopes" | Duplicates the tree with a second view that must stay in sync. Breaks the per-scope mental model. VS Code sidebar guidelines recommend 3-5 views max. The existing override annotations already communicate effective state inline. | Enhance per-scope annotations (description text + tooltips) to surface cross-scope context without a separate view |
| Strikethrough text for overridden items | "Visually cancel out the overridden value" | VS Code `TreeItem` API does not support text decoration (no strikethrough, no italic, no bold). `FileDecorationProvider` supports `color` and `badge` but NOT text-decoration. Attempting CSS hacks would break across themes and future VS Code versions. | Use `disabledForeground` ThemeColor via FileDecorationProvider (already proven with plugin nodes) + description text annotation |
| Interactive "resolve conflict" action on overlapping items | "Click to jump to the winning scope's version" | Adds command complexity for a niche interaction. The tree already shows both scopes -- user can click either. Adding a command creates an expectation of conflict resolution (merge/override) which is out of scope. | Tooltip shows the winning scope with its value; user navigates manually |
| Hide overridden items behind a toggle | "Reduce clutter by hiding items that don't matter" | Overridden items DO matter -- they represent configuration intent that is being suppressed. Hiding them makes the user forget they exist, leading to confusion when the winning scope changes. | Keep overridden items visible but visually differentiated (dimmed color, annotation) |
| Checkbox removal for locked-scope plugins | "If the checkbox can't do anything, remove it entirely" | VS Code checkbox API has no per-item disable. Removing the checkbox entirely changes the node's visual structure (no checkbox vs unchecked checkbox). More confusing than showing the checkbox and blocking the action with a message. | Keep checkbox visible, block toggle with informative message, immediately refresh to revert visual state |

---

## Detailed Feature Analysis

### Feature 1: Visual Overlap Indicators

**Current state:** The extension already detects and displays overrides for 5 entity types via `overrideResolver.ts`. When a higher-precedence scope defines the same key, the lower-precedence scope's node shows "(overridden by [Scope])" in its description and uses dimmed icons. This works for settings, permissions, env vars, sandbox properties, and plugins.

**Gap:** There is no indicator when:
- The same entity exists in multiple scopes but is NOT overridden (e.g., same permission rule in both User and Project Shared in the same category)
- A setting exists in multiple scopes with the same value (technically overridden by precedence, but the user doesn't know the other scope also defines it)
- MCP servers with the same name appear in multiple scopes

**Implementation approach -- use FileDecorationProvider for badges:**
The extension already registers two `FileDecorationProvider` instances (`PluginDecorationProvider` for dimming disabled plugins, `LockDecorationProvider` for lock state). The pattern is proven. A new `OverlapDecorationProvider` can use the `badge` property (max 2 chars) to show scope count, and `color` to tint the label of overridden items.

Each tree node already has a `resourceUri` (used by PluginNode) or can be given one via a custom URI scheme. The URI encodes entity identity; the decoration provider looks up cross-scope presence.

**VS Code API constraints (HIGH confidence, official docs):**
- `FileDecoration.badge`: string, max 2 characters. Suitable for scope count ("2", "3", "4").
- `FileDecoration.color`: ThemeColor. Applies to the label text. Already used for `disabledForeground`.
- `FileDecoration.tooltip`: string. Shown on hover over the badge.
- `FileDecoration.propagate`: boolean. For tree items without a `resourceUri`, decorations cannot be applied. Every node that needs overlap indication must set `resourceUri`.
- Badge text and color can coexist. Badge renders as a small label on the right side of the tree item.
- `onDidChangeFileDecorations` event must fire when overlap data changes (e.g., after config reload).

**Data source for overlap detection:**
The `overrideResolver.ts` already receives `allScopes: ScopedConfig[]` and can compute cross-scope presence. A new function like `findEntityScopes(entityType, entityKey, allScopes)` returns the set of scopes where the entity is defined. Node constructors already receive `allScopes` -- no new data plumbing needed.

**Complexity: MEDIUM overall.** LOW for extending override resolver, MEDIUM for wiring FileDecorationProvider with custom URIs across all node types, LOW for tooltip enhancement.

---

### Feature 2: Plugin Checkbox Lock Enforcement

**Current state:** The `onDidChangeCheckboxState` handler in `extension.ts` (line 128) checks `isReadOnly` and shows a message if the User scope is locked. However, VS Code's checkbox API fires the event AFTER the checkbox visual state has already changed. The handler correctly blocks the write, but the checkbox appears toggled until the next tree refresh reverts it.

**Root cause analysis (HIGH confidence, codebase inspection):**
1. User clicks checkbox on a locked-scope plugin
2. VS Code internally toggles the checkbox state (visual only)
3. `onDidChangeCheckboxState` fires with the new state
4. Handler detects `isReadOnly`, shows "User scope is locked" message
5. Handler `continue`s without writing
6. Checkbox remains in wrong visual state until next `configStore.onDidChange` triggers `treeProvider.refresh()`

**The fix is straightforward:** After the `isReadOnly` early-return path, call `treeProvider.refresh()` to force the tree to re-render with the correct checkbox state from the data model. This is the same pattern already used in the error handling path (line 153: `treeProvider.refresh()`).

**VS Code API limitation (HIGH confidence, GitHub issue #116141):** There is no API to prevent the checkbox from toggling. The `onDidChangeCheckboxState` event is fire-and-forget -- the extension cannot return `false` to cancel the state change. The only approach is to refresh the tree after rejecting the change.

**Risk:** Rapid checkbox clicking during the refresh window could cause visual jitter. Mitigated by the existing `isWriteInFlight` guard which blocks concurrent operations.

**Complexity: LOW.** Single line addition (`treeProvider.refresh()`) at the `isReadOnly` early-return branch. The same fix applies to the `togglePlugin` context menu command handler.

---

### Feature 3: Hook Leaf Navigation Fix

**Current state:** Clicking a `HookKeyValueNode` (e.g., the "command" property of a hook entry) triggers `claudeConfig.revealInFile` with `keyPath = ['hooks', 'PreToolUse', '0', '0', 'command']`. The `findKeyLine` function in `jsonLocation.ts` attempts to navigate this path through the JSON file.

**Root cause analysis (HIGH confidence, codebase inspection + JSON structure analysis):**
The hook JSON structure looks like:
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

The tree keyPath for "command" is `['hooks', 'PreToolUse', '0', '0', 'command']`, which means:
- `hooks` -- object key at indent 2
- `PreToolUse` -- object key at indent 4
- `0` -- first array element (the matcher object)
- `0` -- should be first element of the `hooks` array INSIDE the matcher, but...

**The bug:** The keyPath segment `'0'` (hookIndex) maps to the array element within the matcher's `hooks` array. But `findKeyLine` processes array indices by finding the Nth element after an opening `[`. After finding matcher index `0` (the first `{` after `PreToolUse: [`), the next segment `0` (hookIndex) needs to find the opening `[` of the nested `hooks` array, then find element 0 within it. However, `findKeyLine` uses `searchFromLine` tracking that may not correctly enter the nested structure -- it looks for `[` on or after the current line, which could match the wrong bracket.

Additionally, the `HookEntryNode` keyPath `['hooks', eventType, matcherIndex, hookIndex]` skips the intermediate `matcher` and `hooks` keys in the JSON structure. The JSON path to the hook command is actually `hooks.PreToolUse[0].hooks[0].command`, but the tree keyPath is `hooks.PreToolUse.0.0.command` -- missing the intermediate `hooks` object key.

**The fix requires aligning the keyPath with the actual JSON structure.** The tree node keyPath needs to include the intermediate JSON keys (`matcher`, `hooks`) so that `findKeyLine` can walk the JSON correctly. Alternatively, `findKeyLine` needs to be enhanced to handle the tree's compressed keyPath format for hooks.

**Recommended approach:** Modify `HookEntryNode` and `HookKeyValueNode` to use keyPaths that match the JSON structure: `['hooks', 'PreToolUse', '0', 'hooks', '0']` for a hook entry and `['hooks', 'PreToolUse', '0', 'hooks', '0', 'command']` for a key-value leaf. This aligns with how `findKeyLine` walks the document -- alternating between object key lookup and array element lookup based on whether the segment is numeric.

**Impact on other systems:** The keyPath is used in:
1. `revealInFile` command (navigation -- the broken case)
2. `computeId()` in `baseNode.ts` (node identity for tree reveal/parent mapping)
3. `findNodeByKeyPath` in `configTreeProvider.ts` (editor-to-tree sync)
4. `computeContextValue()` (no impact -- doesn't use keyPath content)

Changing the keyPath format requires updating `findNodeByKeyPath` and `findKeyPathAtLine` to handle the new format for editor-to-tree reverse sync. The `findKeyPathAtLine` function builds keyPaths by walking backward through indentation, so it naturally produces paths matching JSON structure -- the alignment fix would actually make tree keyPaths match what `findKeyPathAtLine` produces, IMPROVING bidirectional sync.

**Complexity: MEDIUM.** Requires coordinated changes across `hookEntryNode.ts`, `hookKeyValueNode.ts`, `jsonLocation.ts`, and verification of `findNodeByKeyPath` / `findKeyPathAtLine` behavior.

---

## Feature Dependencies

```
[Feature 1: Visual Overlap Indicators]
    depends on --> overrideResolver.ts (extend with cross-scope lookup)
    depends on --> baseNode.ts resourceUri (needs custom URI for decoration)
    depends on --> FileDecorationProvider registration (extension.ts)
    independent of --> Features 2 and 3

[Feature 2: Plugin Checkbox Lock Fix]
    depends on --> treeProvider.refresh() (already exists)
    depends on --> extension.ts checkbox handler (modify early-return path)
    independent of --> Features 1 and 3

[Feature 3: Hook Leaf Navigation Fix]
    depends on --> hookEntryNode.ts keyPath format (modify)
    depends on --> hookKeyValueNode.ts keyPath format (modify)
    depends on --> jsonLocation.ts findKeyLine (verify/fix nested array handling)
    depends on --> findKeyPathAtLine (verify reverse-sync still works)
    independent of --> Features 1 and 2
```

### Dependency Notes

- **All three features are independent of each other.** No ordering constraint exists. They can be implemented and tested in any order or in parallel.
- **Feature 2 is the simplest** (single-line fix + test). It should go first to build momentum and reduce the known bug count.
- **Feature 3 has the highest risk** of regression because keyPath changes affect bidirectional editor-tree sync. It needs the most testing.
- **Feature 1 is the most open-ended** in scope. Start with the proven pattern (FileDecorationProvider with badge) and limit to scope count + tooltip. Do not attempt a "resolved view" mode.

---

## MVP Definition

### Must Ship (v0.6.0)

1. **Plugin checkbox lock enforcement** -- refresh tree after blocked toggle to revert visual state. One-line fix, immediate trust improvement.
2. **Hook leaf navigation fix** -- align keyPaths with JSON structure so `findKeyLine` navigates correctly. Fixes the only broken leaf-click case.
3. **Overlap indicators (minimal)** -- for entities that exist in multiple scopes, show which other scopes also define the same entity via description text annotation (e.g., "(also in User, Project Local)") on overridden AND non-overridden items. This uses the existing `applyOverrideStyle()` pattern and requires no new FileDecorationProvider.

### Add After Validation (v0.6.x)

- [ ] FileDecorationProvider badge showing scope count ("2", "3") -- add if description text feels too verbose or hard to scan
- [ ] Enhanced tooltip showing all scope values in Markdown table format -- add if users want to compare values without expanding multiple scopes
- [ ] Color tinting of overridden items via FileDecorationProvider -- add if the dimmed-icon-only approach is insufficient for visual differentiation

### Deferred (future milestones)

- [ ] "Resolved View" mode showing merged effective config -- see Anti-Features above
- [ ] Interactive conflict resolution (jump to winning scope) -- command palette integration deferred per PROJECT.md
- [ ] MCP server overlap detection (more complex due to separate config file and different merge semantics)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| Plugin checkbox lock fix | HIGH -- fixes misleading UI state | LOW -- single refresh() call | LOW -- no API changes | P0 |
| Hook leaf navigation fix | HIGH -- fixes broken functionality | MEDIUM -- keyPath restructure + sync verification | MEDIUM -- regression risk in editor-tree sync | P0 |
| Overlap "also in" annotation | MEDIUM -- surfaces hidden information | MEDIUM -- cross-scope lookup + description modification | LOW -- uses existing patterns | P1 |
| FileDecoration badge for scope count | LOW -- cosmetic enhancement | MEDIUM -- new provider + URI scheme + event wiring | LOW -- proven pattern | P2 |
| Enhanced overlap tooltip | LOW -- detail available on hover | LOW -- MarkdownString construction | LOW -- contained change | P2 |

---

## Sources

- VS Code Tree View API: https://code.visualstudio.com/api/extension-guides/tree-view (HIGH confidence -- official docs)
- VS Code FileDecorationProvider API: https://vscode-api.js.org/interfaces/vscode.FileDecorationProvider.html (HIGH confidence -- official API reference)
- VS Code TreeItem checkbox API -- GitHub issue #116141: https://github.com/microsoft/vscode/issues/116141 (HIGH confidence -- finalized API)
- VS Code checkbox state management -- GitHub issue #183339: https://github.com/microsoft/vscode/issues/183339 (MEDIUM confidence -- confirmed checkbox state behavior)
- VS Code FileDecoration badge limitations -- GitHub issue #182098: https://github.com/microsoft/vscode/issues/182098 (HIGH confidence -- confirmed 2-char badge limit)
- VS Code FileDecoration in tree views -- GitHub issue #166614: https://github.com/microsoft/vscode/issues/166614 (MEDIUM confidence -- confirmed resourceUri requirement)
- Direct codebase inspection: `src/extension.ts`, `src/tree/nodes/`, `src/config/overrideResolver.ts`, `src/utils/jsonLocation.ts`, `src/tree/configTreeProvider.ts` (HIGH confidence)
- Todo files: `.planning/todos/pending/2026-03-05-*.md` (HIGH confidence -- first-party bug reports)

---
*Feature research for: Claude Code Config Manager v0.6.0 -- visual fidelity (overlap indicators, lock enforcement, navigation fix)*
*Researched: 2026-03-05*
