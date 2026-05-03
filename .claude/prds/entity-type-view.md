---
name: entity-type-view
description: Add a second TreeView mode that groups by entity type (Permissions, Hooks, Env, MCP, Plugins, Settings) with scopes nested underneath, complementing the existing scope-first view
status: backlog
created: 2026-04-23T14:42:03Z
---

# PRD: entity-type-view

## Executive Summary

Today the config TreeView is strictly **scope-first**: the top-level nodes are the four scopes (Managed, User, Project Shared, Project Local), and each scope expands into its sections (Permissions, Hooks, Env Vars, MCP Servers, Plugins, Settings, Sandbox). This matches the mental model of *"which file am I editing."*

A different, equally valid mental model is **entity-first**: *"show me all permission rules across all scopes"* or *"show me every env var, from every config file, side by side."* This is how users think when auditing a specific kind of config — comparing an env var's value across User and Project, or finding every MCP server regardless of where it is declared.

This PRD adds a second view mode with the hierarchy **EntityType → Scope → Items**, toggleable from the existing `claudeConfigTree` view. Both modes operate on the same `ConfigStore` and reuse the same leaf node classes (`PermissionRuleNode`, `EnvVarNode`, etc.) — the only new code is a different *grouping* layer at the top two levels.

## Problem Statement

**What**: Comparing the same type of setting across scopes requires repeatedly expanding four different scope branches and hunting down the matching section in each.

**Why now**:
- The config surface has matured: override detection (`overrideResolver`) already computes per-entity cross-scope relationships — the data to drive an entity-first view is *already being computed*.
- Users report friction when auditing permissions or env vars: "I want to see every `Bash(*)` allow rule we have, period." In the current view this takes 4+ clicks and visual cross-referencing.
- Scope-first remains the right default for *editing* (you write to a specific file); entity-first is the right view for *auditing and overrides reasoning*. Both are valuable; today we force users to use the wrong one half the time.
- The tree builder was refactored in v0.6.0 (decouple-state-from-tree) and the VM→node layer now has a clean seam where alternate groupings can plug in.

## User Stories

### Story 1: Audit every permission rule across scopes
**As** a developer reviewing what commands Claude is permitted to run
**I want** to see all `allow`, `deny`, and `ask` rules grouped by entity type, with their scope shown as a sub-branch
**So that** I can spot redundant or conflicting rules without expanding four scope trees.

**Acceptance criteria:**
- Toggling to entity view shows `Permissions` as a top-level node.
- Expanding `Permissions` reveals the four scopes (only those that contain permissions — empty scopes are hidden or de-emphasized).
- Under each scope, the existing `Allow / Deny / Ask` groups render, identical to scope view.
- Override indicators (e.g., "overridden at User") remain correct.

### Story 2: Side-by-side env var value comparison
**As** a user debugging why an env var has a different value than expected
**I want** to expand a single `Environment` branch and see every scope's value for each var
**So that** I don't have to open two editor tabs to compare.

**Acceptance criteria:**
- Expanding `Environment` shows env var **keys** grouped at the second level (rather than scopes), with each key expanding to show its per-scope values.
- *(This is the alternative "key-first" sub-grouping — see FR2 decision.)*

### Story 3: Quick mode switch without losing my spot
**As** a user who just edited a rule in scope view
**I want** to toggle to entity view and return without losing scroll / expansion state
**So that** the two views feel like facets of the same data, not two separate tools.

**Acceptance criteria:**
- Mode toggle is a single click from the view toolbar.
- Switching modes preserves selection when the selected node's identity exists in both views.
- Expansion state is preserved per-mode (expanding `Permissions` in entity view does not auto-expand the `User` scope in scope view).

## Functional Requirements

### FR1: View packaging — single view with mode toggle (default) or two sibling views
*This is the core design decision, surfaced for your call.*

**Option A — single view, mode toggle (default recommendation):**
- Keep the existing `claudeConfigTree` view.
- Add a toolbar button `View: Scope | Entity` that flips a `viewMode` state on `ConfigTreeProvider`.
- Provider's `getChildren(undefined)` branches on `viewMode` to build either scope-roots or entity-roots.
- Pros: one activity bar icon, one selection model, one file watcher; users don't manage two views.
- Cons: only one view visible at a time.

**Option B — two views in the same container:**
- Register a second view `claudeConfigEntityTree` in the same `claude-config` container.
- Each view has its own provider instance backed by the shared `ConfigStore`.
- Pros: both visible at once, VS Code collapse / expand state is separate by design, no toggle mode.
- Cons: doubles the selection/context-menu surface, duplicates toolbar real estate, sidebar gets taller.

**Recommendation**: Option A. The mental models are alternatives, not complements — users rarely need both open at once, and the toolbar real estate is scarce.

### FR2: Entity-view hierarchy

Top-level (entity-type) nodes:
- **Permissions**
- **Environment**
- **MCP Servers**
- **Hooks**
- **Plugins**
- **Settings**
- **Sandbox**

Second-level sub-hierarchy:
- **Default: Scope-as-second-level.** Each entity type expands to the scopes that contain it. Under each scope, the existing structure continues (e.g., Permissions → Scope → Allow/Deny/Ask → Rule).
- **Alternative for Environment (Story 2): key-as-second-level.** Env var keys at the second level, scopes nested under each key. Reduces click-depth for the primary use case (value comparison).
- **Hooks**: event-as-second-level (SessionStart, PreToolUse, …) with scopes nested under each event — mirrors Environment's key-first pattern because hooks are keyed by event.

Rationale for mixed sub-hierarchy: pure consistency (always scope-second) is simpler but fights the grain of each entity type. Env vars and hooks have a natural "key"; permissions/MCP/plugins/settings are already scope-partitioned in the schema.

**Decision point**: accept mixed sub-hierarchy, or enforce uniform scope-second for v1?

### FR3: Empty-scope handling
- In entity view, scopes that contain no items of the current entity type are **hidden**, not shown as empty branches. Otherwise every entity type renders four empty-looking branches on a minimal config.
- Managed scope is hidden when empty even if present, matching the scope-view behavior when managed is not installed.

### FR4: Override indicators
- Override badges (`overridden at <scope>`) continue to use `overrideResolver` output unchanged.
- In entity view, the badge visually emphasizes *which scope overrides which* — this is the primary value of the view.
- No new override logic; this is a presentation-layer change.

### FR5: Context menus & commands
- All existing item-level commands (edit, delete, move, copy, open-file) work identically in entity view — they act on `NodeContext.scope` and `keyPath`, which are unaffected by grouping.
- Section-level "Add" commands (Add Permission, Add Env Var) need to pick a scope; in entity view, the "Add" action either prompts for scope (QuickPick) or is scoped to a selected sub-scope branch.

### FR6: Toggle persistence
- View mode persists across VS Code sessions via workspace state (`Memento`).
- Default on first install: scope view (current behavior).

### FR7: Keyboard & command palette
- Command `claudeConfig.toggleViewMode` is available in the command palette.
- Optional keybinding (not bound by default) for power users.

### FR8: Filter & search interaction
- The existing filter (`filterSections`) applies in both modes. In entity view, hiding a section via filter removes the corresponding top-level entity node.
- No new filter UI.

## Non-Functional Requirements

- **Performance**: entity view construction must not be slower than scope view by more than 10% on a reference config (400 permission rules, 30 env vars, 10 MCP servers). Both views operate on the same `ConfigStore` snapshot; the entity grouping is O(items) per entity type.
- **State separation**: expansion state is tracked per mode so switching back restores prior expansion. Selection attempts to follow the selected leaf across modes when identity allows.
- **Accessibility**: `accessibilityInformation` on each entity-type root matches the pattern used for scope roots (e.g., "Permissions — X rules across Y scopes").
- **Backward compatibility**: scope view is unchanged. No existing command IDs or context values change. Existing context-menu `when` clauses continue to match.
- **No new runtime deps**.

## Success Criteria

- Users can toggle between scope and entity view with one click from the view toolbar.
- In entity view, expanding `Permissions` and scanning all rules across scopes takes ≤ 3 clicks regardless of which scopes are present.
- Override badges in entity view correctly show cross-scope relationships in a manual test matrix covering: override present / absent, managed scope present / absent, empty intermediate scopes.
- No regressions: all existing scope-view command tests pass unchanged.
- `CHANGELOG.md` documents the new view mode under the target milestone.

## Constraints & Assumptions

### Constraints
- Single TreeView ID (`claudeConfigTree`) — if Option A is chosen, no new view registration; if Option B, a second view ID is added.
- Same `ConfigStore` and `overrideResolver` drive both modes. No duplicated data layer.
- VS Code `TreeView` does not support changing the root set without a full `_onDidChangeTreeData.fire(undefined)` — acceptable since mode toggles are user-initiated.
- The leaf node classes (PermissionRuleNode, EnvVarNode, …) remain unchanged. Only grouping nodes above them differ between modes.

### Assumptions (flagged as decisions — please confirm or overturn)
1. **View packaging (FR1)**: Option A (single view with toggle) unless you prefer B. This is the biggest architectural choice.
2. **Sub-hierarchy mixing (FR2)**: env vars and hooks get key-first sub-grouping; other entities get scope-first. Alternative is uniform scope-second for consistency.
3. **Default mode on first install**: scope view. Alternative: entity view, if the team considers it the more valuable default.
4. **Empty scope handling (FR3)**: hide empty scope branches in entity view. Alternative: always show all four for structural consistency.
5. **Add commands (FR5)**: prompt for scope when "Add" is invoked on an entity-type root. Alternative: disable Add at the entity-root level and require the user to navigate into a scope branch first.

## Out of Scope

- **Drag-and-drop between views** — remains excluded per `.claude/context/features.md:101`.
- **Custom grouping configs** — users cannot define their own top-level grouping (e.g., "group by tool family"). Future consideration.
- **Split-view both modes at once** — VS Code does not natively support this for a single view; not attempting.
- **Search-first / flat view** — a third mode (flat list across all scopes and types, filtered) is a separate PRD.
- **Webview-based view** — native TreeView only; no webview escape hatch.
- **Multi-root workspace faceting** — if multiple workspace folders are ever supported, entity view's scope axis may need a workspace dimension. Out of scope for v1.

## Dependencies

### Internal
- `src/tree/configTreeProvider.ts` — add `viewMode` state and branch `getChildren(undefined)`.
- `src/tree/vmToNode.ts` — new grouping builders: `buildEntityRoots()`, `buildScopesForEntity(entityType)`.
- `src/tree/nodes/` — likely two new node classes: `EntityTypeNode` (top-level in entity view) and possibly `EntityScopeNode` (scope-as-child, distinguish from the top-level `ScopeNode` to avoid context-value collisions). Reuse leaf nodes unchanged.
- `src/extension.ts` — register `claudeConfig.toggleViewMode` command; read/write `viewMode` from `context.workspaceState`.
- `package.json` — new command, toolbar button entry with `when` clause toggling its icon, contextual title updates.
- `src/constants.ts` — entity-type labels and icons.

### External
- No new VS Code API. All used APIs (`TreeDataProvider`, `TreeView.reveal`, workspace state) are current.

### Documentation
- Update `.claude/context/features.md` capability table.
- Update `.claude/context/project-vision.md` if entity-first view relates to any deferred item.
- `CHANGELOG.md` entry under target milestone.
- Screenshots in `README.md` for the new view mode (match existing screenshot style).
