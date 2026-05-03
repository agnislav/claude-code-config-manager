---
name: config-model-alignment
status: backlog
created: 2026-05-03T00:33:23Z
progress: 0%
prd: .claude/prds/config-model-alignment.md
github:
---

# Epic: config-model-alignment

Align the extension's config model with Claude Code's actual schema — fix merge semantics for hooks/sandbox, add missing setting keys, hook event types, and TypeScript type gaps.

## Overview

The extension's internal representation of Claude Code's configuration has drifted from reality across three layers (JSON schema, TypeScript interfaces, UI constants). This epic closes all known gaps in two parallel work streams:

- **Stream A — Merge Semantics**: Fix the overlap resolver to use concatenation for hooks and array-merge for sandbox arrays, instead of treating everything as per-key override.
- **Stream B — Entity Coverage**: Add ~55 missing setting keys, 15 missing hook event types, 2 missing hook handler types, fix incorrect schema entries, and ensure all three layers (schema ↔ types ↔ constants) agree.

A final integration task verifies cross-layer consistency and ensures no regressions.

## Architecture Decisions

### AD1: Three merge strategies in the overlap resolver

Introduce a `MergeStrategy` concept to replace the one-size-fits-all `resolveOverlapGeneric`:

| Strategy | Entities | Resolution |
|----------|----------|------------|
| `override` | plugins, env vars, scalars, MCP configs, sandbox booleans | Higher-precedence scope wins per key (current behavior, unchanged) |
| `concatenate` | hooks, permission arrays | All scopes' entries coexist and run together. Show "co-exists with" instead of "overridden by" |
| `arrayMerge` | sandbox array properties (`allowedDomains`, `denyWrite`, etc.) | Arrays from all scopes are concatenated/deduped. Show "merged with" instead of "overridden by" |

This is a logical model — not necessarily three separate functions. `resolveOverlapGeneric` stays for `override`; new functions handle the other two strategies.

### AD2: Extend OverlapInfo, don't replace it

Add optional `coexistsWith` and `mergedWith` fields to `OverlapInfo`. Existing consumers that only check `isOverriddenBy`/`overrides` continue to work unchanged.

```typescript
interface OverlapInfo {
  // existing (unchanged)
  overrides?: OverlapItem;
  isOverriddenBy?: OverlapItem;
  duplicates?: OverlapItem;
  isDuplicatedBy?: OverlapItem;
  // new
  coexistsWith?: OverlapItem;   // hooks: same event type, different scope
  mergedWith?: OverlapItem;     // sandbox arrays: same array key, different scope
}
```

### AD3: Overlap decoration colors

Current palette: red (overridden), orange (duplicated), green (overrides), yellow (duplicates).

New additions:
- **Co-exists**: `charts.blue` or no special color (default) — neutral, no "winner/loser" connotation.
- **Merged**: same blue or default — neutral, indicating array union.

### AD4: Schema as source of truth for entity coverage

All ~79 setting keys go into the JSON schema first. TypeScript types and constants derive from (or must match) the schema. A test-time check ensures `KNOWN_SETTING_KEYS` is a subset of the schema's top-level properties (excluding structural keys).

### AD5: Hook edit notification

After any hook write via `configWriter`, show a VS Code info notification: "Hook configuration updated. A new Claude Code session is required for changes to take effect." This is a one-liner in `addCommands.ts` after the write succeeds.

## Technical Approach

### Overlap Resolver Changes (Stream A)

**File: `src/config/overlapResolver.ts`**

1. **New function `resolveHookCoexistence()`** — replaces the current `resolveHookOverlap()` which delegates to `resolveOverlapGeneric`. The new function:
   - Scans all scopes for hooks with matching `eventType` + `matcher.pattern`.
   - If found in another scope: returns `{ coexistsWith: { scope, value } }`.
   - If exact same command string in another scope: returns `{ isDuplicatedBy: { scope, value } }` (both run, but redundant).
   - Never returns `isOverriddenBy` — hooks always coexist.

2. **New function `resolveSandboxArrayMerge()`** — handles sandbox properties that are arrays. The existing `resolveSandboxOverlap()` becomes a dispatcher:
   - If the leaf value is a boolean/string/number: delegate to `resolveOverlapGeneric` (override strategy, unchanged).
   - If the leaf value is an array: call `resolveSandboxArrayMerge()` which returns `{ mergedWith: { scope, value } }` when the same array key exists in another scope.

3. **Update `getOverlapColor()`** — add cases for `coexistsWith` (blue) and `mergedWith` (blue).

**File: `src/viewmodel/builder.ts`**

4. **`buildOverlapTooltip()`** — add tooltip text for `coexistsWith` ("Also runs in {scope} scope") and `mergedWith` ("Merged with {scope} scope — effective list includes both").

5. **`applyOverrideSuffix()`** — add suffix text for co-existence and merge indicators.

6. **`buildOverlapResourceUri()`** — add URI scheme for the new overlap types so decoration provider can color them.

**File: `src/tree/overlapDecorations.ts`**

7. Update decoration provider to handle new URI schemes with blue/default coloring.

### Entity Coverage Changes (Stream B)

**File: `schemas/claude-code-settings.schema.json`**

1. **Remove** `smallFastModel` and `trustWorkspaceConfig` properties.
2. **Fix** `attribution` from `{ "type": "string" }` to `{ "type": "object", "properties": { "commit": { "type": "string" }, "pr": { "type": "string" } } }`.
3. **Rename** sandbox network `allowedHosts` → `allowedDomains`, `blockedHosts` → `deniedDomains`.
4. **Add** sandbox `filesystem` properties: `allowWrite`, `denyWrite`, `allowRead`, `denyRead` (all `string[]`).
5. **Expand** hooks property to accept all 29 event types.
6. **Add** all ~55 missing setting keys with correct types and enum constraints.

**File: `src/types.ts`**

7. **Expand** `HookEventType` enum from 14 → 29 entries.
8. **Expand** `HookCommand.type` from `'command' | 'prompt' | 'agent'` to include `'http'` and `'mcp_tool'` with their respective fields.
9. **Fix** `attribution` type to `{ commit?: string; pr?: string }`.
10. **Add** all missing setting key properties to `ClaudeCodeConfig` (matching schema additions).
11. **Fix** `allowedMcpServers` / `deniedMcpServers` types to `object[]` (managed-only).

**File: `src/constants.ts`**

12. **Expand** `KNOWN_SETTING_KEYS` to include all new user-facing setting keys.
13. **Expand** `SETTING_TYPE_MAP` to match.
14. **Rename** `disabledMcpServers` → `disabledMcpjsonServers` (or support both with deprecation note).

### Integration & Verification

**Test files:**

15. Add overlap resolver tests for concatenate strategy (hooks) and arrayMerge strategy (sandbox arrays).
16. Add schema validation tests verifying diagnostics fire for representative new keys.
17. Add a consistency test: `KNOWN_SETTING_KEYS` entries exist in `ClaudeCodeConfig` interface (compile-time) and in the JSON schema.

**Hook edit notification:**

18. In `src/commands/addCommands.ts`, after successful hook write, show `vscode.window.showInformationMessage()`.

## Task Breakdown Preview

| # | Task | Stream | Depends On | Parallel |
|---|------|--------|------------|----------|
| 1 | Extend `OverlapInfo` type + add `MergeStrategy` concept to types | A | — | Yes |
| 2 | Implement hook co-existence resolver + sandbox array-merge resolver | A | 1 | Yes |
| 3 | Update viewmodel builder + overlap decorations for new indicators | A | 1, 2 | No |
| 4 | Fix schema: remove wrong keys, fix types, rename sandbox props, expand hooks | B | — | Yes |
| 5 | Expand TypeScript types: all hook events, handler types, missing settings | B | 4 | No |
| 6 | Expand constants: KNOWN_SETTING_KEYS, SETTING_TYPE_MAP, disabledMcpjsonServers | B | 5 | No |
| 7 | Hook edit notification + session restart message | A/B | — | Yes |
| 8 | Tests: overlap resolver (concatenate + arrayMerge), schema validation, cross-layer consistency | A+B | 2, 3, 6 | No |

**Parallelization**: Tasks 1, 4, and 7 can start simultaneously. Stream A (1→2→3) and Stream B (4→5→6) run in parallel. Task 8 (tests) is the integration gate after both streams complete.

## Dependencies

### Internal

- `src/config/overlapResolver.ts` — main change site for Stream A
- `src/viewmodel/builder.ts` — tooltip/description formatting for new overlap types
- `src/tree/overlapDecorations.ts` — decoration colors for new overlap types
- `src/types.ts` — OverlapInfo extension, HookEventType expansion, ClaudeCodeConfig expansion
- `src/constants.ts` — KNOWN_SETTING_KEYS, SETTING_TYPE_MAP expansion
- `schemas/claude-code-settings.schema.json` — entity coverage corrections and additions
- `src/commands/addCommands.ts` — hook edit notification
- Test files in `src/test/` — new test cases

### External

- `vault/projects/_references/cc_config_reference.md` — verified reference for all entity types, merge models, and edge cases
- Official docs: code.claude.com/docs/en/settings, /hooks, /permissions, /sandboxing

## Success Criteria (Technical)

### Merge Semantics (Stream A)
1. Two hooks with same event type in different scopes show blue/neutral co-existence indicator, not red override
2. Sandbox array properties (`allowedDomains`, `allowWrite`, etc.) in multiple scopes show "merged with" indicator, not override
3. Sandbox boolean properties (`enabled`, etc.) retain current override behavior — no regression
4. Plugin, env var, scalar setting, MCP server overlap indicators unchanged — no regression
5. Permission overlap indicators unchanged — no regression

### Entity Coverage (Stream B)
6. `smallFastModel` and `trustWorkspaceConfig` removed from schema
7. `attribution` typed as `{ commit?: string; pr?: string }` in schema and types
8. Sandbox property names corrected in schema (`allowedDomains`/`deniedDomains`)
9. All 29 hook event types in enum and schema
10. All 5 hook handler types in TypeScript (`command`, `http`, `mcp_tool`, `prompt`, `agent`)
11. `KNOWN_SETTING_KEYS`, `ClaudeCodeConfig`, and schema all agree on every key
12. `disabledMcpjsonServers` used consistently (not `disabledMcpServers`)

### Integration
13. All existing tests pass
14. New tests cover concatenate and arrayMerge strategies
15. Hook edits trigger session-restart info notification
16. Schema validation produces diagnostics for typos in newly-added keys

## Estimated Effort

- **Stream A (Merge Semantics)**: ~4-5 hours — new resolver functions, builder updates, decoration changes, tests
- **Stream B (Entity Coverage)**: ~3-4 hours — schema/types/constants bulk additions, verification
- **Integration & Testing**: ~2 hours — cross-layer consistency, regression testing
- **Total**: ~9-11 hours across 8 tasks
