---
status: complete
phase: 07-collapse-expand-toolbar-buttons
source: [07-01-SUMMARY.md]
started: 2026-02-20T12:00:00Z
updated: 2026-02-20T11:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Toolbar Button Presence and Order
expected: The TreeView toolbar shows 4 buttons left-to-right: lock icon, collapse-all icon (chevrons pointing inward), expand-all icon (chevrons pointing outward), filter icon.
result: issue
reported: "should be: lock, filter, collapse, expand"
severity: major

### 2. Collapse All Behavior
expected: With some tree nodes expanded (e.g., scope nodes, section nodes), clicking the Collapse All button collapses everything so only top-level scope nodes are visible. No section or setting nodes remain expanded.
result: pass

### 3. Expand All Behavior
expected: Clicking the Expand All button expands all tree nodes to full depth — every scope, section, setting, rule, and entry becomes visible. The entire tree is fully opened.
result: pass

### 4. Collapse Then Expand Cycle
expected: Collapse All → Expand All → Collapse All works without errors. Each operation fully reverses the other. The tree state is consistent after each cycle.
result: pass

### 5. Works With Active Filter
expected: When a section filter is active (e.g., only "Settings" visible), Expand All expands all nodes within the filtered sections. Collapse All collapses them back. Buttons work correctly within the filtered view.
result: pass

### 6. Hidden From Command Palette
expected: Opening the VS Code Command Palette (Cmd+Shift+P) and searching for "Collapse All" or "Expand All" does NOT show these commands. They are toolbar-only.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Toolbar button order should be lock, filter, collapse, expand (left-to-right)"
  status: resolved
  reason: "User reported: should be: lock, filter, collapse, expand"
  severity: major
  test: 1
  root_cause: "package.json view/title navigation indices are lock@0, collapse@1, expand@2, filter@3 — filter should be @1, collapse @2, expand @3"
  artifacts:
    - path: "package.json"
      issue: "navigation@ indices place collapse/expand before filter instead of after"
  missing:
    - "Reorder navigation indices: lock@0, filter@1, collapse@2, expand@3"
  debug_session: ""
