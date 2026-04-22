# STRUCTURE.md — Claude Code Config Manager

Directory layout, file organization, naming conventions, and key patterns.

---

## Directory Layout

```
claude-code-config-manager/
├── src/                           # TypeScript source code (39 files)
│   ├── extension.ts               # VS Code extension entry point (activate, deactivate)
│   ├── types.ts                   # Enums, interfaces, type definitions
│   ├── constants.ts               # Labels, icons, paths, messages, known keys
│   │
│   ├── config/                    # Config discovery, loading, modeling, writing
│   │   ├── configDiscovery.ts     # Path discovery (no I/O)
│   │   ├── configLoader.ts        # JSON file reading
│   │   ├── configModel.ts         # ConfigStore (in-memory model)
│   │   ├── configWriter.ts        # Write operations + validation + concurrency
│   │   └── overrideResolver.ts    # Override detection
│   │
│   ├── tree/                      # Tree view rendering layer
│   │   ├── configTreeProvider.ts  # TreeDataProvider + caching
│   │   ├── lockDecorations.ts     # Lock state visual decorations
│   │   └── nodes/                 # Tree node types (14 files)
│   │       ├── baseNode.ts        # ConfigTreeNode base class
│   │       ├── scopeNode.ts       # Scope representation
│   │       ├── sectionNode.ts     # Section (Permissions, Hooks, etc.)
│   │       ├── permissionGroupNode.ts  # Allow/Deny/Ask groups
│   │       ├── permissionRuleNode.ts   # Individual rules
│   │       ├── hookEventNode.ts   # Hook event type groups
│   │       ├── hookEntryNode.ts   # Individual hook entries
│   │       ├── hookKeyValueNode.ts # Hook nested properties
│   │       ├── mcpServerNode.ts   # MCP server entries
│   │       ├── envVarNode.ts      # Environment variables
│   │       ├── sandboxPropertyNode.ts  # Sandbox properties
│   │       ├── settingNode.ts     # Scalar settings
│   │       ├── settingKeyValueNode.ts  # Setting nested properties
│   │       └── pluginNode.ts      # Plugins (with checkbox)
│   │
│   ├── commands/                  # User commands (6 files)
│   │   ├── addCommands.ts         # Add operations
│   │   ├── editCommands.ts        # Edit scalar values
│   │   ├── deleteCommands.ts      # Delete operations
│   │   ├── moveCommands.ts        # Move across scopes
│   │   ├── openFileCommands.ts    # Editor operations
│   │   └── pluginCommands.ts      # Plugin operations
│   │
│   ├── watchers/                  # File system monitoring
│   │   └── fileWatcher.ts         # File watch + debounce + reload
│   │
│   ├── validation/                # Validation and diagnostics
│   │   ├── schemaValidator.ts     # Structural validation
│   │   └── diagnostics.ts         # VS Code DiagnosticCollection
│   │
│   └── utils/                     # Utility functions (7 files)
│       ├── json.ts                # JSON read/write helpers
│       ├── jsonLocation.ts        # Line/column position mapping
│       ├── platform.ts            # OS-specific paths
│       ├── permissions.ts         # Permission rule utilities
│       ├── validation.ts          # Input validation
│       ├── pluginMetadata.ts      # Plugin discovery + caching
│       └── [other utilities]
│
├── schemas/
│   └── claude-code-settings.schema.json  # Official JSON Schema (optional reference)
│
├── resources/
│   └── icons/claude-config.svg           # Activity bar icon
│
├── package.json                   # VS Code extension manifest
├── tsconfig.json                  # TypeScript configuration (strict mode)
├── eslintrc.js                    # ESLint rules
├── .prettierrc                    # Prettier formatting rules
├── esbuild.config.mjs             # Build configuration
└── vsc-extension-quickstart.md    # Quick reference
```

---

## Core Files

### Entry Point

#### `src/extension.ts`
**Lines:** ~391

Main extension lifecycle:

```typescript
export function activate(context: vscode.ExtensionContext): void {
  // 1. Create output channel
  // 2. Initialize ConfigStore and reload all configs
  // 3. Create tree view
  // 4. Set up validation
  // 5. Register all commands (add, edit, delete, move, open, plugin)
  // 6. Set up file watcher
  // 7. Handle plugin checkbox toggles
  // 8. Implement editor ↔ tree bidirectional sync
  // 9. Register file decoration providers
  // 10. Push all disposables
}

export async function deactivate(): Promise<void> {
  // Wait for in-flight writes to complete
  // Clear tracked timeouts
}
```

**Key Functions:**
- `openSectionFilterPicker()` — User QuickPick for section filtering
- `runDiagnostics()` — Validate all discovered files
- `collectExpandableNodes()` — For "expand all" command

---

### Type Definitions

#### `src/types.ts`
**Lines:** ~186

All TypeScript types and enums:

```typescript
// Enums
enum ConfigScope { Managed, User, ProjectShared, ProjectLocal }
enum PermissionCategory { Allow, Deny, Ask }
enum HookEventType { SessionStart, PreToolUse, ... }
enum SectionType { Permissions, Sandbox, Hooks, McpServers, Environment, Plugins, Settings }

// Config data shapes
interface PermissionRules
interface HookCommand
interface HookMatcher
interface SandboxConfig
interface ClaudeCodeConfig
interface McpConfig

// Scoped config
interface ScopedConfig

// Override resolution
interface ResolvedValue<T>

// Tree node context
interface NodeContext
```

**Key Constants:**
- `SCOPE_PRECEDENCE` array — Defines scope priority order

---

### Constants & Configuration

#### `src/constants.ts`
**Lines:** ~215

Labels, icons, file paths, messages:

```typescript
// Scope labels/icons/descriptions
SCOPE_LABELS, SCOPE_ICONS, SCOPE_DESCRIPTIONS

// Section labels/icons
SECTION_LABELS, SECTION_ICONS

// Permission category icons
PERMISSION_CATEGORY_ICONS, PERMISSION_CATEGORY_LABELS

// Known config keys
DEDICATED_SECTION_KEYS  // { 'permissions', 'sandbox', 'hooks', 'env', 'enabledPlugins' }
KNOWN_SETTING_KEYS      // [ 'model', 'outputStyle', 'language', ... ]

// File paths
MANAGED_SETTINGS_FILENAME = 'managed-settings.json'
MANAGED_PATH_MACOS = '/Library/Application Support/ClaudeCode'
MANAGED_PATH_LINUX = '/etc/claude-code'
USER_SETTINGS_DIR = '.claude'
PROJECT_CLAUDE_DIR = '.claude'

// Timing constants
DEBOUNCE_RELOAD_MS = 300
DEBOUNCE_MAX_WAIT_MS = 2000
EDITOR_SYNC_SUPPRESS_MS = 500
EDITOR_TREE_SYNC_DEBOUNCE_MS = 150

// Messages
MESSAGES = {
  userScopeLocked,
  readOnlySetting,
  writeInProgress,
  pluginNotInstalled,
  ...
}

// Write path validation
function getAllowedWritePaths(): Set<string>
```

---

## Config Layer: `src/config/`

### `configDiscovery.ts` (59 lines)
Discovers config file paths without reading them.

**Exported:**
```typescript
interface DiscoveredPaths {
  workspaceFolder?: vscode.WorkspaceFolder
  managed: FileInfo
  user: FileInfo
  projectShared?: FileInfo
  projectLocal?: FileInfo
  mcp?: FileInfo
}

function discoverConfigPaths(): DiscoveredPaths[]
function fileInfo(filePath: string): FileInfo
```

---

### `configLoader.ts` (10 lines)
Simple JSON file readers.

**Exported:**
```typescript
function loadConfigFile(filePath: string): ParseResult<ClaudeCodeConfig>
function loadMcpFile(filePath: string): ParseResult<McpConfig>
```

---

### `configModel.ts` (~180 lines)
In-memory configuration state container.

**Export:**
```typescript
export class ConfigStore implements vscode.Disposable {
  // State
  private configs: Map<string, ScopedConfig[]>
  private discoveredPaths: Map<string, DiscoveredPaths>
  private _lockedScopes: Set<ConfigScope>

  // Events
  readonly onDidChange: Event<string | undefined>

  // Methods
  reload(workspaceFolderUri?: string): void
  getScopedConfig(scope, workspaceFolderUri?): ScopedConfig | undefined
  getAllScopes(workspaceFolderUri?): ScopedConfig[]
  getWorkspaceFolderKeys(): string[]
  getDiscoveredPaths(workspaceFolderUri?): DiscoveredPaths | undefined
  findScopeByFilePath(filePath: string): { scopedConfig, workspaceFolderKey }
  isMultiRoot(): boolean
  lockScope(scope): void
  unlockScope(scope): void
  isScopeLocked(scope): boolean
  dispose(): void
}
```

**Data Structure:**
- Key: workspace folder URI (or global key for no workspace)
- Value: array of 4 ScopedConfig objects (one per scope)

---

### `configWriter.ts` (~400 lines)
All write operations with security validation.

**Key Exports:**
```typescript
// Write operations
function addPermissionRule(filePath, category, rule): void
function setEnvVar(filePath, key, value): void
function setSandboxProperty(filePath, key, value): void
function setScalarSetting(filePath, key, value): void
function setMcpServer(filePath, name, config): void
function addHookEntry(filePath, eventType, command): void
function setPluginEnabled(filePath, pluginId, enabled): void

// Validation
function validateConfigPath(filePath): void

// Lifecycle tracking
function initWriteTracker(channel): void
function isWriteInFlight(filePath): boolean
function getInFlightWriteCount(): number

// Error handling
function showWriteError(filePath, error, retryFn): Promise<void>
```

**Security Pattern:**
1. `validateConfigPath()` — Check traversal, symlinks, whitelist, parent
2. `loadOrCreate<T>(filePath)` — Read existing or create empty
3. Mutate structure in memory
4. `writeJsonFile()` — Atomic write to disk
5. Track as in-flight; suppress watcher reload
6. Wait for watcher debounce; remove from in-flight

---

### `overrideResolver.ts` (~140 lines)
Override detection across scopes.

**Exports:**
```typescript
function precedenceOf(scope): number
function findHighestPrecedenceScope(key, allScopes): ConfigScope | undefined
function resolveScalarOverride(key, currentScope, allScopes): ResolvedValue
function resolvePermissionOverride(category, rule, currentScope, allScopes): { isOverridden, overriddenByScope, overriddenByCategory }
function resolveEnvOverride(key, currentScope, allScopes): ResolvedValue
function resolveSandboxOverride(keyPath, currentScope, allScopes): ResolvedValue
```

**ResolvedValue Pattern:**
```typescript
{
  effectiveValue: T,          // Winning value
  definedInScope: ConfigScope,
  isOverridden: boolean,
  overriddenByScope?: ConfigScope
}
```

---

## Tree Layer: `src/tree/`

### `configTreeProvider.ts` (~250 lines)
TreeDataProvider implementation with caching.

**Export:**
```typescript
export class ConfigTreeProvider implements vscode.TreeDataProvider<ConfigTreeNode> {
  // State
  private parentMap: Map<string, ConfigTreeNode>
  private childrenCache: Map<string, ConfigTreeNode[]>
  private _sectionFilter: Set<SectionType>

  // Events
  readonly onDidChangeTreeData: Event<ConfigTreeNode | undefined | void>

  // TreeDataProvider interface
  getTreeItem(element): vscode.TreeItem
  getChildren(element?): ConfigTreeNode[]
  getParent(element): ConfigTreeNode | undefined

  // Custom methods
  refresh(): void
  setSectionFilter(sections: ReadonlySet<SectionType>): void
  findNodeByKeyPath(scope, keyPath, workspaceFolderKey?): ConfigTreeNode | undefined

  // Disposal
  dispose(): void
}
```

**Rendering Logic:**
- Multi-root: Creates WorkspaceFolderNode root (implicit), then ScopeNodes per workspace
- Single-root: Creates ScopeNodes at root
- Each ScopeNode has SectionNodes
- SectionNodes have category/type groups or item nodes
- Item nodes are leaf or have nested properties

---

### `src/tree/nodes/` — Node Types (14 files)

#### Base Class: `baseNode.ts`
```typescript
export abstract class ConfigTreeNode extends vscode.TreeItem {
  abstract readonly nodeType: string
  readonly nodeContext: NodeContext

  protected finalize(): void  // Call at end of constructor
  protected computeId(): string
  protected computeContextValue(): string
  protected computeTooltip(): string | MarkdownString | undefined
  protected applyOverrideStyle(): void
  protected applyClickCommand(): void
  abstract getChildren(): ConfigTreeNode[]
}
```

**Node ID Pattern:**
```
${workspaceFolderUri}/${scope}/${keyPath.join('/')}
```

**Context Value Pattern:**
```
${nodeType}.${editable|readOnly}[.overridden]
```

---

#### Node Types

| File | Class | Purpose |
|------|-------|---------|
| `scopeNode.ts` | ScopeNode | Scope representation (4 per folder) |
| `sectionNode.ts` | SectionNode | Section container (7 types) |
| `permissionGroupNode.ts` | PermissionGroupNode | Allow/Deny/Ask group |
| `permissionRuleNode.ts` | PermissionRuleNode | Individual rule |
| `hookEventNode.ts` | HookEventNode | Event type group |
| `hookEntryNode.ts` | HookEntryNode | Individual hook |
| `hookKeyValueNode.ts` | HookKeyValueNode | Hook nested property |
| `mcpServerNode.ts` | McpServerNode | MCP server entry |
| `envVarNode.ts` | EnvVarNode | Env variable |
| `sandboxPropertyNode.ts` | SandboxPropertyNode | Sandbox property |
| `settingNode.ts` | SettingNode | Scalar setting |
| `settingKeyValueNode.ts` | SettingKeyValueNode | Setting nested property |
| `pluginNode.ts` | PluginNode | Plugin (checkbox) |

---

#### `pluginNode.ts` — Special Case
Only node type with checkbox support:

```typescript
export class PluginNode extends ConfigTreeNode {
  checkboxState: vscode.TreeItemCheckboxState
  // Updated from enabledPlugins[id]
}

export class PluginDecorationProvider implements vscode.FileDecorationProvider {
  // Provides visual decorations for plugin files
}
```

---

### `lockDecorations.ts`
Provides visual dimming for locked User scope.

```typescript
export class LockDecorationProvider implements vscode.FileDecorationProvider {
  provideFileDecoration(uri): FileDecoration | undefined
}
```

---

## Commands Layer: `src/commands/`

Each file exports a `registerXxxCommands()` function.

### `addCommands.ts`
Adds new items to config.

**Commands:**
- `claudeConfig.addPermissionRule` — Pick category → input rule
- `claudeConfig.addEnvVar` — Input key → input value
- `claudeConfig.addMcpServer` — Input name → pick type → input config
- `claudeConfig.addHookEntry` — Pick event → input command
- `claudeConfig.addPlugin` — Discover → install

**Pattern:**
```typescript
async (node?: ConfigTreeNode) => {
  const filePath = await resolveFilePath(node, configStore)
  // Quick pick / input dialogs
  // Call write function
}
```

---

### `editCommands.ts`
Edits scalar values.

**Commands:**
- `claudeConfig.editValue` — Input current → edit → parse → write

**Input Parsing:**
```typescript
function parseInputValue(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  try { return JSON.parse(value) }
  catch { return value }
}
```

---

### `deleteCommands.ts`
Deletes items.

**Commands:**
- `claudeConfig.deleteItem` — Pick yes/no → delete from array or remove key

---

### `moveCommands.ts`
Moves items across scopes.

**Commands:**
- `claudeConfig.moveItem` — Pick target scope → copy → delete from source

---

### `openFileCommands.ts`
Opens files in editor.

**Commands:**
- `claudeConfig.revealInFile` — Takes [filePath, keyPath] → opens file → reveals line
- `claudeConfig.openConfigFile` — Opens config file in editor

**Implementation:**
Uses `findKeyPathAtLine()` utility to map keyPath to file line number.

---

### `pluginCommands.ts`
Plugin-specific operations.

**Commands:**
- `claudeConfig.togglePlugin` — Toggle checkbox state → write enabled state
- `claudeConfig.viewPluginReadme` — Open plugin README in preview

---

## Watchers & Validation: `src/watchers/` and `src/validation/`

### `fileWatcher.ts` (~120 lines)
Watches config files for external changes.

**Export:**
```typescript
export class ConfigFileWatcher implements vscode.Disposable {
  constructor(configStore: ConfigStore)
  setOutputChannel(channel): void
  setup(): void
  dispose(): void

  private watchPattern(pattern: string): void
  private watchAbsolute(filePath: string): void
  private debouncedReload(filePath?): void
}
```

**Patterns Watched:**
- `**/.claude/settings.json`
- `**/.claude/settings.local.json`
- `**/.mcp.json`
- Absolute paths: `~/.claude/settings.json`, `/Library/Application Support/ClaudeCode/...`
- Workspace folder changes

**Debounce:**
```typescript
DEBOUNCE_RELOAD_MS = 300ms    // Regular debounce
DEBOUNCE_MAX_WAIT_MS = 2000ms // Max wait ceiling

// Suppresses reload if write in-flight for that file
if (isWriteInFlight(filePath)) return
```

---

### `schemaValidator.ts` (~200 lines)
Lightweight validation (no runtime library).

**Export:**
```typescript
export interface ValidationIssue {
  message: string
  path: string
  severity: 'error' | 'warning'
  line?: number
}

export function validateConfig(config: unknown, sourceText?: string): ValidationIssue[]
```

**Validates:**
- Root is object
- Top-level keys known
- Permission structure (categories, rules)
- Environment object (key-value pairs)
- Hooks structure (event types, commands)
- Enabled plugins (boolean values)
- Sandbox properties (types)
- Scalar settings (types)

---

### `diagnostics.ts` (~100 lines)
VS Code DiagnosticCollection integration.

**Export:**
```typescript
export class ConfigDiagnostics implements vscode.Disposable {
  validateFiles(filePaths: string[]): void
  dispose(): void
}
```

---

## Utilities: `src/utils/`

### `json.ts`
JSON read/write helpers.

```typescript
export interface ParseResult<T> {
  data: T
  error?: string
}

export function safeParseJson<T>(content: string): ParseResult<T>
export function readJsonFile<T>(filePath: string): ParseResult<T>
export function writeJsonFile(filePath: string, data: unknown): void
```

---

### `jsonLocation.ts`
Maps file positions to keyPaths.

```typescript
export function findKeyPathAtLine(filePath: string, line: number): string[] | undefined
```

Used for editor → tree sync to find which setting the cursor is on.

---

### `platform.ts`
OS-specific path resolution.

```typescript
export function getManagedSettingsPath(): string  // /Library/... or /etc/...
export function getUserSettingsPath(): string    // ~/.claude/settings.json
export function getUserSettingsDir(): string     // ~/.claude/
```

---

### `permissions.ts`
Permission rule utilities.

```typescript
export function rulesOverlap(rule1: string, rule2: string): boolean
// Checks if two rules are likely to conflict (same tool, overlapping specifiers)
```

---

### `validation.ts`
Input validation for commands.

```typescript
export function validateKeyPath(keyPath: string[], minDepth: number, context: string): boolean
export function validateNodeContext(context: NodeContext): boolean
```

---

### `pluginMetadata.ts`
Plugin discovery and caching.

```typescript
export class PluginMetadataService {
  static getInstance(): PluginMetadataService
  discoverPlugins(): PluginMetadata[]
  getPluginReadme(id: string): string
  invalidate(): void  // Called on config reload
}
```

---

## Naming Conventions

### TypeScript
- **Types/Interfaces:** PascalCase (e.g., `ConfigScope`, `ScopedConfig`, `NodeContext`)
- **Enums:** PascalCase (e.g., `PermissionCategory`, `HookEventType`)
- **Classes:** PascalCase (e.g., `ConfigStore`, `ConfigTreeProvider`, `ScopeNode`)
- **Functions:** camelCase (e.g., `loadConfigFile`, `findNodeByKeyPath`)
- **Variables:** camelCase (e.g., `configStore`, `treeProvider`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `DEBOUNCE_RELOAD_MS`, `USER_SETTINGS_DIR`)
- **Private fields:** camelCase with `_` prefix (e.g., `_onDidChange`, `_sectionFilter`)

### File Names
- **Config layer:** `config*.ts` (e.g., `configDiscovery.ts`, `configLoader.ts`)
- **Tree layer:** No prefix, node types are `*Node.ts` (e.g., `scopeNode.ts`, `permissionRuleNode.ts`)
- **Commands:** `*Commands.ts` (e.g., `addCommands.ts`, `editCommands.ts`)
- **Utilities:** `*.ts` in `utils/` (e.g., `json.ts`, `platform.ts`)

### Node Type Names
- Suffix: `Node` (e.g., `ScopeNode`, `PermissionRuleNode`)
- Prefix: None (no redundant `Config` prefix)
- Pattern: Descriptive noun (e.g., `HookEventNode`, `McpServerNode`)

### Command IDs
- Prefix: `claudeConfig.` (e.g., `claudeConfig.addPermissionRule`)
- Pattern: `[add|edit|delete|move|toggle|open]` + noun (camelCase)

### Context Values
- Pattern: `{nodeType}.{editable|readOnly}[.overridden]`
- Examples:
  - `scope.user.editable`
  - `permissionRule.readOnly.overridden`
  - `hookEntry.editable`

---

## File Organization Patterns

### Config Layer (`src/config/`)
**Organization:** Single responsibility per file
- Discovery → Loading → Modeling → Writing → Resolution
- Ordered by data flow
- Each file handles one concern

### Tree Layer (`src/tree/`)
**Organization:** Provider + node hierarchy
- Provider coordinates overall tree building
- One file per node type for maintainability
- All inherit from `baseNode.ts`

### Commands Layer (`src/commands/`)
**Organization:** Grouped by operation type
- Add → Edit → Delete → Move → Open → Plugin
- Each file exports `registerXxxCommands(context, configStore)`
- Registered in `extension.ts` in activation

### Utilities (`src/utils/`)
**Organization:** One concern per file
- JSON helpers, path resolution, validation, plugin discovery
- No cross-dependencies between utils
- Imported by higher layers

---

## Key Patterns & Idioms

### Error Handling Pattern
```typescript
try {
  // Write operation
  addPermissionRule(filePath, category, rule)
} catch (error) {
  await showWriteError(filePath, error, () => {
    // Retry function
    addPermissionRule(filePath, category, rule)
  })
}
```

### Event Flow Pattern
```typescript
configStore.onDidChange(() => {
  treeProvider.refresh()
  runDiagnostics(configStore, diagnostics)
})
```

### Write Lifecycle Pattern
```typescript
inFlightPaths.add(filePath)
try {
  writeJsonFile(filePath, data)
} finally {
  // Remove when watcher debounce fires
  setTimeout(() => inFlightPaths.delete(filePath), DEBOUNCE_RELOAD_MS + 100)
}
```

### Node Context Pattern
```typescript
const context: NodeContext = {
  scope: scopedConfig.scope,
  section: SectionType.Permissions,
  keyPath: ['permissions', 'allow', 0],
  isReadOnly: scopedConfig.isReadOnly,
  isOverridden: resolved.isOverridden,
  overriddenByScope: resolved.overriddenByScope,
  workspaceFolderUri: workspaceFolder?.uri.toString(),
  filePath: scopedConfig.filePath,
}

const node = new PermissionRuleNode(label, context)
```

---

## Module Dependencies

**Dependency Direction:** Commands → Tree → Config → Utils → (none)

```
extension.ts (orchestrator)
  ├→ ConfigStore (config/configModel.ts)
  ├→ ConfigTreeProvider (tree/configTreeProvider.ts)
  ├→ FileWatcher (watchers/fileWatcher.ts)
  ├→ ConfigDiagnostics (validation/diagnostics.ts)
  └→ Commands (commands/*.ts)
     ├→ configWriter.ts (config/)
     ├→ ConfigTreeNode (tree/nodes/)
     └→ constants, types, utils
```

**No Circular Dependencies:** Enforce via ESLint.

---

## File Size Guide

| Category | File | Target Size |
|----------|------|-------------|
| Config | configDiscovery | ~60 lines |
| Config | configLoader | ~10 lines |
| Config | configModel | ~180 lines |
| Config | configWriter | ~400 lines |
| Config | overrideResolver | ~150 lines |
| Tree | configTreeProvider | ~250 lines |
| Tree | baseNode | ~75 lines |
| Tree | Node types | ~50–100 lines each |
| Commands | Each * | ~100–200 lines |
| Utils | Each | ~50–100 lines |

**Rationale:** Keep files under 300 lines for readability.

---

## Folder Structure Best Practices

1. **Config layer** — Ordered by data pipeline: discovery → load → model → write → resolve
2. **Tree layer** — Provider first, then node types alphabetically
3. **Commands layer** — Grouped by operation semantics
4. **Utils** — Alphabetical, one concern per file
5. **No mixed responsibilities** — Never put command + config logic in same file

---
