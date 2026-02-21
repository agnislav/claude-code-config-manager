# ARCHITECTURE.md — Claude Code Config Manager

## Overview

**Claude Code Config Manager** is a VS Code extension that provides a visual config viewer and editor for Claude Code settings. The architecture follows a **layered pattern** with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│      VS Code Extension UI Layer         │
│  (TreeView, Commands, Editors, Pickers) │
└─────────────────────────────────────────┘
                  ▲  │
                  │  ▼
┌─────────────────────────────────────────┐
│      Tree Provider Layer                 │
│ (ConfigTreeProvider, Node Classes)       │
└─────────────────────────────────────────┘
                  ▲  │
                  │  ▼
┌─────────────────────────────────────────┐
│      Config Model Layer                  │
│ (ConfigStore, Loader, Writer, Resolver) │
└─────────────────────────────────────────┘
                  ▲  │
                  │  ▼
┌─────────────────────────────────────────┐
│      File System Layer                   │
│  (Discovery, Reading, Writing, Watching) │
└─────────────────────────────────────────┘
```

---

## Core Architectural Layers

### 1. Entry Point: `src/extension.ts`

The extension activation function orchestrates all components:

```typescript
export function activate(context: vscode.ExtensionContext): void {
  // 1. Create config store and load all scopes
  const configStore = new ConfigStore();
  configStore.reload();

  // 2. Create tree provider
  const treeProvider = new ConfigTreeProvider(configStore);

  // 3. Register tree view
  const treeView = vscode.window.createTreeView('claudeConfigTree', {
    treeDataProvider: treeProvider,
  });

  // 4. Set up validation, commands, watchers
  // 5. Handle editor ↔ tree sync
  // 6. Register decorations and disposables
}
```

**Key Responsibilities:**
- Instantiate and initialize all components in correct dependency order
- Register all commands and event handlers
- Coordinate bidirectional editor ↔ tree sync with debouncing
- Lock User scope by default for safety
- Track in-flight writes during deactivation

---

### 2. Config Model Layer: `src/config/`

This is the heart of the architecture — the in-memory model that keeps all config state.

#### `ConfigStore` (State Management)
**File:** `src/config/configModel.ts`

Central state container with event emission:

```typescript
export class ConfigStore implements vscode.Disposable {
  private configs = new Map<string, ScopedConfig[]>();
  private discoveredPaths = new Map<string, DiscoveredPaths>();
  private _lockedScopes = new Set<ConfigScope>();

  readonly onDidChange = new vscode.EventEmitter<string | undefined>().event;

  reload(workspaceFolderUri?: string): void { }
  getScopedConfig(scope: ConfigScope): ScopedConfig | undefined { }
  getAllScopes(workspaceFolderUri?: string): ScopedConfig[] { }
  lockScope(scope: ConfigScope): void { }
  isScopeLocked(scope: ConfigScope): boolean { }
}
```

**Responsibilities:**
- Stores all scoped configs keyed by workspace folder
- Multi-root workspace support (global key `__global__` for no-workspace case)
- Full reload or per-workspace reload capability
- Scope locking state for UI safety (User scope locked by default)
- Emits `onDidChange` events that trigger tree refreshes and diagnostics

**Data Structure:**
- `configs`: `Map<workspaceFolderKey, ScopedConfig[]>` — all four scopes per workspace
- `discoveredPaths`: `Map<workspaceFolderKey, DiscoveredPaths>` — file paths for each scope
- `_lockedScopes`: `Set<ConfigScope>` — currently locked scopes (typically User)

#### `ConfigScope` Precedence
**Types:** `src/types.ts`

Scopes ordered by precedence (highest to lowest):

```typescript
export enum ConfigScope {
  Managed = 'managed',           // 0. Read-only enterprise policies
  ProjectLocal = 'projectLocal', // 1. .claude/settings.local.json (gitignored)
  ProjectShared = 'projectShared', // 2. .claude/settings.json (committed)
  User = 'user',                 // 3. ~/.claude/settings.json
}

export const SCOPE_PRECEDENCE: ConfigScope[] = [
  ConfigScope.Managed,
  ConfigScope.ProjectLocal,
  ConfigScope.ProjectShared,
  ConfigScope.User,
];
```

**Precedence Pattern:**
- Managed (enterprise) policies always win
- Project local overrides project shared
- Project shared overrides user defaults
- User scope provides defaults for all environments

---

#### `configDiscovery.ts` — Path Resolution
**File:** `src/config/configDiscovery.ts`

Discovers config file paths on disk without reading them:

```typescript
export function discoverConfigPaths(): DiscoveredPaths[] {
  const managedPath = getManagedSettingsPath();    // Platform-specific
  const userPath = getUserSettingsPath();         // ~/.claude/settings.json

  return workspaceFolders.map((folder) => ({
    workspaceFolder: folder,
    managed: fileInfo(managedPath),
    user: fileInfo(userPath),
    projectShared: fileInfo(path.join(root, '.claude/settings.json')),
    projectLocal: fileInfo(path.join(root, '.claude/settings.local.json')),
    mcp: fileInfo(path.join(root, '.mcp.json')),
  }));
}
```

**Output Structure:**
- One `DiscoveredPaths` per workspace folder
- Each includes existence checks but no file reading
- Used by ConfigStore to know where to read/write

---

#### `configLoader.ts` — Reading Files
**File:** `src/config/configLoader.ts`

Simple JSON file readers that delegate to utils:

```typescript
export function loadConfigFile(filePath: string): ParseResult<ClaudeCodeConfig> {
  return readJsonFile<ClaudeCodeConfig>(filePath);
}

export function loadMcpFile(filePath: string): ParseResult<McpConfig> {
  return readJsonFile<McpConfig>(filePath);
}
```

**Error Handling:**
- Returns `ParseResult<T>` with optional error message
- Missing files return empty objects `{}`
- Parse errors logged but don't crash

---

#### `configWriter.ts` — Writing Files
**File:** `src/config/configWriter.ts`

All writes go through structured, type-safe functions. Key aspects:

**Write Lifecycle Tracking:**
```typescript
const inFlightPaths = new Set<string>();

export function isWriteInFlight(filePath: string): boolean {
  return inFlightPaths.has(filePath);
}
```

**Path Validation:**
```typescript
export function validateConfigPath(filePath: string): void {
  // 1. Reject traversal sequences (../)
  // 2. Reject symlinks
  // 3. Check against whitelist (getAllowedWritePaths())
  // 4. Ensure parent directory exists
}
```

**Allowed Write Paths** (from `src/constants.ts`):
```typescript
export function getAllowedWritePaths(): Set<string> {
  return {
    ~/.claude/settings.json,                    // User scope
    {workspace}/.claude/settings.json,         // Project shared
    {workspace}/.claude/settings.local.json,   // Project local
    {workspace}/.mcp.json,                     // MCP servers
  }
}
```

**Write Operations:**
- `addPermissionRule(filePath, category, rule)` — Append to permissions array
- `setEnvVar(filePath, key, value)` — Create/update env object
- `setSandboxProperty(filePath, key, value)` — Nested object mutation
- `setScalarSetting(filePath, key, value)` — Top-level scalar mutation
- `setMcpServer(filePath, name, config)` — Add/update MCP server config
- `addHookEntry(filePath, eventType, command)` — Append hook command
- `setPluginEnabled(filePath, pluginId, enabled)` — Update enabled state

**Concurrency Protection:**
- In-flight write tracking prevents file watcher from reloading during writes
- Deactivation waits up to 5 seconds for all writes to complete

---

#### `overrideResolver.ts` — Conflict Detection
**File:** `src/config/overrideResolver.ts`

Determines when a setting in one scope is overridden by a higher-precedence scope:

```typescript
export function resolveScalarOverride(
  key: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): ResolvedValue {
  const effectiveValue = findHighestPrecedenceScope(key, allScopes);
  const isOverridden = currentValue !== undefined
    && winningScope !== currentScope
    && winningScope has higher precedence;

  return {
    effectiveValue,
    definedInScope: winningScope,
    isOverridden,
    overriddenByScope: isOverridden ? winningScope : undefined,
  };
}
```

**Override Detection:**
- **Scalars:** Value overridden if higher-precedence scope defines the same key
- **Permissions:** Rule overridden if higher-precedence scope has **conflicting category** (e.g., Managed Deny vs User Allow)
- **Environment:** Overridden if higher-precedence scope defines same variable name
- **Sandbox:** Nested property overridden if higher-precedence scope defines same path

---

### 3. Tree Provider Layer: `src/tree/`

Translates the in-memory config model into a hierarchical TreeView.

#### `ConfigTreeProvider` (TreeDataProvider)
**File:** `src/tree/configTreeProvider.ts`

Implements `vscode.TreeDataProvider<ConfigTreeNode>`:

```typescript
export class ConfigTreeProvider implements vscode.TreeDataProvider<ConfigTreeNode> {
  private parentMap = new Map<string, ConfigTreeNode>();
  private childrenCache = new Map<string, ConfigTreeNode[]>();
  private _sectionFilter = new Set<SectionType>();

  getChildren(element?: ConfigTreeNode): ConfigTreeNode[] { }
  getTreeItem(element: ConfigTreeNode): vscode.TreeItem { }
  getParent(element: ConfigTreeNode): ConfigTreeNode | undefined { }
  findNodeByKeyPath(scope, keyPath, workspaceFolderKey?): ConfigTreeNode { }
}
```

**Responsibilities:**
- Build tree hierarchy from flat config model
- Cache children and maintain parent map for reveal support
- Apply section filtering (user can hide sections like "Plugins" or "Hooks")
- Support multi-root workspaces with scope hierarchy per folder

**Rendering Flow:**
```
┌─────────────────────────────────┐
│ Multi-root or Single-root?      │
└──────────────┬──────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
  [Multi-Root]   [Single-Root]
  Root nodes are  Root nodes are
  workspace folders  scopes (Managed, User, etc.)
       │               │
       ├──ScopeNode    ├──ScopeNode
       │  └──SectionNode │  └──SectionNode
       │    └──ItemNode  │    └──ItemNode
       └──ScopeNode    └──ScopeNode
```

**Section Filtering:**
```typescript
setSectionFilter(sections: ReadonlySet<SectionType>): void {
  // Empty set = show all (no filter active)
  // Has sections = hide other sections
  // User picker: "All" vs individual sections (mutually exclusive)
}
```

---

#### `BaseNode` — Tree Node Abstraction
**File:** `src/tree/nodes/baseNode.ts`

All tree nodes inherit from `ConfigTreeNode`:

```typescript
export abstract class ConfigTreeNode extends vscode.TreeItem {
  abstract readonly nodeType: string;
  constructor(label, collapsibleState, nodeContext);

  protected finalize(): void {
    this.id = this.computeId();
    this.contextValue = this.computeContextValue();
    this.tooltip = this.computeTooltip();
    this.applyOverrideStyle();
    this.applyClickCommand();
  }

  abstract getChildren(): ConfigTreeNode[];
}
```

**Node ID Pattern:**
```
${workspaceFolderUri}/${scope}/${keyPath.join('/')}
```
Used for reveal and parent map lookup.

**Context Value Pattern:**
```
${nodeType}.${editable|readOnly}[.overridden]
```

Examples:
- `scope.user.editable`
- `permissionRule.readOnly.overridden`
- `setting.editable`

This powers context menu visibility in `package.json` via regex matching.

---

#### Node Type Hierarchy

**Node Types** (one file per type in `src/tree/nodes/`):

1. **ScopeNode** (`scopeNode.ts`) — Represents a config scope (Managed, User, Project Shared, Project Local)
   - Always collapsed by default
   - Read-only indicator for Managed scope
   - Shows file path as description (or "Not found")

2. **SectionNode** (`sectionNode.ts`) — Represents a section within a scope (Permissions, Hooks, etc.)
   - Children are category/event groups or individual items
   - Filter checks applied here

3. **PermissionGroupNode** (`permissionGroupNode.ts`) — Groups permission rules by category (Allow, Deny, Ask)
   - Children are individual `PermissionRuleNode`s

4. **PermissionRuleNode** (`permissionRuleNode.ts`) — A single permission rule
   - Leaf node; shows override status
   - Context menu: Edit, Delete, Copy, Move

5. **HookEventNode** (`hookEventNode.ts`) — Groups hooks by event type (PreToolUse, PostToolUse, etc.)
   - Children are individual `HookEntryNode`s

6. **HookEntryNode** (`hookEntryNode.ts`) — A single hook command entry
   - Shows command type and snippet
   - Collapsible if complex; shows nested key-value pairs in `HookKeyValueNode`

7. **EnvVarNode** (`envVarNode.ts`) — A single environment variable
   - Leaf node; shows name and value
   - Editable scalar

8. **McpServerNode** (`mcpServerNode.ts`) — A registered MCP server
   - Shows server name and type (stdio/sse)
   - Collapsible for config properties

9. **PluginNode** (`pluginNode.ts`) — A plugin with checkbox
   - Checkbox state reflects `enabledPlugins[id]`
   - Context menu: Toggle, Copy, Move

10. **SettingNode** (`settingNode.ts`) — A top-level scalar setting (model, outputStyle, etc.)
    - Leaf node; shows current value
    - Editable

11. **SandboxPropertyNode** (`sandboxPropertyNode.ts`) — A nested sandbox config property
    - Reflects structure under `sandbox` object

---

### 4. Commands Layer: `src/commands/`

All user-facing operations grouped by action type.

#### Command Organization

**`addCommands.ts`** — Add new items
- `claudeConfig.addPermissionRule` — Quick pick category → input rule
- `claudeConfig.addEnvVar` — Input key → input value
- `claudeConfig.addMcpServer` — Input name → pick type (stdio/sse) → config input
- `claudeConfig.addHookEntry` — Pick event type → input command
- `claudeConfig.addPlugin` — Discover and enable plugin

**`editCommands.ts`** — Edit scalar values
- `claudeConfig.editValue` — Show input with current value, parse JSON/boolean/string
- Applies to: env vars, scalar settings, sandbox properties

**`deleteCommands.ts`** — Remove items
- `claudeConfig.deleteItem` — Type-safe deletion per node type
- Filters array elements or removes object keys
- Handles confirmation for sensitive items

**`moveCommands.ts`** — Move across scopes
- `claudeConfig.moveItem` — Pick target scope → copy → delete from source
- Respects read-only constraints
- Success message with target scope label

**`openFileCommands.ts`** — Editor integration
- `claudeConfig.revealInFile` — Takes [filePath, keyPath], opens editor and scrolls to line
- `claudeConfig.openConfigFile` — Opens specific config file in editor

**`pluginCommands.ts`** — Plugin management
- `claudeConfig.togglePlugin` — Checkbox state → `setPluginEnabled`
- Respects write-in-flight concurrency
- Error recovery via retry dialog

---

### 5. Watchers & Validation: `src/watchers/` and `src/validation/`

#### File Watcher: `ConfigFileWatcher`
**File:** `src/watchers/fileWatcher.ts`

Watches all four config scopes for external changes:

```typescript
setup() {
  this.watchPattern('**/.claude/settings.json');
  this.watchPattern('**/.claude/settings.local.json');
  this.watchPattern('**/.mcp.json');
  this.watchAbsolute(getUserSettingsPath());    // ~/.claude/settings.json
  this.watchAbsolute(getManagedSettingsPath()); // /Library/Application Support/...
  this.watchers.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => this.debouncedReload())
  );
}
```

**Debounce Strategy:**
- Regular debounce: 300ms (allows batching rapid changes)
- Max wait ceiling: 2000ms (eventual consistency)
- Suppresses reload if write is in-flight (prevents reload loop)

---

#### Validation: `schemaValidator.ts`
**File:** `src/validation/schemaValidator.ts`

Lightweight structural validator (no runtime JSON Schema library):

```typescript
export function validateConfig(config: unknown, sourceText?: string): ValidationIssue[] {
  // Check:
  // 1. Root is object
  // 2. Top-level keys are known (from DEDICATED_SECTION_KEYS + KNOWN_SETTING_KEYS)
  // 3. Permissions structure (categories, rules)
  // 4. Environment object (key-value pairs)
  // 5. Hooks structure (event types, command objects)
  // 6. Enabled plugins (object with boolean values)
  // 7. Sandbox properties (nested object with correct types)
  // 8. Scalar settings type checks

  return issues;  // Array of { message, path, severity, line }
}
```

---

### 6. Bidirectional Editor ↔ Tree Sync

**File:** `src/extension.ts` (lines 179–240)

Implemented via debounced event handlers:

**Tree → Editor (select):**
- User clicks tree node
- Set `suppressEditorSync = true` for 500ms to prevent immediate re-trigger
- Tree node's `command` property triggers `revealInFile`, which:
  - Opens the config file
  - Uses `findKeyPathAtLine()` to scroll to correct line
  - Places cursor at the key

**Editor → Tree (cursor movement):**
- Selection or active editor changes
- Debounce 150ms (user typing, cursor moving)
- `findKeyPathAtLine()` extracts path under cursor
- `treeProvider.findNodeByKeyPath()` walks tree to find node
- `treeView.reveal()` selects it with `select: true, expand: true`
- Set `suppressTreeSync = true` for 100ms to prevent loop

**Debounce Constants** (from `src/constants.ts`):
```typescript
EDITOR_SYNC_SUPPRESS_MS = 500;      // After tree click
TREE_SYNC_SUPPRESS_MS = 100;        // After programmatic reveal
EDITOR_TREE_SYNC_DEBOUNCE_MS = 150; // Before sync to tree
```

---

## Data Flow Architecture

### Loading Flow

```
┌──────────────────────────┐
│ activate()               │
│ configStore.reload()     │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ discoverConfigPaths()            │
│ → Returns path metadata          │
│   (no file reading yet)          │
└───────────┬──────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ For each scope:                  │
│ loadConfigFile(path)             │
│ → readJsonFile()                 │
│ → ParseResult or empty {}        │
└───────────┬──────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ buildScopedConfigs(discovered)   │
│ → ScopedConfig[] (4 items)       │
│   [Managed, User, ProjShared,    │
│    ProjLocal]                    │
└───────────┬──────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ configStore.configs.set(key,     │
│   scopedConfigs)                 │
└───────────┬──────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ onDidChange emitted              │
└───────────┬──────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ treeProvider.refresh()           │
│ Clear cache, fire onDidChangeTree│
└───────────┬──────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ VS Code calls getChildren()      │
│ Build ScopeNode → SectionNode →  │
│ ItemNode hierarchy               │
└──────────────────────────────────┘
```

### Writing Flow

```
┌─────────────────────────────┐
│ User context menu → Command │
│ e.g., "Add Permission"      │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Command handler                  │
│ (e.g., addCommands.ts)           │
│ Quick pick → Input dialogs       │
└──────────┬──────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Validate filePath:               │
│ ✓ Traversal? ✗ Symlink?         │
│ ✓ Whitelist? ✓ Parent exists?   │
└──────────┬──────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ Type-safe write function:        │
│ e.g., addPermissionRule(path)    │
│ readJsonFile() → validate →      │
│ mutate structure                 │
└──────────┬──────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ writeJsonFile(path, data)        │
│ mkdir -p && stringify + write    │
└──────────┬──────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ inFlightPaths.add(filePath)      │
│ Prevents watcher reload during   │
│ write                            │
└──────────┬──────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ File watcher debounce timer      │
│ After 300ms (or 2000ms max):     │
│ configStore.reload()             │
└──────────┬──────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ inFlightPaths.delete(filePath)   │
│ Resume normal watching           │
└──────────────────────────────────┘
```

---

## Key Design Decisions

### 1. **Scope Precedence Model**
- **Why:** Claude Code evaluates settings from highest to lowest precedence. The extension models this exactly.
- **Trade-off:** More complex override detection, but accurate user mental model.

### 2. **ConfigStore as Single Source of Truth**
- **Why:** All UI components read from ConfigStore, reducing inconsistency.
- **Trade-off:** All writes must go through ConfigStore to trigger `onDidChange`.

### 3. **Write Validation at Command Level**
- **Why:** Each command validates its input (scope locking, read-only, path validation).
- **Trade-off:** Logic spread across multiple files, but catches errors early.

### 4. **Path Validation with Whitelist**
- **Why:** Prevents malicious writes outside known config paths.
- **Trade-off:** Extension setup must list all allowed paths in `getAllowedWritePaths()`.

### 5. **File Watcher with In-Flight Tracking**
- **Why:** Prevents reload loop: write → OS change → watcher → reload (would lose change).
- **Trade-off:** Requires tracking in-flight writes globally.

### 6. **Debounced Editor ↔ Tree Sync**
- **Why:** Prevents infinite loops as user navigates between editor and tree.
- **Trade-off:** 150ms latency between editor cursor and tree selection.

### 7. **No Runtime JSON Schema**
- **Why:** Lightweight validation without schema library dependency.
- **Trade-off:** Manual validation logic, but easier to reason about.

### 8. **Section Filtering in TreeProvider**
- **Why:** User can hide unneeded sections (e.g., hide "Plugins" if not used).
- **Trade-off:** Filter state stored in TreeProvider, not persisted.

### 9. **Scope Locking (User scope default)**
- **Why:** Prevents accidental user-scope overwrites.
- **Trade-off:** Extra UI state and lock toggle commands.

---

## Component Interactions

### ConfigStore ← → TreeProvider
- ConfigStore emits `onDidChange` → TreeProvider calls `refresh()`
- TreeProvider reads ConfigStore via `getAllScopes()`, `getScopedConfig()`

### ConfigStore ← → FileWatcher
- FileWatcher watches filesystem → calls `configStore.reload()`
- ConfigStore emits change → FileWatcher already listening (redundant reload suppressed)

### Commands ← → ConfigStore
- Commands call write functions (`src/config/configWriter.ts`)
- Write functions call ConfigStore indirectly (configWriter reads/writes disk, watcher calls reload)

### Commands ← → TreeProvider
- Commands receive tree nodes as context
- TreeProvider helps commands find nodes via `findNodeByKeyPath()`

### Editor ← → TreeView
- User selects tree node → command reveals in editor
- User moves cursor in editor → debounced reveal in tree

---

## Error Handling Strategy

### Parse Errors
- If config file JSON invalid: show warning, use empty `{}`
- Prevents extension crash on corrupted user config

### Write Errors
- Validate path (traversal, symlink, whitelist)
- Try write; catch errors
- Show error dialog with "Retry" button
- Retry executes same write command

### Concurrent Writes
- Check `isWriteInFlight(filePath)` before write
- Show "write in progress" message
- Prevent duplicate writes to same file

### Tree Rendering Errors
- Catch errors in `getChildren()`, `findNodeByKeyPath()`
- Log to console; show warning to user
- Return empty array to prevent white screen

---

## Security Considerations

### Path Validation
1. **Traversal check:** Reject paths containing `../` or `..\`
2. **Symlink check:** Reject symlinks via `fs.lstatSync().isSymbolicLink()`
3. **Whitelist check:** Only allow paths in `getAllowedWritePaths()`
4. **Parent existence:** Parent directory must exist (prevents arbitrary dir creation)

### Read-Only Protection
- Managed scope always read-only
- User scope locked by default
- Commands check `nodeContext.isReadOnly` before proceeding

### Input Validation
- Permission rules: User-provided; passed as-is (Claude Code validates)
- Env var keys/values: Passed as-is; no shell expansion
- Hooks: Passed as-is; Claude Code validates syntax
- Scalar settings: Parsed as JSON/boolean/string; validated by type

---

## Performance Considerations

### Caching
- **TreeProvider cache:** Children cache keyed by node ID, cleared on refresh
- **Parent map:** Built during `getChildren()`, enables fast `getParent()` for reveal

### Debouncing
- **File watcher:** 300ms debounce, 2000ms max wait
- **Editor sync:** 150ms debounce, prevents thrashing on cursor moves
- **Reload on activate:** Full reload once; incremental per workspace folder on folder change

### Lazy Loading
- Config files loaded on demand in `configLoader.ts`
- Missing files return empty `{}` (no file I/O error)
- Plugin metadata cached in `PluginMetadataService` singleton

---

## Extension Points & Extensibility

### Adding a New Setting Type
1. Add enum value in `src/types.ts` (SectionType or HookEventType)
2. Add label/icon in `src/constants.ts`
3. Add validation in `src/validation/schemaValidator.ts`
4. Create node class in `src/tree/nodes/`
5. Add rendering in SectionNode's `getChildren()`

### Adding a New Command
1. Create command handler in appropriate file: `src/commands/*.ts`
2. Register in `extension.ts` via `registerXxxCommands()`
3. Add menu item in `package.json` with context value pattern
4. Add keybinding (optional)

### Adding a New Scope
1. Add to `ConfigScope` enum in `src/types.ts`
2. Add to `SCOPE_PRECEDENCE` array
3. Add path discovery in `configDiscovery.ts`
4. Add to scopes loop in `ConfigStore.buildScopedConfigs()`

---
