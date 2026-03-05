# Project Research Summary

**Project:** Claude Code Config Manager v0.6.0 -- Visual Fidelity
**Domain:** VS Code TreeView extension -- visual refinements and bug fixes
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

v0.6.0 is a pure refinement milestone for an existing, fully functional VS Code extension (5,241 LOC). It addresses two bugs and one new feature, all operating within the existing architecture. The two bugs -- plugin checkbox toggling despite a locked scope, and hook leaf nodes navigating the editor to wrong JSON lines -- are root-caused to specific lines of code with verified one-to-two-line fixes. The new feature -- visual overlap indicators showing when config entities exist across multiple scopes -- extends the existing override resolution system with a bidirectional counterpart. No new dependencies, no new VS Code APIs, and no architectural changes are required.

The recommended approach is to ship the two bug fixes first (both are small, high-confidence, and independently verifiable), then implement the overlap indicators starting with the simplest visual treatment (description text suffix) before considering richer decorations like FileDecoration badges. All three features are independent with zero cross-dependencies, so they can be built in any order -- but fixing bugs before adding features reduces the active defect count and builds confidence in the codebase before touching more files.

The primary risk is the hook keyPath fix causing regressions in bidirectional editor-tree sync. This risk is mitigated by the fact that the fix actually *aligns* tree keyPaths with what `findKeyPathAtLine` already produces, so both directions will agree after the fix. The overlap feature carries moderate risk of conflating overlap with override detection or of description text overwrites -- both are avoidable with the patterns documented in the architecture research.

## Key Findings

### Recommended Stack

No changes to the existing stack. All three features use VS Code APIs already imported and exercised by the extension. See [STACK.md](STACK.md) for full details.

**Core technologies (unchanged):**
- **TypeScript ^5.3.3** -- language, strict mode
- **VS Code Extension API ^1.90.0** -- TreeView, FileDecorationProvider, MarkdownString tooltips
- **esbuild ^0.25.0** -- bundler, zero runtime dependencies

**Relevant existing APIs for v0.6.0:**
- `TreeItem.description` -- extend with overlap scope names
- `FileDecoration.badge` -- optional scope count badge (max 2 chars, available since VS Code 1.73)
- `onDidChangeCheckboxState` -- post-change event, no cancellation support
- `treeProvider.refresh()` -- full tree rebuild from disk state

### Expected Features

See [FEATURES.md](FEATURES.md) for full analysis including anti-features.

**Must have (P0 -- broken behavior):**
- **Plugin checkbox lock enforcement** -- call `treeProvider.refresh()` after blocked toggle to revert visual state. One-line fix.
- **Hook leaf navigation fix** -- insert `'hooks'` intermediate key in `HookEntryNode` and `HookKeyValueNode` keyPaths. Fixes the only broken leaf-click case and simultaneously fixes broken editor-to-tree sync for hooks.

**Should have (P1 -- new capability):**
- **Overlap "also in" annotation** -- description suffix showing `(also in User, Project Local)` on entities that exist in multiple scopes. Extends the existing override pattern bidirectionally.

**Defer (v0.6.x or later):**
- FileDecoration badge showing scope count
- Enhanced MarkdownString tooltip with cross-scope value comparison
- Color tinting of overlapping items via FileDecorationProvider
- "Resolved View" mode (anti-feature -- rejected)
- Interactive conflict resolution commands

### Architecture Approach

The existing data flow (configDiscovery -> configLoader -> ConfigStore -> overrideResolver -> ConfigTreeProvider -> TreeView) is unchanged. Overlap detection is added as a mirror of override detection in `overrideResolver.ts`, with results flowing through `NodeContext` into `baseNode.finalize()`. See [ARCHITECTURE.md](ARCHITECTURE.md) for component boundaries and data flow diagrams.

**Modified components:**
1. **`overrideResolver.ts`** -- add `resolve*Overlap()` functions that check lower-precedence scopes (inverse of existing `resolve*Override()` functions)
2. **`types.ts` (NodeContext)** -- add `hasOverlap: boolean` and `overlappedScopes?: ConfigScope[]` fields
3. **`baseNode.ts`** -- add `applyOverlapStyle()` method called from `finalize()` after `applyOverrideStyle()`; combine description text rather than overwriting
4. **`hookEntryNode.ts` + `hookKeyValueNode.ts`** -- fix keyPaths to include intermediate `hooks` key
5. **`extension.ts`** -- add `treeProvider.refresh()` call in the `isReadOnly` early-return path of checkbox handler

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for all 10 pitfalls with detection and prevention strategies.

1. **Hook keyPath skips intermediate `hooks` key (P1)** -- the tree keyPath `['hooks', eventType, matcherIdx, hookIdx, prop]` has 5 segments but the JSON structure has 6 nesting levels. Fix by inserting the inner `'hooks'` segment. Do NOT add domain-specific logic to `findKeyLine`.
2. **Checkbox fires post-change, no cancellation (P2)** -- VS Code toggles the checkbox before the handler fires. The only revert mechanism is `treeProvider.refresh()`. Must be called in the `isReadOnly` early-return path.
3. **Overlap is NOT override (P3)** -- overlap is bidirectional ("does this entity exist elsewhere?") while override is unidirectional ("is this value being suppressed?"). Must be separate fields in `NodeContext`, not reusing `isOverridden`.
4. **Permission overlap needs fuzzy matching (P4)** -- `Bash(npm *)` and `Bash(npm install)` overlap but are not string-equal. Reuse existing `rulesOverlap()` utility from `utils/permissions.ts`.
5. **Description text overwrites (P8)** -- both override and overlap styling modify `this.description`. Must compose into a single string, not assign separately.

## Implications for Roadmap

Based on research, three phases ordered by risk profile and independence. All are independent (no cross-dependencies), so the ordering is a recommendation based on size and regression risk.

### Phase 1: Plugin Checkbox Lock Enforcement

**Rationale:** Smallest change (1 file, 2 lines). Fixes user-visible state corruption. Builds confidence before touching more files.
**Delivers:** Locked-scope plugin checkboxes immediately revert when toggled, with an informational message.
**Addresses:** P0 bug fix (FEATURES.md table stakes), Pitfall P2 and P9 (PITFALLS.md).
**Avoids:** Pitfall P9 (scroll position reset) -- try targeted refresh `_onDidChangeTreeData.fire(node)` first; fall back to full refresh if needed.
**Files touched:** `src/extension.ts` only.

### Phase 2: Hook Leaf Navigation Fix

**Rationale:** Small change (2 files, 1 line each) but needs verification of bidirectional sync. Fixes broken functionality that affects user trust in click-to-reveal.
**Delivers:** All hook leaf node clicks (type, command, timeout, prompt, async, matcher) navigate the editor to the correct JSON line. Editor-to-tree sync also fixed as a side effect.
**Addresses:** P0 bug fix (FEATURES.md table stakes), Pitfalls P1, P7, P10 (PITFALLS.md).
**Avoids:** Pitfall P1 (keyPath-JSON mismatch) by aligning keyPaths with actual JSON structure. Pitfall P10 (reverse mapping) by verifying `findKeyPathAtLine` output matches new keyPaths.
**Files touched:** `src/tree/nodes/hookEntryNode.ts`, `src/tree/nodes/hookKeyValueNode.ts`.
**Verification:** Must test with multiple matchers, multiple hooks per matcher, and every hook property type. Must verify `findKeyPathAtLine` reverse mapping and `configWriter` delete operations still work.

### Phase 3: Visual Overlap Indicators

**Rationale:** Largest change (touches 10+ files). New capability rather than bug fix. Benefits from stable codebase after Phases 1-2. Can be implemented incrementally -- start with one entity type (env vars), verify, then extend.
**Delivers:** Description text annotation `(also in User, Project Local)` on entities that exist across multiple scopes. Both the winning and losing sides show overlap information.
**Addresses:** P1 differentiator (FEATURES.md), Pitfalls P3, P4, P5, P6, P8 (PITFALLS.md).
**Avoids:** Pitfall P3 (conflating overlap with override) by creating separate resolver functions and separate `NodeContext` fields. Pitfall P5 (ID collisions) by using in-place visual treatments, not cross-scope reference nodes. Pitfall P8 (description overwrite) by composing override and overlap text into a single string.
**Files touched:** `src/types.ts`, `src/config/overrideResolver.ts`, `src/tree/nodes/baseNode.ts`, plus 7 leaf node files (`settingNode.ts`, `envVarNode.ts`, `pluginNode.ts`, `sandboxPropertyNode.ts`, `permissionRuleNode.ts`, `hookEventNode.ts`, `mcpServerNode.ts`).
**Incremental approach:** Implement for env vars first (simplest entity type, string equality matching), verify styling composition works, then extend to plugins, settings, sandbox, permissions (fuzzy matching), hooks, and MCP servers.

### Phase Ordering Rationale

- **Bug fixes before features** -- Phases 1 and 2 fix broken behavior. Shipping them first reduces the defect count and ensures the codebase is stable before the larger Phase 3 change.
- **Smallest first** -- Phase 1 is 2 lines in 1 file, Phase 2 is 2 lines in 2 files, Phase 3 is a multi-file change. This ordering catches any unexpected issues early when changes are easiest to revert.
- **Phase 3 last because it is incremental** -- overlap indicators can be added one entity type at a time. If the milestone deadline approaches, partial overlap support (e.g., env vars + settings only) is still shippable.

### Research Flags

Phases with standard patterns (skip `/gsd:research-phase`):
- **Phase 1 (Plugin lock fix):** Root cause verified, fix is a single `refresh()` call following an existing pattern. No research needed.
- **Phase 2 (Hook navigation fix):** Root cause verified, fix is a keyPath string correction. No research needed.

Phases that may benefit from targeted research during planning:
- **Phase 3 (Overlap indicators):** The overlap resolver functions mirror existing override resolvers, but the permission rule fuzzy matching (Pitfall P4) and the description text composition (Pitfall P8) may need a brief spike to validate the approach. Consider a 30-minute spike implementing overlap for `EnvVarNode` only before committing to the full design.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies. All APIs verified against `@types/vscode@1.90.0` type definitions. |
| Features | HIGH | All three features root-caused via codebase inspection. Bug fixes verified to specific lines. |
| Architecture | HIGH | Changes extend existing patterns (override resolver, NodeContext, baseNode styling). No new subsystems. |
| Pitfalls | HIGH | All pitfalls verified against source code. Recovery strategies are low-cost for all critical pitfalls. |

**Overall confidence:** HIGH

### Gaps to Address

- **Targeted vs full tree refresh (Pitfall P9):** It is unclear whether `_onDidChangeTreeData.fire(node)` will correctly revert a checkbox state change, or whether a full `_onDidChangeTreeData.fire(undefined)` is required. Test during Phase 1 implementation.
- **Permission overlap sensitivity:** The `rulesOverlap()` function may produce many matches for broad glob rules like `*`. Consider whether showing overlap for very broad rules is helpful or noisy. Validate during Phase 3 implementation.
- **MCP server overlap semantics:** MCP servers have a separate config file and different merge behavior. The overlap indicator may not be straightforward for this entity type. Defer to Phase 3 incremental rollout -- implement for simpler entity types first.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `extension.ts`, `hookEntryNode.ts`, `hookKeyValueNode.ts`, `jsonLocation.ts`, `overrideResolver.ts`, `baseNode.ts`, `configTreeProvider.ts`, `permissions.ts`
- Local `@types/vscode@1.90.0` type definitions: `FileDecoration.badge`, `TreeItemCheckboxState`, `onDidChangeCheckboxState`, `MarkdownString`

### Secondary (MEDIUM confidence)
- VS Code Tree View API guide: https://code.visualstudio.com/api/extension-guides/tree-view
- VS Code FileDecorationProvider API: https://vscode-api.js.org/interfaces/vscode.FileDecorationProvider.html
- VS Code checkbox API -- GitHub issue #116141
- VS Code checkbox state management -- GitHub issue #183339
- VS Code FileDecoration badge limitations -- GitHub issue #182098

### Tertiary (LOW confidence)
- VS Code FileDecoration in tree views -- GitHub issue #166614 (confirmed `resourceUri` requirement but limited discussion of tree-specific edge cases)

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
