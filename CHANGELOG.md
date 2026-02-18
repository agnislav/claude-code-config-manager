# Changelog

All notable changes to the Claude Code Config Manager extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com),
and this project adheres to [Semantic Versioning](https://semver.org).

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
