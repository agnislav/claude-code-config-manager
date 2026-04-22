# Code Conventions

## TypeScript Configuration

The project uses **strict TypeScript mode** with the following compiler options:

- `"strict": true` — enforces strict null checks, strict function types, strict bind/call/apply
- `"module": "commonjs"` — CommonJS output
- `"target": "ES2022"` — modern JavaScript target
- `"esModuleInterop": true` — allows CommonJS/ES6 interoperability
- `"skipLibCheck": true` — speeds up compilation
- `"forceConsistentCasingInFileNames": true` — prevents case-sensitivity issues
- `"resolveJsonModule": true` — enables JSON imports
- `"declaration": true` — generates `.d.ts` files
- `"declarationMap": true` — source maps for declarations
- `"sourceMap": true` — enables source maps for debugging

**Import restriction**: `vscode` is an external module (not bundled via esbuild); all other dependencies are tree-shaken at build time.

## ESLint Rules

The project extends `eslint:recommended` and `@typescript-eslint/recommended` with custom rules:

- `"@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]` — unused variables trigger warnings; prefix with underscore to suppress (e.g., `_unused`)
- `"@typescript-eslint/no-explicit-any": "warn"` — `any` types discouraged
- `"no-throw-literal": "warn"` — avoid throwing non-Error values
- `"semi": "warn"` — semicolons required

**Ignoring patterns**: `out`, `dist`, `esbuild.js`

Run linting with `npm run lint`.

## Prettier Formatting

All code is formatted with Prettier (verified by committing formatted code):

- **Single quotes** — prefer `'string'` over `"string"`
- **Trailing commas** — always add trailing commas in arrays/objects
- **Print width** — 100 characters (line wrapping)
- **Tab width** — 2 spaces
- **Semicolons** — required

Example:
```typescript
const items = [
  'one',
  'two',
  'three',
];
```

## Naming Conventions

- **PascalCase** for classes, interfaces, enums, and type aliases
  - Example: `ConfigTreeNode`, `PermissionCategory`, `ScopedConfig`
  - Node classes: `ScopeNode`, `PermissionRuleNode`, `EnvVarNode`, `PluginNode`

- **camelCase** for variables, functions, methods, and properties
  - Example: `configStore`, `loadConfigFile()`, `getChildren()`, `onDidChange`

- **UPPER_SNAKE_CASE** for constants
  - Example: `SCOPE_LABELS`, `MANAGED_PATH_MACOS`, `KNOWN_SETTING_KEYS`
  - Used in `src/constants.ts` for mappings, file paths, and readonly sets
  - Also used for special constants like `EDITOR_SYNC_SUPPRESS_MS`, `DEBOUNCE_RELOAD_MS`

- **Descriptive names** for functions: prefix with action verbs
  - Example: `load`, `validate`, `discover`, `resolve`, `register`, `parse`, `watch`, `reload`

## File Organization

### Directory Structure

```
src/
├── extension.ts              # Entry point (activate/deactivate)
├── types.ts                  # All interfaces and enums
├── constants.ts              # Constants, lookup tables, paths
├── config/
│   ├── configDiscovery.ts    # Find config files per scope on disk
│   ├── configLoader.ts       # Read and parse JSON config files
│   ├── configModel.ts        # ConfigStore: in-memory model, reload, events
│   ├── configWriter.ts       # Write changes back to config files
│   └── overrideResolver.ts   # Resolve effective values across scopes
├── tree/
│   ├── configTreeProvider.ts # TreeDataProvider implementation
│   ├── lockDecorations.ts    # File decoration provider for locked items
│   └── nodes/                # TreeItem subclasses (one file per node type)
│       ├── baseNode.ts       # Abstract ConfigTreeNode base class
│       ├── scopeNode.ts      # ScopeNode (managed, user, project scopes)
│       ├── sectionNode.ts    # SectionNode (Permissions, Sandbox, etc.)
│       ├── permissionGroupNode.ts
│       ├── permissionRuleNode.ts
│       ├── hookEventNode.ts
│       ├── hookEntryNode.ts
│       ├── hookKeyValueNode.ts
│       ├── mcpServerNode.ts
│       ├── envVarNode.ts
│       ├── pluginNode.ts     # Has checkbox state & decoration support
│       ├── settingNode.ts
│       ├── settingKeyValueNode.ts
│       └── sandboxPropertyNode.ts
├── commands/
│   ├── addCommands.ts        # Add permission rule, env var, MCP server, hook
│   ├── editCommands.ts       # Edit scalar values, toggle settings
│   ├── deleteCommands.ts     # Delete items from config
│   ├── moveCommands.ts       # Move items between scopes
│   ├── openFileCommands.ts   # Open config file in editor
│   └── pluginCommands.ts     # Plugin-specific operations
├── validation/
│   ├── schemaValidator.ts    # Config validation (hand-written, no lib)
│   └── diagnostics.ts        # VS Code DiagnosticCollection integration
├── watchers/
│   └── fileWatcher.ts        # Auto-refresh on external config file changes
└── utils/
    ├── platform.ts           # OS-specific paths (macOS/Linux)
    ├── json.ts               # JSON read/write helpers with error handling
    ├── permissions.ts        # Permission rule parsing & overlap detection
    ├── pluginMetadata.ts     # Plugin metadata service (cached)
    ├── jsonLocation.ts       # Map JSON key paths to line numbers
    └── validation.ts         # KeyPath validation helper
```

### Node File Pattern

Each tree node type lives in its own file under `src/tree/nodes/`:

- `baseNode.ts` — abstract `ConfigTreeNode` class with finalization logic
- `scopeNode.ts` — `ScopeNode` extends `ConfigTreeNode`
- `permissionRuleNode.ts` — `PermissionRuleNode` extends `ConfigTreeNode`
- etc.

All node classes must:
1. Extend `ConfigTreeNode`
2. Define `readonly nodeType: string` for use in `contextValue` patterns
3. Call `this.finalize()` at the **end** of their constructor (after all fields assigned)
4. Implement `getChildren(): ConfigTreeNode[]` (may return empty array)
5. Use `collapsibleState` to indicate expandability: `Collapsed`, `Expanded`, or `None`

**Constructor pattern:**
```typescript
export class EnvVarNode extends ConfigTreeNode {
  readonly nodeType = 'envVar';

  constructor(label: string, context: NodeContext) {
    super(label, vscode.TreeItemCollapsibleState.None, context);
    this.description = currentValue;  // Set properties before finalize
    this.finalize();  // MUST be called at end
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}
```

### Command Organization

Commands are registered by action type, not feature:

- `addCommands.ts` — add permission rules, env vars, MCP servers, hooks
- `editCommands.ts` — edit scalar values, toggle settings
- `deleteCommands.ts` — delete items from config
- `moveCommands.ts` — move items between scopes
- `openFileCommands.ts` — open config files in editor
- `pluginCommands.ts` — plugin-specific operations

Each file exports a `register*Commands()` function that:
```typescript
export function registerAddCommands(
  context: vscode.ExtensionContext,
  configStore: ConfigStore,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeConfig.addPermissionRule', async (node?: ConfigTreeNode) => {
      // Implementation
    }),
  );
}
```

Commands are registered in `src/extension.ts` during `activate()`.

## Import Patterns

### Absolute Imports

All imports use paths relative to `src/`:

```typescript
import { ConfigStore } from './config/configModel';
import { SCOPE_LABELS } from './constants';
import { NodeContext } from './types';
```

### External Module Handling

```typescript
import * as vscode from 'vscode';  // External, not bundled
import * as fs from 'fs';           // Node.js builtin
import * as path from 'path';       // Node.js builtin
import * as os from 'os';           // Node.js builtin
```

### No Circular Imports

The codebase is structured to avoid circular dependencies:

- `types.ts` imports nothing internal (only declares interfaces/enums)
- `constants.ts` imports only `types.ts` and Node.js builtins
- `utils/` modules import only `types.ts`, `constants.ts`, and Node.js builtins
- `config/` modules can import from utils and types
- `tree/` modules can import from config, utils, and types
- `commands/` modules can import from all above

## Error Handling Patterns

### Safe JSON Parsing

All JSON parsing uses `safeParseJson<T>()` from `src/utils/json.ts`:

```typescript
export interface ParseResult<T> {
  data: T;
  error?: string;
}

const result = safeParseJson<ClaudeCodeConfig>(content);
if (result.error) {
  // Handle error
  return;
}
// Use result.data
```

Features:
- Strips BOM (Byte Order Mark) if present
- Returns typed result with error in separate field
- Never throws exceptions

### Error Messages

All errors are wrapped with context:

```typescript
try {
  addPermissionRule(filePath, category.value, rule.trim());
} catch (error) {
  await showWriteError(filePath, error, () => {
    addPermissionRule(filePath, category.value, rule.trim());
  });
}
```

The `showWriteError()` helper:
- Shows error message to user
- Provides retry callback
- Logs detailed info to output channel

### File System Operations

- Use `fs.readFileSync()` and `fs.writeFileSync()` (extension runs synchronously)
- Always check for `ENOENT` (file not found) separately from other errors
- Validate file paths before writing (check traversal, symlinks, whitelist)

```typescript
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

try {
  const result = readJsonFile<T>(filePath);
  if (result.error) {
    throw new Error(`Cannot parse ${filePath}: ${result.error}`);
  }
  return result.data;
} catch (error) {
  if (isNodeError(error) && error.code === 'ENOENT') {
    return getDefault();
  }
  throw error;
}
```

### Write Lifecycle Tracking

The `configWriter.ts` module tracks in-flight writes to prevent redundant reloads:

```typescript
export function isWriteInFlight(filePath: string): boolean {
  return inFlightPaths.has(filePath);
}

export function getInFlightWriteCount(): number {
  return inFlightPaths.size;
}
```

Used by:
- File watcher to suppress reloads during writes
- Deactivation logic to wait for all writes to complete before shutdown

## ContextValue Pattern for Tree Nodes

Tree items use a structured `contextValue` pattern to control menu visibility:

**Format**: `{nodeType}.{editable|readOnly}[.overridden]`

**Examples**:
- `scope.readOnly` — a managed (read-only) scope node
- `permissionRule.editable` — an editable permission rule
- `permissionRule.editable.overridden` — an editable permission rule overridden by higher scope
- `setting.readOnly` — a read-only setting
- `plugin.editable` — an editable plugin with checkbox support

**Generation** (in `baseNode.ts`):

```typescript
protected computeContextValue(): string {
  const parts = [this.nodeType];
  parts.push(this.nodeContext.isReadOnly ? 'readOnly' : 'editable');
  if (this.nodeContext.isOverridden) parts.push('overridden');
  return parts.join('.');
}
```

**Menu Visibility** (in `package.json`):

```json
{
  "command": "claudeConfig.editValue",
  "when": "viewItem =~ /\\.editable/ && viewItem =~ /setting|envVar|sandboxProperty/",
  "group": "1_edit"
}
```

This regex pattern:
- `viewItem =~ /\.editable/` — must have `.editable` (not `.readOnly`)
- `viewItem =~ /setting|envVar|sandboxProperty/` — must be one of these node types
- Nodes with `.overridden` are still matched (the regex doesn't exclude it)

**Context-sensitive menus** (in `package.json`):
- Commands use regex patterns to match node types and editability
- Disabled commands use `"when": "false"` in command palette to hide them
- Inline commands (group `inline@N`) appear in context menus vs. regular menus

## Type System

### Enum Usage

Enums use string literal values for JSON compatibility:

```typescript
export enum ConfigScope {
  Managed = 'managed',
  User = 'user',
  ProjectShared = 'projectShared',
  ProjectLocal = 'projectLocal',
}

export enum SectionType {
  Permissions = 'permissions',
  Sandbox = 'sandbox',
  Hooks = 'hooks',
  McpServers = 'mcpServers',
  Environment = 'env',
  Plugins = 'plugins',
  Settings = 'settings',
}
```

### Interface Patterns

- Use `interface` for object shapes (not `type`)
- Use `Partial<T>` to mark optional object structures
- Use `Record<K, V>` for maps/lookups
- Use `ReadonlySet<T>` for immutable collections

```typescript
export const SCOPE_LABELS: Record<ConfigScope, string> = {
  [ConfigScope.Managed]: 'Managed (Enterprise)',
  // ...
};

export interface ScopedConfig {
  scope: ConfigScope;
  filePath?: string;
  fileExists: boolean;
  data: ClaudeCodeConfig;
  mcpFilePath?: string;
  mcpData?: McpConfig;
}
```

### Utility Types

- `Partial<Record<T, U>>` for optional mapped types
- `NodeJS.ErrnoException` for file system errors
- `vscode.TreeItemCollapsibleState` for expandability
- `vscode.DiagnosticSeverity` for issue severity

## Validation Patterns

### Lightweight Validation

No JSON Schema libraries at runtime — validation is hand-written in `src/validation/schemaValidator.ts`:

```typescript
export interface ValidationIssue {
  message: string;
  path: string;
  severity: 'error' | 'warning';
  line?: number;  // 0-based line number if resolvable
}

export function validateConfig(config: unknown, sourceText?: string): ValidationIssue[] {
  // Hand-written checks for permissions, hooks, scalar types, etc.
}
```

This keeps the bundle small and avoids schema library overhead.

**Validation scope**:
- Unknown top-level keys (warnings)
- Permission categories (allow/deny/ask)
- Hook event types (enum validation)
- Scalar type validation (string, boolean, number)
- Environment variables (name/value pairs)
- Enabled plugins (array of plugin names)

### Diagnostic Integration

Validation issues are mapped to VS Code diagnostics:

```typescript
class ConfigDiagnostics implements vscode.Disposable {
  validateFile(filePath: string): void {
    const issues = validateConfig(parsed.data, sourceText);
    const diagnostics = issues.map((issue) => this.toDiagnostic(issue));
    this.diagnosticCollection.set(uri, diagnostics);
  }
}
```

Issues with `line` number are placed at specific lines; errors without line info appear at line 0.

## Event Handling

### Config Change Events

The `ConfigStore` class uses VS Code's `EventEmitter` pattern:

```typescript
export class ConfigStore implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<string | undefined>();
  readonly onDidChange = this._onDidChange.event;

  reload(workspaceFolderUri?: string): void {
    // ... reload logic
    this._onDidChange.fire(workspaceFolderUri);  // Fires with workspace key or undefined
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}

// Usage in extension.ts
configStore.onDidChange(() => {
  runDiagnostics(configStore, diagnostics);
});
```

Events fire with:
- `undefined` — full reload (all workspaces changed)
- workspace URI string — single workspace folder changed

### Disposable Pattern

All resources that need cleanup implement `vscode.Disposable`:

```typescript
export class ConfigDiagnostics implements vscode.Disposable {
  dispose(): void {
    this.diagnosticCollection.clear();
  }
}

// In extension.ts
context.subscriptions.push(diagnostics);  // Auto-disposed on deactivation
```

Disposables include:
- `ConfigStore` — manages config data
- `ConfigTreeProvider` — manages tree data
- `ConfigFileWatcher` — manages file watchers
- `ConfigDiagnostics` — manages diagnostic collection
- Command registrations
- File decoration providers

### Debouncing

File watchers use debounced reload to coalesce multiple events:

```typescript
private debouncedReload(filePath?: string): void {
  if (this.reloadTimeout) clearTimeout(this.reloadTimeout);

  this.reloadTimeout = setTimeout(() => {
    if (isWriteInFlight(filePath)) {
      // Don't reload if we just wrote this file
      return;
    }
    this.configStore.reload(workspaceFolderUri);
  }, DEBOUNCE_RELOAD_MS);
}
```

Constants:
- `DEBOUNCE_RELOAD_MS` — delay before reload (default 300ms)
- `DEBOUNCE_MAX_WAIT_MS` — maximum wait for debounce coalescing

## Common Utility Functions

### JSON Operations (`src/utils/json.ts`)

- `safeParseJson<T>(content: string): ParseResult<T>` — parse with error handling, strip BOM
- `readJsonFile<T>(filePath: string): ParseResult<T>` — read file and parse
- `writeJsonFile(filePath: string, data: unknown): void` — write formatted JSON (2 spaces, trailing newline)

### Permission Utilities (`src/utils/permissions.ts`)

- `parsePermissionRule(rule: string): ParsedPermissionRule` — extract tool and specifier
- `formatPermissionRule(parsed: ParsedPermissionRule): string` — format back to string
- `rulesOverlap(ruleA: string, ruleB: string): boolean` — check for conflicts using wildcard matching

### Platform Utilities (`src/utils/platform.ts`)

- `getUserSettingsPath(): string` — resolve to `~/.claude/settings.json`
- `getManagedSettingsPath(): string` — resolve to platform-specific managed config dir
- Path resolution for macOS (`/Library/Application Support/ClaudeCode`) and Linux (`/etc/claude-code`)

### Validation Utilities (`src/utils/validation.ts`)

- `validateKeyPath(keyPath: string[], minLength: number, context: string): boolean` — validate path segments
  - Logs to console.warn and shows error message on failure
  - Used before unsafe array indexing

### Plugin Metadata Service (`src/utils/pluginMetadata.ts`)

- Singleton service that caches plugin metadata
- Invalidated on config reload
- Lazy-loaded from plugin directories

## Code Documentation

- **JSDoc comments** for public functions and classes
- **Inline comments** for complex logic (especially regex, wildcard matching)
- **Section comments** for major logical blocks (e.g., `// ── Permissions ────`)

Example:
```typescript
/**
 * Parses a permission rule string like "Bash(npm run *)" into tool and specifier.
 * - "Bash" → { tool: "Bash" }
 * - "Bash(npm run *)" → { tool: "Bash", specifier: "npm run *" }
 * Handles wildcards in specifier for overlap detection.
 */
export function parsePermissionRule(rule: string): ParsedPermissionRule {
  // Implementation
}
```

## Build System

### Entry Point

- TypeScript source: `src/extension.ts`
- Bundle output: `dist/extension.js`
- Bundler: esbuild (configured in `esbuild.js`)

### Build Scripts

- `npm run compile` — type-check + esbuild bundle
- `npm run watch` — esbuild watch mode (for development)
- `npm run typecheck` — tsc --noEmit only (quick type check)
- `npm run build` — production bundle (minified, no source maps)
- `npm run lint` — ESLint on src/

### esbuild Configuration

- **Platform**: node
- **Format**: CommonJS
- **External modules**: vscode (provided by VS Code runtime)
- **Minify**: only in production mode
- **Source maps**: always generated except in production

### No Runtime Dependencies

The extension has **zero runtime dependencies** — everything is bundled into `dist/extension.js`. Only `vscode` is marked as external (provided by VS Code).

## Scope and Precedence

### Config Scopes

Scopes define where config settings come from, with strict precedence:

1. **Managed** (highest precedence) — Enterprise policies (read-only)
2. **Project Local** — `.claude/settings.local.json` in workspace root (local overrides, gitignored)
3. **Project Shared** — `.claude/settings.json` in workspace root (committed to git)
4. **User** (lowest precedence) — `~/.claude/settings.json` (global user preferences)

When resolving a setting, the first scope that defines it wins. Lower scopes are "overridden" by higher scopes.

### Override Detection

When a value is defined in multiple scopes, the `overrideResolver` marks it as overridden in lower scopes:

```typescript
export interface ResolvedValue<T> {
  effectiveValue: T;
  definedInScope: ConfigScope;
  overriddenByScope?: ConfigScope;  // Set if value is defined in higher scope
  isOverridden: boolean;  // true if overriddenByScope is set
}
```

Tree nodes use this to:
- Show override indicators in tooltips
- Add "(overridden by Scope)" to descriptions
- Apply styling/icons for overridden items

## Design Patterns Used

### Factory Pattern

`configDiscovery.ts` uses factory-like discovery:
```typescript
function discoverConfigPaths(): DiscoveredPaths {
  // Discovers all config files for all scopes
  return {
    managed: { exists, filePath },
    user: { exists, filePath },
    projectShared: { exists, filePath },
    projectLocal: { exists, filePath },
  };
}
```

### Observer Pattern

`ConfigStore` uses EventEmitter (VS Code pattern):
```typescript
configStore.onDidChange(() => {
  // React to config changes
});
```

### Strategy Pattern

Different node types implement `ConfigTreeNode` with their own `getChildren()` strategy:
- `ScopeNode` returns section nodes
- `SectionNode` returns typed child nodes (rules, vars, servers, etc.)
- Leaf nodes return empty array

### Singleton Pattern

`PluginMetadataService` uses singleton with instance():
```typescript
const service = PluginMetadataService.getInstance();
```

### Disposable Pattern

All cleanup is managed via `vscode.Disposable`:
```typescript
context.subscriptions.push(...);  // Auto-disposed on deactivation
```

## Multi-workspace Support

The codebase supports VS Code multi-workspace folders:

- `ConfigStore` maintains separate config per workspace folder (keyed by URI)
- `ConfigTreeProvider` shows nodes organized by workspace
- Commands operate on the context node (includes workspace folder key)
- File watcher watches patterns across all workspace folders
- Reload can be triggered for single workspace or global

Functions with workspace folder parameters:
```typescript
configStore.getScopedConfig(scope, workspaceFolderUri?: string)
configStore.getAllScopes(workspaceFolderUri?: string)
configStore.getDiscoveredPaths(workspaceFolderUri?: string)
```

When parameter is omitted, falls back to first workspace folder or global key.
