---
phase: 27-hook-overlap-detection
plan: "01"
subsystem: overlap-detection
tags: [hooks, overlap, tree-view, tdd]
dependency_graph:
  requires: []
  provides: [hook-overlap-detection]
  affects: [src/config/overlapResolver.ts, src/viewmodel/builder.ts]
tech_stack:
  added: []
  patterns: [resolveOverlapGeneric, TDD-red-green]
key_files:
  created: []
  modified:
    - src/config/overlapResolver.ts
    - src/viewmodel/builder.ts
    - test/suite/config/overlapResolver.test.ts
    - test/suite/viewmodel/builder.test.ts
decisions:
  - Hook identity is (eventType, matcherPattern, hookIndex) — positional within matcher, not by content
  - hookIndex parameter added to resolveHookOverlap to enable positional lookup across scopes
  - Nearest-higher precedence for hooks follows same resolveOverlapGeneric algorithm as other entity types
metrics:
  duration: "~30 minutes"
  completed: "2026-03-12"
  tasks_completed: 2
  files_modified: 4
---

# Phase 27 Plan 01: Hook Overlap Detection Summary

One-liner: Hook entry overlap detection using positional (eventType, matcherPattern, hookIndex) identity with resolveOverlapGeneric, completing all 7 entity types.

## What Was Built

Added hook overlap detection to complete the overlap system across all 7 entity types (permissions, settings, env, plugins, MCP, sandbox, hooks).

### Task 1: resolveHookOverlap resolver (TDD)

Added `resolveHookOverlap(eventType, matcherPattern, hook, hookIndex, currentScope, allScopes)` to `src/config/overlapResolver.ts`.

- Follows the exact pattern of `resolveMcpOverlap` using `resolveOverlapGeneric`
- Identity key: `(eventType, matcherPattern, hookIndex)` — finds the matcher by pattern string equality, then returns the hook at the given index
- Matcher matching: `(m.matcher ?? '') === (matcherPattern ?? '')` — undefined matchers only match other undefined matchers, not explicit matchers
- 7 test cases cover: duplicate detection, override detection, matcher mismatch (no overlap), single-scope (no overlap), nearest-higher neighbor, undefined matcher match, undefined vs explicit mismatch

### Task 2: Hook overlap wiring in builder (TDD)

Modified `src/viewmodel/builder.ts` to thread overlap resolution through the hook builder pipeline:

- `buildHookEvents(scopedConfig, allScopes)` — added `allScopes` parameter
- `buildHookEventVM(eventType, matchers, scopedConfig, allScopes)` — added `allScopes` parameter
- `buildHookEntryVM(label, eventType, matcherPattern, matcherIndex, hookIndex, hook, scopedConfig, allScopes)` — added `matcherPattern` and `allScopes` parameters

Six overlap points wired in `buildHookEntryVM`:
1. `nodeContext.overlap` — populated from `resolveHookOverlap`
2. `contextValue` — includes `.overridden` suffix via `computeStandardContextValue`
3. Icon color — uses `disabledForeground` when `isOverriddenBy` is set
4. `resourceUri` — set via `buildOverlapResourceUri` when overlap color is not 'none'
5. `tooltip` — extended with overlap MarkdownString via `buildOverlapTooltip`
6. `description` — includes "(overridden by X)" suffix via `applyOverrideSuffix`

HookEvent container nodes retain `overlap: {}` — no overlap treatment at container level.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hook identity changed from content-based to positional**
- **Found during:** Task 1 (RED/GREEN cycle)
- **Issue:** Plan specified using `deepEqual(h, hook)` to find hooks across scopes. This fails for the "different values" (override) case: when the other scope has a different hook command, `deepEqual` returns false so getValue returns `undefined`, making the resolver think the hook doesn't exist in that scope.
- **Fix:** Changed identity to positional lookup: find matcher by pattern, return `matcher.hooks[hookIndex]`. Added `hookIndex` parameter to `resolveHookOverlap`.
- **Files modified:** `src/config/overlapResolver.ts`, `test/suite/config/overlapResolver.test.ts`
- **Commit:** 6b60429

**2. [Rule 1 - Bug] "Nearest higher scope" test expectation corrected**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Plan stated "isDuplicatedBy points to nearest higher scope (ProjectLocal)" for User scope with hooks in both ProjectShared and ProjectLocal. But `resolveOverlapGeneric` finds the nearest scope by scanning the sorted array in reverse, yielding ProjectShared (precedence index 2, nearest to User's index 3) not ProjectLocal (index 1).
- **Fix:** Updated test expectation to match the actual algorithm: ProjectShared is the nearest higher from User.
- **Files modified:** `test/suite/config/overlapResolver.test.ts`
- **Commit:** 6b60429

## Pre-existing Failures (Out of Scope)

Two tests were failing before this plan and remain failing (no regression):
- `builds plugin VMs with checkbox state` — plugin icon assertion fails
- `LOCK-03: unlocking restores checkboxes` — plugin checkbox icon assertion fails

These were logged to deferred-items and not touched.

## Commits

| Hash | Description |
|------|-------------|
| 6b60429 | feat(27-01): add resolveHookOverlap resolver with tests |
| cccb98f | feat(27-01): wire hook overlap into builder with tests |

## Success Criteria Verification

- Hook entries show overlap color-coding (via FileDecorationProvider resourceUri) when same hook exists in multiple scopes: **DONE**
- Hook entries show MarkdownString tooltips with overlap details when overlapping: **DONE**
- Hook entries with isOverriddenBy have dimmed icons and "(overridden by X)" in description: **DONE**
- HookEvent container nodes unchanged (overlap: {}): **DONE**
- All 7 entity types now participate in overlap detection: **DONE**

## Self-Check: PASSED

All files exist and all commits verified:
- src/config/overlapResolver.ts — FOUND
- src/viewmodel/builder.ts — FOUND
- test/suite/config/overlapResolver.test.ts — FOUND
- test/suite/viewmodel/builder.test.ts — FOUND
- .planning/phases/27-hook-overlap-detection/27-01-SUMMARY.md — FOUND
- Commit 6b60429 — FOUND
- Commit cccb98f — FOUND
