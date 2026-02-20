---
status: complete
phase: 01-quickpick-multi-select-filter
source: 01-03-SUMMARY.md
started: 2026-02-19T14:30:00Z
updated: 2026-02-19T14:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. QuickPick Width
expected: Click the filter icon in the toolbar. The QuickPick should be compact — roughly the width of the longest label text plus a small icon and checkbox. Not spanning most of the editor width.
result: issue
reported: "still the same width"
severity: minor

### 2. Immediate Filter — No Revert on Escape
expected: Open the picker, check a section (e.g., Permissions). Tree updates immediately. Now press Escape. The filter should stay — Permissions remains the only visible section. No revert to previous state.
result: pass

### 3. Pre-selection on Reopen
expected: With a filter active, reopen the picker. Previously selected sections are already checked.
result: pass

### 4. Icon Swap
expected: When filtered to a subset, toolbar shows filled filter icon. When showing all, outline filter icon.
result: pass

### 5. Mutual Exclusivity
expected: Select "All" — individual sections deselect. Select one section — "All" deselects. Deselect all sections — "All" snaps back.
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "QuickPick opens at appropriate width for its content"
  status: deferred
  reason: "User reported: still the same width. Marked as minor, skipped for now."
  severity: minor
  test: 1
  root_cause: "VS Code QuickPick width is controlled internally — canSelectMany mode adds significant padding. No API to constrain width. May be a VS Code limitation."
  artifacts:
    - path: "src/extension.ts"
      issue: "QuickPick width is determined by VS Code internals, not by item content"
  missing:
    - "Investigate if canSelectMany itself inflates width vs single-select mode"
    - "May require VS Code issue/feature request — no known workaround"
  debug_session: ""
