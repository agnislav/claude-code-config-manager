---
name: terminal-add-permission
description: Right-click context-menu and command-palette action that turns a terminal selection into a Claude Code permission rule, with scope + category prompts
status: backlog
created: 2026-04-27T15:59:51Z
---

# PRD: terminal-add-permission

## Executive Summary

When the user spots a command in the integrated terminal that they want to govern in Claude Code (e.g., `git status`), the current path is to switch to the extension panel, run "Add Permission Rule", remember the exact text, type it back, wrap it as `Bash(...:*)`, and pick scope + category. This PRD adds a **right-click "Add as Claude Code permission…"** item in the terminal context menu (and a sibling command-palette entry) that captures the active selection, pre-wraps it as `Bash(<selection>:*)` in an editable InputBox, then runs the existing scope → category → write flow.

It's a thin entry point on top of `claudeConfig.addPermissionRule`'s existing pickers and writer — the new code is selection capture, menu wiring, and the wrap helper. ~80–120 lines total.

## Problem Statement

**Today**: Adding a permission rule from a command observed in the terminal is a multi-step transcription task — switch focus, recall the exact arguments, hand-wrap the tool prefix, then go through the existing 3-step picker. The friction discourages users from progressively tightening their permissions as they discover what their workflows actually run.

**Why now**:
- The single-rule add command (`claudeConfig.addPermissionRule`) is already the workhorse path; it just needs a second triggering surface.
- The codebase has no `terminal/context` menu contributions yet, so this is also a foundation for any future terminal-driven actions.
- VS Code provides no native API to read terminal selection on stable releases (1.85+) — the `clipboard copy + read` pattern is the consensus workaround. Codifying it once unblocks future selection-driven flows.

## User Stories

### Story 1: Tighten permissions from observed command
**As** a developer who just watched Claude Code execute `git push` in the terminal
**I want** to highlight `git push`, right-click → "Add as Claude Code permission…", pick `Project Shared` + `Ask`
**So that** future `git push` calls go through the ask flow without me ever touching the JSON.

**Acceptance criteria:**
- Right-clicking selected text in the integrated terminal shows a "Claude Config: Add Selection as Permission…" item.
- Selecting the item starts the standard scope → category → rule InputBox flow with the rule pre-filled as `Bash(git push:*)`.
- The user can edit the pre-filled string before pressing Enter (e.g., trim `:*` or change tool prefix).
- On confirm, the rule is appended to the chosen scope's config file and the tree refreshes (existing `addPermissionRule` writer behavior).

### Story 2: Block a dangerous command found in history
**As** a security-conscious user
**I want** to select `rm -rf /` from a scrolled-back terminal history, right-click → "Add as Claude Code permission…", pick `User` + `Deny`
**So that** I never run that pattern under Claude Code in any project.

**Acceptance criteria:**
- The same flow works against any selection in scrollback, not only the current prompt line.
- Selecting `Deny` puts the rule into the `permissions.deny` array of the User scope file.
- The pre-filled wrap is still `Bash(rm -rf /:*)`; user can drop the `:*` to make it an exact-match denial before confirming.

### Story 3: Command-palette path
**As** a keyboard-driven user
**I want** to highlight a command in the terminal and run "Claude Config: Add Selection as Permission…" from the command palette
**So that** I never have to reach for the mouse.

**Acceptance criteria:**
- The command is registered in the palette and runs the same handler as the context-menu item.
- It targets the *active terminal*; if no terminal is focused or no selection is present, the user gets a clear error toast and the flow aborts cleanly.

## Functional Requirements

### FR1: Terminal context-menu item
- New command id: `claudeConfig.addPermissionFromTerminalSelection`.
- Registered in `package.json` under `contributes.menus."terminal/context"` with a stable label (e.g. `"Claude Config: Add Selection as Permission…"`).
- Item is always visible in the terminal context menu (no `when` clause that depends on selection state — the handler validates selection itself, since `terminalSelection` is not a reliable activation context across all terminal frontends).

### FR2: Command palette entry
- The same command id is exposed in the palette under category `Claude Config` with title `Add Selection as Permission…`.
- Available whenever the extension is activated (no editor focus requirement).

### FR3: Capture the terminal selection
- The handler reads the active terminal selection by:
  1. Saving current clipboard via `vscode.env.clipboard.readText()`.
  2. Running `await vscode.commands.executeCommand('workbench.action.terminal.copySelection')`.
  3. Reading the new clipboard via `vscode.env.clipboard.readText()`.
  4. Restoring the previously saved clipboard via `vscode.env.clipboard.writeText(prior)` regardless of success/failure (try/finally).
- If `Terminal.selection` ever stabilizes in a future VS Code minimum version, the helper can be replaced without changing the surrounding flow.

### FR4: Selection validation (reject empty / multi-line)
- After capture, the selection is `.trim()`ed and rejected if:
  - empty (no terminal selection or selection contained only whitespace), or
  - contains any newline (`\n` or `\r`).
- On rejection: `vscode.window.showInformationMessage('Select a single command on one line in the terminal first.')` and abort. The clipboard is still restored.

### FR5: Pre-fill the rule InputBox
- Build the pre-filled rule with a small helper: `wrapAsBashRule(raw: string) → string` that returns `` `Bash(${raw}:*)` ``.
- Reuse the existing scope picker (`pickScopeFilePath`) and category picker (`pickPermissionCategory` or whichever helper currently powers `claudeConfig.addPermissionRule`).
- The rule InputBox uses `vscode.window.showInputBox({ value: 'Bash(<selection>:*)', valueSelection: undefined, prompt: 'Edit and confirm the permission rule' })` so the entire pre-filled string is selected by default — the user can hit Enter to accept verbatim or start typing to overwrite.
- Validation: same regex / `parsePermissionRule` round-trip check used by the existing add flow. No new validation logic.

### FR6: Reuse existing write path
- After scope + category + rule are resolved, the handler delegates to the existing `addPermissionRule()` writer in `src/config/configWriter.ts`, wrapped in `withWriteRetry()` exactly as `claudeConfig.addPermissionRule` already does.
- No new write path. No batching.

### FR7: Read-only scope handling
- Managed scope is excluded from the scope picker (existing behavior of `pickScopeFilePath`).
- If User scope is locked, show the existing lock message and abort — same code path as the existing add flow.
- If no workspace is open, Project Shared / Project Local are excluded from the scope picker.

### FR8: Cancel handling
- Pressing Escape at any picker (scope, category, rule InputBox) cancels silently. No partial writes. Clipboard is still restored.

## Non-Functional Requirements

- **No new runtime dependencies.** Uses `vscode.commands.executeCommand`, `vscode.env.clipboard`, `vscode.window.showInputBox` — all already used elsewhere.
- **Latency**: the copy-selection round-trip should complete in < 100 ms in normal cases. No long-running blocking work.
- **Robustness**: clipboard restore must run even if every intermediate step throws (try/finally).
- **Localization**: all user-facing strings live in `src/constants.ts` alongside existing labels/messages.
- **Discoverability**: the right-click item label and the command-palette title use the same string for grep-ability.
- **No breaking change** to `claudeConfig.addPermissionRule` — its signature, behavior, and existing callers remain untouched.

## Success Criteria

- Selecting `git status` in the integrated terminal, right-clicking, choosing the new menu item, picking `Project Shared` + `Allow`, and pressing Enter on the pre-filled `Bash(git status:*)` adds that exact rule to `.claude/settings.json` in ≤ 5 user actions (right-click, click menu, pick scope, pick category, Enter).
- Running the command palette entry with no active terminal selection shows the rejection toast and writes nothing.
- After running the flow with arbitrary clipboard contents, the user's clipboard contents are unchanged.
- A multi-line selection (e.g., `git status\ngit log`) triggers the rejection toast and aborts.
- Existing `claudeConfig.addPermissionRule` tests/behavior pass unchanged.
- `CHANGELOG.md` documents the new command + menu under the target milestone's `### Added` section.

## Constraints & Assumptions

### Constraints
- VS Code stable does not expose `Terminal.selection` reliably as of 1.85+. The clipboard copy/read workaround is the only viable selection-capture path and is accepted as a trade-off.
- The new command must reuse `pickScopeFilePath`, `pickPermissionCategory`, the InputBox validator, and `addPermissionRule` from the existing `addCommands.ts` / `configWriter.ts` modules. If these helpers are not exported, the implementation may need to extract them to `src/commands/permissionPickers.ts` (or similar) — that refactor is in-scope only insofar as it makes reuse possible.

### Assumptions (decisions confirmed during PRD review)
1. **Wrap strategy = pre-fill editable InputBox with `Bash(<selection>:*)`.** User can edit before commit. Tool-prefix picker rejected as too heavy for v1.
2. **Selection validation = reject empty / multi-line with a toast.** Trimming to first line was rejected as silently surprising.
3. **Clipboard policy = save & restore prior contents** around the programmatic copy. Mutate-freely was rejected.
4. **Surfaces = terminal context menu + command palette only.** Editor-context menu and terminal toolbar button rejected for v1; can be added later by extending `package.json` menus.

## Out of Scope

- **Editor-context menu** (`editor/context`) — not in v1. The same handler can later be exposed there with minor adjustments to selection capture (it would read `vscode.window.activeTextEditor.document.getText(selection)` instead of using the clipboard hack).
- **Terminal toolbar button** — UI noise; rejected for v1.
- **Smart tool detection** (e.g., recognizing `curl` and offering `WebFetch(domain:…)` instead of `Bash`) — out of scope. The wrap is always `Bash(...:*)`; users edit the InputBox if they want a different tool prefix.
- **Multi-rule selection** (selecting two commands separated by a newline and adding both) — out of scope; selection validation rejects multi-line. A future "batch add" feature would be a separate PRD.
- **Selection-to-MCP-server / selection-to-env-var / selection-to-hook** parallels — separate PRDs if ever proposed.
- **Context-menu deduplication** — if a rule already covers the new selection (e.g., existing `Bash(git:*)` already allows `Bash(git status:*)`), this PRD does *not* warn or skip. The existing `addPermissionRule` writer's behavior is the source of truth; this entry point inherits it as-is.

## Dependencies

### Internal
- `src/commands/addCommands.ts` — reference for pickers and the write call. May need to export `pickScopeFilePath`, `pickPermissionCategory`, and the rule-validator helpers if they're file-scoped today.
- `src/config/configWriter.ts` — `addPermissionRule()` and `withWriteRetry()` (reused unchanged).
- `src/utils/permissions.ts` — `parsePermissionRule` / `formatPermissionRule` available if the wrap helper wants to validate the constructed string. Optional, not required for v1.
- `src/constants.ts` — new label strings: menu title, palette title, rejection toast, InputBox prompt.
- `package.json` — new command contribution, new `terminal/context` menu entry, new `commands` palette entry. First time this project declares a `terminal/context` menu.
- New file: `src/commands/terminalSelectionCommands.ts` (or a new export inside `addCommands.ts` if the file is small enough — current count is 335 lines, adding ~80 lines is borderline; prefer a new file for separation).

### External
- `vscode.commands.executeCommand('workbench.action.terminal.copySelection')` — built-in VS Code command, stable.
- `vscode.env.clipboard` — stable since 1.32.
- No new npm dependencies.

### Documentation
- `CHANGELOG.md` entry under the target milestone's `### Added` section.
- `README.md` — short note (1 paragraph + maybe a screenshot) demonstrating the right-click → menu → pre-filled rule flow.
- `.claude/context/features.md` — append the capability under the permissions section.
