# CLAUDE.md — Claude Code Config Manager

VS Code extension that provides a visual config viewer and editor for Claude Code settings. Scope-aware TreeView with override detection, inline editing, and file watching.

## Quick Reference

```bash
npm run compile     # Type-check + esbuild bundle
npm run watch       # esbuild watch mode
npm run build       # Production bundle (minified)
npm run typecheck   # tsc --noEmit only
npm run lint        # ESLint on src/
npm run test        # Compile + run Mocha tests
npm run package     # Build .vsix package
```

**Debug**: Press F5 in VS Code to launch Extension Development Host.

## Project Structure

```
src/
├── extension.ts              # Entry point: activate/deactivate
├── types.ts                  # All interfaces and enums
├── constants.ts              # Labels, icons, file paths, known setting keys
├── config/
│   ├── configDiscovery.ts    # Finds config files per scope on disk
│   ├── configLoader.ts       # Reads and parses JSON config files
│   ├── configModel.ts        # ConfigStore: in-memory model, reload, events
│   ├── configWriter.ts       # Writes changes back to config files
│   └── overrideResolver.ts   # Determines effective values across scopes
├── tree/
│   ├── configTreeProvider.ts # TreeDataProvider implementation
│   └── nodes/                # TreeItem subclasses (scope, section, setting, etc.)
├── commands/
│   ├── addCommands.ts        # Add permission rule, env var, MCP server, hook
│   ├── editCommands.ts       # Edit scalar values, toggle settings
│   ├── deleteCommands.ts     # Delete items from config
│   ├── moveCommands.ts       # Move items between scopes
│   └── openFileCommands.ts   # Open config file in editor
├── watchers/
│   └── fileWatcher.ts        # Auto-refresh on external config file changes
├── validation/
│   ├── schemaValidator.ts    # JSON Schema validation against official schema
│   └── diagnostics.ts        # VS Code DiagnosticCollection integration
└── utils/
    ├── platform.ts           # OS-specific paths (macOS/Linux)
    ├── json.ts               # JSON read/write helpers
    └── permissions.ts         # Permission rule utilities
schemas/
└── claude-code-settings.schema.json  # Official Claude Code JSON Schema
resources/
└── icons/claude-config.svg           # Activity bar icon
```

## Architecture

### Config Scopes (Precedence: highest → lowest)

1. **Managed** — Enterprise policies (`/Library/Application Support/ClaudeCode/` on macOS, `/etc/claude-code/` on Linux). Read-only.
2. **Project Local** — `.claude/settings.local.json` in workspace root. Gitignored.
3. **Project Shared** — `.claude/settings.json` in workspace root. Committed to git.
4. **User** — `~/.claude/settings.json`. Global user preferences.

### Data Flow

```
Config Files on disk
  → configDiscovery (find paths per scope)
  → configLoader (parse JSON)
  → ConfigStore (in-memory model, emits change events)
  → overrideResolver (compute effective values)
  → ConfigTreeProvider (build TreeView nodes)
  → VS Code TreeView UI
```

Edits flow in reverse: commands → configWriter → disk → fileWatcher → ConfigStore.reload().

### Key Types

- `ConfigScope` enum — managed | user | projectShared | projectLocal
- `ScopedConfig` — a loaded config file with scope, path, parsed data
- `ClaudeCodeConfig` — full shape of a Claude Code settings file
- `ResolvedValue<T>` — effective value with override metadata
- `NodeContext` — tree node identity (scope, section, keyPath, override status)

### TreeView Node Hierarchy

```
ScopeNode (Managed / User / Project Shared / Project Local)
  └── SectionNode (Permissions / Sandbox / Hooks / MCP Servers / Environment / Plugins / Settings)
        ├── PermissionGroupNode (Allow / Deny / Ask)
        │     └── PermissionRuleNode
        ├── HookEventNode (SessionStart, PreToolUse, ...)
        │     └── HookEntryNode
        ├── EnvVarNode
        ├── McpServerNode
        ├── PluginNode
        ├── SettingNode
        └── SandboxPropertyNode
```

### Context Value Pattern

Tree items use `contextValue` strings for menu visibility. Pattern: `{nodeType}.{editable|readOnly}[.overridden]`. Example: `permissionRule.editable` enables edit/delete/move context menu items. Regex matching in `package.json` `when` clauses controls which commands appear.

## Milestone Workflow

- **Always update `CHANGELOG.md`** at the end of each milestone, before archiving. Follow [Keep a Changelog](https://keepachangelog.com) format with Added/Changed/Removed/Fixed sections.
- **Always bump `version` in `package.json`** to match the milestone version at the end of each milestone.

## Conventions

- **TypeScript strict mode** — no implicit any, strict null checks
- **ESLint** — `@typescript-eslint/recommended` rules; unused vars with `_` prefix are allowed
- **Prettier** — single quotes, trailing commas, 100 char print width
- **Naming** — PascalCase for types/classes, camelCase for variables/functions, UPPER_SNAKE for constants
- **Imports** — `vscode` is external (not bundled); all other deps are dev-only
- **No runtime dependencies** — extension bundle is self-contained via esbuild
- **Node types** — each tree node type lives in its own file under `src/tree/nodes/`
- **Commands** — grouped by action type in `src/commands/`, registered in `extension.ts`
