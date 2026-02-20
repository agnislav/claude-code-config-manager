# Changelog

All notable changes to the Claude Code Config Manager extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com),
and this project adheres to [Semantic Versioning](https://semver.org).

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
