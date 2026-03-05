# Claude Code Config Manager

## What This Is

A VS Code extension that provides a visual config viewer and editor for Claude Code settings. It displays a scope-aware TreeView with override detection, inline editing, file watching, and bidirectional editor-tree synchronization. Used as a personal productivity tool for managing Claude Code configuration across all scopes.

## Core Value

Every Claude Code setting is visible, editable, and scope-aware in one place — so you never have to hand-edit JSON config files or wonder which scope is winning.

## Current Milestone: v0.6.0 Decouple State from Tree

**Goal:** Reduce tight coupling between tree nodes and ConfigStore so the data model is cleanly separated from the presentation layer.

**Target features:**
- Decouple tree node construction from direct ConfigStore access
- Establish clear boundaries between state management and tree rendering

## Next Milestone: v0.7.0 Visual Fidelity

**Goal:** Make the tree reflect true state — overlaps visible across scopes, lock toggle respected by plugin checkbox, hook leaf navigation correct.

**Target features:**
- Visual overlap indicators (description text, badge, tooltip) for config entities across multiple scopes
- Fix plugin checkbox toggling despite locked User scope
- Fix hook leaf click navigating editor to wrong JSON line

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
- ✓ Project scope nodes show workspace-relative paths — v0.4.1
- ✓ Plugin nodes show only name without enabled/disabled text — v0.4.1
- ✓ Hook entries expandable with key-value child nodes — v0.4.1
- ✓ Write failures propagate scope-aware error messages with retry/open-file recovery — v0.5.0
- ✓ Config and MCP parse errors surface visible warnings with file navigation — v0.5.0
- ✓ Tree operations wrapped in try-catch with safe fallbacks — v0.5.0
- ✓ Plugin checkbox rolls back UI state on write failure — v0.5.0
- ✓ In-flight write tracking suppresses redundant file watcher reloads — v0.5.0
- ✓ Editor-tree sync timeouts tracked and cleaned up on deactivation — v0.5.0
- ✓ File watcher debounce enforces maxWait ceiling — v0.5.0
- ✓ All path parsing uses Node.js path module — v0.5.0
- ✓ Write path validation with whitelist, traversal, and symlink checks — v0.5.0
- ✓ revealInFile validates inputs (path whitelist, keyPath type/depth) — v0.5.0
- ✓ ConfigTreeProvider implements Disposable for proper EventEmitter cleanup — v0.5.0
- ✓ Plugin metadata cache invalidated on config reload — v0.5.0
- ✓ Dead code removed, unused parameters cleaned up — v0.5.0
- ✓ All timeout values extracted to named constants — v0.5.0
- ✓ User-facing messages centralized with "Claude Config:" prefix — v0.5.0
- ✓ keyPath array access guarded with bounds checks — v0.5.0

### Active

- [ ] Decouple tree node construction from direct ConfigStore access
- [ ] Establish clear boundaries between state management and tree rendering

### Out of Scope

- Add "go to (scope/entity)" to the command palette — deferred to future milestone
- Multiselect for batch copy and move operations — deferred to future milestone
- Replace sync file I/O with async in diagnostics validation — deferred, internal quality
- Add memoization to override resolver functions — deferred, internal quality
- Visual overlap indicators for config entities across scopes — v0.7.0
- Fix plugin checkbox toggling despite locked User scope — v0.7.0
- Fix hook leaf click navigating editor to wrong JSON line — v0.7.0
- Add JSDoc documentation for exported functions — deferred, internal quality
- EditValue inline improvements — deferred to separate phase
- Overridden entities visual management — deferred to separate milestone
- Sort items — deferred to separate task
- Plugin inline buttons (move/copy/delete) — temporarily disabled, re-enable in future
- Marketplace publishing — personal tool, not targeting public release
- Windows support — macOS/Linux only, matches Claude Code platform support

## Context

5,241 LOC TypeScript. Shipped v0.5.0 with comprehensive error handling, write-path validation, race condition prevention, and resource cleanup. Toolbar has 4 buttons: lock, filter, collapse, expand. All user-facing messages centralized with "Claude Config:" prefix. Write operations protected by in-flight tracking, path whitelisting, and traversal/symlink validation. Plugin and editValue inline buttons remain temporarily disabled. Starting v0.6.0 to decouple state from tree nodes. v0.7.0 Visual Fidelity (overlap indicators, lock enforcement, hook navigation) planned next with research complete.

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
| asRelativePath(path, false) for project scopes | Clean workspace-relative paths; false omits workspace folder prefix in single-root | ✓ Good |
| Remove enabled/disabled text from plugins | Checkbox + dimming already convey state; text was redundant | ✓ Good |
| Hook entries follow object settings expandable pattern | Consistent UX; same key-value child node approach | ✓ Good |
| showWriteError with scope-aware recovery buttons | Reusable across all command handlers; retry + open file | ✓ Good |
| Error handling at command level, not in configWriter | Commands own UX decisions; writer stays pure I/O | ✓ Good |
| In-flight write tracking via Set<string> | Simple, efficient; watcher suppression prevents double-reload | ✓ Good |
| MaxWait debounce ceiling (2s) independent of regular debounce | Guarantees timely reload even during rapid changes | ✓ Good |
| Deactivation polls in-flight writes up to 5s | Prevents data loss on rapid close; graceful shutdown | ✓ Good |
| Write path validation via whitelist + traversal + symlink checks | Defense-in-depth; centralized in trackedWrite() | ✓ Good |
| revealInFile 7-stage validation pipeline | Comprehensive input validation; whitelisted known paths | ✓ Good |
| Plugin metadata cache invalidated at start of reload() | Covers both full and single-folder reloads | ✓ Good |
| MESSAGES object with functions for parameterized messages | Centralized, discoverable; consistent "Claude Config:" prefix | ✓ Good |
| validateKeyPath returns boolean for guard pattern | Simple early-return; logs + shows error for bad state | ✓ Good |
| Named constants for all timeout values | Discoverable in constants.ts; JSDoc explains rationale | ✓ Good |

---
*Last updated: 2026-03-05 after v0.6.0/v0.7.0 milestone restructure*
