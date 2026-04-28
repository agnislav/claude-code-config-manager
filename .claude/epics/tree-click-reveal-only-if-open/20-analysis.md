---
issue: 20
title: "Reveal-only-if-open: helper, handler gate, tests, and docs"
analyzed: 2026-04-28T10:45:02Z
estimated_hours: 1.5
parallelization_factor: 1.0
---

# Parallel Work Analysis: Issue #20

## Overview

Single-stream task. The helper, the call-site gate, and the tests all touch the same file pair (`src/commands/openFileCommands.ts` + new `test/suite/commands/openFileCommands.test.ts`). The CHANGELOG line is trivial. Splitting this into multiple agents would create merge churn for zero wall-time win.

## Parallel Streams

### Stream A: Reveal-only-if-open implementation + tests + docs
**Scope**: Add `isFileOpenInAnyTab` helper, gate the `showTextDocument` call inside `claudeConfig.revealInFile`, add a new test suite covering both paths, document the behavior change in CHANGELOG.
**Files**:
- `src/commands/openFileCommands.ts` (edit — add helper near top, gate at line ~141 before `showTextDocument`)
- `test/suite/commands/openFileCommands.test.ts` (new file — two cases)
- `CHANGELOG.md` (edit — add `### Changed` line under next milestone or new `[Unreleased]` heading)
**Can Start**: immediately
**Estimated Hours**: 1.5
**Dependencies**: none

## Coordination Points

### Shared Files
None — single stream owns all touched files.

### Sequential Requirements
1. Helper + gate land first (one Edit).
2. Tests reference the new behavior — written second.
3. CHANGELOG line last so it accurately reflects what shipped.

## Conflict Risk Assessment

**Low**. The handler is small, the gate is a 3-line insertion before `showTextDocument`, and the test directory `test/suite/commands/` is new. No other open work touches `openFileCommands.ts`.

## Parallelization Strategy

**Single stream** — execute inline in the worktree at `../epic-tree-click-reveal-only-if-open`. No agent dispatch overhead; the change is small enough that a focused implementation pass + verification is faster than spawning a sub-agent.

## Expected Timeline
- With "parallel" execution: 1.5h (single stream)
- Without: 1.5h
- Efficiency gain: 0% (nothing to parallelize)
