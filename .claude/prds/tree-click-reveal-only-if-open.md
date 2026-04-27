---
name: tree-click-reveal-only-if-open
description: Tree-item clicks reveal-and-highlight the config file only if it is already open in an editor; never auto-open a closed file
status: backlog
created: 2026-04-23T15:53:45Z
---

# PRD: tree-click-reveal-only-if-open

## Source Ideas

This PRD was scoped from the following quick capture(s):

- **2026-04-22**: Tree click must NOT open the config file if it is not already opened — current behavior always opens; should only reveal/highlight when the file is already in an editor (`#ui #tree-click #behavior`)

## Executive Summary

Today every data-bearing tree item carries a default on-click command (`claudeConfig.revealInFile`) that unconditionally opens the backing config file in an editor if it is not already open. This makes the tree a noisy navigator: a single click on a permission rule to inspect it spawns a new editor tab for the underlying `settings.json`, even when the user was just browsing.

This PRD changes the rule: **clicking a tree item reveals and highlights the file only if it is already visible in an editor; if it is not open, the click is a no-op (or a subtle affordance) and does not create a new tab.** Explicit opening remains available through the existing `claudeConfig.openFile` command (context menu / toolbar).

## Problem Statement

**Current behavior** (verified against code):
- `src/viewmodel/builder.ts:85` assigns `command: 'claudeConfig.revealInFile'` to every data-bearing tree item.
- `src/commands/openFileCommands.ts:142` unconditionally calls `vscode.window.showTextDocument(uri)`, which opens the file if closed.
- Net effect: single-click on any tree item always opens the config file.

**Desired behavior**:
- Click on a tree item whose config file is **already open** in an editor tab → reveal/focus that editor and highlight the corresponding range (current reveal logic).
- Click on a tree item whose config file is **not open** → do not open it. Either a no-op, or a subtle status bar / tooltip hint such as "Use Open File to edit."

## User Stories

### Story 1: Browse without editor-tab spam
**As** a user auditing permissions across scopes
**I want** to click through tree items without each click popping a new editor tab
**So that** my editor group stays clean while I browse.

### Story 2: Intentional file open
**As** a user who decides to edit a rule
**I want** an explicit way to open the config file (context menu, toolbar button, or double-click)
**So that** opening is always an intentional action, not a side effect of browsing.

### Story 3: Reveal still works on open files
**As** a user who already has `settings.json` open and clicks a tree item
**I want** the editor to jump to the matching range
**So that** the tree remains a navigator for files I'm actively editing.

## Functional Requirements

### FR1: Detect whether the backing file is already open
- A file is considered "open" if its URI matches any `vscode.window.tabGroups.all[*].tabs[*].input.uri` (preferred over `visibleTextEditors`, which misses non-active tabs).
- Include tabs that are not currently visible — being in *any* tab group counts as open.

### FR2: Modify `claudeConfig.revealInFile` to conditionally no-op
- If the file is open: proceed with existing reveal logic (`showTextDocument` + range highlight).
- If the file is not open: do not call `showTextDocument`. Return without side effects, or (optional) show a transient status-bar message or info hint.

### FR3: Keep `claudeConfig.openFile` as the explicit open path
- Context-menu "Open File" continues to open unconditionally — this is the intentional open action.
- Toolbar "Open in editor" (if present per scope) continues to open unconditionally.

### FR4: No-op feedback (decision point)
Pick one:
- **Silent no-op** (simplest): click does nothing visible. Discoverable via context menu.
- **Status-bar hint**: transient message "Use Open File to edit {filename}".
- **Inline affordance**: a one-time tooltip / notification on first click explaining the change.

### FR5: Double-click behavior (decision point)
- **Option A**: double-click opens the file (treats double-click as the explicit open). Matches common file-tree UX.
- **Option B**: no special double-click handling; user must use context menu. Simpler; keeps a single click model.

## Non-Functional Requirements

- **Backward compatibility**: `claudeConfig.revealInFile` keeps its command ID and arguments. Only the internal behavior changes.
- **Performance**: the "is file open" check is O(open tabs), negligible.
- **No new state**: no persisted toggle; behavior is uniform.

## Success Criteria

- Clicking 20 different tree items with no config files open creates zero new editor tabs.
- Clicking a tree item whose file is already open reveals + highlights as before.
- `claudeConfig.openFile` still opens files unconditionally from menus/toolbar.
- Existing tests for `revealInFile` updated: positive path when file is open, new negative path when file is closed.

## Constraints & Assumptions

### Constraints
- No changes to tree node construction or `vmToNode`. All behavior lives inside the `revealInFile` command handler.
- No changes to the view-model `buildRevealCommand` output — the command is still attached to every node.

### Assumptions (decisions to confirm)
1. **No-op feedback (FR4)**: silent no-op is the simplest default. A small status-bar hint could help discoverability. Pick one.
2. **Double-click (FR5)**: VS Code TreeView does not natively distinguish single-click-to-select from single-click-to-activate; the `command` field fires on the default activation. A true double-click handler is more work and not strictly needed. Lean: skip double-click handling; keep context-menu-only explicit open.
3. **Tree selection still works**: clicks still select the tree item (that's VS Code's native behavior, independent of the command). No change needed.

## Out of Scope

- Changing the `openFile` command's behavior.
- Introducing a per-user preference toggle (reveal-always vs reveal-if-open). If the new default is right, a preference is unnecessary.
- Keyboard-activation behavior (Enter on a selected item) — follows the same command, so inherits the new behavior naturally.
- Any change to the range highlighting / decoration that happens after reveal.

## Dependencies

### Internal
- `src/commands/openFileCommands.ts` — main change: gate `showTextDocument` call on tab presence.
- `src/commands/openFileCommands.ts` — the `claudeConfig.openFile` command stays unchanged.
- Tests under `src/test/` (or equivalent) covering `revealInFile` — add closed-file case.

### External
- `vscode.window.tabGroups` API (stable since 1.66+). Current engine target covers this.

### Documentation
- `CHANGELOG.md` entry under the target milestone: behavior change — tree click no longer auto-opens closed files.
- Possibly a README note so existing users understand the new behavior.
