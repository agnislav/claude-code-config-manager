---
name: multi-select-item-operations
description: Enable multi-select in the config TreeView to batch delete, move, and copy items across scopes
status: backlog
created: 2026-04-22T20:01:32Z
---

# PRD: multi-select-item-operations

## Executive Summary

Today, every destructive or scope-changing action in the config tree is single-item: one click, one QuickPick, one write. When a user needs to delete ten deprecated permission rules or move a batch of env vars from Project Shared to User scope, they repeat the same flow ten times. This PRD enables native VS Code multi-selection (`canSelectMany`) in the config TreeView and wires the existing delete / move / copy commands to accept a list of nodes, with a single confirmation and a per-item result summary.

This reverses the deferral recorded in `.claude/context/features.md:102` ("Multiselect batch operations — deferred"). The deferral reason was "significant state management complexity"; we now have a stable node model (`ConfigStore` + `NodeContext`) and versioned config writers, which make batch operations tractable without webviews or custom selection state.

## Problem Statement

**What**: Routine multi-item cleanup and reorganization of Claude Code config files is tedious in the tree view.

**Why now**:
- The config surface has grown — users commonly carry 100+ permission rules per scope, plus env vars and MCP servers.
- Single-item commands are fast individually but cost compounds quickly. A user pruning a stale project might face 20+ sequential QuickPicks.
- The underlying writer (`configWriter.ts`) already serializes changes per-scope-per-write; batching N changes into one write per affected scope is a natural extension.
- Recent milestones (v0.9.0 permission overlap, v0.10.0 simplify) have stabilized the model layer; the blocker cited in PROJECT.md is no longer load-bearing.

## User Stories

### Story 1: Bulk cleanup of stale permission rules
**As** a developer auditing `.claude/settings.json` before committing
**I want** to select several `allow` rules at once and delete them
**So that** I don't click through 15 separate confirmation dialogs.

**Acceptance criteria:**
- Ctrl/Cmd+click and Shift+click extend the selection in the tree.
- With 2+ items selected, invoking Delete (context menu or keyboard) shows one confirmation listing the selected items.
- A single write per affected scope updates the config file.
- A summary notification reports `Deleted N items` or `Deleted N, failed M — see output`.

### Story 2: Moving env vars between scopes
**As** a user reorganizing env vars from project-shared to user scope
**I want** to select 5 env vars and move them in one action
**So that** the destination is picked once, not five times.

**Acceptance criteria:**
- All selected items must share a source scope; mixed-scope selections disable the Move action and surface a tooltip explaining why.
- Destination scope is chosen in one QuickPick; the same destination applies to all items.
- Conflicts (same key exists at destination) are reported per-item in the summary; the user chose resolution up front (skip conflicts vs overwrite).

### Story 3: Copying a curated set of rules to the user scope
**As** a user promoting a vetted set of project permissions to the global user scope
**I want** to select permissions and copy them in bulk
**So that** I establish a personal baseline without opening the file.

**Acceptance criteria:**
- Copy preserves the source; delete is not implied.
- Duplicate-at-destination rules are deduplicated (no-op for that item); reported in summary.

## Functional Requirements

### FR1: Enable multi-select on the TreeView
- Set `canSelectMany: true` on the TreeView options when registering the config view.
- Update `TreeView.selection` readers to handle arrays; `onDidChangeSelection` already delivers `readonly TreeItem[]`.

### FR2: Scope of multi-selectable node types
Multi-select applies only to **leaf data nodes**:
- PermissionRuleNode
- EnvVarNode
- McpServerNode
- SettingNode (scalar settings)
- PluginNode

**Explicitly out of multi-select:**
- Scope / Section / Group headers (never selectable as batch targets)
- HookEntryNode — inherits the existing exclusion from move/copy between scopes (`.claude/context/features.md:107`). Delete of hooks in multi-select is also deferred until hook-matcher batching is designed.
- SandboxPropertyNode — schema-defined keys, not freely deletable.

### FR3: Batch delete
- Activated when all selected nodes are of a deletable type (see FR2) and all are `.editable` (not `readOnly`).
- Single confirmation modal listing the first ~10 items and `+N more` if larger.
- Per-scope writes are coalesced: one `configWriter` call per affected scope.
- Read-only items in the selection (managed scope, deny rules depending on policy) are filtered out with a pre-confirm notice: "2 of 12 items cannot be deleted and will be skipped."

### FR4: Batch move
- Requires all selected items to share a source scope *and* node type (cannot move env vars and MCP servers together — different writer paths).
- One QuickPick for destination scope.
- One QuickPick for conflict policy: `Skip conflicts` (default) or `Overwrite`.
- Writes are coalesced: one write to source scope (removes), one to destination scope (adds).

### FR5: Batch copy
- Same grouping rules as move (FR4), but source scope is preserved.
- Same conflict policy.

### FR6: Context menu and command palette integration
- Context menu items appear when `view.selection.length > 1` via a `contextValue` suffix or a `when` clause using a context key `claudeConfig.multiSelectActive`.
- Keyboard: `Delete` / `Backspace` triggers batch delete when the tree view is focused.
- Command IDs:
  - `claudeConfig.deleteSelected`
  - `claudeConfig.moveSelected`
  - `claudeConfig.copySelected`

### FR7: Result reporting and failure policy (hybrid dry-run + commit)
- **Phase 1 — dry-run validation** (synchronous, no I/O writes):
  - For each selected item, evaluate: scope writability, node editability (`.readOnly` filter), schema validity of the resulting config, conflict status at destination (move/copy).
  - Classify each item as `ok`, `skipped` (read-only or managed), or `invalid` (would produce invalid config).
  - If any items are `invalid`, abort the batch and show a pre-commit dialog: `N of M items would produce invalid config. Fix selection and retry.` with a "Show Details" button. No writes occur.
  - `skipped` items do not abort; they are filtered out and reported in the final summary.
- **Phase 2 — commit**: the dry-run filtered set is applied via coalesced per-scope writes. Only I/O failures (disk errors, permission denied) can fail here; any such failure is reported per-scope in the summary but does not roll back already-committed scopes (per-scope atomicity is preserved by `configWriter`'s temp-file rename).
- **Summary notification**: a single toast `{action} N items. M skipped, K failed.` with a "Show Details" button that opens the Output channel with per-item lines (one line per `skipped` / `failed`, including the scope and reason).
- No per-item toast spam.

### FR8: Undo (optional, see Out of Scope)
- If technically trivial, a single "Undo" button on the success toast reverts the batch via a stored inverse operation. If not trivial in v1, omit — users retain file-level undo in the editor.

## Non-Functional Requirements

- **Performance**: A batch of 100 items must complete under 500 ms on a warm config load, excluding disk I/O wait. One write per scope, not per item.
- **Atomicity**: Per-scope writes are atomic (the existing `configWriter` already writes via temp-file rename). If scope A write succeeds and scope B write fails, the summary reports it and no partial state is written to B.
- **State**: No new persisted state. Selection is transient and owned by VS Code.
- **Accessibility**: Multi-select interactions use VS Code's native tree keyboard model (Shift+Arrow, Ctrl+Space). No custom keybindings.
- **Backward compatibility**: Single-selection commands continue to work unchanged. Batch commands are additive.

## Success Criteria

- Deleting 20 permission rules takes ≤ 2 user actions (select-range + confirm) instead of 20+.
- Zero regressions in single-item command flows (verified by existing command tests).
- 100-item batch delete completes in < 1 s on a reference config (400 rules across 3 scopes).
- Summary notification correctly distinguishes `deleted`, `skipped` (read-only), and `failed` (write error) counts in a manual test matrix covering mixed selections.
- Anti-feature entry in `.claude/context/features.md:102` is removed and the feature entry is added to features.md.

## Constraints & Assumptions

### Constraints
- VS Code `TreeView.selection` is the single source of truth; we don't track our own selection state.
- `configWriter` writes per-scope; the batch layer must group selected items by scope before calling it.
- The existing ESLint / TypeScript strict rules apply; no new runtime deps.

### Assumptions (flagged as decisions — please confirm or overturn)
1. **Partial-failure policy**: hybrid dry-run + commit (see FR7). Validation failures (schema-invalid results) abort the batch before any write; read-only / managed items are classified as `skipped` and filtered out; only I/O failures during commit can slip through, and they are reported per-scope without cross-scope rollback. Rationale: catches the common failure modes with zero risk of partial state, while avoiding a cross-scope transaction log for the rare I/O case.
2. **Conflict resolution is asked up front, once**: single `Skip / Overwrite` choice applies to the whole batch. Alternative: per-conflict prompt (rejected — defeats the batching win).
3. **Mixed node-type selection disables batch actions** rather than attempting per-type dispatch. Reduces code branches; the user splits the batch manually.
4. **Deny rules**: treated as regular rules for multi-select delete (no special protection beyond the existing single-item behavior). If the user confirms, they go.

## Out of Scope

- **Hook multiselect** — matcher/hooks hierarchy requires dedicated design; defer to a separate PRD.
- **Drag-and-drop** — remains excluded per `.claude/context/features.md:101`.
- **Inline rename/edit in batch** — multi-select edit of scalar values has no coherent UX; single-item edit remains the path.
- **Cross-scope atomic transactions** — writes remain per-scope atomic; a cross-scope commit protocol is not introduced.
- **Undo history beyond the single immediate Undo** in FR8 (if included).
- **Managed scope batch operations** — managed stays read-only.

## Dependencies

### Internal
- `src/tree/configTreeProvider.ts` — must register TreeView with `canSelectMany: true`.
- `src/commands/deleteCommands.ts`, `moveCommands.ts` — new `*Selected` entry points that iterate a `NodeContext[]` and coalesce writes per scope.
- `src/config/configWriter.ts` — likely unchanged; accepts a mutated config object per scope. May need a `writeMany` helper if multiple scopes are touched in parallel.
- `src/types.ts` — possibly a `BatchOperationResult` type for the summary.
- `package.json` — new command declarations, `when` clauses for batch menu items, context key `claudeConfig.multiSelectActive`.

### External
- VS Code API 1.56+ for `canSelectMany` — current engine target (verify in `package.json`) should already cover this.

### Documentation
- Update `.claude/context/features.md`: remove the multiselect anti-feature row, add a capability entry.
- Update `CHANGELOG.md` under the target milestone.
- Update `.claude/context/project-vision.md:84` (currently lists this as deferred).
