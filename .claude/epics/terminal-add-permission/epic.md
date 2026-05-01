---
name: terminal-add-permission
status: backlog
created: 2026-04-27T17:37:18Z
updated: 2026-04-27T17:54:26Z
progress: 0%
prd: .claude/prds/terminal-add-permission.md
github: https://github.com/agnislav/claude-code-config-manager/issues/15
---

# Epic: terminal-add-permission

## Overview

Add a second triggering surface for the existing `claudeConfig.addPermissionRule` flow: a right-click item in the integrated terminal's context menu (and a sibling command-palette entry) that captures the active selection via the clipboard `copy → read → restore` pattern, pre-fills it as `Bash(<selection>:*)` in an editable InputBox, then runs the existing scope → category → write pipeline unchanged.

This is ~80–120 lines of new code plus a small refactor to export the pickers that are currently inline in `addCommands.ts`. No new write paths, no new validators, no new dependencies.

## Architecture Decisions

1. **Reuse, don't rebuild.** The new command delegates to the existing `addPermissionRule()` writer wrapped in `withWriteRetry()`. The only new logic is selection capture and rule pre-fill.

2. **Code placement is governed by the future lib/CLI extraction.** Pure functions with no `vscode` import are *portable* and belong in domain modules that a future lib + CLI will lift wholesale. VS Code-specific code (UI surfaces, command APIs) stays in `src/commands/` or a clearly-marked `src/utils/terminal.ts`. Concretely:
   - `wrapAsBashRule` and `validateSingleLineSelection` → **`src/utils/permissions.ts`** alongside `parsePermissionRule` / `formatPermissionRule`. They're string transforms; a CLI rejecting multi-line input from stdin would use the exact same code.
   - `captureTerminalSelection` → **`src/utils/terminal.ts`** (new). Imports `vscode`; not portable. A CLI doesn't have a "terminal selection" concept — its equivalent is `process.argv` / stdin, which never reaches this helper.
   - Pickers and the InputBox prompt → **`src/commands/permissionPickers.ts`** (new). VS Code QuickPick/InputBox; a CLI would use inquirer or similar.

3. **Extract pickers as a precondition.** `pickScopeFilePath`, the category quick-pick, and the rule InputBox prompt are file-scoped inside `src/commands/addCommands.ts` today (lines 34–48 and 314–335). The PRD's Constraints section explicitly allows extracting them. This is the minimal refactor that makes reuse possible — and it pays compound interest: every future "add permission from <somewhere else>" surface (editor context menu, status bar, code action) becomes a one-handler addition.

4. **Always-visible menu item; handler validates.** Per FR1, the `terminal/context` contribution has no `when` clause that depends on selection state. The handler shows a clear toast if there's no selection. This avoids relying on `terminalSelection` activation context, which is unreliable across terminal frontends.

5. **Clipboard restoration is a hard invariant.** The success criterion "after running the flow with arbitrary clipboard contents, the user's clipboard contents are unchanged" is enforced by a `try/finally` block in `captureTerminalSelection`, not best-effort error handling. This is what the dedicated test in Task 2 verifies.

## Technical Approach

### VS Code surfaces (presentation)

- **Terminal context menu** — new entry in `package.json` under `contributes.menus."terminal/context"`. First time this project declares this menu group.
- **Command palette** — new entry under category `Claude Config`, title `Add Selection as Permission…`, gated through `contributes.menus.commandPalette`.
- **InputBox** — pre-filled `Bash(<selection>:*)` with the entire string selected so Enter accepts verbatim or typing overwrites.
- **All user-facing strings** centralized in `src/constants.ts` for grep-ability.

### Modules

| File | Status | Purpose | Portable? |
|---|---|---|---|
| `src/utils/permissions.ts` | extended | + `wrapAsBashRule`, `validateSingleLineSelection` | ✅ yes |
| `src/utils/terminal.ts` | new | `captureTerminalSelection` (clipboard save/copy/read/restore in try/finally) | ❌ vscode only |
| `src/commands/permissionPickers.ts` | new | `pickScopeFilePath`, `pickPermissionCategory`, `promptPermissionRuleInput` extracted from `addCommands.ts` | ❌ vscode only |
| `src/commands/terminalSelectionCommands.ts` | new | `registerTerminalSelectionCommands`; handler wires capture → validate → wrap → pickers → writer | ❌ vscode only |
| `src/commands/addCommands.ts` | refactored | calls extracted pickers; behavior unchanged | n/a |
| `src/constants.ts` | extended | menu title, palette title, rejection toast, InputBox prompt | n/a |
| `src/extension.ts` | extended | registers `registerTerminalSelectionCommands` | n/a |
| `package.json` | extended | command + `terminal/context` menu + `commandPalette` entries | n/a |

### Reused unchanged
- `addPermissionRule()` writer in `src/config/configWriter.ts`
- `withWriteRetry()` in `src/utils/commandHelpers.ts`
- `PermissionCategory` enum in `src/types.ts`
- `SCOPE_LABELS` in `src/constants.ts`

## Implementation Strategy

Sequenced by risk-isolation: refactor first (no user-visible change, but touches an existing flow), feature second (new code, no risk to existing flow), docs last.

**Phase 1 — Refactor + portable helpers.**
Extract pickers into `permissionPickers.ts`. Append `wrapAsBashRule` and `validateSingleLineSelection` to `permissions.ts`. Re-wire `claudeConfig.addPermissionRule` to call the extracted pickers. Existing test suite must pass unchanged. This phase is shippable on its own.

**Phase 2 — New command end-to-end.**
Build `terminal.ts` (clipboard capture with explicit exception-path test for the restore invariant), the handler in `terminalSelectionCommands.ts`, the `package.json` contributions, the constants, and register in `extension.ts`. All in one task because partial states are broken (a registered command without its menu entry, or a menu entry without its handler, ships nothing usable).

**Phase 3 — Docs.**
CHANGELOG entry, README paragraph, `.claude/context/features.md` append. Can be drafted from the merged Phase 2 diff.

## Task Breakdown Preview

3 tasks. Each is a meaningful, independently-shippable unit.

1. **Refactor pickers + add portable helpers.**
   - Move `pickScopeFilePath`, the category quick-pick, and the rule InputBox prompt out of `addCommands.ts` into a new `src/commands/permissionPickers.ts`. Re-wire `claudeConfig.addPermissionRule` to call them.
   - Append `wrapAsBashRule(raw)` and `validateSingleLineSelection(raw)` to `src/utils/permissions.ts` (no `vscode` import).
   - Unit tests for both new pure helpers.
   - Existing add-permission test suite passes unchanged.

2. **Implement `claudeConfig.addPermissionFromTerminalSelection`.**
   - New `src/utils/terminal.ts` with `captureTerminalSelection` — clipboard save/copy/read/restore wrapped in `try/finally`. Includes a unit test that simulates an exception mid-sequence and asserts the clipboard is restored.
   - New `src/commands/terminalSelectionCommands.ts` with the handler: capture → `validateSingleLineSelection` → `wrapAsBashRule` → `pickScopeFilePath` → `pickPermissionCategory` → `promptPermissionRuleInput(prefilled)` → `withWriteRetry(addPermissionRule)`.
   - Append label constants to `src/constants.ts`.
   - Add the command, the `terminal/context` menu entry, and the `commandPalette` entry to `package.json`.
   - Register `registerTerminalSelectionCommands` in `src/extension.ts`.

3. **Docs.**
   - `CHANGELOG.md` `### Added` entry under `## [Unreleased]`.
   - `README.md` short paragraph (1 paragraph + screenshot placeholder) demonstrating the right-click flow.
   - `.claude/context/features.md` append under the permissions section.

## Dependencies

### Internal (must exist / be respected)
- `src/commands/addCommands.ts` — refactor target (Task 1).
- `src/config/configWriter.ts` — `addPermissionRule()` reused unchanged.
- `src/utils/commandHelpers.ts` — `withWriteRetry()` reused unchanged.
- `src/types.ts` — `PermissionCategory` enum.
- `src/utils/permissions.ts` — host for the new portable helpers.
- `src/constants.ts` — `SCOPE_LABELS` already exists; new label strings appended in Task 2.
- `package.json` — new contributions; respect existing structure.

### External (consumed, not modified)
- `vscode.commands.executeCommand('workbench.action.terminal.copySelection')` — built-in, stable.
- `vscode.env.clipboard` — stable since VS Code 1.32.
- No new npm dependencies.

### Cross-task (within this epic)
- Task 2 depends on Task 1 (imports the extracted pickers and the new portable helpers).
- Task 3 depends on Task 2 (docs describe the shipped feature).

## Success Criteria (Technical)

- Selecting `git status` in the integrated terminal, right-clicking, choosing the new menu item, picking `Project Shared` + `Allow`, pressing Enter on the pre-filled `Bash(git status:*)` writes that exact rule to `.claude/settings.json` in ≤ 5 user actions.
- Running the palette command with no terminal selection shows the rejection toast and writes nothing.
- After running the flow with arbitrary clipboard contents, `vscode.env.clipboard.readText()` returns the original contents (verified by unit test simulating both success and exception paths).
- Multi-line selection (containing `\n` or `\r`) triggers the rejection toast and aborts cleanly.
- Existing `claudeConfig.addPermissionRule` test suite passes unchanged after the Task 1 refactor.
- `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run package` all pass.
- `wrapAsBashRule` and `validateSingleLineSelection` import nothing from `vscode` (verified by `grep -L "from 'vscode'"` on those exports' module).

## Estimated Effort

- **Code surface**: ~80–120 lines net new + ~50 lines moved during the Task 1 refactor.
- **Resources**: single developer; PRD decisions are locked, no design or product review needed.
- **Critical path**: Task 1 → Task 2. Task 3 trails Task 2.

## Tasks Created
- [ ] #16 - Refactor pickers + add portable helpers (parallel: true)
- [ ] #17 - Implement claudeConfig.addPermissionFromTerminalSelection (parallel: false)
- [ ] #18 - Docs (parallel: false)

Total tasks: 3
Parallel tasks: 1
Sequential tasks: 2
Estimated total effort: 9 hours
