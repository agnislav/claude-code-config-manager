---
name: tree-double-click-opens-file
description: Double-click on a tree leaf opens the backing settings file (if closed) and positions the cursor at the matching JSON key
status: backlog
created: 2026-04-28T17:23:30Z
---

# PRD: tree-double-click-opens-file

## Source Ideas

This PRD resolves the open question left in the predecessor PRD `tree-click-reveal-only-if-open` (`.claude/prds/tree-click-reveal-only-if-open.md`, FR5):

> "**Option A**: double-click opens the file (treats double-click as the explicit open). Matches common file-tree UX.
> **Option B**: no special double-click handling; user must use context menu."

`tree-click-reveal-only-if-open` shipped Option B (silent no-op when the file is closed) so that single-click stayed cheap for browsing. This PRD picks **Option A** as an additive layer — restoring "open via the tree" as an explicit two-click gesture without re-introducing the editor-tab spam single-click used to cause.

## Executive Summary

Today, single-clicking a tree leaf whose backing config file is closed is a silent no-op (good for browsing). The only way to actually open that file from the tree is the context menu's "Open File". This PRD adds a **double-click on a leaf node** gesture that opens the backing config file (if not already open) and moves the cursor to the matching JSON key. Single-click behavior is unchanged.

## Problem Statement

After `tree-click-reveal-only-if-open` shipped:
- ✅ Single-click no longer spawns editor tabs while browsing.
- ❌ The keyboard / mouse path for "I actually want to look at this in the file" got slower: right-click → "Open File" → click again to position cursor (the open path doesn't reuse `revealInFile`'s key-line navigation).

Users expect a familiar file-tree gesture: **double-click to open**. We have everything needed (`findKeyLine`, `showTextDocument`) — we just need to detect the second click.

## User Stories

### Story 1: Browse silently (preserved from predecessor PRD)
**As** a user auditing settings across scopes
**I want** single-click to stay silent when the file is closed
**So that** my editor group stays clean while I browse.

**Acceptance**: clicking 20 closed-file leaves spawns 0 editor tabs.

### Story 2: Open + position via double-click
**As** a user inspecting a specific permission rule
**I want** to double-click the leaf and have the file open with the cursor on that exact key
**So that** I can immediately edit it without a separate "find this key" step.

**Acceptance**: with `settings.json` closed, double-clicking the `permissions.allow[2]` leaf opens `settings.json` with the cursor placed at the line containing the matching key.

### Story 3: Idempotent on already-open files
**As** a user with `settings.json` already open
**I want** double-click to behave the same as single-click (reveal + position)
**So that** the gesture is harmless and predictable.

**Acceptance**: with the file already open, single-click and double-click produce the same final cursor position; no extra tab is created.

## Functional Requirements

### FR1: Detect a double-click via debounce inside `claudeConfig.revealInFile`
- Module-level state `lastClick: { nodeId: string; time: number } | null`.
- A "double-click" is two invocations with the **same** `nodeId` arriving within `DOUBLE_CLICK_THRESHOLD_MS` (300 ms).
- Different `nodeId`s within the window do NOT count as a double-click.

### FR2: On double-click of a leaf, open and position
- Call `vscode.window.showTextDocument(uri)` even if the file is currently closed.
- Reuse the existing `findKeyLine`-based positioning logic (same code path used today by reveal-when-already-open).

### FR3: Handle `workbench.list.openMode === 'doubleClick'`
- When this VS Code setting is `'doubleClick'`, native single-click does NOT fire `TreeItem.command` at all — only double-click does. So every fire of `revealInFile` in this mode IS the explicit double-click intent and must run the open-and-position path.

### FR4: Branch nodes unaffected
- `computeCommand` already returns `undefined` for non-leaf items. They keep VS Code's native expand/collapse-on-doubleclick behavior. No double-click handling is wired to them.

### FR5: All existing validations preserved
- Path traversal check, known-paths allowlist, `keyPath` shape and depth limit (`MAX_KEYPATH_DEPTH`) all run BEFORE the debounce branch. Invalid input never advances to the open path.

## Non-Functional Requirements

- **Backward-compatible command surface**: command id stays `claudeConfig.revealInFile`. The signature gains an optional 3rd argument (`nodeId: string`); existing callers that omit it still work — they just lose double-click detection (acceptable; no external callers exist).
- **Memory**: O(1) — a single `lastClick` cell.
- **Latency**: single-click has zero added latency (the open path is gated on the 2nd click only).
- **No new user setting**: the threshold is a code constant.

## Success Criteria

1. With all settings tabs closed, double-clicking 5 different leaves opens 5 corresponding files with the cursor positioned at the matching key in each.
2. Single-click on a closed-file leaf still spawns 0 tabs (regression check on predecessor PRD).
3. Two single-clicks on different leaves within 300 ms still spawn 0 tabs (different `nodeId`).
4. With `workbench.list.openMode = 'doubleClick'`, one double-click opens + positions correctly.
5. Existing `revealInFile` test suite stays green; 4 new tests added pass.

## Constraints & Assumptions

### Constraints
- VS Code's `TreeView` API exposes no native `onDidDoubleClick`. The only click hook is `TreeItem.command`, fired once per activation gesture. Debounce inside the bound command is the accepted workaround.
- 300 ms threshold is OS-double-click-default. Not user-configurable in v1.
- `workbench.list.openMode` is a user setting — we read it at handler entry, not at extension activation, so changes take effect immediately.

### Assumptions
- `nodeContext.id` (or the tree-item id derived from scope + entityType + keyPath) is stable within a tree refresh — the same logical node produces the same id between refreshes. (Confirmed in `viewmodel/builder.ts` — `id` is computed from the full keyPath.)
- Users with `openMode = 'singleClick'` (default on most setups) get a real two-click gesture. Users with `openMode = 'doubleClick'` get a one-gesture open. Both are correct, just different.

## Out of Scope

- Configurable threshold (300 ms is hardcoded).
- Double-click on branch nodes / scope nodes (would conflict with VS Code's native expand/collapse).
- Keyboard activation (Enter on selected item) — same `command` plumbing already inherits whatever single-click does today.
- Animations / transient UI hints on detection.
- A "long-press" or any other custom gesture.

## Dependencies

### Internal
- `src/commands/openFileCommands.ts` — main change site.
- `src/viewmodel/builder.ts` — `computeCommand` signature + 9 call sites pass `nodeId` through.
- `src/constants.ts` — add `DOUBLE_CLICK_THRESHOLD_MS = 300`.
- `test/suite/commands/openFileCommands.test.ts` — add new tests alongside existing reveal-only-if-open tests.

### External
- `vscode.workspace.getConfiguration('workbench.list').get<string>('openMode')` — stable VS Code API.
- `vscode.window.tabGroups` — already used by `isFileOpenInAnyTab`.

### Documentation
- `CHANGELOG.md` entry under the next milestone documenting the new gesture.
