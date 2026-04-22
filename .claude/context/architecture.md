# Architecture Patterns: v0.9.0 UX Audit Integration

**Domain:** UX Audit and Consistency Fixes for VS Code TreeView Extension
**Researched:** 2026-03-11
**Confidence:** HIGH (full codebase audit of builder.ts, all 13 node files, 6 command files, package.json menus, viewmodel types)

---

## Current Architecture Overview

```
ConfigStore (data)
  --> OverlapResolver (cross-scope analysis)
  --> TreeViewModelBuilder (all presentation logic)
  --> BaseVM trees (pre-computed display state)
  --> vmToNode factory (discriminates NodeKind -> Node constructor)
  --> ConfigTreeNode subclasses (thin wrappers, ~10 lines each)
  --> ConfigTreeProvider (caching, parent map, tree walk)
  --> VS Code TreeView UI
  --> package.json menus (contextValue-based visibility)
  --> Command handlers (user actions dispatched by keyPath)
```

### Layer Responsibilities

| Layer | File(s) | Owns |
|-------|---------|------|
| ViewModel Builder | `src/viewmodel/builder.ts` (1018 lines) | label, description, icon, contextValue, tooltip, overlap decoration, collapsibleState, command, resourceUri, checkboxState, children |
| VM Types | `src/viewmodel/types.ts` | BaseVM + 12 per-type VM interfaces, NodeKind enum |
| Node Factory | `src/tree/vmToNode.ts` | NodeKind -> Node constructor mapping |
| Node Subclasses | `src/tree/nodes/*.ts` (13 files) | `getChildren()` delegation, `nodeType` string |
| Base Node | `src/tree/nodes/baseNode.ts` | Abstract TreeItem, static `mapVM` reference |
| Tree Provider | `src/tree/configTreeProvider.ts` | Build roots, cache children, parent map, findNodeByKeyPath |
| Menu Visibility | `package.json` contributes.menus | `when` clauses matching contextValue regex patterns |
| Commands | `src/commands/*.ts` (6 files) | User interaction logic, write operations, validation |
| Overlap Resolver | `src/config/overlapResolver.ts` | 4-directional overlap detection per entity type |
| Decorations | `src/tree/overlapDecorations.ts`, `lockDecorations.ts`, `pluginNode.ts` | FileDecorationProvider for color-coding |

---

## Where UX Audit Fixes Should Land

### Decision Framework

The ViewModel builder is the **single source of truth** for all visual and behavioral properties. Node constructors are pass-through wrappers that call `super(vm)`. This means:

**Almost all UX fixes belong in `builder.ts`** -- that is where label, description, icon, tooltip, contextValue, collapsible state, command, and resourceUri are computed.

**Menu visibility fixes belong in `package.json`** -- `when` clause regex patterns control which inline buttons and context menu items appear on which node types.

**New capabilities belong in `src/commands/*.ts`** -- only when the audit identifies missing operations that need new command handlers.

### Fix Location Matrix

| UX Issue Category | Fix Location | Rationale |
|-------------------|-------------|-----------|
| Wrong/missing icon | `builder.ts` build*VM methods | Icons computed in builder, passed via BaseVM.icon |
| Missing/wrong description text | `builder.ts` | Description computed per entity type |
| Wrong tooltip content | `builder.ts` | Tooltip built in builder incl. overlap composition |
| Missing inline button | `package.json` menus | contextValue already set by builder; `when` clause controls visibility |
| Wrong inline button | `package.json` menus | Adjust `when` clause regex or group ordering |
| Missing context menu item | `package.json` menus | Add entry with appropriate `when` clause |
| Node not clickable (should be) | `builder.ts` | `computeCommand()` call missing or wrong collapsibleState |
| Node should be collapsible | `builder.ts` | Change collapsibleState in build*VM method |
| Missing overlap detection | `builder.ts` + `overlapResolver.ts` | Builder calls resolver; add resolver call if missing |
| Wrong contextValue (command fails) | `builder.ts` | contextValue from `computeStandardContextValue()` |
| New command needed | `src/commands/*.ts` + `package.json` + `extension.ts` | Full vertical slice |
| Section item count wrong | `builder.ts` (`getSectionItemCount`) | Count logic per section type |

### Changes That NEVER Touch Node Files

The 13 node files are structurally identical thin wrappers:

```typescript
export class FooNode extends ConfigTreeNode {
  readonly nodeType = 'foo';
  constructor(private readonly vm: FooVM) { super(vm); }
  getChildren(): ConfigTreeNode[] { return []; /* or vm.children.map(mapVM) */ }
}
```

There is **no reason to modify node files** for UX audit fixes. All visual properties flow through BaseVM -> ConfigTreeNode base constructor. The only node file with extra logic is `pluginNode.ts` (PluginDecorationProvider) -- a FileDecorationProvider, not a node concern.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `TreeViewModelBuilder` | Builds complete VM tree from ConfigStore data | ConfigStore (reads), OverlapResolver (calls), Constants (reads) |
| `ConfigTreeNode` (base) | Abstract TreeItem; holds static `mapVM` reference | vmToNode (static ref) |
| Node subclasses (13) | Type-specific `getChildren()`, `nodeType` string | VM children via `mapVM` |
| `vmToNode` | Factory: discriminates NodeKind -> Node constructor | All node classes |
| `ConfigTreeProvider` | TreeDataProvider; caching, parent map, tree walk | Builder (builds), vmToNode (roots) |
| `package.json` menus | Which commands appear on which nodes | contextValue strings from builder |
| Command handlers | Execute user actions on nodes | ConfigWriter, ConfigStore, NodeContext |
| OverlapResolver | 4-directional overlap info per entity | ScopedConfig data |
| FileDecorationProviders | Color-code via resourceUri schemes | overlap/lock/plugin URI schemes |

---

## Data Flow for UX Fixes

### Visual property change (icon, label, description, tooltip)

```
builder.ts: modify build*VM() method
  --> VM object carries new values
  --> baseNode constructor applies to TreeItem
  --> VS Code renders updated TreeItem
```

Single-file edit. No other files change.

### Inline button addition/removal

```
package.json: add/modify menu entry with `when` clause
  --> VS Code evaluates contextValue against regex
  --> Button appears/disappears
```

If contextValue pattern already exists (e.g., `permissionRule.editable`), only `package.json` changes. If new contextValue variant needed, also edit `builder.ts`.

### New command for existing node type

```
1. src/commands/fooCommands.ts: implement handler
2. package.json: register command + menu entry with `when` clause
3. src/extension.ts: call registerFooCommands() in activate()
```

Three-file change. Builder untouched if contextValue already supports it.

---

## Entity Type Audit Matrix

Current state of each entity type's UX capabilities, derived from `builder.ts` and `package.json`:

| Entity Type | Icon | Desc | Tooltip | Click | Overlap | Inline Buttons | Delete | Move | Copy | Add |
|-------------|------|------|---------|-------|---------|---------------|--------|------|------|-----|
| **PermissionRule** | type-aware | override suffix | overlap+cross-cat | yes | full | changeType@0, move@1, copy@2, delete@3 | yes | yes | yes | via section header |
| **Setting** | tools (dimmed) | value or empty | JSON+overlap | yes (leaf) | full | move@0, copy@1, delete@3 | yes | yes | yes | -- |
| **SettingKeyValue** | symbol-field | value | JSON+overlap | yes | inherits parent | -- | via parent regex | via parent | -- | -- |
| **EnvVar** | terminal (dimmed) | value+override | overlap | yes | full | move@0, delete@3 | yes | yes | -- | via section header |
| **Plugin** | check/slash (locked), checkbox (unlocked) | version+override | metadata+overlap | yes | full | readme@0 (move@1, copy@2, delete@3 all `&&false`) | `&&false` | `&&false` | `&&false` | -- |
| **McpServer** | plug (dimmed) | type:detail | detail+overlap | yes | full | delete@3 | yes | -- | -- | via section header |
| **SandboxProperty** | vm (dimmed) | value+override | array+overlap | yes | full | delete@3 (editValue `&&false`) | yes | -- | -- | -- |
| **HookEvent** | zap | hook count | -- | -- | -- (container) | -- | -- | -- | -- | yes (context) |
| **HookEntry** | type-aware | empty | command preview | yes | none | delete@3 | yes | -- | -- | -- |
| **ScopeNode** | scope-specific | path/"Not found" | scope desc | -- | -- | -- | -- | -- | -- | openFile/createFile |
| **SectionNode** | section-specific | item count | -- | -- | -- | add@0 (permissions only) | -- | -- | -- | context menu (env,mcp,hooks) |
| **WorkspaceFolder** | root-folder | -- | -- | -- | -- | -- | -- | -- | -- | -- |

### Key Inconsistencies Found

#### 1. Plugin inline buttons disabled with `&& false`

Plugin move@1, copy@2, delete@3 are declared in `package.json` but disabled with `&& false` guards. The commands exist in `pluginCommands.ts` (deletePlugin, copyPluginToScope) and `moveCommands.ts` (moveToScope handles plugins). These are functional code with dead menu entries.

**Fix location:** `package.json` -- remove `&& false` guards or remove entries entirely.

#### 2. EditValue inline button disabled for envVar and sandboxProperty

`editValue` inline@1 has `&& false` for envVar and sandboxProperty. The context menu edit works fine.

**Fix location:** `package.json` -- decide whether to enable or remove.

#### 3. Section header add buttons inconsistent

Only Permissions section has an inline add button (`addPermissionRule` at `inline@0`). Environment, MCP Servers, and Hooks have context menu add commands but no inline add button on the section header.

**Fix location:** `package.json` -- add inline@0 entries for `section.env.editable`, `section.mcpServers.editable`, `section.hooks.editable`.

#### 4. HookEntry has no overlap detection

Builder passes `overlap: {}` for both HookEvent and HookEntry. This is partially by design (hooks are array-based, identity matching is harder), but it means hook entries get no overlap tooltips or decorations even when the same hook exists in multiple scopes.

**Fix location:** `builder.ts` + `overlapResolver.ts` if overlap desired, or document as intentional.

#### 5. EnvVar missing copy command

Permissions and Settings have copy-to-scope inline buttons, but EnvVar only has move (no copy).

**Fix location:** `src/commands/moveCommands.ts` (add copyEnvToScope), `package.json` (add menu entry), possibly `src/extension.ts`.

#### 6. McpServer and SandboxProperty missing move commands

Both have delete but no move-to-scope capability. Settings, EnvVar, Permissions, and Plugins all support move.

**Fix location:** `moveCommands.ts` (extend moveToScope to handle these types -- it may already work via keyPath dispatch), `package.json` (add `when` clause entries).

#### 7. Sandbox section has no item count

`getSectionItemCount` returns empty string for Sandbox. All other sections show counts.

**Fix location:** `builder.ts` -- add count logic for Sandbox section.

#### 8. HookEntry description is always empty

HookEntry VMs have `description: ''`. Other leaf nodes show meaningful descriptions (values, types, etc.).

**Fix location:** `builder.ts` -- add type label or other relevant info to description.

#### 9. Setting edit inline button missing

Settings have move and copy inline buttons but no edit inline button, despite `editValue` being available in the context menu.

**Fix location:** `package.json` -- assess whether inline edit button adds value.

#### 10. SettingKeyValue has no inline buttons

Child nodes of object settings have no inline buttons at all. They appear in the generic delete regex but have no type-specific inline actions.

**Fix location:** `package.json` -- if edit/delete inline buttons desired, add entries.

---

## Patterns to Follow

### Pattern 1: Consistent Inline Button Template

**Standard inline button ordering for leaf entities (editable):**
```
@0: primary action (edit, changeType, or type-specific like readme)
@1: move-to-scope (if moveable)
@2: copy-to-scope (if copyable)
@3: delete
```

**Standard for section headers (editable):**
```
@0: add (create new child)
```

**Where to change:** `package.json` contributes.menus only (contextValue patterns already exist).

### Pattern 2: Overlap Integration Checklist

Every keyed entity in the builder follows this pattern:
```typescript
const overlap = resolve*Overlap(key, scopedConfig.scope, allScopes);
// 1. Icon dimming
icon: new ThemeIcon(name, overlap.isOverriddenBy ? dimColor : undefined)
// 2. Description suffix
description = applyOverrideSuffix(rawDescription, overlap)
// 3. Tooltip
tooltip = buildOverlapTooltip(baseTooltip, overlap)
// 4. ResourceUri
resourceUri = buildOverlapResourceUri(scope, entityType, key, overlap)
// 5. ContextValue
contextValue = computeStandardContextValue(nodeType, isReadOnly, overlap)
```

### Pattern 3: The `computeStandardContextValue` Contract

All entity nodes use `computeStandardContextValue()` which produces `{nodeType}.{editable|readOnly}[.overridden]`. Menu `when` clauses depend on this exact pattern. Never construct contextValue strings manually for entity nodes.

### Pattern 4: Generic deleteItem Dispatch

The `deleteItem` command handles all entity types through keyPath-based dispatch:
```typescript
if (rootKey === 'permissions' && keyPath.length === 3) { ... }
else if (rootKey === 'env' && keyPath.length === 2) { ... }
else if (rootKey === 'hooks' && keyPath.length >= 3) { ... }
// etc.
```

Follow this pattern for any new generic commands. Only create type-specific commands when the UX flow differs materially (e.g., `addMcpServer` has a multi-step wizard).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying Node Files for Visual Changes

**What:** Adding icon logic, tooltip computation, or description formatting to node constructors.
**Why bad:** Violates ViewModel boundary. Builder owns all presentation logic. Node files are intentionally thin.
**Instead:** All visual/behavioral changes in `builder.ts` build*VM methods.

### Anti-Pattern 2: Inline Buttons With `&& false` Guards

**What:** Declaring menu entries in `package.json` but permanently disabling them.
**Why bad:** Dead configuration creates confusion during audit. Maintenance burden.
**Instead:** Either enable the button or remove the entry. Track deferred items in PROJECT.md.

### Anti-Pattern 3: Per-Entity-Type Command Proliferation

**What:** Creating `claudeConfig.deleteMcpServer`, `claudeConfig.deleteEnvVar`, etc.
**Why bad:** The existing `deleteItem` command dispatches by keyPath. Type-specific variants fragment the command surface.
**Instead:** Use generic command with keyPath dispatch. Only create type-specific commands when UX flow genuinely differs.
**Exception:** `deletePlugin` exists separately as part of plugin inline button set. If plugin inline buttons are enabled, evaluate consolidation.

### Anti-Pattern 4: Inconsistent contextValue Patterns

**What:** Some nodes using custom contextValue strings outside the standard pattern.
**Why bad:** Makes `when` clause regex matching unpredictable.
**Instead:** Always use `computeStandardContextValue()` for entity nodes. Only scope and section nodes use custom patterns (which is correct -- they need scope-name and section-type segments).

---

## Recommended Audit and Fix Order

### Phase 1: Catalog (no code changes)

Build a complete actual-vs-expected matrix for all node types. Run the extension, manually verify each cell of the Entity Type Audit Matrix above. Document findings.

**Dependencies:** None. Pure analysis.

### Phase 2: package.json Menu Fixes (lowest risk)

Fix inline button and context menu inconsistencies:
1. Remove `&& false` guards (or the entries) for plugin move/copy/delete
2. Remove `&& false` guard for editValue inline on envVar/sandboxProperty (or remove entries)
3. Add inline add@0 buttons for section headers that have add commands (env, mcp, hooks)
4. Evaluate adding copy inline for EnvVar
5. Evaluate adding move inline for McpServer, SandboxProperty

**Dependencies:** Phase 1 catalog confirms which fixes are desired.
**Risk:** Zero runtime risk -- pure declarative JSON changes.

### Phase 3: builder.ts Visual Fixes (medium risk)

Fix presentation inconsistencies:
1. Add Sandbox section item count
2. Add HookEntry description content
3. Fix any tooltip/icon inconsistencies found in Phase 1
4. Evaluate hook overlap detection (may be intentionally omitted)

**Dependencies:** Phase 1 identifies what to fix. Existing tests in `test/suite/viewmodel/builder.test.ts` validate.
**Risk:** Low-medium. Builder changes affect tree rendering but are covered by tests.

### Phase 4: New Commands (highest risk, may not be needed)

If audit identifies truly missing capabilities:
1. EnvVar copy-to-scope (if desired)
2. MCP server move-to-scope (if desired)
3. Sandbox property move-to-scope (if desired)

Each requires: command handler + `package.json` entry + `extension.ts` registration.

**Dependencies:** Phases 1-3 complete. Phase 1 determines scope.
**Risk:** Medium. New commands need error handling, lock-awareness, scope filtering.

---

## Modified vs. New Components

### Files to Modify (no new files expected)

| File | Change Type | Expected Scope |
|------|------------|----------------|
| `package.json` | MODIFY | Add/remove/fix menu `when` clauses |
| `src/viewmodel/builder.ts` | MODIFY | Fix descriptions, tooltips, counts, icons |
| `src/commands/moveCommands.ts` | MODIFY (maybe) | Add copy commands for new entity types |
| `src/extension.ts` | MODIFY (maybe) | Register new commands if any |

### Files That Should NOT Change

| File | Reason |
|------|--------|
| `src/tree/nodes/*.ts` (all 13) | Thin wrappers; all visual logic in builder |
| `src/tree/vmToNode.ts` | Factory mapping; no new node types expected |
| `src/viewmodel/types.ts` | No new VM types expected for UX fixes |
| `src/tree/configTreeProvider.ts` | Tree provider logic unaffected by visual fixes |
| `src/config/overlapResolver.ts` | Overlap system already covers all keyed entities |

### New Files: None Expected

The UX audit is about consistency across existing entity types, not adding new capabilities. All fixes should land in existing files.

---

## Sources

- Direct codebase analysis of all source files:
  - `src/viewmodel/builder.ts` (1018 lines) -- complete build logic for all 12 node kinds
  - `src/viewmodel/types.ts` -- all VM interfaces
  - `src/tree/nodes/*.ts` (13 files) -- all node constructors
  - `src/tree/vmToNode.ts` -- factory mapping
  - `src/tree/configTreeProvider.ts` -- tree provider
  - `src/commands/*.ts` (6 files) -- all command handlers
  - `package.json` contributes.menus -- all 22 menu entries
  - `src/constants.ts` -- labels, icons, config keys
  - `src/types.ts` -- core type definitions
- Existing test suite: `test/suite/viewmodel/builder.test.ts`, `test/suite/config/overlapResolver.test.ts`
- VS Code Extension API TreeDataProvider, contextValue, `when` clause patterns (training data, HIGH confidence for stable API)
