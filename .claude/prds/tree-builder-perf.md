---
name: tree-builder-perf
description: Performance instrumentation for tree builder hot paths — telemetry via Azure Application Insights and local output channel logging, covering CPU timing and memory snapshots
status: backlog
created: 2026-05-01T13:00:00Z
---

# PRD: tree-builder-perf

## Source Ideas

Quick capture L8 (2026-04-22): "Automatic CPU/memory profiling for tree builder — suspect: O(n²) permission overlap resolution with ~140 rules/scope"

## Executive Summary

The extension has no visibility into how long tree rebuilds take or how much memory they consume on real users' machines. On high-end hardware the UI feels instant, but the codebase has known O(n²)-suspect paths (permission overlap resolution across scopes) and config files in the wild range from 30 lines to 1,300+ lines with 900+ permission rules. Without instrumentation, performance regressions ship silently.

This PRD adds two complementary layers:

1. **Telemetry** — `@vscode/extension-telemetry` backed by Azure Application Insights, reporting timing and memory metrics from real users (opt-in via VS Code's `telemetry.telemetryLevel`).
2. **Local diagnostics** — structured performance logs in the existing output channel, useful for development and user-filed bug reports without requiring telemetry consent.

No user-visible alerts or UI changes. Pure observability.

## Problem Statement

### Why we can't rely on developer testing alone

Real-world Claude Code configs vary dramatically:

| Dimension | Typical | Power User | Extreme (observed) |
|---|---|---|---|
| Permission rules | 15–30 | 70–100 | 900+ (thegeosman/claude-code-settings) |
| MCP servers | 2–3 | 4–6 | 8+ |
| Hooks | 1–3 | 4–8 | 15 |
| Env vars | 2–3 | 3–5 | 15 |
| File size | 1–4 KB | 4–10 KB | 34 KB / 1,300 lines |

The permission overlap resolver (`computePermissionOverlapMap`) uses tool-name bucketing to avoid full O(R²), but within a bucket the scan is still O(B²) where B is the number of rules sharing a tool name. With 900 rules, buckets could be large. We don't know — we've never measured.

### Hot paths to instrument

| Path | Triggered by | Frequency |
|---|---|---|
| **Full tree rebuild** | Config file change (save, external edit), scope toggle, filter change | Every config edit — high frequency |
| **Permission overlap resolution** | `computePermissionOverlapMap` inside tree rebuild | Once per rebuild |
| **Config file I/O** | `configLoader` reading + parsing all scope files | Once per rebuild |
| **View-model construction** | `builder.buildScopeVM` / `buildEntityVM` (future) | Once per rebuild |
| **Extension activation** | `activate()` → initial load + tree build | Once per session |

### Memory concern

The `ConfigStore` holds parsed JSON for all scope files plus the `ScopedConfig[]` array. The tree builder creates a full VM representation and then a full node tree. On a 900-rule config across 4 scopes, that's potentially thousands of objects. We don't know the baseline or growth curve.

## User Stories

### Story 1: Detect regressions before users report them

**As** the extension developer
**I want** to see p50/p95/p99 tree rebuild times from real users in Application Insights
**So that** I catch regressions from new features (e.g., entity-type-view) before they become bug reports.

**Acceptance**: Application Insights dashboard shows `treeRebuild.durationMs` distribution broken down by config size (rule count bucket).

### Story 2: Diagnose a user's performance complaint

**As** the extension developer responding to a "tree is slow" issue
**I want** the user to paste their output channel log showing exact timing breakdown per phase
**So that** I can identify whether the bottleneck is I/O, overlap resolution, VM construction, or rendering.

**Acceptance**: Output channel contains timestamped lines like `[perf] treeRebuild: 342ms (io: 12ms, overlap: 285ms, vm: 38ms, nodes: 7ms) | rules: 912 | heap: +2.1MB`.

### Story 3: Validate that entity-type-view doesn't regress performance

**As** the extension developer shipping the entity-type-view feature (future PRD)
**I want** to compare telemetry before and after the feature ships
**So that** I can confirm the second grouping path doesn't double rebuild time.

**Acceptance**: Telemetry events include a `viewMode` property (scope/entity) so the two paths can be compared independently.

## Functional Requirements

### FR1: Add `@vscode/extension-telemetry` dependency

- Add `@vscode/extension-telemetry` as a production dependency (it must be bundled — this will be the extension's first runtime dependency).
- Create an Azure Application Insights resource and embed the connection string in extension code (this is standard practice — the string is not a secret; it only allows writes).
- Initialize `TelemetryReporter` in `activate()`, dispose in `deactivate()`.
- All telemetry calls go through a single `TelemetryService` wrapper so the reporter can be mocked in tests.

### FR2: Respect VS Code telemetry consent

- `@vscode/extension-telemetry` automatically respects `telemetry.telemetryLevel`. When the user sets it to `off`, no events are sent. No custom consent UI needed.
- Add `"telemetry": true` and `"usesOnlineServices": true` to `package.json` `contributes.configuration` metadata.
- Add a `telemetry.json` manifest file in the extension root listing all events and their properties (transparency requirement for Marketplace).

### FR3: Instrument tree rebuild (end-to-end)

Wrap the full rebuild cycle with `performance.now()` timing:

```
configStore.reload() → configLoader I/O → overlapResolver → builder → TreeView refresh
```

Report a single telemetry event per rebuild:

| Event name | Properties (strings) | Measurements (numbers) |
|---|---|---|
| `treeRebuild` | `viewMode`, `trigger`, `ruleCountBucket` | `durationMs`, `ioDurationMs`, `overlapDurationMs`, `vmDurationMs`, `nodeDurationMs`, `totalRules`, `totalScopes`, `totalEntities`, `heapUsedBefore`, `heapUsedAfter`, `heapDelta` |

`ruleCountBucket`: "0-50", "51-100", "101-200", "201-500", "500+" — enables Application Insights to segment by config complexity without leaking exact counts.

`trigger`: "fileChange", "scopeToggle", "filterChange", "activation", "manual" — identifies what caused the rebuild.

### FR4: Instrument permission overlap resolution

Within the `computePermissionOverlapMap` call, measure:

| Event name | Properties | Measurements |
|---|---|---|
| `permissionOverlap` | `ruleCountBucket` | `durationMs`, `totalRules`, `bucketCount`, `maxBucketSize`, `comparisons` |

`comparisons` counts actual `rulesOverlap()` calls — this is the O(B²) indicator. If `maxBucketSize` is high and `comparisons` is quadratic relative to `totalRules`, we know where to optimize.

Only send this event when duration exceeds a threshold (e.g., 50ms) to avoid flooding telemetry on small configs.

### FR5: Instrument config file I/O

Measure per-file load time within `configLoader`:

| Event name | Properties | Measurements |
|---|---|---|
| `configLoad` | `scope`, `fileSizeBucket` | `durationMs`, `parseMs`, `fileSize`, `entityCount` |

`fileSizeBucket`: "0-1KB", "1-5KB", "5-20KB", "20KB+" — segments by file size.

Emitted once per file per reload. Batching into a single event with per-scope breakdowns is acceptable if event volume is a concern.

### FR6: Memory snapshots

Use `process.memoryUsage().heapUsed` before and after each tree rebuild to capture heap delta.

Include in the `treeRebuild` event as `heapUsedBefore`, `heapUsedAfter`, `heapDelta` (all in bytes).

For activation, capture baseline heap after `activate()` completes:

| Event name | Properties | Measurements |
|---|---|---|
| `activation` | `extensionVersion` | `durationMs`, `heapAfterActivation`, `scopeCount`, `totalRules`, `totalEntities` |

### FR7: Local output channel diagnostics

Extend the existing output channel (`Claude Config`) with structured performance log lines. Format:

```
[HH:MM:SS.mmm] [perf] treeRebuild: 342ms (io: 12ms, overlap: 285ms, vm: 38ms, nodes: 7ms) | rules: 912 | scopes: 4 | heap: +2.1MB
[HH:MM:SS.mmm] [perf] permOverlap: 285ms | rules: 912 | buckets: 47 | maxBucket: 83 | comparisons: 6,889
[HH:MM:SS.mmm] [perf] configLoad [User]: 4ms | size: 34KB | entities: 923
[HH:MM:SS.mmm] [perf] activation: 187ms | heap: 12.4MB | scopes: 4 | rules: 912
```

These log lines are always written regardless of telemetry consent — they stay local.

### FR8: `TelemetryService` abstraction

All telemetry goes through a `TelemetryService` class:

```typescript
class TelemetryService {
  constructor(reporter: TelemetryReporter, outputChannel: OutputChannel)
  reportTreeRebuild(metrics: TreeRebuildMetrics): void
  reportPermissionOverlap(metrics: OverlapMetrics): void
  reportConfigLoad(metrics: ConfigLoadMetrics): void
  reportActivation(metrics: ActivationMetrics): void
  dispose(): void
}
```

- Writes to both Application Insights (via reporter) and output channel (structured log).
- Reporter calls are no-ops when telemetry is disabled (handled by `@vscode/extension-telemetry` internally).
- Output channel writes always execute.
- Mockable in tests — inject a stub reporter.

### FR9: Timing utilities

Add a lightweight `PerfTimer` utility:

```typescript
class PerfTimer {
  mark(label: string): void    // records performance.now() for a named phase
  elapsed(label: string): number  // ms since mark
  summary(): Record<string, number>  // all phases as { label: durationMs }
}
```

Used inline in tree rebuild to bracket each phase without cluttering the rebuild code with raw `performance.now()` calls.

## Non-Functional Requirements

- **Overhead budget**: telemetry instrumentation must add < 5ms to a tree rebuild on any config size. `performance.now()` and `process.memoryUsage()` are the only measurement calls; both are sub-microsecond. Application Insights batches and sends asynchronously — no blocking I/O in the rebuild path.
- **Bundle size**: `@vscode/extension-telemetry` is ~150KB minified. Acceptable as the extension's first runtime dependency.
- **No PII**: telemetry events must never include file paths, setting values, permission rule text, plugin IDs, or MCP server names. Only numeric metrics and bucketed dimensions.
- **Backward compatibility**: no changes to any public command IDs, tree nodes, or config writer behavior.
- **Testability**: `TelemetryService` accepts an injected reporter, enabling unit tests that assert event payloads without network calls.

## Success Criteria

1. After shipping, Application Insights shows `treeRebuild` events with timing distributions segmented by `ruleCountBucket`.
2. A user with `telemetry.telemetryLevel: off` generates zero network requests from the extension.
3. Output channel shows structured `[perf]` lines for every tree rebuild, regardless of telemetry consent.
4. On a synthetic 900-rule config, telemetry instrumentation adds < 5ms to total rebuild time.
5. `permissionOverlap` events show `comparisons` count, enabling future optimization decisions.
6. `heapDelta` in `treeRebuild` events provides baseline for memory regression detection.
7. `telemetry.json` manifest lists all events and their schemas.

## Constraints & Assumptions

### Constraints

- `@vscode/extension-telemetry` is the only acceptable telemetry dependency (Sentry has unfixed global-state conflicts in VS Code's shared extension host — issue getsentry/sentry-javascript#9543).
- Azure Application Insights free tier: 5 GB/month ingestion, 90-day retention. Sufficient for a niche extension.
- `process.memoryUsage()` measures the entire extension host heap, not just this extension's allocations. `heapDelta` (before/after rebuild) isolates the rebuild's contribution but is approximate — concurrent GC or other extensions' allocations can skew it.

### Assumptions

1. An Azure Application Insights resource will be provisioned before development begins (free, takes 2 minutes).
2. The connection string will be embedded in source code — this is standard for VS Code extensions and not a security concern (write-only, no read access).
3. The output channel `Claude Config` already exists and is initialized in `activate()` — confirmed in current code.
4. Future PRDs (entity-type-view, config-model-alignment) will inherit instrumentation automatically if they go through the same tree rebuild path.

## Out of Scope

- **User-visible alerts** (e.g., "Tree rebuild took 2.3s") — not wanted.
- **Performance optimization** — this PRD is instrumentation only. Optimization decisions come from the data.
- **Custom telemetry consent UI** — `@vscode/extension-telemetry` handles consent via VS Code's built-in setting.
- **Application Insights dashboard creation** — dashboards and alerts are configured in Azure portal, not in extension code.
- **Profiling for entity-type-view** — that feature doesn't exist yet. When it ships, it inherits these instruments via the shared rebuild path. The `viewMode` property future-proofs the telemetry for comparison.
- **Continuous profiling / flame graphs** — out of scope for v1. `performance.now()` bracketing is sufficient.
- **Network request timing** — the extension makes no network requests today (telemetry is async fire-and-forget via the SDK).

## Dependencies

### Internal

- `src/extension.ts` — initialize `TelemetryReporter` and `TelemetryService` in `activate()`, dispose in `deactivate()`.
- `src/config/configModel.ts` — add timing marks around `reload()` phases.
- `src/config/overlapResolver.ts` — add timing + comparison counter to `computePermissionOverlapMap`.
- `src/config/configLoader.ts` — add per-file timing.
- `src/viewmodel/builder.ts` — add timing marks around VM construction.
- `src/tree/configTreeProvider.ts` — add timing marks around node construction.
- New: `src/telemetry/telemetryService.ts` — `TelemetryService` class.
- New: `src/utils/perfTimer.ts` — `PerfTimer` utility.
- `package.json` — add `@vscode/extension-telemetry` dependency, telemetry metadata.
- New: `telemetry.json` — event manifest for Marketplace transparency.

### External

- Azure Application Insights resource (free tier).
- `@vscode/extension-telemetry` npm package.

### Documentation

- `CHANGELOG.md` entry: added anonymous performance telemetry (respects VS Code telemetry settings).
- `README.md` section: brief telemetry disclosure — what is collected (timing + memory metrics, no PII), how to opt out (VS Code's `telemetry.telemetryLevel` setting).
