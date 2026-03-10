# Claude Code Config Manager

## What This Is

A VS Code extension that provides a visual config viewer and editor for Claude Code settings. It displays a scope-aware TreeView with override detection, inline editing, file watching, and bidirectional editor-tree synchronization. Used as a personal productivity tool for managing Claude Code configuration across all scopes.

## Core Value

Every Claude Code setting is visible, editable, and scope-aware in one place — so you never have to hand-edit JSON config files or wonder which scope is winning.

## Current State

Shipped v0.7.0 (2026-03-09). Tree reflects true state with cross-scope overlap indicators, lock-aware plugin display, and correct hook navigation. Legacy override system replaced with 4-directional overlap model. 56-test suite validates builder and overlap resolver.

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
- ✓ Decouple tree node construction from direct ConfigStore access — v0.6.0
- ✓ Establish clear boundaries between state management and tree rendering — v0.6.0
- ✓ Overlap tooltips listing all scopes where an entity appears with values and override status — v0.7.0
- ✓ Overlap detection independent from override detection (new fields, not reusing isOverridden) — v0.7.0
- ✓ Lock-aware plugin display — locked User scope shows static icons instead of checkboxes — v0.7.0
- ✓ Lock toggle refreshes plugin display between checkbox and icon modes — v0.7.0
- ✓ Hook entry click navigates to correct JSON line — v0.7.0
- ✓ Dead HookKeyValue code removed — v0.7.0

### Active

## Current Milestone: v0.8.0 Tree Display Polish

**Goal:** Refine tree node display — checkbox-only plugins when unlocked, flattened permissions with type-aware icons.

**Target features:**
- Plugin nodes show only checkbox (no plugin icon) when User scope is unlocked
- Permissions flatten to a single list under Permissions section (no Allow/Ask/Deny grouping)
- Permission icons reflect their type using section icons as status indicators

### Out of Scope

- Add "go to (scope/entity)" to the command palette — deferred to future milestone
- Multiselect for batch copy and move operations — deferred to future milestone
- Replace sync file I/O with async in diagnostics validation — deferred, internal quality
- Add JSDoc documentation for exported functions — deferred, internal quality
- EditValue inline improvements — deferred to separate phase
- Overlap description text ("also in [Scope]") on tree items — deferred enhancement (OVLP-03)
- Overlap FileDecoration badge ("2x") for multi-scope entities — deferred enhancement (OVLP-04)
- Sort items — deferred to separate task
- Plugin inline buttons (move/copy/delete) — temporarily disabled, re-enable in future
- Marketplace publishing — personal tool, not targeting public release
- Windows support — macOS/Linux only, matches Claude Code platform support

## Context

5,672 LOC TypeScript. Shipped v0.7.0 with cross-scope overlap indicators, lock-aware plugin display, and corrected hook navigation. OverlapResolver uses nearest-neighbor algorithm with 4-directional model (overrides, isOverriddenBy, duplicates, isDuplicatedBy) for all entity types. Color-coded FileDecoration (red/green/yellow/orange) and MarkdownString tooltips show overlap relationships. 56-test suite validates builder and overlap resolver. Legacy overrideResolver.ts and ResolvedValue type fully removed. Plugin and editValue inline buttons remain temporarily disabled.

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
| Replicate formatting helpers in builder.ts | Avoids viewmodel→tree dependency; keeps layers independent | ✓ Good |
| Static ConfigTreeNode.mapVM property | Breaks circular imports between vmToNode and node files | ✓ Good |
| Hook entries as leaf nodes (no key-value children) | Cleaner UX; simplified tree structure for hook display | ✓ Good |
| Eager VM build in constructor | Ensures initial tree render works without waiting for refresh | ✓ Good |
| TDD Mocha UI for extension tests | VS Code extension test conventions; suite/test pattern | ✓ Good |
| Generic resolveOverlapGeneric helper (6 of 7 resolvers) | Permission resolver special-cased for glob matching; rest share generic pattern | ✓ Good |
| Deep equality with sorted-key comparison | Array order preserved, object key order normalized; correct semantic equality | ✓ Good |
| 4-directional overlap model (overrides/isOverriddenBy/duplicates/isDuplicatedBy) | Distinguishes direction and equality; richer than boolean isOverridden | ✓ Good |
| Orange color for isDuplicatedBy (distinct from red isOverriddenBy) | Clear visual distinction between "shadowed by different value" and "duplicated by same value" | ✓ Good |
| Plugin overlap color takes precedence over disabled decoration | Overlap is more informative than disabled state; both visible in tooltip | ✓ Good |
| Lock-aware static icons instead of disabled checkboxes | VS Code has no disabled checkbox state; icons communicate unclickable clearly | ✓ Good |

---
*Last updated: 2026-03-10 after v0.8.0 milestone started*
