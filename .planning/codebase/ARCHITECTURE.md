# Architecture — Claude Code Config Manager

## Overview

Claude Code Config Manager is a VS Code extension that provides a visual TreeView interface for viewing and editing Claude Code configuration files. It implements a **scope-aware, multi-layered architecture** with clear separation between data discovery, loading, modeling, presentation, and persistence layers.

The extension manages four configuration scopes (Managed, User, Project Shared, Project Local) with precedence-based override resolution and bidirectional editor-tree synchronization.

---

## Architectural Layers

### Layer 1: Config Discovery
**Entry**: `src/config/configDiscovery.ts`

Discovers paths to configuration files across scopes without reading them:
- **Managed scope**: OS-specific paths (`/Library/Application Support/ClaudeCode/` on macOS, `/etc/claude-code/` on Linux)
- **User scope**: `~/.claude/settings.json` (global)
- **Project scopes**: `.claude/settings.json` and `.claude/settings.local.json` in workspace root
- **MCP config**: `mcp.json` in project root (separate from main config)

**Key exports**:
- `discoverConfigPaths(): DiscoveredPaths[]` — Returns discovered file paths for all scopes and workspace folders (single-root and multi-root support)
- `getAllWatchPaths(discovered: DiscoveredPaths[]): string[]` — Returns all paths that should be file-watched

**Design**: Uses `vscode.workspace.workspaceFolders` to support multi-root workspaces. Returns both absolute paths and existence flags. No file I/O or parsing.

---

### Layer 2: Config Loading
**Entry**: `src/config/configLoader.ts`

Reads and parses JSON configuration files:
- `loadConfigFile(filePath: string): ParseResult<ClaudeCodeConfig>` — Loads main config
- `loadMcpFile(filePath: string): ParseResult<McpConfig>` — Loads MCP servers config

Uses `readJsonFile()` utility which returns `{ data, error }` pairs for safe error handling. Missing or malformed files return empty configs rather than throwing.

**Design**: Thin wrapper around `src/utils/json.ts`. Preserves errors for diagnostics without halting startup.

---

### Layer 3: In-Memory Model (ConfigStore)
**Entry**: `src/config/configModel.ts`

The single source of truth for loaded configuration state:

```typescript
class ConfigStore {
  private configs = new Map<string, ScopedConfig[]>();

  reload(workspaceFolderUri?: string): void
  getScopedConfig(scope: ConfigScope, workspaceFolderUri?: string): ScopedConfig
  getAllScopes(workspaceFolderUri?: string): ScopedConfig[]
  getWorkspaceFolderKeys(): string[]
  findScopeByFilePath(filePath: string): { scopedConfig, workspaceFolderKey }
  isMultiRoot(): boolean

  onDidChange: vscode.Event<string | undefined>  // Fires on reload
}
```

**Data structure**:
- Maps workspace folder URI → array of 4 `ScopedConfig` objects (Managed, User, ProjectShared, ProjectLocal)
- Each `ScopedConfig` holds:
  - `scope`: which tier this config belongs to
  - `filePath`: where it was loaded from (undefined if not discovered)
  - `fileExists`: whether the file exists on disk
  - `config`: parsed `ClaudeCodeConfig` object
  - `mcpConfig`: optional parsed MCP config (ProjectShared only)
  - `isReadOnly`: true for Managed scope

**Key operations**:
- `reload()`: Full or partial reload—rediscover paths, reparse files, fire change event
- Single change event is emitted after all scopes for a folder are loaded
- Supports multi-root by keying on workspace folder URI

**Design**: Implements `vscode.Disposable` for cleanup. EventEmitter owned by ConfigStore to centralize change notification.

---

### Layer 4: Override Resolution
**Entry**: `src/config/overrideResolver.ts`

Computes effective values and override metadata for each config item using scope precedence:

**Precedence order (highest → lowest)**:
1. Managed (read-only)
2. Project Local
3. Project Shared
4. User

**Key functions**:

- `resolveScalarOverride(key, currentScope, allScopes): ResolvedValue` — Computes effective value for top-level scalar settings (e.g., `model`, `language`)
- `resolvePermissionOverride(category, rule, currentScope, allScopes): { isOverridden, overriddenByScope, overriddenByCategory }` — Detects if a permission rule is shadowed by a conflicting rule in a higher-precedence scope
- `resolveEnvOverride(envKey, currentScope, allScopes)` — Checks if environment variable is redefined in higher scope
- `resolveSandboxOverride(sandboxKey, currentScope, allScopes)` — Checks if sandbox property is redefined (supports nested keys like `network.allowedDomains`)
- `resolvePluginOverride(pluginId, currentScope, allScopes)` — Checks if plugin is enabled in higher scope

**Return type**: `ResolvedValue<T>` with:
- `effectiveValue`: the winning value
- `definedInScope`: which scope owns it
- `isOverridden`: boolean flag
- `overriddenByScope`: scope that overrides (if true)

**Design**: Stateless—resolver called on-demand during tree building. No caching; computed fresh each time for consistency.

---

### Layer 5: Tree View Presentation
**Entry**: `src/tree/configTreeProvider.ts` + `src/tree/nodes/*.ts`

Implements `vscode.TreeDataProvider<ConfigTreeNode>` and manages the TreeView hierarchy:

#### ConfigTreeProvider
- Caches parent and children relationships to support `reveal()` operations
- Implements section filtering (visible/hidden sections via context keys)
- Provides `findNodeByKeyPath()` for editor-to-tree synchronization
- Implements `getChildren()` with multi-root workspace folder grouping

**Key methods**:
- `getChildren(element?: ConfigTreeNode): ConfigTreeNode[]` — Returns children with caching
- `findNodeByKeyPath(scope, keyPath, workspaceFolderKey): ConfigTreeNode?` — Walks tree to find node matching a JSON path (used for editor sync)
- `toggleSectionFilter(section: SectionType)` — Shows/hides sections and updates context keys
- `refresh()` — Clears caches and fires `onDidChangeTreeData`

#### Node Hierarchy

All nodes extend `ConfigTreeNode` (abstract base):

```
ConfigTreeNode (extends vscode.TreeItem)
├── ScopeNode (Managed / User / Project Shared / Project Local)
│   └── SectionNode (Permissions / Sandbox / Hooks / MCP / Env / Plugins / Settings)
│       ├── PermissionGroupNode (Allow / Deny / Ask)
│       │   └── PermissionRuleNode (scalar, editable)
│       ├── HookEventNode (SessionStart, PreToolUse, etc.)
│       │   └── HookEntryNode (scalar, editable)
│       ├── EnvVarNode (scalar, editable)
│       ├── McpServerNode (expandable)
│       │   └── (properties as scalars or nested nodes)
│       ├── PluginNode (checkbox, toggleable)
│       ├── SandboxPropertyNode (scalar or expandable)
│       └── SettingNode (scalar, editable)
└── WorkspaceFolderNode (multi-root only, virtual grouping)
    └── ScopeNode (children of folder)
```

#### ConfigTreeNode Base Class

All nodes inherit common functionality:

```typescript
abstract class ConfigTreeNode extends vscode.TreeItem {
  abstract nodeType: string
  nodeContext: NodeContext  // scope, section, keyPath, isReadOnly, isOverridden, etc.

  protected finalize(): void  // Called at end of subclass constructor
  protected computeId(): string
  protected computeContextValue(): string  // Format: {nodeType}.{editable|readOnly}[.overridden]
  protected computeTooltip(): string | MarkdownString
  protected applyOverrideStyle(): void  // Adds description hint
  protected applyClickCommand(): void  // Registers click→reveal in file

  abstract getChildren(): ConfigTreeNode[]
}
```

**Design patterns**:
- Each node type in its own file (`src/tree/nodes/{name}Node.ts`)
- `computeContextValue()` determines menu visibility via `when` clauses in `package.json`
- Override information attached to `NodeContext` and visualized via description + tooltip
- Leaf nodes (rules, env vars, settings) use `collapsibleState.None` to prevent expansion
- Internal nodes (scope, section, group) use `collapsibleState.Collapsed` to allow lazy expansion

---

### Layer 6: Persistence Layer
**Entry**: `src/config/configWriter.ts`

Writes configuration changes back to disk:

**Grouped by section**:
- `addPermissionRule(filePath, category, rule)` / `removePermissionRule(...)`
- `setEnvVar(filePath, key, value)` / `deleteEnvVar(...)`
- `addHook(filePath, eventType, matcher)` / `deleteHook(...)`
- `addMcpServer(filePath, serverId, config)` / `removeMcpServer(...)`
- `setPluginEnabled(filePath, pluginId, enabled)`
- `setSetting(filePath, key, value)`
- `setSandboxProperty(filePath, key, value)` / `deleteSandboxProperty(...)`

**Design**:
- All writers are **pure functions**—no event emission or reload logic
- `loadOrCreate<T>(filePath)` pattern: reads existing file or returns empty object
- `ensureDir()` creates parent directories on first write
- `writeJsonFile()` handles formatting (pretty-printed JSON)
- Writers throw errors if file parse fails; callers handle via try-catch in commands
- **File watch integration**: OS file watcher detects changes → triggers `ConfigStore.reload()` → fires `onDidChange` → triggers tree refresh

---

### Layer 7: Commands (Editor Integration)
**Entry**: `src/commands/*.ts` (registered in `src/extension.ts`)

Commands are grouped by operation type:

#### Add Commands (`addCommands.ts`)
- `claudeConfig.addPermissionRule` → Opens input dialog → writes config
- `claudeConfig.addEnvironmentVariable` → Input dialogs → writes config
- `claudeConfig.addHook` → Guided input → writes config
- `claudeConfig.addMcpServer` → Input dialogs or JSON paste → writes config
- Context menus appear on SectionNodes via `when` clauses

#### Edit Commands (`editCommands.ts`)
- `claudeConfig.editScalarValue` → Input dialog → updates setting
- `claudeConfig.toggleBoolean` → Flips boolean value
- Available on SettingNodes, EnvVarNodes, etc.

#### Delete Commands (`deleteCommands.ts`)
- `claudeConfig.deletePermissionRule`
- `claudeConfig.deleteEnvironmentVariable`
- `claudeConfig.deleteSandboxProperty`
- `claudeConfig.deleteHook`
- `claudeConfig.deletePlugin`

#### Move Commands (`moveCommands.ts`)
- `claudeConfig.movePermissionRule` → Moves rule from one category (Allow/Deny) to another
- `claudeConfig.moveToProjectLocal` / `moveToProjectShared` → Copies setting to different scope
- Implements multi-step dialogs for complex operations

#### Plugin Commands (`pluginCommands.ts`)
- `claudeConfig.togglePlugin` → Checkbox state handler
- `claudeConfig.toggleAllPlugins` → Batch operations
- Handles plugin metadata lookup and visual feedback

#### Open File Commands (`openFileCommands.ts`)
- `claudeConfig.revealInFile` → Opens config file and reveals JSON location
- `claudeConfig.openConfigFile` → Quick pick to select and open any scope file
- Uses `jsonLocation.ts` to compute line numbers from keyPath

---

## Data Flow Diagrams

### Read Path (Startup & Manual Refresh)

```
activate() [extension.ts]
  ↓
ConfigStore.reload()
  ↓
  1. discoverConfigPaths() → DiscoveredPaths[]
  ↓
  2. For each scope:
       loadConfigFile(path) → ClaudeCodeConfig
       loadMcpFile(path) → McpConfig
  ↓
  3. Build ScopedConfig[] for each workspace folder
  ↓
  4. Store in configs: Map<workspaceKey, ScopedConfig[]>
  ↓
  5. Emit onDidChange(workspaceKey?)
  ↓
ConfigTreeProvider.refresh()
  ↓
  Clear caches, fire onDidChangeTreeData
  ↓
VS Code TreeView re-renders
  ↓
For each visible node:
  1. ConfigTreeProvider.getChildren(node)
  2. Node.getChildren() → creates child nodes
  3. overrideResolver.resolve*() called during node construction
  4. NodeContext populated with isOverridden, overriddenByScope
  5. computeContextValue() → determines menu visibility
```

### Write Path (User Edits)

```
User clicks menu item / presses key binding
  ↓
Command handler invoked (e.g., claudeConfig.addPermissionRule)
  ↓
  1. Show input dialog (if needed)
  2. configWriter.addPermissionRule(filePath, ...)
       └─ loadOrCreate() → parse existing file
       └─ modify in-memory object
       └─ writeJsonFile() → pretty-print to disk
  ↓
File system change detected by OS watcher
  ↓
ConfigFileWatcher detects change
  ↓
ConfigStore.reload(workspaceFolderUri)
  ↓
  Re-discover, re-parse, emit onDidChange
  ↓
ConfigTreeProvider.refresh()
  ↓
VS Code TreeView updates
```

### Editor ↔ Tree Synchronization

```
User edits config file in editor:
  ↓
onDidChangeActiveTextEditor() / onDidChangeTextEditorSelection()
  ↓
(debounced 150ms)
  ↓
syncEditorToTree(editor)
  ↓
  1. Find scope by filePath using configStore.findScopeByFilePath()
  2. findKeyPathAtLine(filePath, cursorLine) → keyPath[]
  3. treeProvider.findNodeByKeyPath(scope, keyPath, workspaceFolderKey)
  4. treeView.reveal(node, { select: true, focus: false, expand: true })
  ↓
User clicks tree node:
  ↓
onDidChangeSelection()
  ↓
(skip if suppressEditorSync is true, set 500ms timeout)
  ↓
If node has command, execute it (claudeConfig.revealInFile)
  ↓
  1. openFileCommands.ts finds config file
  2. Uses jsonLocation.findKeyPathLine() to locate line
  3. Opens editor and reveals line range
  4. Set suppressEditorSync = true (500ms)
```

### Validation & Diagnostics

```
ConfigStore.reload() completes
  ↓
onDidChange event fires
  ↓
runDiagnostics() in extension.ts
  ↓
  Collects all config file paths from all scopes
  ↓
ConfigDiagnostics.validateFiles(filePaths)
  ↓
  For each file:
    1. Read source text (for line numbers)
    2. validateConfig(parsed, sourceText) → ValidationIssue[]
    3. Errors → DiagnosticCollection with range + message
    4. VS Code displays squiggles + problems panel
```

---

## Key Abstractions & Patterns

### 1. NodeContext
Every tree node carries a `NodeContext` object:

```typescript
interface NodeContext {
  scope: ConfigScope
  section?: SectionType
  keyPath: string[]  // Path to this item in config JSON
  isReadOnly: boolean
  isOverridden: boolean
  overriddenByScope?: ConfigScope
  workspaceFolderUri?: string
  filePath?: string  // Path to config file containing this item
}
```

**Purpose**: Provides enough information for commands to locate and modify the config file, and allows tree-to-file mapping.

**Convention**: keyPath always matches the JSON structure. For arrays (e.g., permission rules), indices are included: `['permissions', 'allow', 0]` for first allowed rule.

### 2. ResolvedValue
Generic wrapper for override metadata:

```typescript
interface ResolvedValue<T = unknown> {
  effectiveValue: T
  definedInScope: ConfigScope
  isOverridden: boolean
  overriddenByScope?: ConfigScope
}
```

**Usage**: Computed during tree node construction. Determines whether item gets marked as overridden in UI.

### 3. Scope Precedence
Defined in `src/types.ts`:

```typescript
export const SCOPE_PRECEDENCE: ConfigScope[] = [
  ConfigScope.Managed,      // 0: highest
  ConfigScope.ProjectLocal,
  ConfigScope.ProjectShared,
  ConfigScope.User,         // 3: lowest
]
```

Used throughout override resolution. Lower index = wins.

### 4. ScopedConfig
Represents a single loaded config across all information needed:

```typescript
interface ScopedConfig {
  scope: ConfigScope
  filePath: string | undefined
  fileExists: boolean
  config: ClaudeCodeConfig
  mcpConfig?: McpConfig
  mcpFilePath?: string
  isReadOnly: boolean
}
```

**Design**: Stores both success state (config, mcpConfig) and metadata (filePath, fileExists, isReadOnly) in one object for easy passing around.

### 5. TreeItem contextValue Pattern
Used for context menu visibility:

```
Format: {nodeType}.{editable|readOnly}[.overridden][.missing]
Example: permissionRule.editable.overridden
         setting.readOnly
         scope.editable.missing
```

In `package.json`, menu visibility uses `when` clauses with regex:
```json
"when": "view == claudeConfigTree && viewItem =~ /^setting\\.(editable|readOnly)/"
```

---

## Extension Entry Point

`src/extension.ts` orchestrates the entire startup:

1. Create `ConfigStore` and call `reload()` to load all scopes
2. Create `ConfigTreeProvider` and register with VS Code
3. Create `ConfigDiagnostics` and run initial validation
4. Register all command handlers (add, edit, delete, move, open, plugin)
5. Set up `ConfigFileWatcher` for auto-refresh on external changes
6. Set up bidirectional editor↔tree sync with debouncing
7. Register `PluginDecorationProvider` for visual feedback
8. Push all disposables to context.subscriptions

---

## Key Design Decisions

### Why ConfigStore instead of direct file reads?
- **Centralized state**: Single source of truth for all loaded config
- **Caching**: Reused across tree builds and commands
- **Change notification**: All mutations trigger reload → change event → tree refresh
- **Multi-root support**: Keyed by workspace folder URI
- **Testability**: Can be mocked in tests

### Why separate override resolver from tree building?
- **Reusability**: Used in multiple contexts (tree nodes, diagnostics, commands)
- **Performance**: Computed fresh on each tree build (no stale data)
- **Clarity**: Override logic isolated from presentation logic

### Why tree nodes in separate files?
- **Single Responsibility**: Each node type owns its rendering logic
- **Maintainability**: Changes to PermissionRuleNode don't affect SectionNode
- **Scalability**: Easy to add new node types without cluttering one mega-file

### Why editor↔tree sync with debouncing?
- **Performance**: Prevents thrashing on rapid edits
- **UX**: Smooth reveal without jitter
- **Suppression flags**: Prevent infinite loops when sync is bidirectional

### Why ConfigWriter as pure functions?
- **Testability**: No side effects; easy to test with mocks
- **Simplicity**: No need to manage file watcher state or reload logic
- **Composition**: Commands can chain writes if needed

---

## Dependency Graph

```
extension.ts
  ├─ ConfigStore (configModel.ts)
  │  ├─ discoverConfigPaths (configDiscovery.ts)
  │  ├─ loadConfigFile, loadMcpFile (configLoader.ts)
  │  │  └─ readJsonFile (utils/json.ts)
  │  └─ buildScopedConfigs (internal)
  │
  ├─ ConfigTreeProvider (configTreeProvider.ts)
  │  ├─ ScopeNode, SectionNode, ...all node types
  │  │  ├─ overrideResolver.ts (all variants)
  │  │  ├─ constants.ts (icons, labels)
  │  │  └─ types.ts
  │  └─ NodeContext (types.ts)
  │
  ├─ ConfigDiagnostics (validation/diagnostics.ts)
  │  ├─ validateConfig (validation/schemaValidator.ts)
  │  └─ readJsonFile (utils/json.ts)
  │
  ├─ Commands (all command modules)
  │  ├─ configWriter.ts (mutations)
  │  ├─ constants.ts
  │  └─ utils/* (permissions, platform, jsonLocation, etc.)
  │
  ├─ ConfigFileWatcher (watchers/fileWatcher.ts)
  │  ├─ getAllWatchPaths (configDiscovery.ts)
  │  └─ ConfigStore.reload()
  │
  └─ PluginDecorationProvider (tree/nodes/pluginNode.ts)
```

---

## Summary

The architecture implements **layered separation of concerns**:
- **Discovery**: Find config files (no I/O)
- **Loading**: Parse files (error-tolerant)
- **Modeling**: Store in-memory state with change events
- **Resolution**: Compute effective values with override metadata
- **Presentation**: Build hierarchical tree from model
- **Persistence**: Write changes back to disk
- **Commands**: Integrate all layers for user actions
- **Sync**: Keep editor and tree in sync

This layering enables **testability**, **maintainability**, and **extensibility** while keeping the codebase **organized and predictable**.
