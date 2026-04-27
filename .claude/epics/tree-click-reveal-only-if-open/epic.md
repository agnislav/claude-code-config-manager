---
name: tree-click-reveal-only-if-open
status: backlog
created: 2026-04-23T20:47:04Z
updated: 2026-04-27T18:12:35Z
progress: 0%
prd: .claude/prds/tree-click-reveal-only-if-open.md
github: https://github.com/agnislav/claude-code-config-manager/issues/19
---

# Epic: tree-click-reveal-only-if-open

## Overview

Change the on-click behavior of tree items so that `claudeConfig.revealInFile` — the default command attached to every data-bearing node via `buildRevealCommand` in `src/viewmodel/builder.ts:85` — no longer opens a closed config file. The command still reveals and highlights the relevant range if the file is already open in any tab group; otherwise it is a no-op (with an optional subtle hint).

Total change surface: one helper (~10 lines), one guarded call site in `src/commands/openFileCommands.ts:142`, one new test file, and a CHANGELOG entry. The view-model and tree layers are untouched.

## Architecture Decisions

- **Gate inside the command handler, not at the view-model layer.** The command is still attached to every node (view-model behavior unchanged); the handler chooses whether to proceed. This keeps the fix localized and leaves the `claudeConfig.openFile` command untouched as the intentional-open path.
- **Use `vscode.window.tabGroups.all[*].tabs[*].input.uri` to detect open state**, not `visibleTextEditors`. A file can be in a non-active tab — that still counts as "open" for reveal purposes. `visibleTextEditors` would miss it and produce surprising no-ops.
- **URI comparison via `fsPath` normalization** (or `Uri.toString()`), not raw string equality on the input `filePath` argument. The `revealInFile` argument is a path string; tab inputs are URIs.
- **Silent no-op for FR4 feedback** (default): the tree click still selects the item; absence of a new tab is the signal. A status-bar hint can be added as a follow-up if users report confusion. Keeps the PR minimal and reversible.
- **No double-click handling (FR5)**: VS Code TreeView does not natively distinguish single-click-to-select from single-click-to-activate. Adding a custom double-click handler is out of proportion for this change; context-menu / toolbar "Open File" is the explicit open path.
- **No feature flag / setting**. The new behavior is the correct default; a toggle would add permanent surface area for a one-time behavior correction.

## Technical Approach

### Frontend Components
No tree-level changes. `buildRevealCommand` continues to emit the same `command` property on every eligible node. The command IDs, argument shapes, and context values are all unchanged.

### Backend Services
A small helper `isFileOpenInAnyTab(uri: vscode.Uri): boolean` lives alongside the other internal utilities in `src/commands/openFileCommands.ts` (or a short `src/utils/editorState.ts` if we want it reusable). Iterates `vscode.window.tabGroups.all[*].tabs[*].input` and checks for a `TabInputText` (or equivalent) whose `uri.fsPath === uri.fsPath`.

The `claudeConfig.revealInFile` handler gains one conditional before `vscode.window.showTextDocument(uri)` at line 142: if `!isFileOpenInAnyTab(uri)` return silently. All existing validations (1–7) run first so invalid inputs continue to surface errors identically.

### Infrastructure
None. No new dependencies, no new commands, no new view registrations. `vscode.window.tabGroups` has been stable since 1.66+ and the extension already targets a compatible engine.

## Implementation Strategy

- **Sequencing**: helper + handler change land together in a single commit (they are coupled). Tests land in the same PR so CI validates the behavior end-to-end. CHANGELOG in the same PR.
- **Risk**: the change is semantically reversible by deleting two lines (the helper call and the early return). No data is touched. Risk is mostly UX: existing users may briefly miss the auto-open convenience. Mitigation is a clear CHANGELOG entry.
- **Testing approach**: use the existing `vscode-test` suite pattern (`test/suite/**/*.test.ts`). Open a fixture file, verify reveal; close it, verify no-op by asserting no new editor is opened. Tests run in the extension host so the `tabGroups` API is real, not mocked.

## Task Breakdown Preview

1. **Implement conditional reveal** — add `isFileOpenInAnyTab` helper and gate the `showTextDocument` call in `claudeConfig.revealInFile`. `src/commands/openFileCommands.ts`. ~15 lines.
2. **Add test coverage** — new file `test/suite/commands/openFileCommands.test.ts` with two cases: file-open path (reveal + range highlight), file-closed path (no new tab opened, no error). Uses the existing test fixture pattern from `test/suite/viewmodel/builder.test.ts`.
3. **Documentation** — `CHANGELOG.md` entry under the next milestone noting the behavior change; brief `README.md` note if the screenshots or user-facing docs describe tree-click behavior.

Three tasks total. Task 1 and task 2 can be drafted in parallel once the helper signature is agreed; task 3 is trivial and lands last.

## Dependencies

### Internal
- `src/commands/openFileCommands.ts` — the only source file that changes.
- `src/viewmodel/builder.ts` — **read-only** dependency; no edits. Used to confirm the command ID and argument shape.
- `test/suite/` — new subdirectory `commands/` added.

### External
- VS Code `tabGroups` API (1.66+). Already available.

### Blocking
- None. No other epic or feature is a prerequisite.
- No dependency on `multi-select-item-operations`, `entity-type-view`, or `permission-scaffolding` — this epic is independent and can ship in any milestone.

## Success Criteria (Technical)

- Clicking a tree item whose backing file is **closed** invokes `claudeConfig.revealInFile` and returns without calling `showTextDocument`. Confirmed by test.
- Clicking a tree item whose backing file is **open** (in any tab group, visible or not) reveals and highlights the range. Confirmed by test.
- `claudeConfig.openFile` command behavior is unchanged. Confirmed by test (existing or new).
- All existing tests pass. `npm run lint` and `npm run typecheck` clean.
- `CHANGELOG.md` documents the behavior change in the next milestone's `### Changed` section.

## Estimated Effort

- **Code**: 15–30 lines (helper + handler gate + imports).
- **Tests**: 40–80 lines (two `suite()` cases + fixture setup).
- **Docs**: 3–5 lines in CHANGELOG, optional README tweak.
- **Total**: ~1–2 hours of focused work, including local manual verification.
- **Critical path**: single-task — no parallelization win from splitting further.

## Tasks Created
- [ ] 001.md - Reveal-only-if-open: helper, handler gate, tests, and docs (parallel: false)

Total tasks: 1
Parallel tasks: 0
Sequential tasks: 1
Estimated total effort: 1–2 hours
