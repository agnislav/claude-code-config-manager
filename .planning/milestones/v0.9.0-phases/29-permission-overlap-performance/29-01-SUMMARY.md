---
phase: 29-permission-overlap-performance
plan: 01
subsystem: permissions
tags: [performance, batch-algorithm, caching, permissions, overlap-resolution]
dependency_graph:
  requires: []
  provides:
    - computePermissionOverlapMap batch function
    - RegExp cache in wildcardMatch
    - ParsedPermissionRule cache via getCachedParse
  affects:
    - src/viewmodel/builder.ts (buildPermissionRules wired to batch map)
    - src/config/overlapResolver.ts (batch function added)
    - src/utils/permissions.ts (caches added, getCachedParse exported)
tech_stack:
  added: []
  patterns:
    - Module-level Map caches for RegExp and ParsedPermissionRule objects
    - Tool-name pre-indexing to eliminate cross-tool comparisons
    - Single-pass batch overlap computation for all (scope, category, rule) triples
key_files:
  created:
    - test/suite/utils/permissions.test.ts
  modified:
    - src/utils/permissions.ts
    - src/config/overlapResolver.ts
    - src/viewmodel/builder.ts
    - test/suite/config/overlapResolver.test.ts
decisions:
  - getCachedParse exported as public API (rulesOverlap uses it internally, batch function imports it)
  - resolvePermissionOverlap kept unchanged for backward compatibility — tests import it directly
  - computePermissionOverlapMap called once per buildPermissionRules invocation, not per rule
  - overlapMap keyed as ${scope}/${category}/${rule} — matches builder lookup pattern exactly
  - Tool-name bucket isolation ensures cross-tool comparisons are structurally impossible
metrics:
  duration_seconds: 296
  completed_date: "2026-03-13"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 3
  tests_added: 17
  tests_total_after: 120
---

# Phase 29 Plan 01: Permission Overlap Performance Summary

**One-liner:** Batch indexed permission overlap resolution with RegExp/parse caches eliminates O(R²) per-rule scans; tree renders instantly with 140+ rules per scope.

## What Was Built

### Task 1 — RegExp cache and parse cache in permissions.ts

Added two module-level caches to `src/utils/permissions.ts`:

- `_regexpCache: Map<string, RegExp>` — `wildcardMatch` checks this before constructing a `new RegExp(...)`. Cache miss stores the compiled pattern; subsequent calls with identical patterns reuse it.
- `_parseCache: Map<string, ParsedPermissionRule>` — new exported function `getCachedParse(rule)` checks this before calling `parsePermissionRule`. Returns the identical object reference on cache hit.
- `rulesOverlap` updated to call `getCachedParse` instead of `parsePermissionRule` directly.

All public signatures (`parsePermissionRule`, `rulesOverlap`, `formatPermissionRule`) are unchanged.

### Task 2 — computePermissionOverlapMap + builder wiring

Added `computePermissionOverlapMap(allScopes)` to `src/config/overlapResolver.ts`:

- Private `buildToolIndex(allScopes)` groups all `(scope, category, rule)` entries by parsed tool name into a `Map<string, RuleEntry[]>`.
- For each bucket (same tool name), each entry's overlap is computed by comparing only within the bucket — eliminating cross-tool comparisons entirely.
- Same nearest-neighbor precedence logic as `resolvePermissionOverlap`: sort by `SCOPE_PRECEDENCE`, find nearest higher/lower, classify as override/duplicate/overriddenBy/duplicatedBy.
- Result keyed as `${scope}/${category}/${rule}`.

In `src/viewmodel/builder.ts`:
- `buildPermissionRules` now calls `computePermissionOverlapMap(allScopes)` once before the category loop.
- `buildPermissionRule` signature changed from `allScopes: ScopedConfig[]` to `overlapMap: Map<...>`.
- Per-rule `resolvePermissionOverlap` call replaced with `overlapMap.get(key) ?? {}`.
- `resolvePermissionOverlap` import removed from builder.ts.

### Task 3 — Parity and coverage tests

Added `suite('computePermissionOverlapMap', ...)` to `test/suite/config/overlapResolver.test.ts`:

1. **Parity test**: 2 scopes with overlapping rules; each triple's map entry matches `resolvePermissionOverlap` output exactly.
2. **Key completeness test**: `map.size` equals the count of unique `(scope, category, rule)` triples.
3. **Scale test**: 4 scopes × 140 rules each (560 total) — completes without throwing, correct map size.
4. **Cross-tool isolation test**: `Bash(*)` and `Read(*)` rules never show overlap with each other.

Added `test/suite/utils/permissions.test.ts` with 13 tests covering `parsePermissionRule`, `rulesOverlap`, and `getCachedParse` behavior including cache reference identity.

## Test Results

| State | Count |
|-------|-------|
| Baseline (pre-plan) | 103 passing, 2 pre-existing failures |
| After plan | 120 passing, 2 pre-existing failures (unchanged) |
| Tests added | 17 (13 in permissions.test.ts + 4 in overlapResolver.test.ts) |

Pre-existing failures are in `builder.test.ts` (plugin VM checkbox tests) — unrelated to this plan, present before execution.

## Deviations from Plan

None — plan executed exactly as written.

## Performance Impact

The batch algorithm eliminates the O(R²) per-rule scan:

- **Before**: `buildPermissionRules` called `resolvePermissionOverlap` once per rule. With R rules per scope and S scopes, this is O(R × S × R) per tree build (each call scans all rules in all scopes).
- **After**: `computePermissionOverlapMap` is called once. Tool-name indexing means each rule only compares against rules with the same tool name. Rules from different tools are never compared.
- **RegExp cache**: each unique wildcard pattern is compiled to a `RegExp` exactly once across the extension's lifetime.
- **Parse cache**: each unique rule string is parsed exactly once; subsequent calls return the cached `ParsedPermissionRule` object reference.

## Commits

| Hash | Description |
|------|-------------|
| `7bcd4cf` | feat(29-01): add RegExp cache and parse cache to permissions.ts |
| `c0ecaec` | feat(29-01): add computePermissionOverlapMap and wire into builder |
| `24821ee` | test(29-01): add parity and coverage tests for computePermissionOverlapMap |

## Self-Check: PASSED

- FOUND: src/utils/permissions.ts (contains _regexpCache, _parseCache, getCachedParse)
- FOUND: src/config/overlapResolver.ts (exports computePermissionOverlapMap)
- FOUND: src/viewmodel/builder.ts (contains computePermissionOverlapMap call)
- FOUND: test/suite/config/overlapResolver.test.ts (contains computePermissionOverlapMap tests)
- FOUND: test/suite/utils/permissions.test.ts (new test file)
- FOUND: commits 7bcd4cf, c0ecaec, 24821ee in git log
- All 120 tests passing (4 new computePermissionOverlapMap + 13 new permissions tests)
