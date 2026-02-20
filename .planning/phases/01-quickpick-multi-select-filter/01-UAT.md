---
status: resolved
phase: 01-quickpick-multi-select-filter
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md
started: 2026-02-19T12:00:00Z
updated: 2026-02-19T13:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Single Filter Icon in Toolbar
expected: The TreeView toolbar shows exactly one filter icon button (outline filter icon). The old 8 individual section filter buttons are gone.
result: pass

### 2. Open Filter Picker
expected: Clicking the filter icon opens a multi-select QuickPick listing "Show All Sections" at the top, followed by 7 section items (Permissions, MCP Servers, Plugins, Hooks, Settings, Environment, Sandbox) — each with an icon.
result: issue
reported: "the QuickPick is too wide, like 4-5 times bigger than enough"
severity: cosmetic

### 3. Filter by Section Subset
expected: In the QuickPick, select only 2-3 sections (e.g., Permissions and Settings), then accept. The tree updates to show only those sections across all scopes. Other sections disappear.
result: issue
reported: "Can this Ok button be omitted, so filtering applies on check/uncheck immediately?"
severity: minor

### 4. Show All Sections
expected: With a filter active, reopen the picker and select "Show All Sections" (or deselect everything). Accept. The tree shows all 7 sections again across all scopes.
result: pass

### 5. Icon Swap on Active Filter
expected: When a filter is active (subset selected), the toolbar icon changes to a filled filter icon. When filter is cleared (all sections shown), the icon reverts to the outline filter icon.
result: pass

### 6. TreeView Description Count
expected: When filtered to a subset (e.g., 3 sections), the TreeView title area shows "3/7". When showing all sections, no count is displayed.
result: issue
reported: "absent"
severity: major

### 7. Pre-selection on Reopen
expected: With a filter active (e.g., Permissions + Settings selected), reopen the picker. The previously selected sections are already checked/highlighted.
result: pass

### 8. Escape Cancels Without Change
expected: With a filter active, open the picker, change the selection, then press Escape. The tree remains unchanged — the previous filter is preserved.
result: pass

### 9. Filter Resets on Restart
expected: With a filter active, run "Developer: Reload Window". After reload, the tree shows all sections — filter has reset to default (all visible).
result: pass

### 10. No Orphaned Filter Commands
expected: Open the Command Palette and search for "filter". No old individual section filter commands appear (e.g., no "Filter: Permissions", "Filter: Hooks", etc.). Only the new "Filter Sections" command is visible.
result: pass

## Summary

total: 10
passed: 7
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "QuickPick opens at appropriate width for its content"
  status: resolved
  reason: "User reported: the QuickPick is too wide, like 4-5 times bigger than enough"
  severity: cosmetic
  test: 2
  root_cause: "VS Code QuickPick API has no width control; icon codicon strings (e.g. $(shield)) expand label width beyond visual rendering"
  artifacts:
    - path: "src/extension.ts"
      issue: "Item labels use $(icon) prefix syntax that inflates measured width"
  missing:
    - "Remove icon prefixes from QuickPick item labels or move icons to description field to reduce measured width"
  debug_session: ""

- truth: "Filtering applies immediately on check/uncheck without requiring Ok button"
  status: resolved
  reason: "User reported: Can this Ok button be omitted, so filtering applies on check/uncheck immediately?"
  severity: minor
  test: 3
  root_cause: "Filter is applied only in onDidAccept handler; onDidChangeSelection is used solely for mutual exclusivity logic"
  artifacts:
    - path: "src/extension.ts"
      issue: "openSectionFilterPicker() applies filter in onDidAccept (line 234), not onDidChangeSelection (line 209)"
    - path: "src/tree/configTreeProvider.ts"
      issue: "setSectionFilter() triggers tree refresh — needs to handle rapid calls from checkbox toggling"
  missing:
    - "Move filter application into onDidChangeSelection after mutual exclusivity logic"
    - "Track previous filter state before opening picker for Escape cancellation restore"
    - "Simplify onDidAccept to just call qp.hide()"
    - "Update onDidHide to restore previous filter if user cancelled (Escape)"
  debug_session: ""

- truth: "TreeView title area shows N/7 count when filtered"
  status: resolved
  reason: "User reported: absent"
  severity: major
  test: 6
  root_cause: "setTreeView() does not call updateFilterUI() after storing _treeView reference; initial constructor call runs before _treeView is set; subsequent calls may also fail if description property is not rendered by VS Code for this view type"
  artifacts:
    - path: "src/tree/configTreeProvider.ts"
      issue: "setTreeView() at line 24 stores reference but does not call updateFilterUI(); updateFilterUI() in constructor at line 21 runs before _treeView exists"
    - path: "src/extension.ts"
      issue: "setTreeView() called at line 34 after createTreeView but updateFilterUI() not retriggered"
  missing:
    - "Add this.updateFilterUI() call inside setTreeView() after storing the reference"
    - "Verify TreeView.description renders visually in the Extension Development Host"
  debug_session: ""
