# Changelog

All notable changes to the Claude Code Config Manager extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com),
and this project adheres to [Semantic Versioning](https://semver.org).

## [0.6.0] - 2026-03-08

### Added
- ViewModel type system — BaseVM plus 15 per-type interfaces covering all tree node types, decoupling display state from raw config data
- TreeViewModelBuilder that pre-computes override resolution, labels, descriptions, icons, and contextValues from raw ConfigStore data
- WorkspaceFolderNode extracted as standalone file with vmToNode mapper for NodeKind-based dispatch
- 23-test suite covering all 7 entity types, override resolution, and NodeContext preservation

### Changed
- All 14 tree node constructors migrated from ScopedConfig/allScopes parameters to typed ViewModel descriptors
- ConfigTreeProvider wired to TreeViewModelBuilder with full bidirectional editor-tree sync preserved

## [0.5.0] - 2026-02-20

### Added
- Config parse error notifications — malformed JSON surfaces a user-facing message with "Open File" action that navigates to the exact error position
- Scope-aware write error handler with retry and "Open File" recovery actions
- Write path validation — blocks writes to paths outside allowed config directories
- Input validation for `revealInFile` — rejects empty paths, traversal sequences (including Windows `..\\`), and non-file URIs
- In-flight write tracking in `configWriter` — prevents concurrent writes to the same file
- Watcher suppression during writes — file watcher ignores self-triggered change events
- Max-wait timeout on file watcher debounce to guarantee reload within bounded time
- Editor-to-tree sync timeout tracking — blocks UI during in-flight writes to prevent stale reads
- Plugin checkbox rollback on write failure — restores previous checked state instead of showing inconsistent UI
- Try-catch error guards on all tree node `getChildren()` and `getTreeItem()` methods
- `ConfigTreeProvider` implements `Disposable` with `EventEmitter` disposal
- Plugin metadata cache invalidation on config reload
- `validateKeyPath` guards in all command handlers to prevent undefined access

### Changed
- Replaced string-based path operations (`startsWith`, `includes`) with `path.resolve`/`path.normalize` for cross-platform correctness
- Centralized user-facing messages into constants with consistent `Claude Config:` prefix
- Human-readable scope labels (`SCOPE_LABELS`) used consistently in all notifications
- Extracted magic numbers (timeouts, debounce intervals) to named constants with JSDoc
- Removed unused `_configStore` parameters from command handler signatures
- Removed dead exports and unreferenced code
- Removed unnecessary try-catch wrappers in leaf node `getChildren()` (McpServerNode, SandboxPropertyNode)
- File watcher `doReload` clears both timeouts before reloading to prevent race conditions
- `showWriteError` retry callback wrapped in try-catch for safety
- `openTextDocument` in error handler includes rejection callback to prevent unhandled promise

### Fixed
- Plugin delete confirmation message now uses `Claude Config:` prefix consistently
- Environment section and env var icons no longer render blue — replaced semantic `symbol-variable` with `terminal` codicon
- Setting key-value and hook key-value child nodes no longer render blue — added explicit `icon.foreground` to `symbol-field` icons

## [0.4.1] - 2026-02-20

### Changed
- Project Shared and Project Local scope nodes now show workspace-relative paths (e.g., `.claude/settings.json`) instead of full home-relative paths
- Plugin nodes display only version suffix in description — removed redundant "enabled"/"disabled" text since checkbox state already conveys this
- Hook entry nodes are now expandable, revealing key-value child nodes for each hook command property (type, command, timeout, etc.), matching the object settings UX from v0.4.0

## [0.4.0] - 2026-02-20

### Added
- User scope lock toggle — session lock making User scope read-only, with write guards and lock-aware move/copy pickers
- QuickPick multi-select filter — single filter icon opens multi-select picker replacing 8 toolbar buttons
- Move inline button — move items between scopes alongside existing copy button
- Collapse All toolbar button — collapses entire tree to top-level scope nodes
- Expand All toolbar button — recursively expands all nodes to full depth
- Object settings expansion — object-type settings render as expandable tree nodes with key/value child nodes instead of static `{N keys}` description
- Lock file decoration provider for visual lock state indicators

### Changed
- Copy icon changed to `$(add)`, move icon to `$(arrow-swap)`
- Editor-to-tree sync guarded by `treeView.visible` to prevent pane auto-activation

### Removed
- 8 individual section filter toolbar buttons (replaced by QuickPick)
- Refresh toolbar button (file watcher auto-syncs; manual refresh via Command Palette only)
- Inline lock/unlock buttons from User scope tree node context menu
- `toggleSectionFilter()` and `selectAllSections()` dead code

## [0.3.0] - 2026-02-18

### Added
- README for VS Code Marketplace listing
- CHANGELOG for tracking version history

### Changed
- Bumped minor version for marketplace documentation

## [0.2.0]

### Added
- Section filter toolbar with per-section toggle buttons
- Plugin management (toggle, copy to scope, delete, open README)
- Copy permission rules and settings to other scopes
- Sandbox configuration section
- Reveal setting in config file command
- Create missing config file from tree

## [0.1.0]

### Added
- Initial release
- Scope-aware TreeView for Claude Code configuration
- Support for Managed, User, Project Shared, and Project Local scopes
- Override detection across scopes
- Inline editing of settings, environment variables, and permissions
- Add, edit, delete, and move operations for all config sections
- MCP server configuration management
- Hook event management (SessionStart, PreToolUse, PostToolUse, etc.)
- Real-time file watching for external config changes
- Context menu actions with scope-aware visibility
