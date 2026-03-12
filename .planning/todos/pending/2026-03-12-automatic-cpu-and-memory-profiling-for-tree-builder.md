---
created: 2026-03-12T18:47:46.451Z
title: Automatic CPU and memory profiling for tree builder
area: ui
files:
  - src/viewmodel/builder.ts
  - src/config/overlapResolver.ts
  - src/utils/permissions.ts
---

## Problem

With realistic fixture data (~140 permission rules per scope, nested sandbox objects, multiple hook entries), the TreeView takes noticeably longer to render and "Expand All" can hang VS Code. The root cause is likely the O(n²) permission overlap resolution: `resolvePermissionOverlap()` calls `rulesOverlap()` for each rule against every rule in other scopes across 3 categories (~120K comparisons for 140 rules × 2 scopes).

Discovered during Phase 25 UAT when test fixtures were enriched with sandbox, hooks, and env var data. The permission rules were already present but the additional sections may have tipped rendering time over the threshold.

## Solution

Add automatic CPU/memory profiling instrumentation to the tree builder pipeline:
- Measure `buildScopeVM()` and section-level build times (especially `buildPermissionRules`)
- Profile `resolvePermissionOverlap()` with large rule sets
- Consider caching overlap results or pre-indexing rules by tool name to reduce comparisons
- Add VS Code performance marks (`performance.mark`/`performance.measure`) for telemetry
- Consider lazy/virtualized node expansion for large sections
