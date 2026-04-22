---
name: v0.10.0-simplify-and-power-features
status: completed
created: 2026-03-15T00:00:00Z
updated: 2026-03-27T00:00:00Z
progress: 100%
prd:
github:
---

# Simplify & Power Features (v0.10.0)

## Summary

Cleaned up ~270 lines of duplicated command-handler code into 6 shared helpers, then added three power features on top of the slimmer foundation: a schema-aware Settings "Add" button, drag-and-drop move between scopes for all 6 movable item types, and screen-reader accessibility labels on all 13 tree node types. Ordering was deliberate — Phase 30 refactoring made Phases 31–33 cleaner to implement, and the ViewModel layer from v0.6.0 paid dividends once again: accessibility labels were a trivial addition because every node's display state already flows through `BaseVM`.

The milestone shipped 2026-03-27 with all 20 requirements satisfied across 4 phases and 5 plans (9 commits). Net source delta was +416 LOC; the test suite stayed at 132.

## Requirements delivered

### Simplification (Phase 30)
- **SIMP-01**: Try/catch retry dispatch blocks extracted into `withWriteRetry(filePath, action)` — applied to 5+ locations across command files.
- **SIMP-02**: Read-only guard extracted into `guardReadOnly(node, message, options?)` with `allowLockedUser` option — 8 call sites converted to one-liners.
- **SIMP-03**: Target scope selection extracted into `pickEditableTargetScope(...)` — 5 call sites share a single implementation (including `noWorkspaceFolders` / `noEditableScopes` handling).
- **SIMP-04**: Overwrite confirmation extracted into `confirmOverwrite(itemName, scopeLabel)` — modal dialog deduplicated across 3 copy commands.
- **SIMP-05**: `formatSandboxValue()` merged into `formatValue(value, style)` with `style: 'summary' | 'raw'` parameter; the separate function no longer exists.
- **SIMP-06**: Timestamp formatting extracted into `formatTimestamp()` returning `[HH:MM:SS.mmm]` — applied across `openFileCommands`, `fileWatcher`, `configWriter`.
- **SIMP-07**: Plugin checkbox + context-menu toggle handlers deduplicated via exported `togglePluginEnabled(node, enabled, refreshTree?)`; `extension.ts` handlers shrunk from ~20 lines each to 3–4 lines.

### Settings Add (Phase 31)
- **SETT-01**: Inline `+` button on editable Settings section headers; hidden on Managed (read-only) scope.
- **SETT-02**: Schema-aware QuickPick listing known settings from `KNOWN_SETTING_KEYS`, filtered to exclude keys already present in the target scope.
- **SETT-03**: Free-text fallback via separator + `$(edit) Enter custom key...` item with `__custom__` value sentinel for settings not in the schema.
- **SETT-04**: Type-appropriate input dispatched via `SETTING_TYPE_MAP`: boolean → toggle QuickPick, number → InputBox with validation, `string[]` → comma-separated InputBox, object → JSON InputBox with parse validation, string → plain InputBox.

### Drag and Drop (Phase 32)
- **DND-01**: `ConfigDragAndDropController` implementing VS Code's `TreeDragAndDropController<ConfigTreeNode>` wired via `createTreeView`.
- **DND-02**: All 6 item types draggable: PermissionRule, EnvVar, McpServer, Plugin, Setting, SandboxProperty.
- **DND-03**: Drop targets resolve through leaf nodes and intermediate nodes (permission groups) to their parent scope; cross-entity-type drops silently rejected.
- **DND-04**: Move-only on drop (no QuickPick prompt); Copy remains available via context menu — a deliberate simplification from the original plan.
- **DND-05**: `moveItemToScope` and `copyItemToScope` extracted as reusable exported functions from `moveCommands.ts`; DnD reuses them, no parallel write path.
- **DND-06**: Drops onto locked or Managed scopes produce an error notification and leave the tree unchanged; `guardReadOnly` consulted.

### Accessibility (Phase 33)
- **A11Y-01**: `accessibilityInformation` set on all 9 leaf node types (PermissionRule, Setting, SettingKeyValue, EnvVar, Plugin, SandboxProperty, SandboxChild, McpServer, HookEntry) with scope, value, and override status.
- **A11Y-02**: `accessibilityInformation` set on all 4 container node types (ScopeNode, SectionNode, HookEventNode, WorkspaceFolderNode) with scope name, section name, and item count where applicable.
- **A11Y-03**: `buildOverlapAccessibilityLabel` helper appends overrides/isOverriddenBy/duplicates/isDuplicatedBy relationship text to any base label, mirroring the overlap semantics already in tooltips.

## Implementation history

- **Phase 30 Plan 01 — Extract Shared Command Helpers** (~15 min, 2026-03-15): Created `src/utils/commandHelpers.ts` (4 helpers) and `src/utils/timestamp.ts` (`formatTimestamp`). Merged `formatSandboxValue` into `formatValue(value, 'raw')`. Applied helpers across `addCommands`, `editCommands`, `deleteCommands`, `moveCommands`, `pluginCommands`, `openFileCommands`, `fileWatcher`, `configWriter`. ~308 net lines removed. Commits: `31b99b0`, `895ad4e`.
- **Phase 30 Plan 02 — Deduplicate Plugin Toggle** (8 min, 2026-03-15): Extracted `togglePluginEnabled` in `pluginCommands.ts`; `onDidChangeCheckboxState` and `togglePlugin` handlers in `extension.ts` shrunk to 3–4 lines. Kept inline try/catch in the helper (not `withWriteRetry`) because the original handlers called `treeProvider.refresh()` in the catch block and `withWriteRetry` swallows the error internally. Commit: `c74bd48`.
- **Phase 31 — Settings Add Button** (5 min, 2026-03-15): Added `SETTING_TYPE_MAP` constant for 24 known setting keys to their types; implemented `claudeConfig.addSetting` command with schema-aware QuickPick, custom-key fallback, type-dispatched input widgets; wired inline button + context menu + commandPalette suppression in `package.json`. Commits: `2c35704` (feat), `db4f680` (feat).
- **Phase 32 — Drag-and-Drop Between Scopes** (~60 min, 2026-03-27): Created `src/dnd/dndController.ts` with `ConfigDragAndDropController`; added `removeSandboxProperty` to `configWriter.ts` (with empty-object cleanup mirroring `setSandboxProperty`); extracted `moveItemToScope` / `copyItemToScope` as exported functions from `moveCommands.ts`; wired controller into `createTreeView` in `extension.ts`. Human-verify checkpoint drove two auto-fixes: (1) removed post-drop QuickPick in favor of Move-only, (2) extended `resolveDropTarget` to walk up through leaf and intermediate nodes to find the parent scope. Commits: `f2d8c19`, `4598de9`, `c8aee1c`.
- **Phase 33 — Accessibility Labels** (27 min, 2026-03-27): Added optional `accessibilityInformation?: { label: string; role?: string }` to `BaseVM`; wired `ConfigTreeNode` constructor to propagate to `TreeItem`; added `buildOverlapAccessibilityLabel` helper; populated labels in `builder.ts` for all 13 node types. EnvVar values truncated to 50 chars to avoid verbose screen reader announcements. Commits: `496b27e` (leaf nodes), `63993f1` (container nodes), `20c0a31` (docs).

## Key decisions

- **Extract before adding**: Refactor duplicated command code (Phase 30) first so new features in Phases 31–33 integrate into a smaller, cleaner surface. Every subsequent phase consumed the new helpers.
- **`withWriteRetry` uses `showWriteError`'s retry slot directly**: Passes the action as `retryFn` rather than wrapping it in another closure — reuses the existing error-recovery pattern without a new abstraction.
- **`guardReadOnly` with `allowLockedUser` option**: Copy commands bypass the lock check because copies target *other* scopes — only writes to the locked scope should be blocked.
- **`formatValue` style parameter replaces `formatSandboxValue`**: Single function handles both regular (summary) and sandbox (raw) display styles.
- **`togglePluginEnabled` keeps inline try/catch**: Not `withWriteRetry`, because the original handler called `treeProvider.refresh()` in the catch block — the inline approach preserves exact original semantics.
- **`SETTING_TYPE_MAP` dispatches per-type input widgets**: Boolean → QuickPick (discoverability), number → InputBox with regex validation, `string[]` → comma-separated, object → JSON InputBox with `JSON.parse` validation, string → plain InputBox. Default for unknown keys is `string`.
- **Custom key via separator item**: `$(edit) Enter custom key...` preceded by a `QuickPickItemKind.Separator`, carrying a `__custom__` sentinel to branch into free-text InputBox.
- **DnD defaults to Move (no QuickPick)**: Simpler interaction than the original Move/Copy dialog. Copy still available via context menu. Alt-copy modifier support unavailable in VS Code's DnD API — but the simplification turned out to match user intent anyway.
- **Drop target resolution walks up through any node type**: `resolveDropTarget` uses `nodeContext.scope` to find the target scope from leaf items and intermediate nodes (permission groups), not just ScopeNode/SectionNode.
- **Cross-entity-type drops silently rejected**: VS Code drag UX convention — invalid drop targets show no indicator and nothing happens. No error notification.
- **`removeSandboxProperty` mirrors `setSandboxProperty`**: Key-splitting and empty-object cleanup of `sandbox.network`-style nested objects.
- **`accessibilityInformation` optional on `BaseVM`**: Nodes without it remain unaffected at runtime — no empty-string labels announced to screen readers.
- **`buildOverlapAccessibilityLabel` appends relationship text to base label**: Keeps overlap semantics consistent with tooltip display — screen reader users get the same relationship info visual users get from icons and tooltip.
- **EnvVar a11y label truncates value at 50 chars**: Avoids excessively long screen reader announcements for long environment values.

## Functionality delivered

- **Code added/modified**:
  - `src/utils/commandHelpers.ts` (new) — `withWriteRetry`, `guardReadOnly`, `pickEditableTargetScope`, `confirmOverwrite`.
  - `src/utils/timestamp.ts` (new) — `formatTimestamp`.
  - `src/dnd/dndController.ts` (new) — `ConfigDragAndDropController` with drag, drop, scope resolution, lock/read-only rejection, entity-type cross-check.
  - `src/viewmodel/types.ts` — `accessibilityInformation` on `BaseVM`; `formatValue` gained `style` parameter; `formatSandboxValue` removed.
  - `src/viewmodel/builder.ts` — `buildOverlapAccessibilityLabel`; accessibility labels on all 13 node builder return objects.
  - `src/tree/nodes/baseNode.ts` — wires `vm.accessibilityInformation` to `TreeItem.accessibilityInformation`.
  - `src/commands/addCommands.ts` — `SettingQuickPickItem` interface; `claudeConfig.addSetting` command.
  - `src/commands/moveCommands.ts` — `moveItemToScope` / `copyItemToScope` extracted as exported functions; existing handlers refactored to delegate.
  - `src/commands/pluginCommands.ts` — exported `togglePluginEnabled`.
  - `src/commands/editCommands.ts`, `src/commands/deleteCommands.ts`, `src/watchers/fileWatcher.ts`, `src/config/configWriter.ts`, `src/commands/openFileCommands.ts` — helper adoption.
  - `src/config/configWriter.ts` — new `removeSandboxProperty`.
  - `src/constants.ts` — `SETTING_TYPE_MAP` for 24 known settings.
  - `src/extension.ts` — simplified plugin toggle handlers; DnD controller instantiation passed to `createTreeView`.
  - `package.json` — `claudeConfig.addSetting` command, inline button on `section.settings.editable`, context menu in `3_add` group; commandPalette suppression entries.
- **User-facing behavior**:
  - Inline `+` on editable Settings section headers opens a schema-aware picker; type-appropriate input follows.
  - Drag any item (permission rule, env var, MCP server, plugin, setting, sandbox property) onto a different scope's node (or any node within a target scope) to move it. Locked/Managed scopes reject drops.
  - Screen reader users hear "{nodeType}: {identity}, {scopeLabel} scope[, overlap relationships]" for leaves and "{name} {nodeType} in {scope} scope, {count} {children}" for containers.
  - Plugin toggle (both checkbox and context menu) runs through one helper — consistent error handling and UI refresh.
- **Tests**: held steady at 132 tests (no net change).

## Audit outcome

No dedicated `v0.10.0-MILESTONE-AUDIT.md` was produced for this milestone (in contrast to v0.9.0). Verification relies on per-phase VERIFICATION.md files (phases 30 and 31) and the milestone retrospective: every requirement SIMP-01..07, SETT-01..04, DND-01..06, A11Y-01..03 was explicitly marked Complete in `.planning/milestones/v0.10.0-REQUIREMENTS.md` traceability (20/20 mapped, 0 unmapped), and `.planning/PROJECT.md` lists each v0.10.0 requirement as validated. Net source delta +416 LOC; test suite stable at 132; no known tech debt at ship.

## Lessons learned

- Extract shared helpers before adding features — a smaller codebase makes new code easier to integrate and reduces the blast radius of bugs. Phase 30's 308-line reduction made Phases 31–33 cleaner.
- The ViewModel layer from v0.6.0 pays dividends across milestones — accessibility labels were a trivial addition because every node's display state already flows through `BaseVM`. Same pattern benefited overlap (v0.7.0) and audit-driven fixes (v0.9.0).
- DnD "move-only by default" with copy in the context menu is better UX than a QuickPick dialog on every drop — the simplification was driven by a human-verify checkpoint after the first implementation.
- Leaf-node drop resolution is a quiet UX win — VS Code often routes drops to the nearest visible node rather than the intended container, so walking up the node chain to find the target scope removes a whole class of "drop did nothing" failures.
- STATE.md progress tracking needs to be updated by the execution workflow, not just planning — current tracking drifted (percent stayed 0%, phase tracking lagged). Documentation gap, non-blocking.
- Durable verification pattern: when a phase's prior audit is absent or light, cross-reference per-phase VERIFICATION.md + REQUIREMENTS.md traceability + PROJECT.md validated list before declaring complete.
- Next milestone hint: the `.planning/milestones/v1-MILESTONE-AUDIT.md` file was a historical artifact auditing the v0.3.x toolbar work (phases 1–3, audited 2026-02-19), not forward-looking guidance for a post-v0.10.0 milestone — it does not define a "next milestone" and was not folded into this epic.
