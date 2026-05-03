---
name: config-model-alignment
description: Align the extension's config model with Claude Code's actual schema — fix merge semantics for hooks/sandbox, add missing setting keys, hook event types, and TypeScript type gaps
status: active
created: 2026-05-01T12:00:00Z
updated: 2026-05-03T01:00:00Z
---

# PRD: config-model-alignment

## Source Ideas

- Quick #11 verification audit (2026-05-01) — discovered scope merge semantics mismatch.
- Entity coverage audit (2026-05-03) — discovered schema/type gaps. Verified against official docs at code.claude.com.
- Reference: `vault/projects/_references/cc_config_reference.md` — canonical verified source for Claude Code's config model.

## Executive Summary

The extension's internal model of Claude Code's configuration has drifted from reality in two ways:

1. **Merge semantics** — The overlap resolver treats all entity types as "higher scope wins," which is wrong for hooks (concatenated across scopes) and sandbox arrays (merged across scopes). This misleads users into thinking cross-scope hooks are silently ignored.

2. **Entity coverage** — The extension knows ~24 setting keys; Claude Code has ~79. The schema is missing most of them plus 24 of 29 hook event types. Two schema properties (`smallFastModel`, `trustWorkspaceConfig`) don't actually exist in Claude Code. The hook type model is missing 2 of 5 handler types (`http`, `mcp_tool`). Sandbox property names in the schema are outdated (`allowedHosts` vs actual `allowedDomains`).

Both problems share a root cause: **the extension's model of Claude Code's config is incomplete and inconsistent across layers** (schema vs. types vs. constants). This PRD aligns all three.

**Canonical reference:** `vault/projects/_references/cc_config_reference.md` — verified against official docs (May 2026).

## Problem Statement

### Root cause

`overlapResolver.ts` funnels all entity types through `resolveOverlapGeneric`, which uses a single model: find the nearest higher/lower-precedence scope with the same key, then classify as override (values differ) or duplicate (values match).

Claude Code actually uses **three distinct merge strategies**:

| Strategy | Entities | Behavior |
|----------|----------|----------|
| **Per-key override** | plugins, env vars, scalar settings, MCP server configs | Higher scope wins per key. Extension models this correctly. |
| **Concatenation** | hooks, permissions (allow/ask/deny arrays) | All scopes' entries run/apply together. Extension wrongly shows "overridden." |
| **Array merge** | sandbox filesystem paths, sandbox network domains | Arrays from all scopes are concatenated and deduplicated. Extension wrongly shows "overridden." |

### Affected entities

1. **Hooks** — `resolveHookOverlap` uses `resolveOverlapGeneric`. A hook in User scope with the same event type + matcher pattern as one in Project scope is shown as overridden. It should show as "also runs in Project scope" (or similar co-existence indicator).

2. **Sandbox array properties** — `resolveSandboxOverlap` uses `resolveOverlapGeneric`. Properties like `network.allowedDomains`, `filesystem.allowWrite`, `filesystem.denyWrite`, `filesystem.allowRead`, `filesystem.denyRead` are arrays that Claude Code concatenates across scopes. The extension shows them as overridden.

3. **Sandbox boolean properties** — `sandbox.enabled` and similar booleans DO follow per-key override. These are correct today.

4. **Permissions** — Already has specialized logic in `resolvePermissionOverlap` with cross-category conflict detection. The overlap detection is correct (deny overrides allow). However, same-category same-rule duplicates across scopes are shown as "duplicated" when they're actually concatenated — but since the effect is identical for exact duplicates, this is cosmetically wrong but functionally harmless.

### What's NOT broken

- Plugin toggle, move, copy across scopes — all correct.
- Env var merge across scopes — correct.
- Scalar setting override across scopes — correct.
- MCP server config override across scopes — correct.
- Permission cross-category conflict detection — correct.

## User Stories

### Story 1: Hook co-existence visibility

**As** a user with a `PreToolUse` hook in User scope (global logging) and another `PreToolUse` hook in Project scope (project-specific guard)
**I want** the extension to show both hooks as active, not one as overridden
**So that** I know both hooks will execute and don't waste time debugging why my global hook "stopped working."

**Acceptance**: Two hooks with the same event type in different scopes both show without red/override indicators. A co-existence indicator (e.g., blue info icon or tooltip) shows which other scopes also have hooks for this event.

### Story 2: Sandbox domain merge visibility

**As** a user with `network.allowedDomains: ["api.internal.com"]` in User scope and `network.allowedDomains: ["cdn.example.com"]` in Project scope
**I want** the extension to show that both domain lists are active (merged)
**So that** I know `api.internal.com` is still allowed and don't redundantly add it to the Project scope.

**Acceptance**: Both scope entries for `allowedDomains` show without red/override indicators. A tooltip or decoration indicates the merged result.

### Story 3: Sandbox boolean still shows override correctly

**As** a user with `sandbox.enabled: true` in User scope and `sandbox.enabled: false` in Project scope
**I want** the User-scope entry to show as overridden (red) since booleans DO follow precedence
**So that** I know Project scope's `false` wins.

**Acceptance**: Boolean sandbox properties retain current override/duplicate indicators. No regression.

## Functional Requirements

### FR1: Classify entity types by merge strategy

Introduce a concept of merge strategy per entity type:

- `override` — higher-precedence scope wins per key (plugins, env vars, scalars, MCP configs, sandbox booleans).
- `concatenate` — all scopes' entries coexist and run together (hooks).
- `arrayMerge` — arrays from all scopes are concatenated and deduplicated (sandbox array properties like `allowedDomains`, `allowWrite`, etc.).

### FR2: New overlap resolver for concatenated entities (hooks)

For hooks, replace the "overridden by" / "duplicated by" model with a co-existence model:

- When the same event type + matcher pattern exists in multiple scopes, show a **"co-exists with"** indicator instead of "overridden by."
- When the exact same hook command exists in multiple scopes (identical event + matcher + command), show a **"duplicated in"** indicator — both run, but one is redundant.
- No red/override coloring. Use a neutral color (blue or default) for co-existence, and yellow for exact duplicates.

### FR3: New overlap resolver for array-merge entities (sandbox arrays)

For sandbox properties that are arrays (`allowedDomains`, `deniedDomains`, `allowWrite`, `denyWrite`, `allowRead`, `denyRead`):

- Show a **"merged with"** indicator when the same array key exists in multiple scopes.
- Optionally: tooltip shows the effective merged array (all scopes combined, deduplicated).
- No red/override coloring.

### FR4: Distinguish sandbox booleans from sandbox arrays

`resolveSandboxOverlap` must check the property type:
- If the value is a boolean or string: use `override` strategy (current behavior, unchanged).
- If the value is an array: use `arrayMerge` strategy (new behavior per FR3).
- If the value is an object (like `network`): recurse — check each child property's type.

### FR5: Update tooltip and description builders

The builder in `viewmodel/builder.ts` that formats overlap info into tooltips and descriptions must handle the new indicator types (`coexistsWith`, `mergedWith`) alongside the existing ones (`isOverriddenBy`, `isDuplicatedBy`, `overrides`, `duplicates`).

### FR6: Verify permission overlap specificity model

The existing `resolvePermissionOverlap` and `computePermissionOverlapMap` logic handles cross-category conflict detection. **However**, verified docs reveal that permission rule matching is **by specificity, not array order** — the most specific matching pattern wins within the unified pool. Verify that `rulesOverlap()` in `utils/permissions.ts` correctly models specificity ranking, not just glob intersection. If it doesn't, the overlap indicators may show wrong conflict winners.

Additionally, add `permissions.additionalDirectories` to the model — this field is an array that merges across scopes (same as `allow`/`deny`/`ask`) and grants Claude read access to directories beyond the project root. Currently missing from `PermissionRules` interface.

### FR6a: Hook edit notification — session restart required

Claude Code snapshots hook configuration at session start. Edits mid-session don't take effect until restart (or `/hooks` panel review). When the extension writes a hook change via configWriter, show an information notification: "Hook configuration updated. A new Claude Code session is required for changes to take effect."

## Non-Functional Requirements

- **No new dependencies** — all changes are internal to the overlap resolver and builder.
- **Performance** — the new resolvers must be no slower than `resolveOverlapGeneric`. Hook overlap is O(scopes), sandbox overlap is O(scopes × properties). Both negligible.
- **Backward-compatible OverlapInfo type** — extend the `OverlapInfo` interface with optional `coexistsWith` and `mergedWith` fields. Existing fields remain. Callers that only check `isOverriddenBy` / `overrides` continue to work.

## Success Criteria

### Part 1 — Merge Semantics

1. Two hooks with the same `PreToolUse` event type in User and Project scopes show without red indicators. Co-existence is indicated.
2. Two `sandbox.network.allowedDomains` arrays in different scopes show without red indicators. Merge is indicated.
3. `sandbox.enabled` boolean in two scopes still shows override (red on losing scope, green on winning scope).
4. Plugin, env var, scalar setting, MCP server overlap indicators are unchanged (regression check).
5. Permission overlap indicators are unchanged (regression check).
6. All existing overlap resolver tests pass; new tests cover the concatenate and arrayMerge strategies.

### Part 2 — Entity Coverage

7. `smallFastModel` and `trustWorkspaceConfig` removed from schema and types (they don't exist in Claude Code).
8. Sandbox property names corrected (`allowedDomains`/`deniedDomains`, `filesystem.*` paths added).
9. `attribution` typed as object, not string.
10. All 29 hook event types present in schema and TypeScript enum.
11. All 5 hook handler types present in TypeScript (`command`, `http`, `mcp_tool`, `prompt`, `agent`).
12. Schema validation produces diagnostics for typos in newly-added keys (manual test with intentional typo).
13. `KNOWN_SETTING_KEYS`, `ClaudeCodeConfig`, and the schema all agree — no key exists in one layer without existing in the other two.
14. `disabledMcpjsonServers` used consistently (not the wrong `disabledMcpServers`).
15. `permissions.additionalDirectories` present in `PermissionRules` interface, handled as array-merge in overlap resolver.
16. Hook edits via configWriter trigger an info notification about session restart requirement.
17. MCP servers from `~/.claude.json` clearly labeled in the tree to distinguish from `~/.claude/settings.json` (different file, different purpose).

## Constraints & Assumptions

### Constraints

- Changes are scoped to `overlapResolver.ts`, `viewmodel/builder.ts` (tooltip/description formatting), and `types.ts` (OverlapInfo extension). No changes to configWriter, configLoader, or tree node constructors.
- The color palette for tree icons is limited to what VS Code ThemeColor provides. Co-existence may use `charts.blue` or no special color (default).

### Assumptions

1. Claude Code's merge semantics are stable and documented. If they change, the extension must update accordingly.
2. The list of sandbox array properties is finite and known: `allowedDomains`, `deniedDomains`, `allowWrite`, `denyWrite`, `allowRead`, `denyRead`. New array properties added by Claude Code in the future would need to be registered.
3. Hook concatenation applies regardless of matcher — two hooks with different matchers for the same event type in different scopes both run. **Identical** command hooks (same command string) are deduplicated by Claude Code and run only once. Different hooks for the same event all run in parallel.

---

## Part 2: Entity Coverage Alignment

### Problem Statement

The extension has three layers that describe Claude Code's config shape: the JSON schema (validation), the TypeScript interface (runtime), and the constants (UI). All three have drifted from Claude Code's actual config model (verified against code.claude.com/docs/en/settings, May 2026):

- **~55 setting keys** documented by Claude Code are missing from all three layers. The extension knows ~24; Claude Code has ~79.
- **24 of 29 hook event types** are missing from the schema. The TypeScript enum has 14; Claude Code has 29.
- **2 of 5 hook handler types** are missing from the TypeScript interface (`http`, `mcp_tool`).
- **2 schema properties don't exist** in Claude Code: `smallFastModel` (deprecated env var only) and `trustWorkspaceConfig` (interactive dialogs, no settings key). Must be removed.
- **`attribution`** is typed as `string` but is actually an **object** with subkeys `commit` and `pr`.
- **Sandbox property names are wrong** in the schema: uses `allowedHosts`/`blockedHosts` instead of actual `allowedDomains`/`deniedDomains`. Missing `filesystem.*` properties entirely.
- **`disabledMcpServers`** in constants doesn't match the actual key `disabledMcpjsonServers`.
- **`allowedMcpServers`/`deniedMcpServers`** are `object[]` (managed-only), not `string[]`.

### Gap Inventory (Priority Items)

Full verified inventory: `vault/projects/_references/cc_config_reference.md`.

#### Must remove from schema (don't exist in Claude Code)

| Key | Reason |
|-----|--------|
| `smallFastModel` | Env var `ANTHROPIC_SMALL_FAST_MODEL` is deprecated; no settings.json equivalent |
| `trustWorkspaceConfig` | Workspace trust uses interactive dialogs, not a config key |

#### Must fix in schema/types (wrong shape)

| Key | Current | Correct |
|-----|---------|---------|
| `attribution` | `string` | `object { commit?: string, pr?: string }` |
| `sandbox.network.allowedHosts` | `string[]` | Rename to `allowedDomains` |
| `sandbox.network.blockedHosts` | `string[]` | Rename to `deniedDomains` |
| `allowedMcpServers` | `string[]` in constants | `object[]`, managed-only |
| `deniedMcpServers` | `string[]` in constants | `object[]`, managed-only |
| `disabledMcpServers` | `string[]` in constants | Should be `disabledMcpjsonServers` |

#### Must add to types (missing from PermissionRules interface)

| Key | Type | Merge |
|-----|------|-------|
| `permissions.additionalDirectories` | `string[]` | Array merge across scopes |

#### Must add to schema (in types/constants, not in schema)

The 19 keys from the original audit remain valid (except `attribution` type correction above). All verified as real Claude Code settings.

#### Must add to TypeScript enum (hook event types missing from extension)

Extension has 14 of 29. The 15 missing: `Setup`, `InstructionsLoaded`, `ConfigChange`, `UserPromptExpansion`, `PermissionDenied`, `PostToolBatch`, `TaskCreated`, `StopFailure`, `CwdChanged`, `FileChanged`, `WorktreeCreate`, `WorktreeRemove`, `PostCompact`, `Elicitation`, `ElicitationResult`.

#### Must add to TypeScript types (hook handler types)

Extension has 3: `command`, `prompt`, `agent`. Missing: `http`, `mcp_tool`.

#### New settings not yet in any layer (~50 keys)

See `cc_config_reference.md` for full list. Priority additions for Phase 1: settings that users actually configure (not managed-only flags). Managed-only flags can follow in a later pass.

### User Stories

#### Story 4: Validation catches typos in new settings

**As** a user who sets `teamateMode: "full"` (typo) in my config
**I want** the extension to flag the unknown key with a diagnostic warning
**So that** I catch the mistake before wondering why teammate mode isn't working.

**Acceptance**: All 19 missing setting keys are in the schema. A typo in any of them produces a VS Code diagnostic.

#### Story 5: All hook event types validate

**As** a user who adds a `SessionStart` hook to my config
**I want** the extension to validate the hook entry structure (command, matcher, etc.)
**So that** I get feedback if my hook config is malformed.

**Acceptance**: All 29 hook event types are recognized in the schema's `hooks` property. Invalid entries under any event type produce diagnostics.

#### Story 6: TypeScript types match the full config shape

**As** a contributor to this extension
**I want** the `ClaudeCodeConfig` interface to cover every known setting
**So that** I get compile-time errors if I mistype a property name when accessing config values.

**Acceptance**: `ClaudeCodeConfig` includes `apiKeyHelper`, `allowedMcpServers` (object[]), `deniedMcpServers` (object[]), `attribution` (object). `smallFastModel` and `trustWorkspaceConfig` are removed. No `any` casts needed.

### Functional Requirements

#### FR7: Fix incorrect schema entries

- **Remove** `smallFastModel` and `trustWorkspaceConfig` from the schema (they don't exist in Claude Code).
- **Fix** `attribution` type from `string` to `object { commit?: string, pr?: string }`.
- **Rename** sandbox `allowedHosts` → `allowedDomains`, `blockedHosts` → `deniedDomains`.
- **Add** missing sandbox `filesystem.*` properties (`allowWrite`, `denyWrite`, `allowRead`, `denyRead`).

#### FR8: Add missing setting keys to schema

Add the 19 keys from the original audit (all verified as real) plus priority user-facing keys from the full ~79 list. Use correct types and enum constraints (e.g., `teammateMode: "auto" | "in-process" | "tmux"`, `forceLoginMethod: "claudeai" | "console"`).

#### FR9: Add all 29 hook event types to schema and TypeScript enum

The extension's `HookEventType` enum has 14 entries; Claude Code supports 29. Add the 15 missing types. Update the schema's `hooks` property to accept all 29 event types.

#### FR10: Add missing hook handler types

The extension's `HookCommand.type` is `'command' | 'prompt' | 'agent'`. Add `'http'` and `'mcp_tool'` with their respective fields (`url`, `headers`, `allowedEnvVars` for http; `server`, `tool`, `input` for mcp_tool).

#### FR11: Fix TypeScript types

- **Remove** `smallFastModel` and `trustWorkspaceConfig` from `ClaudeCodeConfig` (if added from schema).
- **Add** `apiKeyHelper?: string`.
- **Fix** `attribution` type to `{ commit?: string; pr?: string }`.
- **Fix** `allowedMcpServers` and `deniedMcpServers` to `object[]` (managed-only, not `string[]`).
- **Rename** `disabledMcpServers` to `disabledMcpjsonServers` in constants (or add both if backward compat needed).

#### FR12: Verify constants ↔ types ↔ schema consistency

After FR7–FR11, all three layers must agree. Add a compile-time or test-time check that `KNOWN_SETTING_KEYS` entries are a subset of `keyof ClaudeCodeConfig` (excluding structural keys like `permissions`, `hooks`, `sandbox`, `env`, `enabledPlugins`).

### Dependencies (Part 2)

#### Internal

- `schemas/claude-code-settings.schema.json` — main change site for FR7, FR8.
- `src/types.ts` — add missing properties (FR9).
- `src/constants.ts` — verify `KNOWN_SETTING_KEYS` and `SETTING_TYPE_MAP` are complete after changes.
- `src/validation/schemaValidator.ts` — no code changes expected, but verify diagnostics fire for the newly-added keys.
- Tests — add schema validation tests for representative new keys and hook events.

#### External

- `vault/projects/_references/cc_config_reference.md` — verified reference with full entity list, merge models, and edge cases.
- Official docs: code.claude.com/docs/en/settings, /hooks, /permissions, /sandboxing, /mcp, /memory.

---

## Out of Scope

- Showing the effective merged result for permissions (concatenated allow/deny/ask lists across all scopes). The existing cross-category conflict detection is sufficient.
- Adding a "merged view" or "effective config" panel. This PRD fixes indicators within the existing per-scope tree view.
- Changing how hooks, sandbox, or permissions are written (configWriter). Write paths are entity-per-scope and remain correct.
- Changing move/copy behavior for hooks or sandbox. Move/copy operations are out of scope for this PRD (hooks don't even support move/copy yet — that's a separate gap).

## Dependencies

### Internal

- `src/config/overlapResolver.ts` — main change site. New resolver functions or strategy parameter for existing ones.
- `src/types.ts` — extend `OverlapInfo` with new optional fields.
- `src/viewmodel/builder.ts` — update tooltip and description formatters to handle new overlap types.
- `src/constants.ts` — if new icon/color constants are needed for co-existence indicators.
- Tests for overlap resolver — add concatenate and arrayMerge test cases.

### External

- Claude Code documentation on settings scope merge behavior (verified 2026-05-01).

### Documentation

- `CHANGELOG.md` entry: hooks and sandbox array indicators now correctly reflect Claude Code's merge semantics.
- `CHANGELOG.md` entry: JSON schema updated with all current Claude Code setting keys and hook event types; TypeScript types synced.
