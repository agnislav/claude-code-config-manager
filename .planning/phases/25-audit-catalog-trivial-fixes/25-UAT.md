---
status: testing
phase: 25-audit-catalog-trivial-fixes
source: [25-01-SUMMARY.md, 25-02-SUMMARY.md]
started: 2026-03-12T13:00:00Z
updated: 2026-03-12T13:00:00Z
---

## Current Test

number: 1
name: Sandbox Property Count
expected: |
  In the TreeView, expand a scope that has a sandbox configuration with nested properties (e.g., network sub-object). The Sandbox section header should show the total flattened property count (e.g., "3 properties"), not just the top-level key count.
awaiting: user response

## Tests

### 1. Sandbox Property Count
expected: Sandbox section header shows accurate flattened property count including nested sub-object properties (e.g., "3 properties" when there are 2 top-level + 1 nested network property)
result: [pending]

### 2. Hook Entry Type Description
expected: HookEntry nodes in the TreeView display a type-prefixed description (e.g., "command: echo test", "prompt: Review output") instead of a generic or missing description
result: [pending]

### 3. EnvVar Tooltip with Scope Context
expected: Hovering over an environment variable node shows a MarkdownString tooltip displaying key=value with the scope label and config file path, with values truncated at 80 characters
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0

## Gaps

[none yet]
