# Technology Stack

**Project:** Claude Code Config Manager v0.7.0 -- Visual Fidelity
**Researched:** 2026-03-08
**Confidence:** HIGH (all findings verified against codebase source, VS Code API docs, and existing extension patterns)

---

## Context

This is a subsequent-milestone research document. The extension is at 6,247 LOC with a fully decoupled ViewModel layer (v0.6.0). This document covers the VS Code API surfaces and patterns needed for three v0.7.0 features:

1. **Visual overlap indicators** -- Show when config entities exist in multiple scopes
2. **Lock-aware plugin toggling** -- Prevent checkbox toggle on locked User scope
3. **Hook leaf editor navigation** -- Fix revealInFile for hook entry nodes

**Already validated (DO NOT re-research):** TypeScript strict mode, VS Code Extension API (TreeDataProvider, TreeItem, FileDecorationProvider), esbuild bundler, ViewModel layer (TreeViewModelBuilder, BaseVM, 14 NodeKind types), ConfigStore, configWriter, fileWatcher, overrideResolver, JSON Schema validation.

---

## Verdict: No New Dependencies Required

All three features are implementable with VS Code APIs already available at the minimum engine version (1.90.0) and patterns already established in the codebase. Zero new npm packages. Zero new VS Code API surfaces that are not already imported.

---

## Feature 1: Visual Overlap Indicators

### Problem

When a config entity (setting, env var, plugin, permission rule, MCP server) exists in multiple scopes, the tree shows it independently in each scope with no visual connection. Users cannot tell at a glance that `model: "claude-sonnet-4-20250514"` in User scope is the same key as `model: "claude-opus-4-20250514"` in Project Local scope. The existing override detection marks the lower-precedence value as "overridden" but does not show anything on the winning (higher-precedence) instance.

### Available VS Code API Surfaces

All of these are already used in the codebase:

| API | Property | Already Used | How to Use for Overlaps |
|-----|----------|-------------|------------------------|
| `TreeItem.description` | `string` | YES (override suffix, version strings) | Add "also in: User, Project Shared" text |
| `TreeItem.tooltip` | `string \| MarkdownString` | YES (override warnings, JSON previews) | Rich markdown listing all scopes with values |
| `TreeItem.iconPath` / `ThemeIcon` | `ThemeIcon(id, ThemeColor)` | YES (override dimming via `disabledForeground`) | No change needed -- dimming already handles overridden items |
| `FileDecorationProvider` | `FileDecoration.badge` (max 2 chars) | YES (plugin enabled/disabled, lock dimming) | Add scope count badge like "3" on items present in 3 scopes |
| `FileDecorationProvider` | `FileDecoration.color` | YES (disabled foreground) | Could use accent color for "winning" scope item |

### Recommended Approach

Use `TreeItem.description` and `TreeItem.tooltip` because they are the simplest, most visible, and already wired through the ViewModel layer.

**description:** The `BaseVM.description` field is already a `string` that flows through `ConfigTreeNode` constructor to `TreeItem.description`. The builder already appends override suffixes via `applyOverrideSuffix()`. Extend this pattern:
- Overridden items: keep existing `"(overridden by Project Local)"` suffix
- Winning items: add `"(also in: User)"` suffix when the same key exists in lower-precedence scopes
- No overlap: no suffix (current behavior)

**tooltip:** The `BaseVM.tooltip` field already supports `MarkdownString`. For items with cross-scope presence, build a tooltip listing all scopes and their values:
```
**model** defined in 3 scopes:
- **Project Local**: `claude-opus-4-20250514` (active)
- **Project Shared**: `claude-sonnet-4-20250514` (overridden)
- **User**: `claude-sonnet-4-20250514` (overridden)
```

**Why NOT use FileDecoration.badge:** The badge is limited to 2 characters and requires a dedicated `resourceUri` scheme per node type that needs it. The codebase already uses two schemes (`claude-config-plugin` for plugin dimming, `claude-config-lock` for lock dimming). Adding a third scheme for overlap counts adds complexity with minimal visual benefit over description text. The description is always visible; the badge requires custom URI plumbing.

### What Changes in the Stack

Nothing new. The ViewModel builder (`builder.ts`) already has access to `allScopes: ScopedConfig[]` in every entity builder method. It already calls `resolveScalarOverride`, `resolveEnvOverride`, `resolvePluginOverride`, etc. The overlap detection is the inverse of override detection: instead of "is there a higher-precedence scope with this key?" ask "are there any other scopes with this key?"

New helper function needed in `overrideResolver.ts` or `builder.ts`:

```typescript
function findOverlappingScopes(
  key: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
  accessor: (config: ClaudeCodeConfig) => boolean,
): ConfigScope[]
```

This is pure TypeScript logic. No new VS Code APIs.

---

## Feature 2: Lock-Aware Plugin Toggling

### Problem

The User scope lock toggle sets `isReadOnly: true` on the ScopedConfig, which propagates through the ViewModel to `contextValue: "plugin.readOnly"`. This correctly hides the context menu "Toggle Plugin" command (gated by `viewItem =~ /^plugin\.editable/`). However, the `TreeView.onDidChangeCheckboxState` event fires regardless of `contextValue` -- VS Code does not prevent checkbox clicks based on contextValue. The checkbox UI still allows toggling.

### Existing Lock Enforcement Pattern

The current code in `extension.ts` line 133 already checks `isReadOnly`:
```typescript
if (isReadOnly || !filePath || keyPath.length < 2) {
  if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
    vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
  }
  treeProvider.refresh();  // revert checkbox state
  continue;
}
```

This shows an info message and calls `refresh()` to revert the checkbox. The bug is that the checkbox visually toggles before the refresh reverts it, creating a flicker. Also, the `contextMenu` "Toggle Plugin" command at line 165 has the same guard.

### Available VS Code API Surfaces

| API | Capability | Relevant? |
|-----|-----------|-----------|
| `TreeItemCheckboxState` | `.Checked` / `.Unchecked` | YES -- already used |
| `TreeItem.checkboxState` | Controls checkbox rendering | YES -- set in PluginVM |
| `onDidChangeCheckboxState` | Fires when user clicks checkbox | YES -- handler in extension.ts |
| `contextValue` when clause | Controls context menu visibility | YES -- already gates Toggle Plugin |

**There is no VS Code API to disable or hide a checkbox on a TreeItem.** The `checkboxState` property only supports `Checked` and `Unchecked`, not a "disabled" state. This is a known limitation.

### Recommended Approach

The current pattern (block write + refresh to revert) is the correct approach given the API limitations. The fix is to ensure the revert is fast and the user gets clear feedback:

1. **Keep the refresh-to-revert pattern** -- this is what VS Code extensions must do since there is no disabled checkbox state
2. **Ensure the locked message is shown before refresh** -- the current order is correct
3. **Consider removing checkbox entirely when locked** -- set `checkboxState: undefined` in the ViewModel builder when the scope is locked, which removes the checkbox control entirely from the TreeItem

Option 3 is the cleanest solution. In `builder.ts` line 725:
```typescript
checkboxState: scopedConfig.isReadOnly
  ? undefined  // no checkbox when read-only
  : enabled
    ? vscode.TreeItemCheckboxState.Checked
    : vscode.TreeItemCheckboxState.Unchecked,
```

When `checkboxState` is `undefined`, VS Code renders the tree item without a checkbox. This is the correct UX for a locked scope -- there is nothing to toggle.

### What Changes in the Stack

Nothing new. The fix is a one-line conditional in `builder.ts` (ViewModel layer). No new APIs, no new dependencies.

---

## Feature 3: Hook Leaf Editor Navigation

### Problem

Hook entry nodes (leaf nodes representing individual hook commands) click to `revealInFile` with a keyPath like `["hooks", "PreToolUse", "0", "0"]`. The `findKeyLine()` function in `jsonLocation.ts` must navigate through nested JSON:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          { "type": "command", "command": "echo hello" }
        ]
      }
    ]
  }
}
```

The keyPath `["hooks", "PreToolUse", "0", "0"]` means: hooks -> PreToolUse -> first matcher (index 0) -> first hook in that matcher's hooks array (index 0). But the current `findKeyLine()` uses a single `findArrayElement()` for numeric segments, which counts top-level array elements. For the hook structure, index "0" navigates to the first matcher object, but the second "0" should navigate into the `hooks` array inside that object -- however, `findKeyLine` does not know to descend into the `hooks` property of the matched object.

### Available VS Code API Surfaces

The navigation APIs are already correctly used:

| API | Usage | Status |
|-----|-------|--------|
| `vscode.window.showTextDocument(uri)` | Open file in editor | Already used |
| `vscode.Position(line, character)` | Create cursor position | Already used |
| `vscode.Selection(anchor, active)` | Set cursor selection | Already used |
| `editor.revealRange(range, TextEditorRevealType)` | Scroll to position | Already used |
| `TextEditorRevealType.InCenterIfOutsideViewport` | Scroll behavior | Already used |

The problem is not in the VS Code APIs -- they work correctly. The problem is in `findKeyLine()` which is pure TypeScript JSON parsing logic that does not correctly handle the hook entry keyPath structure.

### Recommended Approach

The fix is in `jsonLocation.ts`, specifically in how `findKeyLine` handles nested array-of-objects structures. Two options:

**Option A: Fix the keyPath to include "hooks" property name.** Change `buildHookEntryVM` in `builder.ts` to emit keyPath `["hooks", "PreToolUse", "0", "hooks", "0"]` instead of `["hooks", "PreToolUse", "0", "0"]`. This makes the keyPath match the actual JSON structure: object key "hooks" -> key "PreToolUse" -> array index 0 -> object key "hooks" -> array index 0. The existing `findKeyLine` already handles alternating key/index segments correctly.

**Option B: Fix findKeyLine to handle the implicit "hooks" property.** This would add hook-specific knowledge to a generic JSON utility, which violates separation of concerns.

Option A is correct because the keyPath should reflect the actual JSON structure. The current keyPath `["hooks", "PreToolUse", "0", "0"]` skips the intermediate `"hooks"` key inside the matcher object, which is why navigation fails.

### What Changes in the Stack

Nothing new. The fix is in `builder.ts` (keyPath construction) or `jsonLocation.ts` (parsing logic). Both are pure TypeScript. No new VS Code APIs or dependencies.

---

## Recommended Stack (No Changes)

### Core Framework (Unchanged)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| TypeScript | ^5.3.3 | Language | No change |
| VS Code Extension API | ^1.90.0 | Extension host | No change |
| esbuild | ^0.25.0 | Bundler | No change |

### VS Code APIs In Use (Relevant to v0.7.0)

| API | Current Usage | v0.7.0 Impact |
|-----|--------------|---------------|
| `TreeItem.description` | Override suffix, version strings, value display | Extend with overlap scope list |
| `TreeItem.tooltip` (MarkdownString) | Override warnings, JSON previews, plugin descriptions | Extend with multi-scope overlap details |
| `TreeItem.checkboxState` | Plugin enabled/disabled toggle | Conditionally set to `undefined` when locked |
| `TreeItem.contextValue` | Menu visibility gating via regex `when` clauses | No change |
| `TreeItem.command` | `revealInFile` with filePath + keyPath args | No change (fix is in keyPath construction) |
| `FileDecorationProvider` | Plugin dimming, lock scope dimming | No change |
| `TextEditor.selection` | Cursor positioning in revealInFile | No change |
| `TextEditor.revealRange` | Scroll to cursor in revealInFile | No change |
| `vscode.Position` / `vscode.Selection` | Cursor coordinates | No change |

### Supporting Libraries (Unchanged)

| Library | Version | Purpose | When Used |
|---------|---------|---------|-----------|
| Mocha | ^10.2.0 | Test runner | `npm run test` |
| @vscode/test-electron | ^2.3.8 | Extension test host | `npm run test` |
| ESLint | ^8.56.0 | Linting | `npm run lint` |

---

## What NOT to Add

| Avoid | Why |
|-------|-----|
| New FileDecorationProvider for overlap badges | Two schemes already registered; `description` text is simpler and always visible |
| Custom webview for overlap visualization | TreeView API surfaces (description, tooltip) are sufficient; webview is overkill |
| Third-party JSON parser (jsonc-parser, json5) | `findKeyLine` uses manual line parsing that handles comments-free JSON; adding a parser dependency violates no-runtime-deps constraint |
| State management for overlap tracking | ViewModel builder already has `allScopes` access; overlap is computed inline during build, same as overrides |
| New node types for overlap indicators | Overlap is metadata on existing nodes (description, tooltip), not a new tree hierarchy level |
| Event emitter for lock state changes | Lock state already flows through ConfigStore -> ViewModel rebuild -> tree refresh |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Overlap display | description + tooltip | FileDecoration badge | Badge limited to 2 chars, needs URI scheme plumbing, less informative than text |
| Overlap display | description + tooltip | Dedicated overlap section node | Adds tree depth, complicates hierarchy, overlap is metadata not structure |
| Lock enforcement | Remove checkbox when locked | Refresh-to-revert after click | Removing checkbox is cleaner UX than click-show-message-revert flicker |
| Lock enforcement | `checkboxState: undefined` | Custom `contextValue` + CSS | No CSS control over checkbox visibility in TreeView API |
| Hook navigation | Fix keyPath in builder | Fix findKeyLine for hooks | keyPath should reflect JSON structure; generic utility should not have hook-specific logic |
| Hook navigation | Fix keyPath in builder | Use jsonc-parser library | Violates no-runtime-deps constraint |

---

## Version Constraints

All APIs used are available in VS Code 1.90.0+ (engine minimum). Relevant API availability:

| API | Available Since | Status |
|-----|----------------|--------|
| `TreeItem.description` | 1.25.0 | Stable, well-established |
| `TreeItem.tooltip` (MarkdownString) | 1.25.0 (string), 1.46.0 (MarkdownString) | Stable |
| `TreeItem.checkboxState` | 1.78.0 | Stable |
| `FileDecorationProvider` | 1.56.0 | Stable |
| `TextEditorRevealType.InCenterIfOutsideViewport` | 1.0.0 | Stable |
| `MarkdownString.supportThemeIcons` | 1.42.0 | Stable, used for $(warning) icon in tooltips |

All well within the 1.90.0 minimum.

---

## Installation

```bash
# No new dependencies to install
# No changes to package.json dependencies
# Only changes: TypeScript source files (builder.ts, jsonLocation.ts)
```

---

## Summary

v0.7.0 Visual Fidelity requires zero new dependencies and zero new VS Code API surfaces. All three features use APIs and patterns already established in the codebase:

1. **Overlap indicators** -- Extend `TreeItem.description` (scope list) and `TreeItem.tooltip` (rich markdown with all scope values). Computed in `builder.ts` using existing `allScopes` access. New helper in `overrideResolver.ts` to find overlapping scopes (inverse of existing override detection).

2. **Lock-aware plugin toggle** -- Set `checkboxState: undefined` when scope is locked, removing the checkbox entirely. One conditional in `builder.ts`. No new APIs.

3. **Hook leaf navigation** -- Fix keyPath construction in `builder.ts` to include the intermediate `"hooks"` property name inside matcher objects, so `findKeyLine()` can navigate the JSON structure correctly. Pure TypeScript fix.

The ViewModel layer (v0.6.0) makes all three features straightforward: the builder has full access to `allScopes` for overlap detection, lock state for checkbox control, and keyPath construction for navigation. The decoupling pays off immediately.

---

## Sources

- Codebase analysis: `builder.ts` (ViewModel builder, 1041 lines), `overrideResolver.ts` (override detection patterns), `baseNode.ts` (TreeItem property wiring), `pluginNode.ts` (FileDecorationProvider pattern), `lockDecorations.ts` (lock dimming pattern), `jsonLocation.ts` (findKeyLine implementation), `extension.ts` (checkbox handler, toggle plugin command), `configTreeProvider.ts` (tree provider), `types.ts` (VM interfaces)
- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view) -- TreeItem properties, FileDecorationProvider integration
- [VS Code API reference](https://code.visualstudio.com/api/references/vscode-api) -- TreeItem, TreeView, FileDecoration, TextEditor, Position, Selection, MarkdownString
- [VS Code FileDecoration API](https://vshaxe.github.io/vscode-extern/vscode/FileDecoration.html) -- badge (2-char max), color, propagate, tooltip properties
- [VS Code TreeView badge PR](https://github.com/microsoft/vscode/pull/144775) -- ViewBadge is view-level only, not per-item

---

*Stack research for: v0.7.0 Visual Fidelity -- overlap indicators, lock enforcement, hook navigation*
*Researched: 2026-03-08*
