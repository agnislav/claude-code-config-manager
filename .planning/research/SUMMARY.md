# Project Research Summary

**Project:** Claude Code Config Manager
**Domain:** VS Code Extension — TreeView toolbar UX improvements and scope-level write protection
**Researched:** 2026-02-18
**Confidence:** HIGH

## Executive Summary

This is a brownfield VS Code extension milestone adding three targeted UX improvements to an existing, fully-functional TreeView config editor. All three features are implementable using APIs already present in the extension's minimum VS Code version (1.90.0) — no new runtime dependencies, no new npm packages, and no changes to the esbuild bundle configuration. The recommended approach is to work sequentially in the order defined by the project brief: QuickPick filter first (Feature 1), then Refresh button removal (Feature 2), then User scope lock (Feature 3). This order is justified by architecture: Feature 1 cleans up 16 dead commands before Feature 3 adds new ones, and Feature 2 is pure deletion that benefits from landing on a cleaner package.json.

The single most important technical decision is that the User scope lock state must live in `ConfigStore` as a separate `_lockedScopes: Set<ConfigScope>` — not in `ScopedConfig` objects, not in `ConfigTreeProvider`, and not as a mutation of the existing `isReadOnly` field. This is non-negotiable: `ScopedConfig` objects are rebuilt on every file-watcher-triggered reload, so lock state stored there would be silently lost on every external config file change. `ConfigStore` outlives reloads and is already the authoritative source of truth for scope metadata.

The second critical decision is the choice of `window.createQuickPick()` over `window.showQuickPick()` for the filter UI. `showQuickPick` cannot pre-select items when `canPickMany: true` is used — the `QuickPickItem.picked` property is silently ignored by `createQuickPick`. The correctly idiomatic VS Code approach is `createQuickPick` with `qp.selectedItems = [...]` set explicitly after `qp.items = items`. Paired with `qp.onDidHide(() => qp.dispose())` and a selection-tracking variable in `onDidAccept`, this avoids all three known QuickPick race-condition and memory-leak pitfalls documented by confirmed VS Code GitHub issues.

## Key Findings

### Recommended Stack

The extension already has everything needed. All three features use only the `vscode` extension host API, which is already bundled as an external dependency by esbuild. The relevant APIs (`window.createQuickPick`, `commands.executeCommand('setContext', ...)`, `TreeItem.contextValue`, `ExtensionContext.workspaceState`) have been available since VS Code 1.22 at the latest — well before the project's 1.90.0 minimum. Confidence is HIGH: all interfaces were verified directly against the locally installed `@types/vscode@1.90.0` type definitions.

**Core technologies:**
- `vscode.window.createQuickPick<T>()`: multi-select filter UI — the only API that supports pre-selecting items in a multi-select picker with full lifecycle control
- `vscode.commands.executeCommand('setContext', ...)`: drives toolbar `when` clause icon-swapping for the lock toggle — already used by the extension's `syncFilterContext()`
- `vscode.TreeItem.contextValue` (dot-segmented string): encodes lock state per scope node for conditional context menu visibility — already used via `computeContextValue()` in `baseNode.ts`
- `ExtensionContext.workspaceState`: optional persistence for lock state across VS Code sessions — available since VS Code 1.0

### Expected Features

All three features are strictly P1 for this milestone. There are P2 additions (filter count in view description, "Show All" shortcut in QuickPick) that can be added post-validation. There are no features to remove from scope — all three are confirmed necessary, justified, and implementable.

**Must have (table stakes):**
- QuickPick multi-select filter replacing 8 toolbar icon buttons — users expect minimal toolbar clutter per official VS Code UX guidelines; 9 icons exceeds the implicit ceiling
- Remove Refresh toolbar button — auto-refresh via file watcher is now the standard expectation; a manual refresh button implies the watcher is unreliable
- User scope lock toggle — prevents accidental writes to `~/.claude/settings.json` during project-scoped config sessions; must show locked scope as visible-but-read-only (not hidden)

**Should have (competitive):**
- Filter count in `TreeView.description` (e.g., "3 sections") — communicates active filter state at a glance without opening the picker
- "Show All Sections" shortcut item in QuickPick — clears filters in one click instead of unchecking all items

**Defer (v2+):**
- Lock state persisted across VS Code sessions (workspaceState) — ephemeral session lock covers the stated use case
- Lock extended to Project Shared or Project Local scopes — architecture supports it (`Set<ConfigScope>`), but out of scope for this milestone
- Visual dimming of locked TreeItems — blocked by VS Code API limitation; `TreeItem` has no `disabled` property (issue #139557 closed without implementation)

### Architecture Approach

The existing architecture — `ConfigStore` as in-memory model, `ConfigTreeProvider` as tree renderer, `baseNode.computeContextValue()` for menu visibility, and `configWriter` as pure write functions with command-level `isReadOnly` guards — requires only targeted additions. Feature 1 is a net reduction in complexity (removes 16 commands, 8 context keys, icon-swap machinery; replaces with 1 command and 1 QuickPick handler). Feature 2 is pure deletion. Feature 3 adds a `Set<ConfigScope>` to `ConfigStore`, threads `effectiveReadOnly` down through `ScopeNode` construction using a shallow-clone pattern, and registers one new command. No new architectural patterns are introduced; the existing patterns are extended uniformly.

**Major components and their changes:**
1. `src/config/configModel.ts` (ConfigStore) — adds `_lockedScopes: Set<ConfigScope>`, `lockScope()`, `unlockScope()`, `isScopeLocked()` for Feature 3
2. `src/tree/configTreeProvider.ts` — removes filter context-key machinery for Feature 1; adds `effectiveReadOnly` computation for Feature 3
3. `src/tree/nodes/scopeNode.ts` — accepts `effectiveReadOnly` parameter; shallow-clones `ScopedConfig` with overridden `isReadOnly` for children (Feature 3)
4. `src/extension.ts` — removes 14 filter command registrations (Feature 1); removes Refresh command (Feature 2); registers `claudeConfig.toggleUserLock` (Feature 3)
5. `package.json` — removes 16 filter command entries, adds 1 filter picker entry (Feature 1); removes Refresh entry (Feature 2); adds lock toggle command and icon-swap menu entries (Feature 3)

### Critical Pitfalls

1. **`QuickPickItem.picked` silently ignored by `createQuickPick`** — set `qp.selectedItems = [...]` explicitly after `qp.items = items`; never rely on `picked: true` for pre-selection with `createQuickPick` (VS Code issue #119834, WONTFIX)

2. **`onDidAccept` timing race with `onDidChangeSelection`** — track selection in a variable updated by `onDidChangeSelection`, read from that variable in `onDidAccept` instead of `qp.selectedItems`; prevents intermittent missed-selection on fast keyboard input

3. **QuickPick not disposed — listener accumulation** — always wire `qp.onDidHide(() => qp.dispose())`; opening the filter picker repeatedly without disposing accumulates event listeners and causes duplicate filter applications

4. **Lock state lost on file-watcher reload** — never store lock state in `ScopedConfig` instances; they are rebuilt on every `configStore.reload()`; lock state must live in `ConfigStore` as a separate field that survives reloads

5. **Orphaned `setContext` keys after command removal** — remove `syncFilterContext()` and all `claudeConfig_filter_*` setContext calls atomically with the command entries in `package.json`; stale context keys persist in the VS Code host until restart

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: QuickPick Multi-Select Filter (Feature 1)
**Rationale:** Largest complexity reduction of the three features; removes 16 commands and 8 context keys before Feature 3 adds new ones; validates QuickPick API usage pattern for the codebase; self-contained changes across 3 files only
**Delivers:** Single filter icon replaces 8 toolbar icons; `setSectionFilter()` replaces `toggleSectionFilter()`/`selectAllSections()`; `syncFilterContext()` and all `claudeConfig_filter_*` context machinery removed
**Addresses:** Toolbar clutter (primary UX pain point), filter pre-selection state, cancel-preserves-state semantics
**Avoids:** Pitfall 1 (picked pre-selection), Pitfall 2 (onDidAccept timing), Pitfall 3 (QuickPick disposal), Pitfall 4 (orphaned setContext keys)

### Phase 2: Remove Refresh Toolbar Button (Feature 2)
**Rationale:** Pure deletion with zero architectural changes; cheapest feature; lands cleanly after Feature 1 has already removed filter entries from the same package.json sections, minimizing merge conflicts
**Delivers:** Cleaner toolbar; removal of 3 manifest entries and 1 command registration; explicit documentation in CHANGELOG as a breaking-change notice for any users who bound the command
**Avoids:** Pitfall 5 (command removal breaks user keybindings without visible error)

### Phase 3: User Scope Lock Toggle (Feature 3)
**Rationale:** Most complex feature; requires coordinated changes across 5 files; modifies `ScopeNode` constructor signature; benefits from a clean codebase after Phases 1 and 2 have reduced noise in `extension.ts` and `package.json`
**Delivers:** Lock toggle toolbar button on User scope; `isReadOnly` effective value propagated through entire node tree via shallow-clone pattern; write guard reuses existing `nodeContext.isReadOnly` checks in all command handlers unchanged
**Uses:** `ConfigStore._lockedScopes`, `effectiveReadOnly` computation in `ConfigTreeProvider`, `$(lock)`/`$(unlock)` built-in ThemeIcons, `claudeConfig_userScope_locked` context key for icon-swap
**Avoids:** Pitfall 6 (lock vs Managed scope isReadOnly collision), Pitfall 7 (contextValue stale after toggle), Pitfall 8 (when-clause regex double-escaping), Pitfall 10 (lock command appearing in Command Palette)

### Phase Ordering Rationale

- Feature 1 before Feature 3: Feature 1 removes 16 command entries from `package.json`; Feature 3 adds 2. Sequential rather than parallel avoids interleaved edits to the same JSON arrays.
- Feature 2 can land between or alongside Feature 1: it touches different command IDs and is a pure deletion with no coupling to Features 1 or 3. The suggested order (after Feature 1) is purely for reviewer clarity.
- Feature 3 last: it is the only feature that adds stateful behavior to `ConfigStore` and modifies the `ScopeNode` constructor — the highest-risk change. Landing it last on a clean codebase reduces the probability of merge conflicts and makes the diff easier to review.

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1 (QuickPick Filter):** Pattern is already proven in `moveCommands.ts` (scope QuickPick); all API behaviors are verified in `@types/vscode@1.90.0`; no unknowns
- **Phase 2 (Remove Refresh):** Pure deletion; no research needed
- **Phase 3 (User Scope Lock):** `ConfigStore` pattern, `contextValue` propagation pattern, and `setContext` icon-swap pattern are all established in the codebase; lock data model design is fully specified in ARCHITECTURE.md and PITFALLS.md

No phases require `/gsd:research-phase` during planning. All API behaviors are resolved and the architecture decisions are documented with rationale.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against locally installed `@types/vscode@1.90.0`; all API interfaces line-number confirmed; version compatibility table checked |
| Features | HIGH | Official VS Code UX guidelines + direct codebase inspection + confirmed API limitations (TreeItem.disabled, TreeView search) from tracked GitHub issues |
| Architecture | HIGH | Based on direct codebase inspection of all 35 source files; component boundaries, data flow, and propagation path fully mapped |
| Pitfalls | HIGH | 10 pitfalls documented; all critical ones have confirmed GitHub issues (VS Code or eclipse-theia); none are speculative |

**Overall confidence:** HIGH

### Gaps to Address

- **Filter state persistence policy:** PITFALLS.md identifies that neither the current toolbar approach nor the QuickPick approach persists filter state across sessions. A deliberate decision must be made during planning: persist to `globalState`/`workspaceState` or accept session-only behavior. The research recommends documenting "intentionally ephemeral" if persistence is deferred.
- **Lock icon UX — single vs. dual icon:** STACK.md recommends a single `$(lock)` icon (click-to-toggle) for simplicity; ARCHITECTURE.md also mentions the icon-swap approach (separate `$(lock)` and `$(unlock)` icons via two `view/item/context` entries on different `when` clauses). The roadmap should specify which approach is required before implementation begins.
- **`canPickMany` vs `canSelectMany` naming:** The property name differs between `showQuickPick` options (`canPickMany`) and `createQuickPick` instances (`canSelectMany`). TypeScript strict mode will catch this at compile time only if the type is not `any` — ensure the QuickPick variable is typed as `vscode.QuickPick<vscode.QuickPickItem>`, not inferred as `any`.

## Sources

### Primary (HIGH confidence)
- Local `@types/vscode@1.90.0` — QuickPick interfaces (lines 13142, 13199, 13229, 13169), QuickPickItem.picked documentation (line 1960), showQuickPick overloads (lines 11398, 11418), createQuickPick factory (line 11479)
- VS Code GitHub issue #119834 — `QuickPickItem.picked` not working with `createQuickPick`; official workaround from VS Code team: use `selectedItems`
- VS Code GitHub issue #138070 — same bug, documented as design decision ("we didn't want two ways to do the same thing")
- VS Code GitHub issue #139557 — `TreeItem` has no `disabled` property; closed without implementation
- VS Code GitHub issue #161753 — TreeView search/filter API declined by team; QuickPick is the recommended approach
- VS Code GitHub issue #140010 — `when` clause not auto-reevaluated without `onDidChangeTreeData`
- VS Code GitHub issue #110421 — `command.enablement` buggy with tree items; use `contextValue` + `when` clauses
- VS Code quickinput-sample — official `onDidHide(() => dispose())` dispose pattern
- VS Code UX Guidelines — Quick Picks: https://code.visualstudio.com/api/ux-guidelines/quick-picks
- VS Code UX Guidelines — Views: https://code.visualstudio.com/api/ux-guidelines/views
- VS Code UX Guidelines — Sidebars: https://code.visualstudio.com/api/ux-guidelines/sidebars
- VS Code Tree View Extension Guide: https://code.visualstudio.com/api/extension-guides/tree-view
- VS Code 1.64 Release Notes — `QuickPickItemKind.Separator` stable: https://code.visualstudio.com/updates/v1_64
- Direct codebase inspection: `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/` and `package.json`

### Secondary (MEDIUM confidence)
- eclipse-theia/theia issue #6221 — `onDidChangeSelection` fires after `onDidAccept`; event ordering issue
- VS Code GitHub issue #64014 — `canPickMany` vs `canSelectMany` naming asymmetry confirmed
- VS Code GitHub issue #46587 — QuickPick event pipeline ordering
- GitLens sidebar views and filter patterns: https://help.gitkraken.com/gitlens/side-bar/
- IBM i extension read-only mode (lock icon pattern): https://www.seidengroup.com/2024/01/08/read-only-mode-in-vs-code-for-ibm-i/

### Tertiary (LOW confidence)
- None. All findings in this research have at least MEDIUM confidence backing.

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
