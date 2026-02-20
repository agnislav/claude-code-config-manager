---
phase: 05-add-move-inline-button
verified: 2026-02-19T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Move inline button visible on permissionRule, setting, and plugin tree items"
    expected: "$(arrow-both) icon button appears to the left of the copy button on editable permissionRule, setting, and plugin items in the Claude Config tree view"
    why_human: "VS Code tree view rendering and inline button visibility cannot be verified programmatically without launching the extension host"
  - test: "Move inline button is NOT visible on read-only scope items"
    expected: "No move button appears on Managed scope items or items with .readOnly contextValue"
    why_human: "Requires visual inspection of the running extension tree view"
  - test: "Clicking move inline button shows confirmation dialog, then scope picker"
    expected: "A modal warning dialog appears first; only after clicking 'Move' does the scope picker open"
    why_human: "Interactive dialog flow requires a running VS Code instance with extension loaded"
  - test: "Plugin move end-to-end: entry written to target, removed from source"
    expected: "Plugin appears in target scope settings file and disappears from source scope settings file"
    why_human: "File mutation requires a running extension with real config files"
---

# Phase 5: Add Move Inline Button Verification Report

**Phase Goal:** Add a move inline icon button alongside the existing copy icon button on tree items that support copy-to-scope. The move button invokes the existing move-to-scope command infrastructure. This provides a one-click move action instead of requiring manual copy + delete.
**Verified:** 2026-02-19
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tree items with a copy inline icon button also show a move inline icon button to the left of copy | ✓ VERIFIED | `package.json` lines 258-261 (plugin move@1), 278-281 (permissionRule move@0), 288-291 (setting move@0); copy buttons at inline@2, @1, @1 respectively |
| 2 | Clicking the move inline button on a permissionRule, setting, or plugin shows a confirmation dialog, then opens the move-to-scope picker | ✓ VERIFIED | `moveCommands.ts` lines 40-45: `showWarningMessage` with `{ modal: true }` and `'Move'` button before scope picker at line 66 |
| 3 | Move for plugins writes the plugin entry to the target scope and removes it from the source scope | ✓ VERIFIED | `moveCommands.ts` lines 98-103: `enabledPlugins` branch calls `setPluginEnabled(targetFilePath, ...)` then `removePlugin(filePath, ...)` |
| 4 | Move inline button only appears on .editable items, not read-only scope items | ✓ VERIFIED | All three `moveToScope` inline entries use `when` clauses matching `/^permissionRule\.editable/`, `/^plugin\.editable/`, `/^setting\.editable/` — restricted to `.editable` contextValue pattern |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/commands/moveCommands.ts` | Extended moveToScope with plugin support and confirmation dialog | ✓ VERIFIED | Imports `setPluginEnabled`, `removePlugin` (lines 10-11); `enabledPlugins` branch at line 98; modal confirmation at line 40-45 |
| `package.json` | Move inline button menu contributions with when clauses matching copy patterns; uses `$(arrow-both)` | ✓ VERIFIED | `moveToScope` command definition has `"icon": "$(arrow-both)"` at line 100; three inline entries at lines 258, 278, 288 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json` inline menu entries | `claudeConfig.moveToScope` command | command string in view/item/context inline entries | ✓ WIRED | `package.json` lines 258, 278, 288 all specify `"command": "claudeConfig.moveToScope"` in inline groups |
| `moveToScope` handler | `configWriter.removePlugin` + `configWriter.setPluginEnabled` | plugin branch in moveToScope handler | ✓ WIRED | `moveCommands.ts` line 98: `enabledPlugins` branch; line 102: `setPluginEnabled(...)`; line 103: `removePlugin(...)` |
| `registerMoveCommands` | extension activation | imported and called in `extension.ts` | ✓ WIRED | `extension.ts` line 9 imports `registerMoveCommands`; line 96 calls it |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MOVE-01 | 05-01-PLAN.md | Move inline icon button appears alongside copy icon button on tree items that support copy-to-scope | ✓ SATISFIED | Three `view/item/context` inline entries for `claudeConfig.moveToScope` targeting permissionRule@0, setting@0, plugin@1 — all placed before their corresponding copy buttons |
| MOVE-02 | 05-01-PLAN.md | Clicking move inline button invokes existing move-to-scope command for the selected item | ✓ SATISFIED | All inline entries point to the same `claudeConfig.moveToScope` command registered in `moveCommands.ts`; confirmation dialog + scope picker in handler |
| MOVE-03 | 05-01-PLAN.md | `package.json` menu contributions include move icon entries with `when` clauses matching copy entry `contextValue` patterns | ✓ SATISFIED | `when` clauses use `/^permissionRule\.editable/`, `/^plugin\.editable/`, `/^setting\.editable/` — identical patterns to copy entries; context menu `when` updated to include `plugin` at line 219 |

No orphaned requirements: all three MOVE-01..03 IDs appear in the plan's `requirements` field and are accounted for above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODO/FIXME/placeholder comments, no empty implementations, no stub returns found in either modified file.

### Human Verification Required

#### 1. Move inline button visibility in tree view

**Test:** Open a VS Code workspace with Claude Code configuration files. Open the Claude Config tree view. Hover over a permissionRule, setting, or plugin tree item.
**Expected:** An `$(arrow-both)` icon button appears to the left of the `$(copy)` button. For plugins: order is readme, move, copy, delete. For permissionRule/setting: order is move, copy, delete.
**Why human:** VS Code tree view inline button rendering requires a running Extension Development Host — not verifiable via static analysis.

#### 2. Move button absence on read-only items

**Test:** In the same tree view, hover over an item from the Managed scope.
**Expected:** No move button appears. The `$(arrow-both)` icon is absent.
**Why human:** Visual inspection required; contextValue `.readOnly` filtering is defined in `when` clauses but confirmation requires actual rendering.

#### 3. Confirmation dialog flow

**Test:** Click the move inline button on an editable permissionRule.
**Expected:** A modal warning dialog appears reading `Move "..." to a different scope? This will remove it from ...`. Only after clicking "Move" does the scope picker appear. Clicking "Cancel" or dismissing aborts the operation.
**Why human:** Interactive dialog flow requires a running VS Code instance.

#### 4. Plugin move end-to-end

**Test:** Move a plugin from one scope to another using the move inline button.
**Expected:** The plugin entry disappears from the source scope's `settings.json` file and appears in the target scope's `settings.json` file with the same enabled/disabled state.
**Why human:** File mutation side effects require running the extension with real config files and verifying disk state.

### Gaps Summary

No gaps found. All four observable truths are verified by code evidence. All three requirement IDs (MOVE-01, MOVE-02, MOVE-03) are satisfied by implementation. The `npm run typecheck` passes with zero errors. Four human verification items are identified due to the inherent visual/interactive nature of VS Code tree view UI testing — these do not represent implementation gaps but rather confirm functionality requires a running extension host.

---

_Verified: 2026-02-19_
_Verifier: Claude (gsd-verifier)_
