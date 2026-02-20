# Button Inventory

Current state of all tree item types, their inline buttons, and context menu actions.
Edit this document to specify changes — additions, removals, icon swaps, reordering.

**Legend:** ~~strikethrough~~ = currently disabled (`&& false` in when clause)

---

## Toolbar (view/title)

| Position | Command | Icon | Condition |
|----------|---------|------|-----------|
| navigation@0 | filterSections | `$(filter)` | No active filter |
| navigation@0 | filterSections.active | `$(filter-filled)` | Filter active |

---

## Scope Nodes

### User Scope

| Position | Command | Icon | Condition |
|----------|---------|------|-----------|
| inline@0 | lockUserScope | `$(lock)` | Unlocked |
| inline@0 | unlockUserScope | `$(unlock)` | Locked |

Context menu: Open Config File

### Other Scopes (Managed, Project Shared, Project Local)

No inline buttons. Context menu: Open Config File.

---

## Item Types — Inline Buttons

### Permission Rule

Editable: `[move] [copy] [delete]`

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | moveToScope | `$(arrow-swap)` | `.editable` only |
| inline@1 | copyPermissionToScope | `$(add)` | `.editable` only |
| inline@2 | deleteItem | `$(trash)` | `.editable` only |

### Plugin

Editable: `[readme]` (others disabled)
Read-only: `[readme]`

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | openPluginReadme | `$(book)` | All (`.editable` + `.readOnly`) |
| ~~inline@1~~ | ~~moveToScope~~ | ~~`$(arrow-swap)`~~ | ~~disabled~~ |
| ~~inline@2~~ | ~~copyPluginToScope~~ | ~~`$(add)`~~ | ~~disabled~~ |
| ~~inline@3~~ | ~~deletePlugin~~ | ~~`$(trash)`~~ | ~~disabled~~ |

### Setting (scalar)

Editable: `[move] [copy] [delete]`

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | moveToScope | `$(arrow-swap)` | `.editable` only |
| inline@1 | copySettingToScope | `$(add)` | `.editable` only |
| inline@2 | deleteItem | `$(trash)` | `.editable` only |

### Env Var

Editable: `[move] [delete]`

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@0 | moveToScope | `$(arrow-swap)` | `.editable` only |
| ~~inline@1~~ | ~~editValue~~ | ~~`$(edit)`~~ | ~~disabled (separate phase)~~ |
| inline@2 | deleteItem | `$(trash)` | `.editable` only |

**Missing:** copyEnvToScope command (needs new handler; override logic same as permissions)

### Sandbox Property

Editable: `[delete]` only

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| ~~inline@1~~ | ~~editValue~~ | ~~`$(edit)`~~ | ~~disabled (separate phase)~~ |
| inline@2 | deleteItem | `$(trash)` | `.editable` only |

**Missing:** moveToScope (needs `removeSandboxProperty` writer + handler branch), copyToScope (needs new command). Override logic IS the same as permissions/settings.

### Hook Entry

Editable: `[delete]`

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@2 | deleteItem | `$(trash)` | `.editable` only |

**Note:** Hooks accumulate across scopes (no override). Move/copy needs different logic than permissions/settings — array-indexed structs with matcher patterns.

### MCP Server

Editable: `[delete]`

| Position | Command | Icon | Visibility |
|----------|---------|------|------------|
| inline@2 | deleteItem | `$(trash)` | `.editable` only |

---

## Click Behavior

- **Tree item click → editor**: Active — clicking a leaf node opens the config file and reveals the key
- **Editor → tree highlight**: Active — cursor position in a config file highlights the corresponding tree node (only when tree pane is already visible)
- **Editor → pane auto-activation**: Disabled — switching to a config file does NOT force-open the tree pane

---

## Context Menu Actions (right-click)

| Group | Command | Applies To |
|-------|---------|------------|
| 1_edit | editValue | setting, envVar, sandboxProperty |
| 1_edit | deleteItem | permissionRule, envVar, hookEntry, mcpServer, plugin, setting, sandboxProperty |
| 1_edit | togglePlugin | plugin |
| 2_move | moveToScope | permissionRule, envVar, plugin, setting |
| 3_add | addPermissionRule | permissionGroup |
| 3_add | addEnvVar | section.env |
| 3_add | addMcpServer | section.mcpServers |
| 3_add | addHook | section.hooks, hookEvent |
| navigation | openFile | scope |
| navigation | createConfigFile | scope (missing only) |

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
