# Claude Code Config Manager

## What This Is

A VS Code extension that provides a visual config viewer and editor for Claude Code settings. It displays a scope-aware TreeView with override detection, inline editing, file watching, and bidirectional editor-tree synchronization. Used as a personal productivity tool for managing Claude Code configuration across all scopes.

## Core Value

Every Claude Code setting is visible, editable, and scope-aware in one place — so you never have to hand-edit JSON config files or wonder which scope is winning.

## Current Milestone: v0.4.1 — Node Display Polish

**Goal:** Refine how tree nodes render — relative paths for project scopes, cleaner plugin labels, and expandable hook entries.

**Target features:**
- Show relative path for project and local scope tree items
- Remove enabled/disabled text from plugin nodes
- Render hook entries as expandable key-value nodes like object settings

## Requirements

### Validated

- ✓ Scope-aware TreeView displaying 4 config scopes (Managed, User, Project Shared, Project Local) — existing
- ✓ Full CRUD for all 7 config sections (Permissions, MCP Servers, Plugins, Hooks, Settings, Environment, Sandbox) — existing
- ✓ Override detection and resolution across scopes with visual indicators — existing
- ✓ Bidirectional editor ↔ tree synchronization with debouncing — existing
- ✓ File watching for auto-refresh on external config changes — existing
- ✓ JSON Schema validation with VS Code diagnostics — existing
- ✓ Plugin metadata service with checkbox toggle — existing
- ✓ Multi-root workspace support — existing
- ✓ Create missing config files from tree — existing
- ✓ Reveal in file (tree click → editor jumps to JSON location) — existing
- ✓ QuickPick multi-select filter replacing 8 toolbar buttons — v0.3.x
- ✓ Refresh toolbar button removed (file watcher sufficient) — v0.3.x
- ✓ User scope lock toggle with icon swap and lock-aware commands — v0.3.x
- ✓ Move/copy inline buttons for permissions, settings, env vars — v0.3.x
- ✓ Lock defaults to on with state-semantic icons; lock toggle in toolbar — v0.4.0
- ✓ Collapse All / Expand All toolbar buttons — v0.4.0
- ✓ Object settings expand to show key/value children — v0.4.0

### Active

- [ ] Show relative path for project and local scope tree items
- [ ] Remove enabled/disabled text from plugin nodes
- [ ] Render hook entries as expandable key-value nodes

### Out of Scope

- EditValue inline improvements — deferred to separate phase
- Overridden entities visual management — deferred to separate milestone
- Sort items — deferred to separate task
- Plugin inline buttons (move/copy/delete) — temporarily disabled, re-enable in future
- Marketplace publishing — personal tool, not targeting public release
- Windows support — macOS/Linux only, matches Claude Code platform support

## Context

4,399 LOC TypeScript. Toolbar has 4 buttons: lock (locked by default), filter (with active variant), collapse all, expand all. Lock toggle is in toolbar with state-semantic icons. Object settings expand to show key/value children. Plugin and editValue inline buttons remain temporarily disabled.

## Constraints

- **Tech stack**: TypeScript, VS Code Extension API, esbuild bundler — no runtime dependencies
- **Platform**: macOS and Linux only (matches Claude Code)
- **VS Code**: Minimum version 1.90.0

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| QuickPick for filters (not submenu or webview) | Native VS Code component, supports multi-select checkboxes, familiar UX | ✓ Good |
| Lock blocks target selection, not menu visibility | Less confusing — items still visible, just can't write to locked scope | ✓ Good |
| Remove refresh button entirely | File watcher auto-syncs; manual refresh adds no value, just toolbar clutter | ✓ Good |
| `$(arrow-swap)` for move, `$(add)` for copy | Arrow-both was horizontal; arrow-swap gives swap metaphor; add ("+") distinguishes from move | ✓ Good |
| treeView.visible guard for editor→tree sync | Prevents pane auto-activation while preserving sync when pane is open | ✓ Good |
| Lock by default with lockScope before tree provider | Ensures locked state on first render; setContext starts true | ✓ Good |
| State semantics for lock icons (icon = current state) | Consistent with VS Code toggle patterns (filter/filter-filled) | ✓ Good |
| Toolbar order: lock, filter, collapse, expand | User-validated order during UAT; navigation@ indices 0-3 | ✓ Good |
| Collapse All delegates to VS Code built-in | Consistent behavior; Expand All uses reveal() pattern for full-depth walk | ✓ Good |
| Object settings single-level expansion only | Avoids recursive complexity; nested objects show `{N keys}` as leaves | ✓ Good |
| formatValue exported from settingNode.ts | Shared by SettingKeyValueNode for consistent value rendering | ✓ Good |

---
*Last updated: 2026-02-20 after v0.4.1 milestone started*
