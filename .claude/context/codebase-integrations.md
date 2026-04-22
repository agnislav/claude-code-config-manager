# External Integrations & VS Code APIs — Claude Code Config Manager

## VS Code Extension APIs

The extension extensively uses VS Code's public API surface (`vscode` module). Below are the key APIs consumed:

### TreeView & Tree Data Provider

| API | Location | Purpose |
|-----|----------|---------|
| `vscode.window.createTreeView()` | `extension.ts:30` | Register the main config tree view (`claudeConfigTree`) in the sidebar |
| `vscode.TreeDataProvider` | `tree/configTreeProvider.ts` | Interface implemented by `ConfigTreeProvider` to supply tree structure and items |
| `vscode.TreeItem` | `tree/nodes/*.ts` | Base class for all tree node types (ScopeNode, SectionNode, PermissionRuleNode, etc.) |
| `TreeItemCheckboxState` | `extension.ts:77, 95` | Enum for plugin enable/disable checkbox states |
| `onDidChangeCheckboxState` | `extension.ts:77` | Event fired when user toggles plugin checkboxes |
| `onDidChangeSelection` | `extension.ts:106` | Event fired when tree selection changes (editor ↔ tree sync) |

**Affected Files**:
- `src/extension.ts` — activation and tree view setup
- `src/tree/configTreeProvider.ts` — TreeDataProvider implementation
- `src/tree/nodes/baseNode.ts` — ConfigTreeNode base class
- `src/tree/nodes/scopeNode.ts`, `sectionNode.ts`, `settingNode.ts`, etc. — TreeItem subclasses

### Commands & Command Palette

| API | Location | Purpose |
|-----|----------|---------|
| `vscode.commands.registerCommand()` | `extension.ts`, `src/commands/*.ts` | Register all ~30 commands for config editing, file operations, filtering |
| `vscode.commands.executeCommand()` | `tree/configTreeProvider.ts:56-63` | Programmatically set filter context keys for menu visibility |

**Command Categories** (all registered in `extension.ts:43-70` and command files):
- **Refresh**: `claudeConfig.refresh`
- **File Operations**: `claudeConfig.openFile`, `claudeConfig.createConfigFile`, `claudeConfig.revealInFile`, `claudeConfig.openPluginReadme`
- **Add Operations**: `claudeConfig.addPermissionRule`, `claudeConfig.addEnvVar`, `claudeConfig.addMcpServer`, `claudeConfig.addHook`
- **Edit Operations**: `claudeConfig.editValue`, `claudeConfig.togglePlugin`
- **Delete Operations**: `claudeConfig.deleteItem`, `claudeConfig.deletePlugin`
- **Move Operations**: `claudeConfig.moveToScope`, `claudeConfig.copyPluginToScope`, `claudeConfig.copyPermissionToScope`, `claudeConfig.copySettingToScope`
- **Filtering**: `claudeConfig.filter.*`, `claudeConfig.filterAll` (context-aware menu items)

**Affected Files**:
- `src/extension.ts` — command registration hub
- `src/commands/addCommands.ts` — add operations
- `src/commands/editCommands.ts` — edit and toggle operations
- `src/commands/deleteCommands.ts` — delete operations
- `src/commands/moveCommands.ts` — scope transfer operations
- `src/commands/openFileCommands.ts` — file operations
- `src/commands/pluginCommands.ts` — plugin-specific operations

### File System APIs

| API | Location | Purpose |
|-----|----------|---------|
| `vscode.workspace.workspaceFolders` | `config/configModel.ts:80`, `config/configDiscovery.ts` | Enumerate open workspace folders (multi-root workspace support) |
| `vscode.workspace.getWorkspaceFolder()` | `config/configDiscovery.ts` | Get workspace folder containing a given URI |
| `vscode.workspace.createFileSystemWatcher()` | `watchers/fileWatcher.ts:46, 58` | Watch config files for external changes (reload trigger) |
| `vscode.FileSystemWatcher` events | `watchers/fileWatcher.ts:47-49, 61-63` | Monitor `onDidChange`, `onDidCreate`, `onDidDelete` for all config files |
| `vscode.RelativePattern` | `watchers/fileWatcher.ts:59` | Pattern-based file watching with absolute directory paths (user home, /etc) |
| `vscode.Uri.file()` | Multiple files | Convert file paths to VS Code URIs |
| `vscode.workspace.onDidChangeWorkspaceFolders()` | `watchers/fileWatcher.ts:28` | Detect workspace folder additions/removals and trigger reload |

**Affected Files**:
- `src/config/configDiscovery.ts` — workspace folder detection and config file path resolution
- `src/watchers/fileWatcher.ts` — implements ConfigFileWatcher for auto-refresh
- `src/config/configModel.ts` — multi-root workspace handling

### Diagnostics & Code Intelligence

| API | Location | Purpose |
|-----|----------|---------|
| `vscode.languages.createDiagnosticCollection()` | `validation/diagnostics.ts:12` | Create diagnostic collection for config file validation errors |
| `vscode.DiagnosticCollection` | `validation/diagnostics.ts` | Store and update validation issues as red/yellow squiggles |
| `vscode.Diagnostic` | `validation/diagnostics.ts:38-42` | Individual diagnostic (error/warning) with message, range, severity |
| `vscode.DiagnosticSeverity` | `validation/diagnostics.ts:41` | Enum: Error, Warning, Information, Hint |
| `vscode.Range` | `validation/diagnostics.ts:39` | Line/column range for diagnostic placement |

**Affected Files**:
- `src/validation/diagnostics.ts` — ConfigDiagnostics class wrapping DiagnosticCollection
- `src/validation/schemaValidator.ts` — validation logic that produces ValidationIssues
- `src/extension.ts:35-40` — diagnostics setup and refresh on config change

### Text Editor & Selection Sync

| API | Location | Purpose |
|-----|----------|---------|
| `vscode.window.onDidChangeTextEditorSelection()` | `extension.ts:138` | Sync cursor position in config file editor → tree selection |
| `vscode.window.onDidChangeActiveTextEditor()` | `extension.ts:146` | Switch tree view when user changes active editor tab |
| `vscode.TextEditor` | `extension.ts:112` | Access current editor document and cursor position |
| `TextEditor.selection`, `TextEditor.document.uri.fsPath` | `extension.ts:115-119` | Get current file path and line number for sync logic |
| `vscode.window.createOutputChannel()` | `extension.ts:19` | Debug logging to "Claude Code Config" output pane |

**Affected Files**:
- `src/extension.ts:100-153` — bidirectional editor ↔ tree sync with debouncing
- `src/utils/jsonLocation.ts` — line-to-keyPath mapping in JSON files

### File Decorations

| API | Location | Purpose |
|-----|----------|---------|
| `vscode.window.registerFileDecorationProvider()` | `extension.ts:161` | Register custom decoration provider for tree item styling |
| `FileDecorationProvider` | `tree/nodes/pluginNode.ts` | Interface for dynamic decoration (dimming disabled plugins) |

**Affected Files**:
- `src/tree/nodes/pluginNode.ts` — PluginDecorationProvider implementation
- `src/extension.ts:156` — registration

### UI Dialogs & Input

| API | Location | Purpose |
|-----|----------|---------|
| `vscode.window.showInputBox()` | `commands/addCommands.ts`, `commands/editCommands.ts` | Prompt user for scalar values (permission rules, env var values, hook commands) |
| `vscode.window.showQuickPick()` | `commands/moveCommands.ts`, `commands/editCommands.ts` | Multiple-choice selection (scope to move to, hook event type, etc.) |
| `vscode.window.showErrorMessage()` | `commands/*.ts` | Display error dialogs |
| `vscode.window.showWarningMessage()` | Various | Display warnings |
| `vscode.window.showInformationMessage()` | Various | Display info messages |

**Affected Files**:
- `src/commands/addCommands.ts` — add permission, env var, MCP server, hook with prompts
- `src/commands/editCommands.ts` — edit scalar values with input boxes
- `src/commands/moveCommands.ts` — scope selection with quick pick
- `src/commands/deleteCommands.ts` — confirmation dialogs

### Context & Menus

| API | Location | Purpose |
|-----|----------|---------|
| `package.json` — `menus` section | | Define context menus for tree items and command palette |
| Context values (viewItem) | `tree/nodes/*.ts` | TreeItem.contextValue pattern drives menu visibility (e.g., `permissionRule.editable`) |
| When clauses | `package.json` menus | Regex patterns like `viewItem =~ /^permissionRule\\.editable/` gate command visibility |
| `setContext` command | `tree/configTreeProvider.ts:56-63` | Dynamically toggle filter context keys (e.g., `claudeConfig_filter_all`) |

**Affected Files**:
- `package.json` — `contributes.menus`, `contributes.commands`, `when` clauses
- `src/tree/nodes/*.ts` — contextValue assignments per node type
- `src/tree/configTreeProvider.ts` — filter context management

### Extension Lifecycle

| API | Location | Purpose |
|-----|----------|---------|
| `vscode.ExtensionContext` | `extension.ts:18` | Extension context passed to `activate()` |
| `context.subscriptions.push()` | `extension.ts:55, 159-163` | Register all disposable resources (commands, listeners, providers) for cleanup |
| `vscode.Disposable` | `config/configModel.ts:8`, `watchers/fileWatcher.ts:6`, `validation/diagnostics.ts:8` | Interface for cleanup handlers |
| `deactivate()` | `extension.ts:168-170` | Called when extension is deactivated; cleanup via subscriptions |

**Affected Files**:
- `src/extension.ts` — activate/deactivate entry points
- All config/tree/command/watcher/validation classes implement Disposable

## External File System Integration

### Config File Paths

The extension manages config files at multiple scopes:

1. **Managed** (read-only)
   - macOS: `/Library/Application Support/ClaudeCode/settings.json`
   - Linux: `/etc/claude-code/settings.json`
   - Discovered via `getManagedSettingsPath()` in `utils/platform.ts`

2. **User** (editable)
   - macOS/Linux: `~/.claude/settings.json`
   - Discovered via `getUserSettingsPath()` in `utils/platform.ts`

3. **Project Shared** (editable, version-controlled)
   - `{workspace-root}/.claude/settings.json`
   - Discovered via workspace folder enumeration

4. **Project Local** (editable, gitignored)
   - `{workspace-root}/.claude/settings.local.json`
   - Discovered via workspace folder enumeration

5. **MCP Servers** (separate config file)
   - `{workspace-root}/mcp.json` (referenced in settings via `enabledMcpjsonServers`)

**Affected Files**:
- `src/config/configDiscovery.ts` — path resolution logic
- `src/utils/platform.ts` — OS-specific path helpers
- `src/constants.ts` — magic strings (paths, keys)
- `src/config/configLoader.ts` — file I/O and JSON parsing
- `src/config/configWriter.ts` — file I/O and JSON serialization

### File Watching

Watches are established on:
- Workspace glob patterns: `**/.claude/settings.json`, `**/.claude/settings.local.json`, `**/mcp.json`
- User settings absolute path (via RelativePattern)
- Managed settings absolute path (via RelativePattern)
- Workspace folder changes

Triggers debounced reload (300ms) when any file changes/creates/deletes.

**Affected Files**:
- `src/watchers/fileWatcher.ts`

## JSON Schema Validation

| Artifact | Location | Purpose |
|----------|----------|---------|
| **JSON Schema** | `schemas/claude-code-settings.schema.json` | Draft-7 schema defining allowed config structure, property types, and constraints |
| **Schema Validator** | `src/validation/schemaValidator.ts` | Lightweight hand-rolled validator (no runtime JSON Schema library) |
| **Diagnostic Integration** | `src/validation/diagnostics.ts` | Publishes validation errors as VS Code diagnostics |

The schema covers:
- `permissions` (allow/deny/ask arrays)
- `env` (string key-value pairs)
- `hooks` (lifecycle events and commands)
- `sandbox` (network, commands, nested sandbox config)
- `enabledPlugins` (boolean toggles)
- Scalar settings (model, outputStyle, language, etc.)
- `mcpServers` (stdio and SSE configurations)
- `attribution` (commit/PR links)
- Various boolean and string settings

**Affected Files**:
- `schemas/claude-code-settings.schema.json` — schema definition
- `src/validation/schemaValidator.ts` — custom validation logic
- `src/validation/diagnostics.ts` — error reporting

## No Network/External Service Dependencies

The extension does NOT connect to:
- GitHub API (no config syncing or PR links)
- Claude Code cloud services (fully local)
- Any HTTP endpoints
- Package registries

It is a **purely local development tool** that reads/writes files and provides UI for Claude Code configuration management.

## Summary Table

| Integration | Type | Direction | Used For |
|------------|------|-----------|----------|
| VS Code TreeView API | API | Inbound | Config tree sidebar UI |
| VS Code Commands API | API | Bidirectional | Command registration and execution |
| VS Code FileSystemWatcher | API | Inbound | Config file change detection |
| VS Code Diagnostics | API | Outbound | Validation error reporting |
| VS Code Editor Selection | API | Bidirectional | Tree ↔ Editor sync |
| VS Code Workspace API | API | Inbound | Workspace folder enumeration |
| VS Code UI Dialogs | API | Outbound | User input (prompts, quick picks) |
| JSON Schema (Draft-7) | Format | Inbound | Config validation rules |
| Local File System | I/O | Bidirectional | Config file read/write |
| macOS/Linux Paths | System | Inbound | Managed config discovery |

## Code Patterns & Implementation Details

### TreeView Node Context Value Pattern

All tree items use `contextValue` strings following the pattern: `{nodeType}.{editable|readOnly}[.{overridden}]`

**Examples**:
- `permissionRule.editable` — rule can be edited/deleted
- `permissionRule.readOnly` — rule is from managed scope (locked)
- `permissionRule.editable.overridden` — rule is editable and has override in higher scope
- `scope.managed.missing` — managed scope with no config file

**menu `when` clauses use regex matching** (in `package.json`):
```json
{
  "when": "view == claudeConfigTree && viewItem =~ /^permissionRule\\.editable/"
}
```

**Affected Files**:
- `src/tree/nodes/baseNode.ts` — base ConfigTreeNode class sets contextValue
- `src/tree/nodes/*.ts` — each node type extends baseNode

### Bidirectional Editor ↔ Tree Sync

**Data Flow** (in `src/extension.ts`):

1. **Editor → Tree** (when cursor moves in config file):
   - `onDidChangeTextEditorSelection` fires
   - Debounced 300ms to avoid too many re-renders
   - `findKeyPathAtLine()` maps cursor line → config JSON path (e.g., `["permissions", "allow", 0]`)
   - `treeProvider.findNodeByKeyPath()` finds matching tree node
   - `treeView.reveal()` scrolls tree to node and selects it
   - `suppressTreeSync` flag prevents feedback loop

2. **Tree → Editor** (when tree item clicked):
   - `onDidChangeSelection` fires
   - Sets `suppressEditorSync` flag
   - Suppresses next editor sync for 100ms to avoid circular updates

**Affected Files**:
- `src/extension.ts` lines 100–153 (sync implementation)
- `src/utils/jsonLocation.ts` (line-to-keyPath mapping)
- `src/tree/configTreeProvider.ts:findNodeByKeyPath()` (tree lookup)

### Write Lifecycle Tracking

**In-Flight Write Prevention** (in `src/config/configWriter.ts`):

The extension prevents redundant file watcher reloads during writes:

```typescript
// Track paths currently being written to
const inFlightPaths = new Set<string>();

// Before write operation
inFlightPaths.add(filePath);

// After write completes
inFlightPaths.delete(filePath);

// File watcher checks: if (isWriteInFlight(filePath)) skip reload
```

**Timestamps logged** to output channel: `[HH:MM:SS.mmm] [write] {message}`

**Deactivation waits** for all writes to complete:
- Polls `getInFlightWriteCount()` every 100ms
- Max wait: 5 seconds
- Ensures data integrity before extension unloads

**Affected Files**:
- `src/config/configWriter.ts` lines 29–73 (lifecycle)
- `src/extension.ts` lines 268–271 (deactivation wait)
- `src/watchers/fileWatcher.ts:debouncedReload()` (checks in-flight)

### JSON Parsing with BOM Handling

**Safe JSON parsing** (`src/utils/json.ts`):

```typescript
export function safeParseJson<T>(content: string): ParseResult<T> {
  // Strip BOM if present (UTF-8 BOM: U+FEFF)
  const cleaned = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const data = JSON.parse(cleaned) as T;
  return { data };
}
```

Handles:
- UTF-8 BOM (common on Windows)
- Parse errors (returns with error message)
- Type safety with generics

**Write formatting**: 2-space indent, trailing newline

**Affected Files**:
- `src/utils/json.ts` (all JSON I/O)
- Used by `configLoader.ts` and `configWriter.ts`

### Validation: Hand-Rolled vs JSON Schema

**Why no runtime JSON Schema library?**

The project deliberately avoids adding a runtime dependency for JSON Schema validation.

**Instead**:
- `src/validation/schemaValidator.ts` contains custom validation logic (~100 lines)
- Validates most common mistakes: type errors, unknown keys, structure issues
- Stays in sync with actual config types via enums (`HookEventType`, `PermissionCategory`, etc.)
- `schemas/claude-code-settings.schema.json` serves as documentation (not parsed at runtime)

**Validation Checks**:
- Top-level keys against KNOWN_SETTING_KEYS
- Permission categories (allow/deny/ask)
- Hook event type names
- Scalar property types (string, boolean, object arrays)
- Required field presence

**Affected Files**:
- `src/validation/schemaValidator.ts` (custom validator, ~150 lines)
- `schemas/claude-code-settings.schema.json` (reference schema)
- `src/validation/diagnostics.ts` (error reporting)

### Multi-Root Workspace Support

**Workspace Folder Detection** (`src/config/configModel.ts`):

```typescript
isMultiRoot(): boolean {
  return vscode.workspace.workspaceFolders?.length ?? 0 > 1;
}

getWorkspaceFolderKeys(): string[] {
  return this.scopedConfigs.map((sc) => sc.workspaceFolderKey || '');
}

getAllScopes(workspaceFolderKey?: string): ScopedConfig[] {
  // Returns all 4 scopes for given workspace (or global if no key)
}
```

Each workspace folder gets:
- Separate project-shared config (`.claude/settings.json`)
- Separate project-local config (`.claude/settings.local.json`)
- Shared user and managed scopes

**TreeView Rendering**:
- Single-root: ScopeNodes at root level
- Multi-root: WorkspaceFolderNodes at root, then ScopeNodes nested

**Affected Files**:
- `src/config/configModel.ts` (ConfigStore)
- `src/tree/configTreeProvider.ts` (getSingleRootChildren, getMultiRootChildren)
- `src/config/configDiscovery.ts` (path resolution per workspace)

### Permission Rule Parsing

**Utility** (`src/utils/permissions.ts`):

Parses permission rule strings like:
- `"bash"` → tool by name
- `"bash#read"` → tool + specifier
- `"Bash"` (case-insensitive)

Rules can span multiple categories (allow/deny/ask):
- Exact match: `"bash"` in allow and `"bash#write"` in deny → same tool, different specificity
- Custom traversal detection: checks for `../` in permission strings

**Affected Files**:
- `src/utils/permissions.ts` (parsing logic)
- `src/tree/nodes/permissionRuleNode.ts` (displays parsed rules)

### Lock Scope Feature

**User Scope Locking** (`src/config/configModel.ts`):

```typescript
private lockedScopes = new Set<ConfigScope>();

lockScope(scope: ConfigScope): void {
  this.lockedScopes.add(scope);
  // Tree refresh triggered
}

isScopeLocked(scope: ConfigScope): boolean {
  return this.lockedScopes.has(scope);
}
```

- Prevents accidental edits to user global config
- Locked by default on activation
- Lock state persisted in context key: `claudeConfig_userScope_locked`
- UI: button toggles lock, visual feedback via decorations

**Affected Files**:
- `src/config/configModel.ts:27–38` (lock state)
- `src/extension.ts:31–36, 70–97` (lock initialization and commands)
- `src/tree/lockDecorations.ts` (visual decorations for locked items)

### Section Filtering

**Filter State** (`src/tree/configTreeProvider.ts`):

```typescript
private readonly _sectionFilter = new Set<SectionType>();

setSectionFilter(sections: ReadonlySet<SectionType>): void {
  this._sectionFilter.clear();
  for (const s of sections) {
    this._sectionFilter.add(s);
  }
  this.updateFilterUI();
  this.refresh();
}
```

- Empty set = show all sections
- Non-empty = only show selected sections
- "All" button provides mutual exclusivity (select all or custom)
- Persisted via context key: `claudeConfig_filterActive`

**Affected Files**:
- `src/tree/configTreeProvider.ts:15–38` (filter logic)
- `src/extension.ts:286–363` (quick pick UI)

## Error Handling Patterns

### File Operations

**Safe file read** (in `json.ts`):
- Check ENOENT (file not found) separately
- Return empty object instead of erroring
- Allow graceful degradation for missing files

**Safe file write** (in `configWriter.ts`):
- Validate path (traversal, symlink, whitelist check)
- Create parent directories recursively
- Track write in-flight to suppress watcher reloads

### Configuration Parsing

**Permissive parsing** (in `configModel.ts`):
- Config files can be malformed → validation reports issues, tree still renders
- Unknown keys → warnings only, no blocking errors
- Missing files → treated as empty object per scope

### Workspace Detection

**Handles no-workspace scenario** (in `extension.ts`):
- VS Code can open without a workspace folder
- Only managed + user scopes available
- No project-local or project-shared scopes

## Performance Optimizations

### TreeView Caching

**Child node cache** (in `configTreeProvider.ts`):
```typescript
private readonly childrenCache = new Map<string, ConfigTreeNode[]>();
```
- Caches children per parent node ID
- Cleared on `refresh()`
- Avoids re-computation during tree navigation

### Debouncing

**File watcher reload** (in `fileWatcher.ts`):
- 300ms debounce on file changes
- 5 second max wait (to ensure eventual consistency)
- Prevents thrashing from rapid changes

**Editor-tree sync** (in `extension.ts`):
- 300ms debounce on cursor movement
- 100ms suppress window to prevent feedback loops
- Prevents excessive tree reveals

### Lazy Evaluation

**Override resolution** (in `overrideResolver.ts`):
- Computed on-demand, not cached
- Only for currently displayed tree nodes
- Scope precedence: managed > projectLocal > projectShared > user
