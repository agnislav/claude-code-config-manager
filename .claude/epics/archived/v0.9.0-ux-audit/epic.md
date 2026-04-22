---
name: v0.9.0-ux-audit
status: completed
created: 2026-03-12T00:00:00Z
updated: 2026-03-14T00:00:00Z
progress: 100%
prd:
github:
---

# UX Audit (v0.9.0)

## Summary

Systematically audited every entity type's tree structure, node behavior, and inline buttons — built a complete gap inventory first, then fixed everything in sequence. The audit catalog covered all 12 `NodeKind` types across 5 audit vectors (tooltip, inline buttons, context menu, click behavior, overlap) and produced 48 OK / 1 Intentional / 11 Gap findings, each mapped to a target phase. Subsequent phases closed those gaps: trivial display fixes, uniform inline button slot ordering, hook overlap completing coverage for all 7 entity types, action parity (EnvVar copy, MCP multi-scope, SettingKeyValue edit/delete), and a batch-indexed permission overlap algorithm replacing an O(R²) per-rule scan.

The milestone shipped 2026-03-14 with 16/16 requirements satisfied, 132 tests passing (+76 vs. v0.8.0), 58 commits across 5 phases, and all identified tech debt resolved through a re-audit pass.

## Requirements delivered

### Audit (Phase 25)
- **AUDIT-01**: Complete audit matrix documenting all 12 NodeKind types across 5 audit vectors.
- **AUDIT-02**: Each finding classified as OK / Intentional (with rationale) / Gap (with target phase).

### Trivial Fixes (Phase 25)
- **TRIV-01**: Sandbox section header shows flattened property count (e.g. "3 properties") via `getSectionItemCount` mirroring `buildSandboxProperties`.
- **TRIV-02**: HookEntry description prefixed with hook type ("command: echo test", "prompt: Review output", etc.).
- **TRIV-03**: EnvVar nodes carry a base MarkdownString tooltip with key=value, scope label, file path, and 80-char truncation.

### Inline Buttons (Phase 26)
- **INLN-03**: Dead `editValue && false` guard removed from `package.json`; plugin `&& false` guards for move/copy/delete documented as intentional in the audit matrix (tied to DEFR-01 and the plugin checkbox UX model).
- **INLN-04**: Uniform inline button slot ordering `edit@0, move@1, copy@2, delete@3` applied across all entity types (EnvVar and Setting moveToScope repositioned from @0 to @1, Setting copy from @1 to @2).

### Overlap (Phase 27)
- **OVLP-01**: Hook entries participate in the overlap detection system with positional identity `(eventType, matcherPattern, hookIndex)`.
- **OVLP-02**: Hook overlap uses the same color-coded FileDecoration + MarkdownString tooltip conventions as other entity types — completing coverage for all 7 entity types.

### Action Parity (Phase 28)
- **ACTN-01**: EnvVar nodes expose `copyEnvVarToScope` inline and via context menu.
- **ACTN-02**: MCP Server tooltip enriched with "Defined in: {ScopeLabel} ({shortPath})" scope info line.
- **ACTN-03**: MCP Server discovery extended to `~/.claude.json` (top-level `mcpServers` for User, `projects[path].mcpServers` for ProjectLocal) with scope-aware writers and move/copy inline buttons.
- **ACTN-04**: SettingKeyValue children support edit via new `setSettingKeyValue` writer.
- **ACTN-05**: SettingKeyValue children support delete via new `removeSettingKeyValue` writer (leaves parent as `{}` when last child removed, per existing UX rule).

### Performance (Phase 29)
- **PERF-01**: Pre-indexed batch `computePermissionOverlapMap(allScopes)` computes all `(scope, category, rule)` overlaps in a single pass, called once per `buildPermissionRules`.
- **PERF-02**: Module-level `_regexpCache` in `wildcardMatch` and `_parseCache` with `getCachedParse(rule)` eliminate redundant RegExp compilations and rule re-parses. Tool-name bucket isolation structurally prevents cross-tool comparisons. Expand All on 140+ rules per scope renders without perceptible hang.

## Implementation history

- **Phase 25 Plan 01 — Audit Matrix** (2 min, 2026-03-12): Generated `25-AUDIT-MATRIX.md` covering 12 NodeKind types × 5 vectors; gap tracking table mapped 11 gaps to target phases 25–28. Commit: `fdc1723` (docs).
- **Phase 25 Plan 02 — Trivial Display Fixes** (5 min, 2026-03-12): TDD red/green on 10 tests covering sandbox count, HookEntry type prefix, and EnvVar base tooltip; implementation in `builder.ts`. Commits: `74f1222` (test, RED), `3d03c3f` (feat, GREEN).
- **Phase 26 — Inline Button Cleanup** (2 min, 2026-03-12): Removed dead `editValue && false` guard, repositioned envVar/setting move/copy slots, documented plugin guards in the audit matrix as intentional. Commits: `264d0a6` (fix), `2856bbe` (docs).
- **Phase 27 — Hook Overlap Detection** (~30 min, 2026-03-12): Added `resolveHookOverlap` reusing `resolveOverlapGeneric`; identity changed from content-based to positional after a RED/GREEN iteration exposed the override-detection failure. Wired 6 overlap points into `buildHookEntryVM` (nodeContext, contextValue, icon color, resourceUri, tooltip, description). Commits: `6b60429` (feat + test), `cccb98f` (feat + test).
- **Phase 28 Plan 01 — SettingKeyValue + EnvVar Copy** (4 min, 2026-03-13): `setSettingKeyValue` / `removeSettingKeyValue` added to `configWriter` under full TDD (11 tests); extended `editValue` and `deleteItem` with `DEDICATED_SECTION_KEYS` guard branch; added `copyEnvVarToScope`. Commits: `e4dd260` (test, RED), `22819ba` (feat, GREEN), `9af4f2c` (feat).
- **Phase 28 Plan 02 — MCP Multi-Scope Discovery** (9 min, 2026-03-13): `getUserClaudeJsonPath` + whitelist update; `DiscoveredPaths` extended with `claudeJsonPath`/`userMcpConfig`/`localMcpConfig`; four new writers (`setUserMcpServer`/`removeUserMcpServer`/`setLocalMcpServer`/`removeLocalMcpServer`) using `Record<string,unknown>` to preserve non-MCP data; `dispatchMcpWrite`/`dispatchMcpRemove` helpers; tooltip scope info line; `fileWatcher` now watches `~/.claude.json`. Commits: `091e133` (test), `1e25ad8` (feat), `bd3bacc` (test), `050cedb` (feat).
- **Phase 29 — Permission Overlap Performance** (~5 min, 2026-03-13): Added `_regexpCache` and `_parseCache` with `getCachedParse` in `permissions.ts`; added `computePermissionOverlapMap` with tool-name bucket indexing in `overlapResolver.ts`; rewired `buildPermissionRules` to call the batch function once and look up by `${scope}/${category}/${rule}` key. 17 new tests (13 in `permissions.test.ts`, 4 batch parity/scale tests). Commits: `7bcd4cf` (feat), `c0ecaec` (feat), `24821ee` (test).

## Key decisions

- **Audit-first workflow**: Build a comprehensive audit matrix before planning fix phases — the gap inventory directly drives precise phase scope and prevents missed requirements.
- **Hook overlap identity is positional**: `(eventType, matcherPattern, hookIndex)` — content-based `deepEqual` fails for the override case because a differing value makes the hook appear absent in the other scope.
- **`resolveOverlapGeneric` pattern extended to hooks**: Nearest-higher precedence scan in reverse over the sorted scope array; the same algorithm now powers all 7 entity types.
- **Inline button slot convention is global**: `edit@0, move@1, copy@2, delete@3` applied uniformly. `&& false` guards serve dual purpose: suppression + design documentation (plugin guards are intentional per DEFR-01).
- **MCP multi-scope uses `Record<string,unknown>` for `~/.claude.json` reads**: Preserves unrelated top-level fields on write — safe partial file editing for a shared config file.
- **`dispatchMcpWrite` / `dispatchMcpRemove` helpers**: Single dispatch point for scope-based MCP writer selection (User → setUserMcpServer, ProjectLocal → setLocalMcpServer, ProjectShared → setMcpServer).
- **Permission overlap batching**: `computePermissionOverlapMap(allScopes)` called once per `buildPermissionRules`, not per rule. Tool-name buckets make cross-tool comparisons structurally impossible.
- **`removeSettingKeyValue` leaves parent as `{}`**: Consistent with the existing user-locked decision to not auto-clean empty parents.
- **`setSettingKeyValue` replaces non-object parent with `{}`**: Defensive guard against stale scalar data before setting a child key.
- **Test path whitelisting via monkey-patching**: Unit tests patch `getAllowedWritePaths` before requiring `configWriter` so temp paths pass validation without needing a real workspace.

## Functionality delivered

- **Code added/modified**:
  - `src/viewmodel/builder.ts` — sandbox count flattening, hook type description, envvar base tooltip, hook overlap wiring, MCP tooltip scope line, batch permission overlap lookup.
  - `src/config/overlapResolver.ts` — `resolveHookOverlap`, `computePermissionOverlapMap`, `buildToolIndex` (private).
  - `src/utils/permissions.ts` — `_regexpCache`, `_parseCache`, exported `getCachedParse`.
  - `src/config/configWriter.ts` — `setSettingKeyValue`, `removeSettingKeyValue`, `setUserMcpServer`, `removeUserMcpServer`, `setLocalMcpServer`, `removeLocalMcpServer`.
  - `src/config/configDiscovery.ts`, `src/config/configModel.ts` — `claudeJsonPath`, `userMcpConfig`, `localMcpConfig` wired through.
  - `src/commands/editCommands.ts`, `src/commands/deleteCommands.ts` — settingKeyValue branches with `DEDICATED_SECTION_KEYS` guard.
  - `src/commands/moveCommands.ts` — `copyEnvVarToScope`, `copyMcpServerToScope`, `moveToScope` extended with `mcpServers` branch, `dispatchMcpWrite` / `dispatchMcpRemove` helpers.
  - `src/utils/platform.ts` — `getUserClaudeJsonPath`.
  - `src/constants.ts` — `getAllowedWritePaths` includes `~/.claude.json`; new `MESSAGES.copiedEnvVar`, `copiedMcpServer`, `movedMcpServer`.
  - `src/watchers/fileWatcher.ts` — watches `~/.claude.json`.
  - `package.json` — dead guard removed, slot repositioning, new command declarations, inline buttons and context menu entries for settingKeyValue edit/delete, envVar copy, MCP move/copy.
  - New test files: `test/suite/config/configWriter.settingKeyValue.test.ts`, `test/suite/config/mcpDiscovery.test.ts`, `test/suite/viewmodel/mcpTooltip.test.ts`, `test/suite/utils/permissions.test.ts`.
- **User-facing behavior**:
  - Every entity type has a consistent inline button layout and full action parity (edit/move/copy/delete where structurally valid).
  - Hook entries show overlap coloring and tooltips across scopes — on par with permissions, settings, env vars, plugins, MCP, and sandbox.
  - MCP servers from `~/.claude.json` appear in the User and ProjectLocal scopes with enriched tooltips, and can be moved/copied between scopes.
  - Settings children can be edited and deleted inline.
  - Expand All on a heavy permission set renders without perceptible hang.
- **Tests**: 56 → 132 tests (+76).

## Audit outcome

Milestone audit (2026-03-14) passed after a re-audit pass cleared all 5 prior-audit items. Scores: requirements 16/16, phases 8/8, integration 32/32, E2E flows 9/9. Tech debt at ship: **none** (sandbox count bug fixed, stale audit prose updated, plugin checkbox test failures aligned with intended behavior, PERF-01/02 added to REQUIREMENTS.md traceability, a stale `PERMISSION_CATEGORY_LABELS` import removed during re-audit). Test suite: 132 passing, 0 failures. Nyquist compliance: 3/8 phases fully compliant; phases 25–29 shipped with `VALIDATION.md` files in draft status (`nyquist_compliant: false`) but that did not block the audit.

## Lessons learned

- Systematic audit before UX work is highly effective — a gap inventory drives precise phase scope and prevents missed requirements.
- Batch algorithms with pre-indexing solve performance problems more cleanly than incremental optimization — the O(R×G) indexed pass with tool-name buckets was simpler than trying to shrink the per-rule scan.
- Post-merge visual testing is essential — Phase 29's batch algorithm introduced a UI hang only visible with real data, requiring a hotfix (debounce, overlap map hoisting, sandbox rendering fix — commit `8c291f8`).
- `Record<string,unknown>` for partial file reads (e.g. `~/.claude.json`) prevents data loss when writing back a shared config file.
- `&& false` guards in `package.json` are ambiguous by themselves — distinguish dead artifacts (remove) from intentional feature suppression (document in audit matrix).
- TDD pattern matured — 9 feat commits each had a preceding test commit; zero behavioral regressions across the milestone.
- Re-audit is a cheap safety net — the first audit found 4 real items, fixes applied, re-audit confirmed clean. Two-pass verification catches issues the first pass misses.
