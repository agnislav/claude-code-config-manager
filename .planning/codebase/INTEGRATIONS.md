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
