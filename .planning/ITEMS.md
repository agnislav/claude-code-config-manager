# Tree Items

Current state of all tree item types, their inline buttons, and context menu actions.
Edit this document to specify changes — additions, removals, icon swaps, reordering.

**Legend:** ~~strikethrough~~ = currently disabled (`&& false` in when clause)

---

## Toolbar (view/title)

| Position | Command | Icon | Condition |
|----------|---------|------|-----------|
| navigation@0 | lockUserScope | `$(unlock)` | User scope unlocked |
| navigation@0 | unlockUserScope | `$(lock)` | User scope locked |
| navigation@1 | filterSections | `$(filter)` | No active filter |
| navigation@1 | filterSections.active | `$(filter-filled)` | Filter active |
| navigation@2 | collapseAll | `$(collapse-all)` | Always |
| navigation@3 | expandAll | `$(expand-all)` | Always |

---

## Scope Nodes

### User Scope

No inline buttons. Lock/unlock is toolbar-level (see Toolbar section).

Context menu:
- Open Config File
- Create Config File (missing scope only)

### Other Scopes (Managed, Project Shared, Project Local)

No inline buttons.

Context menu:
- UPDATE: Open Config File (when exists only) 
- Create Config File (missing scope only)

---

## Sections & Items

### Permissions

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | addPermissionRule | `$(add)` | `.editable` only |

Context menu:
- UPDATE: Add Permission Rule (NOT IMPLEMENTED)

#### Permission Rule

Editable: `[changeType] [move] [copy] [delete]`

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | changePermissionType | `$(edit)` | `.editable` only |
| inline@1 | moveToScope | `$(arrow-swap)` | `.editable` only |
| inline@2 | copyPermissionToScope | `$(add)` | always |
| inline@3 | deleteItem | `$(trash)` | `.editable` only |

Context menu:
- Change Permission Type
- Delete
- Move to Scope

### Sandbox

No section-level buttons or context menu.

#### Sandbox Property

Editable: `[delete]` only

UPDATE: 

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | deleteItem | `$(trash)` | `.editable` only |

Context menu:
- Delete

**Missing:** moveToScope, copyToScope

### Hooks

Context menu:
- Add Hook (if editable only)

#### Hook Event

Context menu:
- Add Hook (if editable only)

#### Hook Entry

Editable: `[delete]`

UPDATE:

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | deleteItem | `$(trash)` | `.editable` only |

Context menu:
- Delete

**Note:** Hooks accumulate across scopes (no override). Move/copy needs different logic — array-indexed structs with matcher patterns.

### MCP Servers

Context menu:
- Add MCP Server

#### MCP Server

Editable: `[delete]`

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | deleteItem | `$(trash)` | `.editable` only |

Context menu:
- Delete

### Environment

Context menu:
- Add Environment Variable

#### Env Var

Editable: `[move] [delete]`

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | moveToScope | `$(arrow-swap)` | `.editable` only |
| inline@1 | copyToScope | `$(add)` | always |
| inline@2 | deleteItem | `$(trash)` | `.editable` only |

Context menu:
- Edit Value
- Delete
- Move to Scope

**Missing:** copyEnvToScope command

### Plugins

No section-level buttons or context menu.

#### Plugin

Editable: `[readme]`
Read-only: `[readme]`

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | openPluginReadme | `$(book)` | All |

No context menu.

### Settings

No section-level buttons or context menu.

#### Setting (scalar)

Editable: `[move] [copy] [delete]`

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | moveToScope | `$(arrow-swap)` | `.editable` only |
| inline@1 | copySettingToScope | `$(add)` | always |
| inline@2 | deleteItem | `$(trash)` | `.editable` only |

Context menu:
- Edit Value
- Move to Scope
- Copy to Scope
- Delete

#### Setting Key-Value (object child)

No inline buttons. No context menu.

---

## Click Behavior

- **Tree item click → editor**: Active — clicking a leaf node opens the config file and reveals the key
- **Editor → tree highlight**: Active — cursor position in a config file highlights the corresponding tree node (only when tree pane is already visible)
- **Editor → pane auto-activation**: Disabled — switching to a config file does NOT force-open the tree pane. TODO: REMOVE COMPLETELY

---

## Lock Behavior

- Move FROM locked User scope: **blocked** (destructive)
- Copy FROM locked User scope: **allowed** (non-destructive)
- Move/Copy TO locked User scope: **blocked** (target picker excludes locked)
- Edit/Delete in locked User scope: **blocked** (informative message)

---

## Planned Phases

- **EditValue**: Separate phase — inline edit for scalar values
- **Overridden entities**: Separate milestone — visual indicators + override management
- **Sort items**: Separate task

---
