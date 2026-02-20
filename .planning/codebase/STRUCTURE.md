# Project Structure — Claude Code Config Manager

## Directory Layout

```
claude-code-config-manager/
├── src/                           # TypeScript source code
│   ├── extension.ts               # VS Code extension entry point
│   ├── types.ts                   # All TypeScript interfaces and enums
│   ├── constants.ts               # Labels, icons, file paths, known keys
│   │
│   ├── config/                    # Configuration discovery, loading, modeling, writing
│   │   ├── configDiscovery.ts     # Finds config file paths per scope
│   │   ├── configLoader.ts        # Reads and parses JSON config files
│   │   ├── configModel.ts         # ConfigStore: in-memory model + change events
│   │   ├── configWriter.ts        # Writes changes back to disk
│   │   └── overrideResolver.ts    # Computes effective values and override metadata
│   │
│   ├── tree/                      # Tree view presentation layer
│   │   ├── configTreeProvider.ts  # TreeDataProvider implementation + caching
│   │   └── nodes/                 # TreeItem subclasses (one file per node type)
│   │       ├── baseNode.ts        # ConfigTreeNode base class
│   │       ├── scopeNode.ts       # Managed / User / Project Shared / Project Local
│   │       ├── sectionNode.ts     # Permissions / Sandbox / Hooks / MCP / Env / Plugins / Settings
│   │       ├── permissionGroupNode.ts  # Allow / Deny / Ask groups
│   │       ├── permissionRuleNode.ts   # Individual permission rules
│   │       ├── hookEventNode.ts   # Hook event types (SessionStart, etc.)
│   │       ├── hookEntryNode.ts   # Individual hook entries
│   │       ├── mcpServerNode.ts   # MCP server entries
│   │       ├── mcpServerNode.ts   # MCP server entries
│   │       ├── envVarNode.ts      # Environment variable entries
│   │       ├── sandboxPropertyNode.ts  # Sandbox properties
│   │       ├── settingNode.ts     # Top-level scalar settings
│   │       ├── pluginNode.ts      # Plugin entries (with checkbox support)
│   │       └── (baseNode.ts structure inherited by all above)
│   │
│   ├── commands/                  # User commands grouped by operation type
│   │   ├── addCommands.ts         # Add permission rule, env var, hook, MCP server
│   │   ├── editCommands.ts        # Edit scalar values, toggle booleans
│   │   ├── deleteCommands.ts      # Delete items from config
│   │   ├── moveCommands.ts        # Move items between scopes or categories
│   │   ├── openFileCommands.ts    # Open config files in editor
│   │   └── pluginCommands.ts      # Plugin-specific operations
│   │
│   ├── watchers/                  # File system monitoring
│   │   └── fileWatcher.ts         # Auto-refresh config on external file changes
│   │
│   ├── validation/                # JSON schema validation and diagnostics
│   │   ├── schemaValidator.ts     # Lightweight structural validator (no runtime library)
│   │   └── diagnostics.ts         # VS Code DiagnosticCollection integration
│   │
│   └── utils/                     # Utility functions
│       ├── json.ts                # Read/write JSON helpers
│       ├── platform.ts            # OS-specific paths (macOS/Linux)
│       ├── permissions.ts         # Permission rule overlap detection
│       ├── jsonLocation.ts        # Map JSON paths to source line numbers
│       └── pluginMetadata.ts      # Plugin metadata lookup
│
├── schemas/                       # JSON Schema definitions
│   └── claude-code-settings.schema.json  # Official Claude Code schema
│
├── resources/                     # Extension assets
│   └── icons/
│       └── claude-config.svg      # Activity bar icon
│
├── package.json                   # VS Code extension manifest + npm scripts
├── tsconfig.json                  # TypeScript configuration
├── eslintrc.json                  # ESLint rules
├── .prettierrc.json               # Prettier formatting rules
├── esbuild.js                     # Bundling configuration
├── vsce.json                      # VSCE packaging configuration
└── CLAUDE.md                      # Project instructions and conventions
```

---

## File Organization Patterns

### Config Layer (`src/config/`)

**Responsibility**: Configuration discovery, loading, modeling, mutation, and override resolution.

| File | Purpose | Key Exports |
|------|---------|------------|
| `configDiscovery.ts` | Finds config file paths on disk without reading them | `DiscoveredPaths`, `discoverConfigPaths()`, `getAllWatchPaths()` |
| `configLoader.ts` | Parses JSON config files | `loadConfigFile()`, `loadMcpFile()` |
| `configModel.ts` | In-memory model with change events | `ConfigStore` class, `ScopedConfig` |
| `configWriter.ts` | Writes changes back to disk (pure functions) | `addPermissionRule()`, `setEnvVar()`, `setPluginEnabled()`, etc. |
| `overrideResolver.ts` | Computes effective values and override metadata | `resolveScalarOverride()`, `resolvePermissionOverride()`, `resolveEnvOverride()`, `resolveSandboxOverride()`, `resolvePluginOverride()` |

**Data Flow**:
```
discoverConfigPaths() → configLoader → ConfigStore → overrideResolver
```

---

### Tree Layer (`src/tree/`)

**Responsibility**: Build and maintain the hierarchical tree view presented to users.

#### configTreeProvider.ts
- Implements `vscode.TreeDataProvider<ConfigTreeNode>`
- Caches parent/children relationships for reveal support
- Manages section filtering via context keys
- Provides `findNodeByKeyPath()` for editor-tree sync

#### nodes/ Directory
One file per node type. All extend `ConfigTreeNode` abstract base:

| File | Node Type | Parent | Children | Editable | Notes |
|------|-----------|--------|----------|----------|-------|
| `baseNode.ts` | (abstract) | — | — | — | Implements common TreeItem logic |
| `scopeNode.ts` | `scope` | Root or WorkspaceFolder | SectionNodes | Read-only (Managed); Editable (others) | Labels: "Managed (Enterprise)", "User", "Project (Shared)", "Project (Local)" |
| `sectionNode.ts` | `section.{permissions,sandbox,hooks,mcpServers,env,plugins,settings}` | ScopeNode | Type-specific children | Inherits from parent scope | Section header showing item count |
| `permissionGroupNode.ts` | `permissionGroup` | SectionNode (Permissions) | PermissionRuleNodes | Read-only (Managed) | Labels: "Allow", "Deny", "Ask" |
| `permissionRuleNode.ts` | `permissionRule` | PermissionGroupNode | (none) | Editable (unless read-only) | Leaf; right-click to edit/delete/move |
| `hookEventNode.ts` | `hookEvent` | SectionNode (Hooks) | HookEntryNodes | Read-only (Managed) | Labels: "SessionStart", "PreToolUse", etc. (from enum) |
| `hookEntryNode.ts` | `hookEntry` | HookEventNode | (none) | Editable (unless read-only) | Leaf; displays hook command summary |
| `mcpServerNode.ts` | `mcpServer` | SectionNode (McpServers) | (nested as scalars or expandable) | Editable | Shows server name; right-click to edit/delete |
| `envVarNode.ts` | `envVar` | SectionNode (Environment) | (none) | Editable | Leaf; key=value display |
| `sandboxPropertyNode.ts` | `sandboxProperty` | SectionNode (Sandbox) | (nested expandable for objects/arrays) | Editable | Handles nested structure (e.g., `network.allowedDomains`) |
| `settingNode.ts` | `setting` | SectionNode (Settings) | (none) | Editable | Leaf; top-level scalar settings |
| `pluginNode.ts` | `plugin` | SectionNode (Plugins) | (none) | Toggleable (checkbox) | Includes plugin metadata lookup and icon dimming |

**Convention**: All nodes compute `contextValue` to control menu visibility:
- Format: `{nodeType}.{editable|readOnly}[.overridden][.missing]`
- Example: `permissionRule.editable.overridden` enables edit/delete/move menus

---

### Command Layer (`src/commands/`)

**Responsibility**: Handle user actions and integrate all layers.

| File | Commands | Triggers |
|------|----------|----------|
| `addCommands.ts` | `claudeConfig.add{PermissionRule,EnvironmentVariable,Hook,McpServer}` | Context menu on SectionNodes |
| `editCommands.ts` | `claudeConfig.edit{ScalarValue,Boolean}` | Context menu on leaf nodes |
| `deleteCommands.ts` | `claudeConfig.delete{PermissionRule,EnvironmentVariable,Hook,Sandbox,Plugin}` | Context menu on leaf nodes |
| `moveCommands.ts` | `claudeConfig.move{PermissionRule,ToProjectLocal,ToProjectShared}` | Context menu on leaf nodes |
| `openFileCommands.ts` | `claudeConfig.{revealInFile,openConfigFile}` | Click on leaf nodes; context menu |
| `pluginCommands.ts` | `claudeConfig.toggle{Plugin,AllPlugins}` | Checkbox state; context menu |

**Pattern**: All command handlers follow this flow:
1. Extract `nodeContext` from the clicked tree item
2. Show input dialog or quick pick (if needed)
3. Call `configWriter.{function}()` to mutate file
4. (No explicit reload—file watcher detects change and triggers it)

---

### Utility Layer (`src/utils/`)

| File | Purpose | Key Exports |
|------|---------|------------|
| `json.ts` | Safe JSON read/write helpers | `readJsonFile()`, `writeJsonFile()` (with error handling) |
| `platform.ts` | OS-specific file paths | `getManagedSettingsPath()`, `getUserSettingsPath()` |
| `permissions.ts` | Permission rule utilities | `rulesOverlap()` (glob pattern matching) |
| `jsonLocation.ts` | Map JSON keyPaths to source line numbers | `findKeyPathAtLine()`, `findKeyPathLine()` |
| `pluginMetadata.ts` | Lookup plugin metadata (icons, descriptions) | `getPluginMetadata()` |

---

### Validation Layer (`src/validation/`)

| File | Purpose | Key Exports |
|------|---------|------------|
| `schemaValidator.ts` | Lightweight structural validation (no runtime JSON Schema library) | `validateConfig(): ValidationIssue[]` |
| `diagnostics.ts` | VS Code DiagnosticCollection integration | `ConfigDiagnostics` class |

**Design**: Custom validation avoids runtime library overhead. Catches common mistakes:
- Unknown top-level keys (warn)
- Invalid permission categories (error)
- Invalid hook event types (error)
- Malformed permission rules (error)

---

### Watcher Layer (`src/watchers/`)

| File | Purpose | Key Exports |
|------|---------|------------|
| `fileWatcher.ts` | Auto-refresh ConfigStore on external file changes | `ConfigFileWatcher` class |

**Design**: Uses VS Code's `FileSystemWatcher` API. Debounces rapid changes. Calls `configStore.reload()` on change.

---

## Naming Conventions

### Files
- **PascalCase for classes**: `configModel.ts`, `configTreeProvider.ts`, `permissionRuleNode.ts`
- **camelCase for utilities**: `json.ts`, `permissions.ts`, `platform.ts`
- **Descriptive names**: Full words, no abbreviations except established acronyms (MCP, JSON)
- **Node files**: `{name}Node.ts` (e.g., `scopeNode.ts`, `permissionRuleNode.ts`)
- **Command files**: Group by operation type (add, edit, delete, move, open, plugin)

### TypeScript

**Enums & Types** (PascalCase):
- `ConfigScope`, `SectionType`, `HookEventType`, `PermissionCategory`
- `ClaudeCodeConfig`, `ScopedConfig`, `ResolvedValue`, `NodeContext`

**Classes** (PascalCase):
- `ConfigStore`, `ConfigTreeProvider`, `ConfigTreeNode`
- `ScopeNode`, `SectionNode`, `PermissionRuleNode`
- `ConfigDiagnostics`, `ConfigFileWatcher`

**Functions** (camelCase):
- `discoverConfigPaths()`, `loadConfigFile()`, `resolveScalarOverride()`
- `addPermissionRule()`, `deleteEnvVar()`, `setPluginEnabled()`

**Constants** (UPPER_SNAKE or descriptive):
- `SCOPE_PRECEDENCE`, `DEDICATED_SECTION_KEYS`, `ALL_HOOK_EVENT_TYPES`
- `SCOPE_LABELS`, `SECTION_ICONS`, `PERMISSION_CATEGORY_ICONS`

**Variables** (camelCase):
- `configStore`, `treeProvider`, `nodeContext`, `filePath`

**Private members** (camelCase with leading underscore):
- `_onDidChange`, `_sectionFilter`, `_configs`

---

## Import Organization

**Pattern**:
1. External imports (`vscode`, Node built-ins)
2. Blank line
3. Relative imports from parent/sibling modules
4. Blank line
5. Relative imports from utils
6. Blank line
7. Type imports

**Example** (from `configTreeProvider.ts`):
```typescript
import * as vscode from 'vscode';

import { ConfigStore } from '../config/configModel';
import { ConfigScope, ScopedConfig, SectionType } from '../types';

import { ConfigTreeNode } from './nodes/baseNode';
import { ScopeNode } from './nodes/scopeNode';
```

---

## TypeScript Configuration

**`tsconfig.json` highlights**:
- `"strict": true` — Strict null checks, implicit any forbidden
- `"target": "ES2020"` — Modern ES features
- `"declaration": true` — Generate `.d.ts` files
- `"sourceMap": true` — Source maps for debugging
- Module: `"CommonJS"` (VS Code extension standard)

**`eslintrc.json`**:
- `@typescript-eslint/recommended` rules
- Unused variables must be prefixed with `_` (e.g., `_unused`)
- No `any` without `// @ts-ignore` comment

**`.prettierrc.json`**:
- Single quotes
- Trailing commas
- 100-char print width
- 2-space indentation

---

## Build & Packaging

### npm Scripts (from `package.json`)

| Script | Purpose |
|--------|---------|
| `npm run compile` | Type-check + esbuild bundle |
| `npm run watch` | esbuild in watch mode |
| `npm run build` | Production bundle (minified) |
| `npm run typecheck` | tsc --noEmit only |
| `npm run lint` | ESLint on src/ |
| `npm run test` | Compile + run Mocha tests |
| `npm run package` | Build .vsix extension package |

### esbuild Configuration (`esbuild.js`)
- Entry: `src/extension.ts`
- Output: `dist/extension.js`
- Bundle: all except `vscode` (external)
- Minify: only for production build
- Sourcemaps: always

### VS Code Extension Manifest (`package.json`)

**Key sections**:
- `"contributes.commands"` — Registers command IDs
- `"contributes.keybindings"` — Key bindings
- `"contributes.menus"` — Context menu items with `when` clauses
- `"contributes.views"` — Tree view registration
- `"contributes.viewsContainers"` — Activity bar icon
- `"contributes.configuration"` — Extension settings schema

---

## File Dependencies Summary

```
extension.ts (entry)
  ├─ config/configModel.ts
  │  ├─ config/configDiscovery.ts
  │  ├─ config/configLoader.ts
  │  └─ utils/json.ts
  │
  ├─ tree/configTreeProvider.ts
  │  ├─ tree/nodes/* (12 node types)
  │  └─ types.ts
  │
  ├─ validation/diagnostics.ts
  │  └─ validation/schemaValidator.ts
  │
  ├─ commands/* (all command modules)
  │  ├─ config/configWriter.ts
  │  └─ utils/*
  │
  ├─ watchers/fileWatcher.ts
  │  └─ config/configDiscovery.ts
  │
  └─ tree/nodes/pluginNode.ts
```

---

## Constants Organization

All UI strings and icons centralized in `src/constants.ts`:

**Labels**:
- `SCOPE_LABELS`: "Managed (Enterprise)", "User", "Project (Shared)", "Project (Local)"
- `SECTION_LABELS`: "Permissions", "Sandbox", "Hooks", "MCP Servers", "Environment", "Plugins", "Settings"
- `PERMISSION_CATEGORY_LABELS`: "Allow", "Deny", "Ask"

**Icons** (VS Code codicons):
- `SCOPE_ICONS`: `lock`, `home`, `git-commit`, `file-code`
- `SECTION_ICONS`: `shield`, `vm`, `zap`, `plug`, `symbol-variable`, `extensions`, `tools`
- `PERMISSION_CATEGORY_ICONS`: `check`, `close`, `question`

**Config keys**:
- `DEDICATED_SECTION_KEYS`: Sections with dedicated tree structure (permissions, sandbox, hooks, enabledPlugins, env)
- `KNOWN_SETTING_KEYS`: All top-level setting keys (model, language, outputStyle, etc.)

**File paths**:
- `MANAGED_PATH_MACOS`, `MANAGED_PATH_LINUX`
- `PROJECT_CLAUDE_DIR`, `PROJECT_SHARED_FILE`, `PROJECT_LOCAL_FILE`
- `MCP_CONFIG_FILE`

---

## Types Organization

`src/types.ts` contains all TypeScript interfaces and enums for consistency:

### Enums
- `ConfigScope`: Managed, User, ProjectShared, ProjectLocal
- `PermissionCategory`: Allow, Deny, Ask
- `HookEventType`: SessionStart, UserPromptSubmit, PreToolUse, ... (13 values)
- `SectionType`: Permissions, Sandbox, Hooks, McpServers, Environment, Plugins, Settings

### Config Shape Interfaces
- `ClaudeCodeConfig`: Main config shape
- `McpConfig`: MCP servers config
- `ScopedConfig`: A loaded config with scope, path, and metadata
- `ResolvedValue<T>`: Effective value with override metadata
- `NodeContext`: Tree node identity and override info

### Utility Types
- `FileInfo`: { path, exists }
- `PermissionRules`, `HookCommand`, `HookMatcher`, `SandboxNetworkConfig`, `SandboxConfig`
- `McpServerStdio`, `McpServerSse`, `McpServerConfig`
- `AttributionConfig`

---

## Summary

The structure follows **clear separation of concerns**:

| Layer | Directory | Responsibility |
|-------|-----------|-----------------|
| **Config** | `src/config/` | Discovery, loading, modeling, writing, override resolution |
| **Tree** | `src/tree/` | Build and maintain tree view hierarchy |
| **Commands** | `src/commands/` | User actions and integrations |
| **Validation** | `src/validation/` | Schema validation and diagnostics |
| **Watchers** | `src/watchers/` | File system monitoring |
| **Utilities** | `src/utils/` | Cross-cutting helpers |
| **Types** | `src/types.ts` | Centralized type definitions |
| **Constants** | `src/constants.ts` | UI strings and icons |

**Key principles**:
- **One file per node type** — Easy to find and modify tree nodes
- **Grouped commands** — Operations of the same kind together
- **Pure functions in configWriter** — Testable, composable mutations
- **Centralized constants** — Single source of truth for labels and icons
- **No circular imports** — Clear dependency hierarchy
- **Strict TypeScript** — Type safety throughout

This organization enables **rapid navigation**, **minimal context switching**, and **confident refactoring**.
