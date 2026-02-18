# Claude Code Config Manager

Visual config viewer and editor for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) settings — right inside VS Code.

Browse, edit, and manage all your Claude Code configuration files through a scope-aware TreeView with override detection, inline editing, and real-time file watching.

## Features

### Scope-Aware Configuration

Claude Code uses a layered config system with four scopes (highest precedence first):

1. **Managed** — Enterprise policies (read-only)
2. **Project Local** — `.claude/settings.local.json` (gitignored)
3. **Project Shared** — `.claude/settings.json` (committed)
4. **User** — `~/.claude/settings.json` (global)

The extension displays all scopes in a single tree, clearly showing which values are overridden and where the effective value comes from.

### Full Config Coverage

Manage every section of Claude Code configuration:

- **Permissions** — Allow, deny, and ask rules for tool access
- **MCP Servers** — Model Context Protocol server definitions
- **Plugins** — Enable, disable, and manage plugins
- **Hooks** — Lifecycle hooks (SessionStart, PreToolUse, PostToolUse, etc.)
- **Settings** — Model preferences, output style, and other options
- **Environment Variables** — Custom env vars passed to Claude Code
- **Sandbox** — Sandbox mode and networking configuration

### Inline Editing

Edit values directly from the tree — no need to hunt for the right JSON file and key. Add, edit, delete, and move settings between scopes with context menu actions.

### Section Filters

Quickly focus on what matters with toolbar filter buttons for each config section. Toggle visibility of Permissions, MCP Servers, Plugins, Hooks, Settings, Environment, and Sandbox sections independently.

### File Watching

Config files are monitored for external changes. Edits made by Claude Code itself, other tools, or manual file editing are picked up automatically and reflected in the tree.

### Create Missing Config Files

If a config file doesn't exist yet, the extension offers to create it for you directly from the tree.

## Getting Started

1. Install the extension from the VS Code Marketplace
2. Open the **Claude Code Config** view from the Activity Bar (look for the Claude icon)
3. Browse your configuration across all scopes
4. Right-click any item to edit, delete, move, or copy it to another scope

## Requirements

- VS Code 1.90.0 or later
- Claude Code installed (the extension reads and writes Claude Code config files)

## Extension Settings

This extension contributes the following commands (available from the Command Palette):

- `Claude Config: Refresh Config` — Reload all configuration files
- `Claude Config: Open Config File` — Open a scope's config file in the editor
- `Claude Config: Add Permission Rule` — Add a new allow/deny/ask rule
- `Claude Config: Add Environment Variable` — Add a new env var
- `Claude Config: Add MCP Server` — Add a new MCP server definition
- `Claude Config: Add Hook` — Add a new lifecycle hook

## License

[MIT](LICENSE)
