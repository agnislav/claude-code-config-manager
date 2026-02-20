---
status: diagnosed
phase: 01-quickpick-multi-select-filter
source: 01-03-SUMMARY.md
started: 2026-02-19T13:10:00Z
updated: 2026-02-19T14:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. QuickPick Width (Gap 1 Fix)
expected: Click the filter icon in the toolbar. The QuickPick that opens should be a normal/compact width — not excessively wide. Item labels show plain text ("All", "Permissions", "MCP Servers", etc.) with small icons to their right in the description area.
result: issue
reported: "Gap 1 doesn't fixed. the width is huge, could be 4 times narrower"
severity: cosmetic

### 2. Immediate Filter Apply (Gap 2 Fix)
expected: Open the filter picker and check/uncheck a section (e.g., toggle "Permissions" on). The tree should update immediately — no need to press Enter/OK. Keep the picker open and toggle another section — tree updates again instantly.
result: issue
reported: "it works partially. Filters apply immediately. However, then it's needed to press Ok to save them, otherwise they will reset to prev state on Esc. Correct flow: no Ok button at all. Filters apply immediately and don't reset on Esc"
severity: minor

### 3. Escape Restores Previous State (Gap 2 Fix)
expected: With a filter active (e.g., only Permissions showing), open the picker. Check a few more sections. Then press Escape. The tree should revert to showing only Permissions — the state from before you opened the picker.
result: issue
reported: "User wants opposite behavior: Escape should just close the picker, not revert. Filters already applied live — no undo needed."
severity: minor

### 4. TreeView Description Count (Gap 3 Fix)
expected: When filtered to a subset (e.g., 3 sections), the TreeView title area shows "3/7". When showing all sections, no count is displayed (or description is empty).
result: issue
reported: "nope, nothing shown"
severity: major

### 5. Pre-selection Still Works (Regression Check)
expected: With a filter active (e.g., Permissions + Settings), close the picker, then reopen it. The previously selected sections should already be checked/highlighted in the picker.
result: pass

### 6. Icon Swap Still Works (Regression Check)
expected: When a filter is active (subset selected), the toolbar icon is a filled filter. When filter is cleared (all sections shown), the icon reverts to an outline filter.
result: pass

### 7. Mutual Exclusivity Still Works (Regression Check)
expected: Open the picker. Select "All" — all individual sections should deselect. Then select one individual section — "All" should deselect. Deselect all individual sections — "All" should snap back on.
result: pass

## Summary

total: 7
passed: 4
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "QuickPick opens at appropriate width for its content"
  status: failed
  reason: "User reported: Gap 1 doesn't fixed. the width is huge, could be 4 times narrower"
  severity: cosmetic
  test: 1
  root_cause: "Moving icons from label to description created a two-column layout. VS Code sizes QuickPick to fit both columns with padding, making it wider than single-column. The description field is still measured for width."
  artifacts:
    - path: "src/extension.ts"
      issue: "allItem and sectionItems have description field with codicon strings — forces two-column layout in QuickPick"
  missing:
    - "Remove description field from all QuickPick items entirely"
    - "Put icons back in label as $(icon) prefix — VS Code renders inline codicons in labels without inflating width"
    - "Single-column layout (label only) produces the narrowest QuickPick"
  debug_session: ""

- truth: "Filters apply immediately and persist on Escape — no OK/confirm step needed"
  status: failed
  reason: "User reported: filters apply immediately but reset to prev state on Esc. Correct flow: no Ok button at all, filters apply immediately and don't reset on Esc"
  severity: minor
  test: 2
  root_cause: "onDidHide handler checks accepted flag and calls setSectionFilter(previousFilter) when false (Escape). User wants no revert — Escape should just close the picker."
  artifacts:
    - path: "src/extension.ts"
      issue: "Lines 209-211: previousFilter snapshot and accepted flag enable revert. Lines 261-267: onDidHide restores previousFilter when !accepted."
  missing:
    - "Remove previousFilter snapshot (line 209)"
    - "Remove accepted flag (line 211)"
    - "Simplify onDidAccept to just qp.hide()"
    - "Simplify onDidHide to just qp.dispose() — no revert logic"
  debug_session: ""

- truth: "TreeView title area shows N/7 count when filtered"
  status: failed
  reason: "User reported: nope, nothing shown"
  severity: major
  test: 4
  root_cause: "VS Code single-view merge: when a custom activity bar container has exactly one view, VS Code sets mergeViewWithContainerWhenSingleView=true and headerVisible=false. TreeView.description renders only in the view pane header, which is hidden. The property is set correctly but the DOM element never renders."
  artifacts:
    - path: "src/tree/configTreeProvider.ts"
      issue: "updateFilterUI() sets _treeView.description correctly but it's invisible due to hidden header"
    - path: "package.json"
      issue: "One view (claudeConfigTree) in claude-config container triggers single-view merge"
  missing:
    - "Replace TreeView.description with TreeView.badge (renders on activity bar icon, always visible)"
    - "Or embed count in TreeView.title (e.g. 'Configuration (2/7)' when filtered)"
  debug_session: ""
