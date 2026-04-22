# Feature Landscape

**Domain:** VS Code TreeView UX Audit for Config Manager Extension
**Researched:** 2026-03-11

## Table Stakes

Features users expect from every tree node type. Missing on any entity = inconsistency that erodes trust.

### Universal Node Behaviors (All 7 Entity Types)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Click navigates to JSON location | Every leaf node should reveal its source in the config file | Low | Currently implemented via `computeCommand()` for leaf nodes. Verify all entity types wire this up. |
| Tooltip shows useful context | Hovering any item should explain what it is, not just repeat the label | Low | Currently inconsistent: EnvVar has no base tooltip (only overlap), MCP Server has rich tooltip, Sandbox shows array items. |
| Description shows current value | The description field (gray text after label) should show the effective value or relevant metadata | Low | Currently inconsistent: HookEntry has empty string `''`, Sandbox shows value, EnvVar shows value. |
| Overlap detection and decoration | Every entity that can exist in multiple scopes must show overlap color and tooltip | Low | Implemented for 6 of 7 entity types. Hooks have NO overlap detection. |
| Context menu with all applicable actions | Right-click should offer every action the node supports (edit, delete, move, copy) | Low | Currently varies wildly per entity type. See Inconsistency Matrix below. |
| Delete action for editable items | Every user-created item should be deletable | Low | Missing inline delete for some entity types where context menu supports it. |
| Consistent icon dimming for overridden items | Overridden items should use `disabledForeground` ThemeColor uniformly | Low | Already consistent across entities that support overlap. |
| Item count on section headers | Section nodes should show "N items" in description | Low | Currently inconsistent: Sandbox shows empty string `''` while all others show counts. |

### Interaction Consistency

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Inline button set follows a predictable pattern | Users learn button positions; inconsistent button sets between entity types cause misclicks | Med | Currently the biggest inconsistency. See detailed matrix below. |
| Read-only nodes suppress all edit affordances | Managed scope and locked User scope should show zero inline buttons and no edit context menus | Low | Already handled via `.editable` / `.readOnly` contextValue pattern. Verify no leaks. |
| Destructive actions require confirmation | Delete should not silently remove items | Low | Needs audit: does `deleteItem` show confirmation for all entity types? |
| Add button on section headers | Every section that supports adding items should have an inline `$(add)` button | Low | Currently only Permissions, Environment, MCP Servers, Hooks sections have add buttons. Settings and Sandbox sections do not. |

## Inconsistency Matrix (Current State)

This is the core audit finding. Each cell shows what actions are available per entity type.

### Inline Buttons (visible on hover)

| Entity Type | Edit | Move | Copy | Delete | Type-Switch | Other |
|-------------|------|------|------|--------|-------------|-------|
| PermissionRule | - | inline@1 | inline@2 (copyPermission) | inline@3 | inline@0 (changeType) | - |
| EnvVar | disabled (`&& false`) | inline@0 | - | inline@3 | - | - |
| Setting | - | inline@0 | inline@1 (copySetting) | inline@3 | - | - |
| SettingKeyValue | - | - | - | - | - | No inline buttons at all |
| McpServer | - | - | - | inline@3 | - | - |
| Plugin | disabled (`&& false`) | disabled (`&& false`) | disabled (`&& false`) | disabled (`&& false`) | - | inline@0 (openReadme) |
| HookEntry | - | - | - | inline@3 | - | - |
| SandboxProperty | disabled (`&& false`) | - | - | inline@3 | - | - |

### Context Menu Actions

| Entity Type | Edit | Delete | Move | Copy | Type-Switch | Toggle |
|-------------|------|--------|------|------|-------------|--------|
| PermissionRule | - | Yes | Yes | - | Yes (changeType) | - |
| EnvVar | Yes | Yes | Yes | - | - | - |
| Setting | Yes (scalar only) | Yes | Yes | - | - | - |
| SettingKeyValue | - | - | - | - | - | - |
| McpServer | - | Yes | - | - | - | - |
| Plugin | - | Yes | Yes | - | - | Yes (toggle) |
| HookEntry | - | Yes | - | - | - | - |
| SandboxProperty | Yes | Yes | - | - | - | - |

### Key Inconsistencies Found

1. **EnvVar edit inline button is disabled** (`&& false` in when clause) but edit is available in context menu -- mismatch between inline and context affordances.
2. **SandboxProperty edit inline button is disabled** (`&& false`) but edit is available in context menu -- same mismatch.
3. **Plugin inline buttons are ALL disabled** with `&& false`. Only openReadme works inline. Context menu has toggle, delete, move.
4. **McpServer has no move/copy** in either inline or context menu. Cannot relocate MCP servers between scopes.
5. **HookEntry has no move/copy**. Cannot relocate hooks between scopes.
6. **SandboxProperty has no move/copy**. Cannot relocate sandbox config between scopes.
7. **SettingKeyValue has zero actions** -- no inline buttons, no context menu entries. Dead-end leaf node.
8. **Sandbox section header has no item count** (empty string) unlike all other sections.
9. **EnvVar has no base tooltip** -- only overlap tooltip when overlapping. Non-overlapping env vars show nothing on hover.
10. **HookEntry description is always empty string** -- wastes the description field that all other leaf entities use.
11. **Hooks have NO overlap detection** -- the only entity type without it. A hook defined in both User and Project scopes shows no visual indication.
12. **EnvVar has no copy-to-scope** but has move-to-scope. PermissionRule and Setting have both. Asymmetric.
13. **McpServer has no inline action buttons other than delete** -- the sparsest entity despite being complex config that users would want to relocate between scopes.

## Differentiators

Features that would make the UX audit milestone go beyond fixing inconsistencies into real polish.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Uniform inline button template per entity | Every leaf entity gets a predictable set: [primary-action@0, move@1, copy@2, delete@3] where applicable | Med | Requires deciding which actions each entity truly supports, then making it consistent. Core deliverable of the audit. |
| Hook overlap detection | Hooks are the only entity without overlap. Adding it completes the overlap model across all 7 types. | Med | Requires a new `resolveHookOverlap` function following the `resolveOverlapGeneric` pattern. |
| Section header "Add" button for Settings | Currently Settings section has no add button. Users could add arbitrary config keys. | Low | Requires new `addSetting` command with key name input + value type picker. |
| Tooltip on every entity (not just overlapping ones) | EnvVar with no overlap has no tooltip. Should show `KEY=VALUE` or similar contextual info. | Low | Small polish with outsized impact on discoverability. |
| SettingKeyValue actions (edit, delete) | Currently a dead-end node. Should at least support editing the child value and deleting the child key. | Med | Requires new contextValue pattern and extending editValue/deleteItem commands. |
| MCP Server move/copy between scopes | Extends scope operations to the most complex entity type. Users reorganizing their config need this. | Med | Requires extending moveToScope + new copyMcpToScope commands. MCP config lives in separate file -- adds complexity. |
| HookEntry description shows hook type | Description field currently empty. Should show "command", "prompt", or "agent" -- data already in VM. | Low | Trivial change in builder. |
| Sandbox section item count | Only section without a count. Should show "N properties". | Low | Trivial fix in `getSectionItemCount`. |
| EnvVar copy-to-scope | EnvVar supports move but not copy. Adding copy makes it consistent with permissions and settings. | Low | Mostly wiring -- follow the copyPermissionToScope/copySettingToScope pattern. |

## Anti-Features

Features to explicitly NOT build during this UX audit milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Deep-edit inline for complex values (objects, arrays) | JSON editing in a QuickPick is error-prone. Webview would be overengineering for a config tool. | Click to reveal in editor, edit JSON directly. Already works via revealInFile. |
| Drag-and-drop between scopes | VS Code TreeView DnD API is limited and finicky. Not worth the complexity. | Keep move/copy inline buttons and context menu. |
| Multiselect batch operations | Significant state management complexity. Deferred per PROJECT.md. | Single-item operations sufficient for a config manager. |
| Inline text editing (rename in place) | VS Code TreeView does not support inline text editing natively. Faking it is fragile. | Use QuickPick input boxes (already the pattern for editValue). |
| Sort controls in toolbar | Sorting adds toolbar clutter for minimal value with few items per section. Deferred per PROJECT.md. | Maintain deterministic insertion order (current approach). |
| "Add" button on Plugins section header | Plugins are discovered from registry, not manually typed. Adding arbitrary plugin IDs is error-prone. | Keep current model: plugins appear when installed, toggle via checkbox. |
| "Add" button on Sandbox section header | Sandbox properties are schema-defined, not arbitrary. Users should not add unknown sandbox keys. | Edit existing properties only. |
| Hook move/copy between scopes | Hooks have complex nested structure (matchers with sub-arrays). Moving individual hook entries between scopes requires reconstructing the matcher/hooks hierarchy in the target. | Defer to a future milestone. Users can copy JSON manually via revealInFile. |

## Feature Dependencies

```
Sandbox section item count (independent, trivial)
HookEntry description (independent, trivial)
EnvVar base tooltip (independent, trivial)

Enable disabled inline buttons:
  EnvVar edit inline --> remove `&& false` from when clause
  SandboxProperty edit inline --> remove `&& false` from when clause

Remove dead inline button registrations:
  Plugin move/copy/delete inline --> remove `&& false` entries entirely (keep openReadme only)

Hook overlap detection:
  --> new resolveHookOverlap function
  --> builder wires overlap into HookEntry/HookEvent VMs
  --> overlap tooltip + color decoration on hook entries

SettingKeyValue actions:
  --> new contextValue pattern for settingKeyValue.editable
  --> extend editValue command to handle settingKeyValue nodes
  --> extend deleteItem command to handle settingKeyValue nodes
  --> add inline button registrations for settingKeyValue

MCP Server move/copy:
  --> extend moveToScope to handle mcpServer nodes
  --> new copyMcpToScope command
  --> handle separate MCP config file (mcpFilePath vs filePath)

EnvVar copy-to-scope:
  --> new copyEnvToScope command
  --> inline button registration
```

## MVP Recommendation

Priority order for the UX audit milestone:

1. **Fix trivial inconsistencies first** (Sandbox count, HookEntry description, EnvVar tooltip) -- Three small changes that remove obvious gaps. Low risk, immediate payoff.
2. **Resolve disabled inline buttons** -- Either enable the `&& false` buttons that work (envVar edit, sandboxProperty edit) or remove dead registrations (plugin inline buttons). Cleans up package.json noise.
3. **Uniform inline button audit** -- Document the intentional pattern: which entities get which buttons and why. Create a consistency rule, then apply it. This is the core intellectual work of the milestone.
4. **Hook overlap detection** -- Completes the overlap model for all 7 entity types. Important for the "every entity type behaves the same" goal.
5. **SettingKeyValue basic actions** -- Make child key-value pairs editable and deletable. Currently a dead-end node which is unexpected.
6. **EnvVar copy-to-scope** -- Small addition that makes env vars consistent with permissions and settings.
7. **MCP Server move/copy** -- Extends scope operations to the remaining complex entity type. Defers hook move/copy (too complex).

Defer: Plugin inline buttons (checkbox/icon interaction), hook move/copy (complex nesting), Settings "add" button (scope creep).

## Sources

- Direct codebase analysis of `package.json` menu registrations (view/item/context section, lines 229-344)
- Direct codebase analysis of `src/viewmodel/builder.ts` (all entity builder methods, overlap wiring, description/tooltip computation)
- Direct codebase analysis of `src/viewmodel/types.ts` (BaseVM fields, per-type VM interfaces)
- Direct codebase analysis of `src/tree/nodes/*.ts` (node implementations, getChildren patterns)
- VS Code TreeView API: TreeItem properties (description, tooltip, contextValue, command, iconPath, checkboxState)
- VS Code `when` clause context: regex matching on contextValue for menu visibility
- PROJECT.md: validated requirements, key decisions, out-of-scope items
