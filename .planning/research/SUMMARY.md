# Project Research Summary

**Project:** Claude Code Config Manager v0.7.0 -- Visual Fidelity
**Domain:** VS Code TreeView extension -- visual polish for cross-scope config display
**Researched:** 2026-03-08
**Confidence:** HIGH

## Executive Summary

v0.7.0 "Visual Fidelity" addresses three targeted gaps in the existing config viewer: users cannot see when entities exist across multiple scopes (overlap), locked-scope plugin checkboxes flicker when clicked, and hook leaf nodes navigate to wrong editor lines. All three features are implementable with zero new dependencies and zero new VS Code API surfaces. The v0.6.0 ViewModel layer (TreeViewModelBuilder) absorbs all changes cleanly -- the builder is the single computation point, tree nodes remain pure consumers, and the override resolver extends naturally to overlap detection.

The recommended approach is to fix the two small bugs first (hook navigation, checkbox lock) then build the overlap indicator system. This ordering puts quick wins first, builds confidence in the architecture, and saves the largest feature for when the smaller changes have validated the ViewModel layer's extensibility. The total estimated change is ~85-130 lines added across two files (`builder.ts` and `overrideResolver.ts`), with ~80 lines of dead code removed.

The primary risk is conflating "overlap" (entity exists in multiple scopes) with "override" (higher-precedence scope shadows lower). These are distinct concepts that must stay separate in the data model, display logic, and visual treatment. A secondary risk is appending overlap text to `TreeItem.description`, which would corrupt edit command pre-fill values. The mitigation is clear: overlap details belong in tooltips, not descriptions.

## Key Findings

### Recommended Stack

No stack changes. All three features use VS Code APIs already imported and patterns already established. TypeScript 5.3+, VS Code Extension API 1.90.0+, esbuild bundler -- all unchanged. See [STACK.md](STACK.md) for full analysis.

**Core technologies (unchanged):**
- **TypeScript ^5.3.3**: Language -- strict mode, no runtime deps
- **VS Code Extension API ^1.90.0**: All needed APIs (`TreeItem.description`, `TreeItem.tooltip`, `TreeItem.checkboxState`, `MarkdownString`) available since well before 1.90.0
- **esbuild ^0.25.0**: Bundler -- no new packages to bundle

**What NOT to add:**
- No new FileDecorationProvider for overlap badges (description + tooltip is sufficient)
- No third-party JSON parser (violates no-runtime-deps constraint)
- No custom webview (TreeView API surfaces are sufficient)
- No new state management (ViewModel builder already has all needed data access)

### Expected Features

See [FEATURES.md](FEATURES.md) for full feature landscape and dependency graph.

**Must have (table stakes):**
- Visual overlap indicators showing when entities exist in multiple scopes -- description text like "also in User" on winning-scope items, plus rich MarkdownString tooltips listing all scopes and values
- Lock-aware plugin checkbox suppression -- remove checkbox entirely when scope is locked (`checkboxState: undefined`), eliminating the click-flicker-revert cycle
- Hook leaf editor navigation fix -- correct the keyPath from `['hooks', eventType, '0', '0']` to `['hooks', eventType, '0', 'hooks', '0']` to match actual JSON nesting

**Should have (differentiators):**
- Checkbox tooltip on locked plugins ("Scope is locked") using the object form of `checkboxState`
- Overlap tooltip with rich markdown listing all scopes and their values
- Dead code cleanup (~80 lines: HookKeyValueVM, HookKeyValueNode, buildHookKeyValueVM)

**Defer (v2+):**
- FileDecoration badge for overlap count (adds URI scheme complexity for minimal visual gain)
- Cross-scope entity merging / "entity-first" tree view (fundamentally different tree model)
- Overlap detection for MCP servers and hooks (semantically misleading -- same name may mean different configs)

### Architecture Approach

All changes flow through the existing pipeline: `ConfigStore -> overrideResolver -> TreeViewModelBuilder -> VM tree -> ConfigTreeProvider -> TreeView`. The builder is the single modification point for all three features. New `resolve*Overlap` functions are added to `overrideResolver.ts` alongside (not replacing) existing `resolve*Override` functions. No new files, no new node types, no new event channels. See [ARCHITECTURE.md](ARCHITECTURE.md) for full component boundaries and data flow diagrams.

**Modified components (2 files only):**
1. **overrideResolver.ts** -- Add 5-6 `resolve*Overlap` functions returning `OverlapInfo { otherScopes, isOverridden, overriddenByScope }`
2. **builder.ts** -- Call overlap resolvers in 7 entity builder methods, fix hook keyPath (1 line), conditional checkboxState for locked plugins (1 line)

**Unchanged components:** All tree nodes, ConfigTreeProvider, extension.ts, jsonLocation.ts, configWriter, fileWatcher, constants, types.

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for all 11 pitfalls with detection and recovery strategies.

1. **Override-overlap conflation** -- Never reuse `isOverridden` for overlap. These are distinct concepts. Override dims losing items; overlap annotates all items sharing a key. Add separate resolver functions and fields. Detection: verify winning-scope items are NOT dimmed when they have overlap.

2. **Description corruption for edit pre-fill** -- Appending overlap text to `TreeItem.description` would cause edit commands to pre-fill "value (also in User)" as the setting value. Keep overlap info in tooltips only, or use a strippable sentinel format. This was flagged in v0.6.0 as well.

3. **Hook keyPath contract change** -- Changing from 4-segment to 5-segment keyPath is cross-cutting. Must update builder, verify `findNodeByKeyPath` prefix matching works with new depth, and test `findKeyPathAtLine` reverse mapping produces matching paths. Test with multiple matchers and multiple hooks per matcher.

4. **Checkbox flicker on locked scope** -- VS Code fires `onDidChangeCheckboxState` AFTER visual toggle. The only clean fix is removing the checkbox entirely when locked (`checkboxState: undefined`). Keep the existing handler as a safety net for race conditions.

5. **Visual clutter with override + overlap** -- A node that is both overridden AND overlapping could show double decoration. Prioritize override indicator (more actionable); put overlap details in tooltip only.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Hook Leaf Navigation Fix + Dead Code Cleanup

**Rationale:** Smallest scope, zero dependencies on other features, highest user annoyance factor. Every hook entry click currently may land on the wrong line. Dead code cleanup pairs naturally since both touch hook-related code.
**Delivers:** Correct editor navigation for all hook entry leaf nodes; removal of ~80 lines of unused HookKeyValue code.
**Addresses:** Table stakes -- hook leaf click navigates to correct JSON line.
**Avoids:** Pitfall 9 (cleanup-before-fix ordering) by fixing navigation first, then cleaning up dead code in a separate commit.
**Estimated LOC:** ~5-10 lines changed (keyPath fix) + ~80 lines deleted (cleanup).

### Phase 2: Lock-Aware Plugin Checkbox

**Rationale:** Small scope, independent of other features, eliminates a visible UI bug (checkbox flicker). One conditional in builder.ts.
**Delivers:** Locked-scope plugins show no checkbox; no flicker; clear UX signal that the scope is not editable.
**Addresses:** Table stakes -- lock enforcement without visual confusion.
**Avoids:** Pitfall 3 (checkbox flicker) by removing checkbox entirely rather than blocking-and-reverting. Pitfall 7 (lock check inconsistency) by keeping the runtime guard in extension.ts as safety net.
**Estimated LOC:** ~10-20 lines changed.

### Phase 3: Visual Overlap Indicators

**Rationale:** Largest scope, most impactful for the "visual fidelity" milestone goal. Depends on no other feature but benefits from the confidence gained in Phases 1-2 that the ViewModel layer handles modifications cleanly.
**Delivers:** Cross-scope visibility for settings, env vars, plugins, sandbox properties, and permission rules. Winning-scope items show "also in [scopes]" description; all overlapping items get rich tooltips listing scopes and values.
**Addresses:** Table stakes -- overlap indicators for same-name entities; differentiator -- rich markdown tooltips.
**Avoids:** Pitfall 1 (override-overlap conflation) via separate resolver functions and fields. Pitfall 4 (description corruption) by using tooltips for details and minimal description markers. Pitfall 5 (performance) by building overlap map in single pass before per-scope VM construction. Pitfall 10 (false MCP/hook overlap) by skipping overlap detection for those entity types.
**Estimated LOC:** ~40-60 lines in builder.ts + ~30-50 lines in overrideResolver.ts.

### Phase Ordering Rationale

- Phases 1 and 2 are independent bug fixes that can be built in parallel or either-first. They are ordered by scope (smallest first) to deliver quick wins.
- Phase 3 depends on neither but is ordered last because it touches the most code (7 builder methods + new resolver functions) and benefits from the validation that Phases 1-2 provide for the ViewModel extension pattern.
- Dead code cleanup is bundled with Phase 1 to avoid the ordering pitfall (Pitfall 9) and to keep hook-related changes together.
- All three phases modify only `builder.ts` and `overrideResolver.ts`. No merge conflicts expected since they touch different methods within those files.

### Research Flags

Phases with standard patterns (skip deeper research):
- **Phase 1 (Hook Navigation):** Well-understood bug with clear fix. The keyPath must include the intermediate `hooks` property. No ambiguity.
- **Phase 2 (Lock Checkbox):** One-line conditional. VS Code API behavior verified. No research needed.
- **Phase 3 (Overlap Indicators):** Follows established override resolver pattern. API surfaces confirmed. One design decision worth validating during planning: whether overlap description text should use a short format (`+2`) or verbose format (`also in User, Project Local`). Recommend deciding based on tree panel width testing.

No phases need `/gsd:research-phase` -- all patterns are well-documented and already used in the codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all APIs verified against VS Code 1.90.0+ and codebase usage |
| Features | HIGH | All three features derived from direct codebase analysis of existing gaps; clear table stakes vs. differentiators |
| Architecture | HIGH | Full audit of builder.ts (1041 LOC), overrideResolver.ts (195 LOC), and all integration points; v0.6.0 ViewModel layer makes changes surgical |
| Pitfalls | HIGH | 11 pitfalls identified from code-level analysis; critical pitfalls have clear prevention strategies verified against actual code paths |

**Overall confidence:** HIGH

### Gaps to Address

- **Overlap description format:** Whether to use short (`+2`) or verbose (`also in User`) format needs testing with narrow tree panels. Decide during Phase 3 implementation.
- **Checkbox removal on older VS Code:** Setting `checkboxState: undefined` after it was previously set should cleanly remove the checkbox on 1.90.0+, but this needs manual verification. If it shows a blank checkbox instead, fall back to the refresh-to-revert pattern.
- **MCP server overlap policy:** Research recommends skipping overlap for MCP servers (same name may mean different configs). This policy decision should be confirmed during Phase 3 planning.
- **`node.description` as data source:** `editCommands.ts` reads `node.description` to pre-fill input boxes (flagged in v0.6.0 Pitfall 8). Adding overlap text to descriptions would exacerbate this. Consider adding `nodeContext.rawValue` if overlap text must go in descriptions. Otherwise, tooltip-only approach avoids the problem entirely.

## Sources

### Primary (HIGH confidence)
- Direct codebase audit: `builder.ts` (1041 LOC), `overrideResolver.ts` (195 LOC), `jsonLocation.ts` (262 LOC), `extension.ts` (401 LOC), all node types, configTreeProvider.ts
- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view) -- TreeItem properties, FileDecorationProvider, checkboxState
- [VS Code API Reference](https://code.visualstudio.com/api/references/vscode-api) -- TreeItem, MarkdownString, TextEditor, Position, Selection
- Claude Code settings schema and test fixtures in the project

### Secondary (MEDIUM confidence)
- [VS Code TreeItem checkbox API discussion](https://github.com/microsoft/vscode/issues/116141) -- checkboxState object form with tooltip
- [VS Code FileDecoration badge](https://github.com/microsoft/vscode/issues/125658) -- badge limited to 2 characters

---
*Research completed: 2026-03-08*
*Ready for roadmap: yes*
