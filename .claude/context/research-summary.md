# Project Research Summary

**Project:** Claude Code Config Manager v0.9.0 UX Audit
**Domain:** VS Code TreeView UX Consistency Audit
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

The v0.9.0 milestone is a UX consistency audit across 7 entity types and 14 total node types in an existing, shipping VS Code TreeView extension (v0.8.0, 5,672 LOC). This is not a greenfield build -- the architecture, stack, and core features are validated across 8 prior milestones. The work is about finding and fixing inconsistencies in how existing TreeView API features (inline buttons, context menus, tooltips, descriptions, overlap indicators) are applied across entity types. No new dependencies, no new API surfaces, no architectural changes.

The recommended approach is a systematic audit-then-fix workflow: first catalog the actual-vs-expected state of every node type across 11 audit vectors (icons, descriptions, tooltips, inline buttons, context menus, click behavior, overlap detection, etc.), then fix in order of increasing risk -- declarative package.json menu fixes first, builder.ts visual fixes second, new command handlers last. The ViewModel builder (`builder.ts`, 1018 lines) is the single source of truth for all visual properties; nearly all fixes land there or in `package.json` menu declarations.

The key risks are subtle regressions: contextValue regex breakage silently hides buttons, inline button index collisions reorder buttons (potentially putting delete at position 0), and the `&& false` disabled-button pattern looks like dead code but is intentional deferral. The edit pre-fill reads from `node.description` which already contains override suffix text -- any description formatting changes risk corrupting user data. Manual Extension Development Host testing is mandatory after every change; the 56-test suite validates viewmodel output but not rendered UI.

## Key Findings

### Recommended Stack

No changes required. The existing stack (TypeScript 5.3+, VS Code Extension API 1.90.0+, esbuild) is stable and validated. Zero new dependencies for this milestone. See [STACK.md](STACK.md) for full analysis.

**Core technologies (unchanged):**
- **TypeScript ^5.3.3**: Language -- no change
- **VS Code Extension API ^1.90.0**: Extension host -- all needed APIs available since well before this version
- **esbuild ^0.25.0**: Bundler -- no change

**One optional addition:** `TreeItem.accessibilityInformation` (available since VS Code 1.57) for screen reader labels. Low effort, fits existing viewmodel pattern, not required for the consistency goal but worth evaluating.

### Expected Features

See [FEATURES.md](FEATURES.md) for full feature landscape, inconsistency matrix, and dependency graph.

**Must have (table stakes -- inconsistencies that erode trust):**
- Click-to-reveal works on every leaf node
- Tooltip shows useful context on every entity (EnvVar currently has none)
- Description shows meaningful value on every leaf entity (HookEntry currently empty)
- Overlap detection on all 7 entity types (Hooks currently missing)
- Consistent context menu actions per entity type
- Item count on all section headers (Sandbox currently missing)
- Read-only nodes suppress all edit affordances universally

**Should have (differentiators -- polish beyond basic consistency):**
- Uniform inline button template: edit@0, move@1, copy@2, delete@3 across all applicable entities
- Resolve disabled `&& false` inline buttons (either enable or remove dead entries)
- Hook overlap detection to complete the overlap model
- EnvVar copy-to-scope (currently has move but not copy, unlike permissions and settings)
- MCP Server move/copy between scopes
- SettingKeyValue basic actions (edit, delete) -- currently a dead-end node
- Inline add buttons on section headers that have add commands

**Defer (anti-features for this milestone):**
- Deep-edit inline for complex values (objects, arrays)
- Drag-and-drop between scopes
- Multiselect batch operations (explicitly deferred per PROJECT.md)
- Hook move/copy between scopes (complex nesting makes this a separate feature)
- Plugin inline buttons beyond openReadme (checkbox interaction complicates this)
- Settings section "add" button (scope creep)
- Sandbox/Plugin section "add" buttons (schema-defined / registry-discovered)

### Architecture Approach

All changes flow through the existing ViewModel pipeline. The builder owns ALL presentation logic, node subclasses are thin pass-through wrappers (~10 lines each), and `package.json` `when` clauses control menu visibility via contextValue regex matching. This means UX fixes have a clear, predictable location: visual properties in builder.ts, button visibility in package.json, new capabilities in commands/*.ts. No node files should change. See [ARCHITECTURE.md](ARCHITECTURE.md) for full component boundaries, fix location matrix, and anti-patterns.

**Fix location matrix:**
1. **builder.ts** -- icons, descriptions, tooltips, counts, contextValue, overlap wiring
2. **package.json** -- inline button add/remove/fix, context menu entries, `when` clause regexes
3. **commands/*.ts** -- only if new operations are needed (copy-to-scope for new entity types)
4. **extension.ts** -- only if new commands are registered
5. **Node files (13 files)** -- should NOT change; all visual logic flows through BaseVM

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for all 14 pitfalls with detection and recovery strategies.

1. **contextValue regex breakage** -- Changing contextValue strings silently breaks inline buttons and context menus with no error. Build a contextValue-to-regex mapping table before any changes. Always change contextValue and when clause atomically.

2. **Inline button index collision** -- Adding buttons without checking ALL existing `view/item/context` entries causes buttons to swap positions. The delete button ending up at position 0 leads to accidental data deletion. Build a per-node-type button matrix first.

3. **`&& false` removal re-enables deferred features** -- 5 entries in package.json are intentionally disabled. They look like dead code but are deliberate deferrals. Check PROJECT.md before removing any `&& false` guard.

4. **Tooltip homogenization** -- Tooltips are intentionally heterogeneous by design (permissions show override warnings, MCP shows command strings, envVar shows nothing because value is visible). The overlap suffix via `buildOverlapTooltip()` is the shared consistency layer. Do not force all tooltips into the same format.

5. **Edit pre-fill contamination** -- `editValue` reads `node.description?.toString()` for pre-fill, which includes override suffix text. Any description formatting changes risk corrupting user data when users edit values. Test the edit flow after every description change.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Audit Catalog and Trivial Fixes
**Rationale:** Establish the complete actual-vs-expected matrix before changing anything. Fix zero-risk items that require no design decisions.
**Delivers:** Documented audit matrix for all 14 node types across all audit vectors; 3 trivial fixes shipped (Sandbox section count, HookEntry description, EnvVar base tooltip).
**Addresses:** Table stakes features -- item counts, descriptions, tooltips on every node.
**Avoids:** Pitfall 4 (tooltip homogenization) by documenting intentional variation first; Pitfall 3 (`&& false` removal) by cataloging all disabled entries with rationale before touching them.

### Phase 2: Menu Declaration Fixes (package.json)
**Rationale:** Lowest-risk code changes -- pure declarative JSON, no runtime logic. Fixes the most visible inconsistencies (missing/wrong inline buttons).
**Delivers:** Consistent inline button sets across entity types; resolved `&& false` entries (either enabled or removed); section header add buttons where applicable.
**Addresses:** Uniform inline button template; disabled button cleanup; section header consistency.
**Avoids:** Pitfall 2 (index collision) by working from the Phase 1 matrix; Pitfall 1 (regex breakage) by only modifying `when` clauses, not contextValues; Pitfall 9 (section asymmetry) by making intentional decisions per section.

### Phase 3: Builder Visual Consistency
**Rationale:** Medium-risk changes in builder.ts, but covered by existing 56-test suite. Fixes presentation inconsistencies found in Phase 1 audit.
**Delivers:** Consistent tooltips, descriptions, icons across all entity types; hook overlap detection (completing the overlap model for all 7 types); accessibility labels (optional).
**Addresses:** Hook overlap detection; tooltip depth consistency; icon semantic consistency.
**Avoids:** Pitfall 4 (tooltip homogenization) by preserving intentional per-type base tooltips; Pitfall 10 (description suffix pollution) by applying overrideSuffix last; Pitfall 11 (edit pre-fill) by testing edit flow after every description change.

### Phase 4: New Commands (conditional)
**Rationale:** Highest risk -- new command handlers need error handling, lock-awareness, scope filtering, and MCP file path awareness. Only implement what Phase 1 audit identified as genuinely needed.
**Delivers:** EnvVar copy-to-scope; MCP server move-to-scope; SettingKeyValue edit/delete (if scoped in).
**Addresses:** Feature parity for move/copy across entity types.
**Avoids:** Pitfall 6 (lock state) by copying guard patterns from existing commands; Pitfall 7 (MCP file path) by using the existing `removeMcpServer` pattern; Pitfall 13 (hookEvent vs hookEntry confusion) by using precise `when` clause patterns.

### Phase Ordering Rationale

- Phase 1 before anything else because the audit matrix is the reference for all subsequent fixes. Making changes without the matrix risks Pitfalls 1-4.
- Phase 2 before Phase 3 because package.json changes are zero-runtime-risk and immediately testable.
- Phase 3 before Phase 4 because builder changes are localized (single file) and test-covered, while new commands are vertical slices across 3 files.
- Phase 4 is conditional -- the audit may determine that missing move/copy for MCP and hooks is acceptable for this milestone.

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1:** Pure analysis and trivial builder fixes. No research needed.
- **Phase 2:** package.json menu declarations are well-documented VS Code API. No research needed.
- **Phase 3:** builder.ts follows established viewmodel pattern. Overlap integration follows `resolveOverlapGeneric` pattern already used for 6 entity types. No research needed.

Phases likely needing deeper research during planning:
- **Phase 4:** MCP server move/copy needs investigation of the `.mcp.json` file structure vs `settings.json` structure. The `mcpFilePath` vs `filePath` distinction is a known gotcha (Pitfall 7). Worth a focused research spike before implementation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all APIs verified against VS Code 1.90.0+ and codebase usage |
| Features | HIGH | Inconsistency matrix derived from direct codebase analysis of package.json menus (24 entries) and builder.ts (1018 LOC). Every finding traceable to specific lines. |
| Architecture | HIGH | Full audit of all 13 node files, builder.ts, 6 command files, and package.json menus. Fix locations are deterministic per the ViewModel pattern. |
| Pitfalls | HIGH | 14 pitfalls identified from code-level analysis; critical pitfalls map to specific code patterns (editCommands.ts line 36, 5 specific `&& false` entries, etc.) |

**Overall confidence:** HIGH

### Gaps to Address

- **Hook overlap identity matching:** Hooks are array-based, not keyed. The overlap resolver works on key-value pairs. Determining whether two hooks in different scopes are "the same hook" requires defining an identity function (command string? matcher pattern?). This needs a design decision during Phase 3 planning.
- **`&& false` entries: enable vs remove:** The audit must make an explicit decision for each of the 5 disabled entries. Some may be ready to enable (envVar edit inline), others should be removed (plugin move/copy/delete inline). This is a Phase 2 design decision.
- **Edit pre-fill long-term fix:** The `node.description` pre-fill pattern is a known weakness (flagged since v0.6.0). Fixing it properly (reading from config data instead of rendered description) is deferred, but any description changes must be tested against this flow. Flag for Phase 3 testing.
- **Section header add button policy:** The asymmetry between Permissions (inline add button) and other sections (context menu only) may be intentional. Phase 1 audit must determine whether this is a bug or design choice before Phase 2 attempts to "fix" it.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: builder.ts (1018 LOC), package.json menus (24 view/item/context entries, 5 with `&& false`), all 13 node files, 6 command files, overlapResolver.ts, types.ts, constants.ts
- [VS Code Tree View API Guide](https://code.visualstudio.com/api/extension-guides/tree-view) -- TreeItem properties, contextValue, when clauses
- [VS Code API Reference](https://code.visualstudio.com/api/references/vscode-api) -- TreeItem, accessibilityInformation, FileDecorationProvider
- [VS Code UX Guidelines: Views](https://code.visualstudio.com/api/ux-guidelines/views) -- max 3 inline actions, icon guidance, nesting depth
- Existing test suite: builder.test.ts (56 tests), overlapResolver.test.ts

### Secondary (MEDIUM confidence)
- [TreeView badge PR #144775](https://github.com/microsoft/vscode/pull/144775) -- confirms view-level only (not per-item)
- [TreeItem checkbox API tracking #186164](https://github.com/microsoft/vscode/issues/186164) -- confirms no disabled state
- [VS Code Extension API Guidelines wiki](https://github.com/microsoft/vscode/wiki/Extension-API-guidelines) -- pattern recommendations

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
