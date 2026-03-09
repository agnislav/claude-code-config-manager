# Feature Landscape

**Domain:** Visual fidelity improvements for VS Code TreeView config editor
**Researched:** 2026-03-08
**Confidence:** HIGH (direct codebase analysis + VS Code API documentation)

---

## Context: What Already Exists

The v0.6.0 ViewModel layer (TreeViewModelBuilder) pre-computes all display state. Override resolution already works for settings, env vars, permissions, plugins, and sandbox properties -- producing `isOverridden`, `overriddenByScope`, dimmed icons, and description suffixes like `(overridden by Project Local)`. The lock toggle already sets `isReadOnly: true` on User scope and blocks edits. Plugin checkbox toggle already checks `isReadOnly` and shows an info message when locked. Hook entry nodes already have a `command` property that calls `revealInFile` with a keyPath.

The three v0.7.0 features address gaps in this existing system, not new systems.

---

## Table Stakes

Features that make the existing tree reflect truthful state. Without these, users see incomplete or wrong information.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Visual overlap indicators for same-name entities across scopes | When the same env var, plugin, setting, or MCP server appears in multiple scopes, nothing currently shows this. Users cannot tell that `API_KEY` in User scope is shadowed by `API_KEY` in Project Local without manually expanding both scopes. The override system already detects this but only shows it on the lower-precedence (losing) side. | Med | TreeViewModelBuilder (description, badge, tooltip computation), overrideResolver (already has all needed data) |
| Lock-aware plugin checkbox suppression | When User scope is locked, clicking a plugin checkbox fires `onDidChangeCheckboxState`, the handler detects `isReadOnly`, shows an info message, and calls `treeProvider.refresh()` to reset the checkbox. But: (1) VS Code does not support disabling individual checkboxes, so the checkbox always appears interactive; (2) the visual reset causes a brief flicker as the tree refreshes. The fix is to prevent the write and immediately revert without full refresh. | Low | extension.ts checkbox handler, PluginVM contextValue |
| Hook leaf click navigates to correct JSON line | Hook entries have keyPath `['hooks', eventType, matcherIndex, hookIndex]` where matcherIndex and hookIndex are stringified numbers. `findKeyLine()` handles numeric segments as array indices. But the hook JSON structure nests matchers as array-of-objects with a `hooks` sub-array, meaning the keyPath `['hooks', 'PreToolUse', '0', '0']` must navigate through two levels of array indexing. The current implementation may land on the wrong line when matchers have multiple hooks or when the `hooks` key inside a matcher object is encountered. | Low-Med | jsonLocation.ts `findKeyLine()`, builder.ts hook entry keyPath construction |

---

## Differentiators

Features that go beyond correctness into polish. Not required for v0.7.0 but add significant UX value.

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Overlap badge via FileDecorationProvider | Show a short badge (e.g., "2x" or scope-initial letter) on entities that exist in multiple scopes. FileDecoration.badge supports up to 2 characters, can use ThemeColor, and appears right-aligned on the tree item. Already have the pattern from PluginDecorationProvider and LockDecorationProvider. | Low | New URI scheme for overlap, new FileDecorationProvider, builder computes overlap count |
| Overlap tooltip with scope list | MarkdownString tooltip listing all scopes where an entity appears: "Also defined in: **Project Local**, **User**". More informative than badge alone. Already producing MarkdownString tooltips for overrides. | Low | Builder overlap detection across allScopes |
| Checkbox tooltip on locked plugins | VS Code TreeItem checkboxState accepts an object form: `{ state: TreeItemCheckboxState, tooltip: string }`. When User scope is locked, set tooltip to "Scope is locked" so hovering the checkbox explains why toggling has no effect. | Low | Builder produces checkbox object instead of enum when locked |
| Clean up dead HookKeyValueVM/Node/builder code | v0.6.0 left HookKeyValueVM, HookKeyValueNode, and buildHookKeyValueVM as dead code after deciding hook entries should be leaf nodes. Removing ~80 lines of unused code. | Low | None -- pure deletion |

---

## Anti-Features

Features to explicitly NOT build in v0.7.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Cross-scope entity merging (single node showing all scopes) | Fundamentally changes the tree model from "scope-first" to "entity-first". Would require a different tree structure, break the mental model of "each scope shows its own file contents", and conflict with edit/delete commands that target a specific scope. | Keep scope-first tree. Overlap indicators show cross-scope presence without merging. |
| Disabling checkbox rendering on locked items | VS Code TreeItem API has no way to conditionally remove a checkbox once set. Setting checkboxState to undefined would hide the checkbox entirely, losing the visual indication of enabled/disabled state. | Keep checkbox visible; use tooltip + immediate revert to communicate lock state. |
| Full tree diff on refresh (virtual DOM approach) | VS Code TreeView has no partial-update API. `_onDidChangeTreeData.fire()` always triggers full tree rebuild. Building a diffing layer adds complexity with zero rendering benefit since VS Code will request all visible nodes anyway. | Continue with fire() full rebuild. Tree is small enough (~100 nodes typical) that rebuild is instant. |
| Badge/decoration for override direction (winning vs losing) | The current override system already dims losing items and adds description text. Adding separate badges for "this item wins" vs "this item loses" doubles visual noise without adding actionable information. | Keep existing dimming + description suffix for overridden (losing) items. Add overlap indicator only for cross-scope presence. |
| Animated or transitional checkbox revert | VS Code TreeView provides no animation API. Attempting smooth transitions via rapid state changes would cause flicker and race conditions with the file watcher. | Instant revert via `treeProvider.refresh()` or targeted checkbox state reset. |

---

## Feature Dependencies

```
Overlap detection in builder (compute which entities appear in multiple scopes)
  |
  +-> Description text: "also in Project Local" (table stakes)
  +-> MarkdownString tooltip with scope list (differentiator)
  +-> FileDecoration badge "2x" (differentiator)
       |
       +-> New OverlapDecorationProvider + URI scheme

Lock-aware checkbox (independent of overlap)
  |
  +-> Checkbox object form with tooltip (differentiator)
  +-> Immediate revert without full refresh (table stakes)

Hook leaf navigation fix (independent of both above)
  |
  +-> findKeyLine() fix for nested array-of-objects with sub-arrays
  +-> Verify keyPath construction in buildHookEntryVM

Dead code cleanup (independent)
  |
  +-> Remove HookKeyValueVM, HookKeyValueNode, buildHookKeyValueVM
```

All three main features are independent of each other and can be built in any order or in parallel.

---

## MVP Recommendation

**Prioritize:**

1. **Hook leaf navigation fix** -- Smallest scope, highest annoyance factor. Every click on a hook entry currently may land on the wrong line. Fix is localized to `jsonLocation.ts` and possibly builder keyPath construction. Verify with a test fixture that has multiple matchers with multiple hooks.

2. **Lock-aware plugin checkbox** -- Small scope, clear user confusion when checkbox "toggles then reverts". Two changes: (a) in the `onDidChangeCheckboxState` handler, revert the specific item's checkbox state without full tree refresh; (b) in the builder, use the object form of checkboxState with a tooltip when scope is locked.

3. **Visual overlap indicators** -- Largest scope but most impactful for the "visual fidelity" milestone goal. Implement in the builder by cross-referencing allScopes for each entity. Start with description text (lowest risk, no new providers needed), then add tooltip, then optionally badge decoration.

**Defer:**
- Dead code cleanup: Do as final commit or alongside any feature that touches the same files.
- FileDecoration badge for overlap: Optional polish on top of description text. Can ship v0.7.0 without it.

---

## Implementation Details

### Overlap Detection

The builder already receives `allScopes: ScopedConfig[]` for override resolution. Overlap detection is a simpler query: "does this entity key exist in any other scope?" (vs override resolution which asks "does a higher-precedence scope win?").

For each entity type:
- **Settings:** Check if key exists in any other scope's config (excluding DEDICATED_SECTION_KEYS)
- **Env vars:** Check if env key exists in any other scope's config.env
- **Plugins:** Check if pluginId exists in any other scope's config.enabledPlugins
- **MCP servers:** Check if serverName exists in any other scope's mcpConfig.mcpServers
- **Sandbox:** Check if property key exists in any other scope's config.sandbox
- **Permissions:** Already handled by resolvePermissionOverride (cross-category conflicts)

The overlap check is distinct from override: an entity can exist in a lower-precedence scope without being overridden (same value) or in a higher-precedence scope (where it is the winner). Overlap says "this entity appears in N scopes" regardless of who wins.

### Checkbox Revert Strategy

VS Code's `onDidChangeCheckboxState` fires after the UI has already toggled. Two options:
1. **Full refresh** (current approach): `treeProvider.refresh()` rebuilds entire tree, resets checkbox. Causes brief flicker.
2. **Targeted revert**: Fire `_onDidChangeTreeData.fire(node)` for just the affected node. This is what VS Code's API supports -- passing a specific element to `fire()` triggers a single-node refresh. Cleaner but requires the node reference to be stable.

Recommendation: Use approach 2 (targeted node refresh) since we already have the node reference in the event handler.

### Hook keyPath Structure

Current hook entry keyPath: `['hooks', eventType, matcherIndex, hookIndex]`

The JSON structure is:
```json
{
  "hooks": {
    "PreToolUse": [          // eventType key
      {                       // matcher at index 0
        "matcher": "Bash",
        "hooks": [            // hooks sub-array
          {                    // hook at index 0
            "type": "command",
            "command": "echo hello"
          }
        ]
      }
    ]
  }
}
```

The keyPath `['hooks', 'PreToolUse', '0', '0']` needs `findKeyLine()` to:
1. Find `"hooks"` key at indent 2
2. Find `"PreToolUse"` key at indent 4
3. Find array element 0 (the matcher object) -- opens `{` at indent 6
4. Find array element 0 inside the matcher's `hooks` sub-array

But step 4 is wrong: the fourth segment is not "find element 0 inside the current context" -- it needs to find the `hooks` key inside the matcher object first, then find element 0 of that sub-array. The keyPath should be `['hooks', 'PreToolUse', '0', 'hooks', '0']` to correctly navigate the nested structure.

This means the fix is in the **builder** (keyPath construction), not in `findKeyLine()`.

---

## Complexity Assessment

| Feature | Estimated LOC Change | Risk | Verification |
|---------|---------------------|------|-------------|
| Overlap indicators (description + tooltip) | ~40-60 lines in builder.ts | Low | Manual inspection: expand same entity in two scopes, verify description shows overlap |
| Overlap badge (FileDecorationProvider) | ~30-40 lines new provider + URI scheme | Low | Manual inspection: badge appears on overlapping entities |
| Plugin checkbox lock fix | ~10-20 lines in extension.ts + builder.ts | Low | Lock User scope, click plugin checkbox, verify no flicker and tooltip shown |
| Hook navigation fix | ~5-10 lines in builder.ts keyPath | Low | Click hook entry, verify editor lands on correct line |
| Dead code cleanup | ~-80 lines (deletion) | None | Compile succeeds, no runtime changes |

**Total estimated LOC change:** ~85-130 lines modified/added, ~80 lines removed. Net change: small.

---

## Sources

- Direct codebase analysis: `src/viewmodel/builder.ts` (TreeViewModelBuilder, all build methods, override resolution integration)
- Direct codebase analysis: `src/viewmodel/types.ts` (BaseVM, PluginVM, HookEntryVM -- checkboxState, command properties)
- Direct codebase analysis: `src/config/overrideResolver.ts` (5 resolver functions, allScopes pattern)
- Direct codebase analysis: `src/utils/jsonLocation.ts` (findKeyLine, findArrayElement, findObjectKey)
- Direct codebase analysis: `src/extension.ts` lines 128-157 (onDidChangeCheckboxState handler)
- Direct codebase analysis: `src/tree/nodes/pluginNode.ts` (PluginDecorationProvider, PLUGIN_URI_SCHEME)
- Direct codebase analysis: `src/tree/lockDecorations.ts` (LockDecorationProvider pattern)
- Direct codebase analysis: `src/commands/openFileCommands.ts` (revealInFile command, findKeyLine usage)
- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view) -- TreeItem description, tooltip, contextValue, checkboxState
- [VS Code TreeItem checkbox API](https://github.com/microsoft/vscode/issues/116141) -- checkboxState object form with tooltip
- [VS Code FileDecoration badge](https://github.com/microsoft/vscode/issues/125658) -- badge limited to 2 characters
- [VS Code FileDecorationProvider API](https://github.com/microsoft/vscode/issues/47502) -- custom view decoration support
- Confidence: HIGH -- all three features are well within established VS Code extension API patterns already used in this codebase

---
*Feature research for: Claude Code Config Manager v0.7.0 -- Visual Fidelity*
*Researched: 2026-03-08*
