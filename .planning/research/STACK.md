# Technology Stack

**Project:** Claude Code Config Manager v0.6.0 — Visual Fidelity
**Researched:** 2026-03-05
**Confidence:** HIGH (all findings verified against existing codebase source code and `@types/vscode@1.90.0`)

---

## Context

This is a subsequent-milestone research document. The extension already exists at 5,241 LOC with a fully
working TreeView, override resolution, file watching, bidirectional editor-tree sync, and scope-level
lock toggle. This document covers only the three v0.6.0 capabilities:

1. Visual overlap indicators showing config entities that exist across multiple scopes
2. Fix plugin checkbox toggling despite locked User scope
3. Fix hook leaf click navigating editor to wrong JSON line

---

## Verdict: No New Dependencies Required

All three features are achievable with the existing stack. The fixes involve logic corrections and
extensions to existing code patterns. Zero new npm packages. Zero new VS Code API surfaces beyond
what the extension already uses.

---

## Existing Stack (Unchanged)

### Core Framework
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| TypeScript | ^5.3.3 | Language | No change |
| VS Code Extension API | ^1.90.0 | Extension host | No change |
| esbuild | ^0.25.0 | Bundler | No change |

### VS Code APIs Already In Use (Relevant to v0.6.0)
| API | Current Usage | v0.6.0 Usage |
|-----|--------------|--------------|
| `TreeItem.description` | Override text ("overridden by X") | Extend with overlap scope names |
| `TreeItem.tooltip` via `MarkdownString` | Override warnings | Extend with overlap details |
| `FileDecorationProvider` | Plugin dimming, lock dimming | Add overlap badge via `FileDecoration.badge` |
| `ThemeColor` | Override/disabled styling | Overlap styling |
| `onDidChangeCheckboxState` | Plugin checkbox write handler | Add refresh() on readOnly guard path |
| `TreeItemCheckboxState` | Plugin enabled/disabled toggle | Unchanged |
| `TextEditor.selection` / `revealRange` | Editor navigation on tree click | Unchanged (fix is in keyPath, not API) |

---

## Feature 1: Visual Overlap Indicators

**Goal:** When a config entity (plugin, setting, env var, permission rule, etc.) exists in multiple
scopes, show visual indicators on each occurrence.

### Available APIs (all already used in codebase)

| API | How It Helps | Already Used |
|-----|-------------|-------------|
| `TreeItem.description` | Append "(also in User, Project Local)" text | Yes, in `baseNode.applyOverrideStyle()` |
| `MarkdownString` tooltip | Rich tooltip listing all scopes where entity exists | Yes, in `baseNode.computeTooltip()` |
| `FileDecoration.badge` | 1-2 char badge (e.g. scope count "3") on tree items | Pattern exists via `PluginDecorationProvider` |
| `FileDecoration.color` | Subtle color tint for overlapping items | Pattern exists via `PluginDecorationProvider` |
| `ThemeIcon` | Icon variation for overlapping items | Yes, throughout tree nodes |

### Implementation Approach

Extend `overrideResolver.ts` functions to return overlap metadata alongside existing override data.
The existing `resolvePluginOverride`, `resolveEnvOverride`, `resolveScalarOverride`, and
`resolveSandboxOverride` functions already iterate all scopes. Add a `presentInScopes: ConfigScope[]`
field to their return types:

```typescript
// Existing return: { isOverridden, overriddenByScope }
// Extended return: { isOverridden, overriddenByScope, presentInScopes }
```

The overlap data flows through the existing pipeline:
`overrideResolver` -> `NodeContext` -> `baseNode.finalize()` -> description/tooltip/decoration.

`NodeContext` needs a new optional field: `overlapScopes?: ConfigScope[]`.

### What NOT to Add

| Avoid | Why |
|-------|-----|
| Webview panel for visual diff | Violates no-runtime-deps constraint; TreeView decorations are sufficient |
| Custom icon SVGs per overlap state | Maintenance burden; codicons + badge + color cover all cases |
| `jsonc-parser` for overlap detection | Overlap detection is at the config model level, not JSON parsing |
| New `FileDecorationProvider` | Extend the existing `PluginDecorationProvider` URI scheme pattern to other node types |

---

## Feature 2: Plugin Checkbox Lock Enforcement

**Goal:** When User scope is locked, prevent plugin checkbox from visually changing state.

### Root Cause (Verified in Source)

The `onDidChangeCheckboxState` handler in `extension.ts` (line 128) correctly checks `isReadOnly`
and shows an informational message, but VS Code's native checkbox has already visually toggled by
the time the handler fires. The handler calls `continue` (skipping the write) but does NOT call
`treeProvider.refresh()` to revert the visual state.

Compare the two code paths:
- **readOnly guard (line 133-138):** shows message, `continue` -- checkbox stays toggled (BUG)
- **write error catch (line 150-153):** shows error, calls `treeProvider.refresh()` -- checkbox reverts (CORRECT)

### Fix

Add `treeProvider.refresh()` after the readOnly guard, same as the error handler already does:

```typescript
if (isReadOnly || !filePath || keyPath.length < 2) {
  if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
    vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
  }
  treeProvider.refresh();  // <-- revert the visual checkbox state
  continue;
}
```

### Available APIs

- `treeProvider.refresh()` -- already exists, just needs to be called

### What NOT to Add

| Avoid | Why |
|-------|-----|
| Custom checkbox implementation | VS Code TreeView does not support disabling individual checkboxes |
| "will change" interceptor | VS Code does not provide a pre-change event for checkboxes |
| Separate "locked checkbox" node type | Unnecessary complexity; refresh-to-revert is the standard pattern |

---

## Feature 3: Hook Leaf Editor Navigation

**Goal:** When clicking a hook leaf node (type, command, timeout, etc.), navigate the editor to
the correct JSON line.

### Root Cause (Verified in Source)

`HookKeyValueNode` emits a keyPath like:
```
['hooks', 'PreToolUse', '0', '0', 'command']
```

But the actual JSON structure has an intermediate `"hooks"` property key:
```json
{
  "hooks": {
    "PreToolUse": [
      {                          // matcherIndex 0
        "matcher": "...",
        "hooks": [               // <-- this "hooks" key is missing from the keyPath
          {                      // hookIndex 0
            "type": "command",
            "command": "..."
          }
        ]
      }
    ]
  }
}
```

The correct keyPath should be:
```
['hooks', 'PreToolUse', '0', 'hooks', '0', 'command']
```

The `findKeyLine` function in `jsonLocation.ts` is generic and correct. The bug is that
`HookEntryNode` and `HookKeyValueNode` emit keyPaths that skip the intermediate `"hooks"` array key.

### Fix

Change the keyPath construction in `HookEntryNode` (line 18) and `HookKeyValueNode` (line 14):

```typescript
// HookEntryNode: currently
keyPath: ['hooks', eventType, String(matcherIndex), String(hookIndex)]
// Should be:
keyPath: ['hooks', eventType, String(matcherIndex), 'hooks', String(hookIndex)]

// HookKeyValueNode: currently
keyPath: ['hooks', eventType, String(matcherIndex), String(hookIndex), propertyKey]
// Should be:
keyPath: ['hooks', eventType, String(matcherIndex), 'hooks', String(hookIndex), propertyKey]
```

### Impact Analysis

The keyPath change affects:
1. **`revealInFile` command** -- will now navigate correctly (the fix)
2. **`findNodeByKeyPath` in `configTreeProvider.ts`** -- used for editor-to-tree sync; the
   `findKeyPathAtLine` function in `jsonLocation.ts` already correctly walks the JSON structure and
   produces paths including the intermediate `"hooks"` key, so this will now MATCH correctly
3. **`deleteItem` command** -- uses `keyPath` to locate the hook entry for deletion; verify that
   `configWriter` delete logic handles the new path correctly
4. **`TreeItem.id` computation** -- changes the ID string, which is fine (IDs are only used for
   expand/collapse state preservation within a session)

### What NOT to Add

| Avoid | Why |
|-------|-----|
| `jsonc-parser` AST parser | The line-based `findKeyLine` works correctly when given the right keyPath |
| Hook-specific navigation logic | Generic `findKeyLine` handles object keys and array indices correctly |
| Separate navigation command for hooks | The existing `revealInFile` command works once keyPath is correct |

---

## Alternatives Considered

| Need | Considered | Why Not |
|------|-----------|---------|
| Overlap indicators | `vscode-jsonc-parser` | Overkill -- overlap detection is at config model level |
| Overlap indicators | Webview side panel | No runtime deps constraint; TreeView decorations sufficient |
| Overlap badge | Custom SVG icons per count | Maintenance burden; `FileDecoration.badge` is native |
| Plugin lock | Disable checkbox at render time | VS Code API does not support disabling individual checkboxes |
| Hook navigation | AST-based JSON parser | Current line-based approach works when keyPath is correct |

---

## Version Constraints

| API | Introduced | Project Minimum | Compatible |
|-----|-----------|----------------|------------|
| `FileDecoration.badge` | VS Code 1.73 | 1.90.0 | YES |
| `FileDecorationProvider` | VS Code 1.55 | 1.90.0 | YES |
| `TreeItemCheckboxState` | VS Code 1.78 | 1.90.0 | YES |
| `onDidChangeCheckboxState` | VS Code 1.78 | 1.90.0 | YES |
| `MarkdownString` in tooltip | VS Code 1.52 | 1.90.0 | YES |

All APIs are available in VS Code 1.90.0+. No version bump required.

---

## Installation

```bash
# No new dependencies to install
# No changes to package.json dependencies
# Only changes: TypeScript source files
```

---

## Summary

v0.6.0 is a pure logic milestone requiring zero new dependencies:

1. **Overlap indicators** -- Extend `overrideResolver` return types with `presentInScopes`, propagate
   through `NodeContext`, render via existing `description`/`tooltip`/`FileDecoration` patterns
2. **Plugin lock fix** -- Add `treeProvider.refresh()` call after the readOnly guard in the
   `onDidChangeCheckboxState` handler (one line)
3. **Hook navigation fix** -- Insert `'hooks'` intermediate key in `HookEntryNode` and
   `HookKeyValueNode` keyPath arrays to match actual JSON structure

---

## Sources

- Codebase analysis: `extension.ts` (lines 127-156), `pluginNode.ts`, `hookEntryNode.ts`,
  `hookKeyValueNode.ts`, `jsonLocation.ts`, `overrideResolver.ts`, `baseNode.ts`,
  `configTreeProvider.ts`, `openFileCommands.ts`
- Local `@types/vscode@1.90.0` type definitions -- `FileDecoration.badge`, `TreeItemCheckboxState`,
  `onDidChangeCheckboxState`, `MarkdownString`
- VS Code Extension API documentation -- TreeView, FileDecorationProvider

---

*Stack research for: v0.6.0 Visual Fidelity — overlap indicators, plugin lock fix, hook navigation fix*
*Researched: 2026-03-05*
