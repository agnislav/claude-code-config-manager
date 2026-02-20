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

**Import restriction**: `vscode` is an external module (not bundled); all other dev dependencies are tree-shaken at build time.

## ESLint Rules

The project extends `eslint:recommended` and `@typescript-eslint/recommended` with custom rules:

- `"@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]` — unused variables trigger warnings; prefix with underscore to suppress (e.g., `_unused`)
- `"@typescript-eslint/no-explicit-any": "warn"` — `any` types discouraged
- `"no-throw-literal": "warn"` — avoid throwing non-Error values
- `"semi": "warn"` — semicolons required

**Ignoring patterns**: `out`, `dist`, `esbuild.js`

## Prettier Formatting

All code is formatted with Prettier:

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
  - Node classes: `ScopeNode`, `PermissionRuleNode`, `EnvVarNode`

- **camelCase** for variables, functions, methods, and properties
  - Example: `configStore`, `loadConfigFile()`, `getChildren()`

- **UPPER_SNAKE_CASE** for constants
  - Example: `SCOPE_LABELS`, `MANAGED_PATH_MACOS`, `KNOWN_SETTING_KEYS`
  - Used in `src/constants.ts` for mappings, file paths, and readonly sets

- **Descriptive names** for functions: prefix with action verbs
  - Example: `load`, `validate`, `discover`, `resolve`, `register`, `parse`

## File Organization

### Directory Structure

```
src/
├── extension.ts              # Entry point
├── types.ts                  # All interfaces and enums
├── constants.ts              # Constants and lookup tables
├── config/                   # Config discovery, loading, writing, model
├── tree/                     # TreeView UI components
│   └── nodes/                # Node classes (one file per node type)
├── commands/                 # Command handlers (grouped by action type)
├── validation/               # Schema validation and diagnostics
├── watchers/                 # File system watchers
└── utils/                    # Utility functions
```

### Node File Pattern

Each tree node type lives in its own file under `src/tree/nodes/`:

- `baseNode.ts` — abstract `ConfigTreeNode` class
- `scopeNode.ts` — `ScopeNode` extends `ConfigTreeNode`
- `permissionRuleNode.ts` — `PermissionRuleNode` extends `ConfigTreeNode`
- etc.

All node classes must:
1. Extend `ConfigTreeNode`
2. Define `readonly nodeType: string`
3. Call `this.finalize()` at the **end** of their constructor
4. Implement `getChildren(): ConfigTreeNode[]`

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
```

### No Circular Imports

The codebase is structured to avoid circular dependencies:

- `types.ts` imports nothing internal
- `constants.ts` imports only `types.ts`
- `utils/` modules import only `types.ts` and `constants.ts`
- Core modules can import from utils and types

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

### Error Messages

All errors are wrapped and re-thrown with context:

```typescript
try {
  addPermissionRule(filePath, category.value, rule.trim());
} catch (error) {
  vscode.window.showErrorMessage(
    `Failed to add permission rule: ${error instanceof Error ? error.message : String(error)}`,
  );
}
```

### File System Operations

- Use `fs.readFileSync()` and `fs.writeFileSync()` (extension runs synchronously)
- Always check for `ENOENT` (file not found) separately from other errors:

```typescript
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
```

## ContextValue Pattern for Tree Nodes

Tree items use a structured `contextValue` pattern to control menu visibility:

**Format**: `{nodeType}.{editable|readOnly}[.overridden]`

**Examples**:
- `scope.readOnly` — a managed (read-only) scope node
- `permissionRule.editable` — an editable permission rule
- `permissionRule.editable.overridden` — an editable permission rule that's overridden by higher scope
- `setting.readOnly` — a read-only setting

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

## Type System

### Enum Usage

Enums use string literal values for compatibility with JSON:

```typescript
export enum ConfigScope {
  Managed = 'managed',
  User = 'user',
  ProjectShared = 'projectShared',
  ProjectLocal = 'projectLocal',
}
```

### Interface Patterns

- Use `interface` for object shapes (not `type`)
- Use `Partial<T>` to mark optional object structures
- Use `Record<K, V>` for maps/lookups:

```typescript
export const SCOPE_LABELS: Record<ConfigScope, string> = {
  [ConfigScope.Managed]: 'Managed (Enterprise)',
  // ...
};
```

### Utility Types

- `ReadonlySet<T>` for immutable collections
- `Partial<Record<T, U>>` for optional mapped types
- `NodeJS.ErrnoException` for file system errors

## Validation Patterns

### Lightweight Validation

No JSON Schema libraries at runtime — validation is hand-written in `src/validation/schemaValidator.ts`:

```typescript
export interface ValidationIssue {
  message: string;
  path: string;
  severity: 'error' | 'warning';
  line?: number;
}

export function validateConfig(config: unknown, sourceText?: string): ValidationIssue[] {
  // Hand-written checks
}
```

This keeps the bundle small and avoids schema library overhead.

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

## Event Handling

### Config Change Events

The `ConfigStore` class uses VS Code's `EventEmitter` pattern:

```typescript
export class ConfigStore implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<string | undefined>();
  readonly onDidChange = this._onDidChange.event;

  reload(): void {
    // ... reload logic
    this._onDidChange.fire(undefined);
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}

// Usage
configStore.onDidChange(() => {
  runDiagnostics(configStore, diagnostics);
});
```

### Disposable Pattern

All resources that need cleanup implement `vscode.Disposable`:

```typescript
export class ConfigDiagnostics implements vscode.Disposable {
  dispose(): void {
    this.diagnosticCollection.clear();
  }
}

context.subscriptions.push(diagnostics);  // Auto-disposed on deactivation
```

## Common Utility Functions

### JSON Operations (`src/utils/json.ts`)

- `safeParseJson<T>(content: string): ParseResult<T>` — parse with error handling
- `readJsonFile<T>(filePath: string): ParseResult<T>` — read and parse file
- `writeJsonFile(filePath: string, data: unknown): void` — write formatted JSON (2 spaces, trailing newline)

### Permission Utilities (`src/utils/permissions.ts`)

- `parsePermissionRule(rule: string): ParsedPermissionRule` — extract tool and specifier
- `formatPermissionRule(parsed: ParsedPermissionRule): string` — format back to string
- `rulesOverlap(ruleA: string, ruleB: string): boolean` — check for conflicts using wildcard matching

### Platform Utilities (`src/utils/platform.ts`)

- Path resolution for macOS (`/Library/Application Support/ClaudeCode`) and Linux (`/etc/claude-code`)
- Conditional logic based on `process.platform`

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
- `npm run watch` — esbuild watch mode
- `npm run typecheck` — tsc --noEmit only
- `npm run build` — production bundle (minified)
- `npm run lint` — ESLint on src/

### No Runtime Dependencies

The extension has **zero runtime dependencies** — everything is bundled into `dist/extension.js`. Only `vscode` is marked as external (provided by VS Code).
