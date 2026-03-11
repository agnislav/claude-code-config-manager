# Milestones: Claude Code Config Manager

## v0.8.0 — Tree Display Polish (Complete)

**Completed:** 2026-03-11
**Phases:** 23–24 (2 phases, 3 plans, 6 tasks)
**Requirements:** 5/5 satisfied
**Git range:** docs(23)..docs(24-02) (14 commits)
**LOC:** 5,672 TypeScript (+105 / -85 source changes)

Refined tree node display for cleaner UX — plugin nodes show checkbox-only appearance when unlocked, permission rules flatten to a single list with type-aware icons and inline type switching.

**Key accomplishments:**
- Plugin checkbox-only display — no icon noise when User scope is unlocked
- Flattened 3-level permission hierarchy to 2-level (Section → PermissionRule)
- Category-specific icons on permission rules (check/question/close for allow/ask/deny)
- Inline pencil button for switching permission type via QuickPick
- Inline + button on Permissions section header for direct rule creation
- Full dead code cleanup — removed PermissionGroupVM and all related artifacts

---

## v0.7.0 — Visual Fidelity (Complete)

**Completed:** 2026-03-09
**Phases:** 19–22 (4 phases, 5 plans)
**Requirements:** 7/7 satisfied
**Git range:** v0.6.0..HEAD (~30 commits)
**LOC:** 5,672 TypeScript (+1,002 / -423 source changes)

Made the tree reflect true state — overlaps visible across scopes, lock toggle respected by plugin display, hook leaf navigation correct. Replaced the legacy override system with a new 4-directional overlap model.

**Key accomplishments:**
- Fixed hook entry keyPath navigation — clicking hook entries now opens correct JSON line
- Lock-aware plugin display — locked User scope shows static icons instead of interactive checkboxes
- Overlap resolver with nearest-neighbor algorithm for all 7 entity types
- Color-coded overlap indicators (red/green/yellow/orange) with git-themed FileDecoration
- Overlap tooltips showing scope/value/relationship details on overlapping entities
- Replaced legacy override system with new overlap system — clean break from old code

### Tech Debt

- Phase 20 missing SUMMARY.md (executed outside GSD workflow, verified via VERIFICATION.md)
- Phase 22 SUMMARY frontmatter has empty requirements_completed (documentation-only)

---

## v0.6.0 — Decouple State from Tree (Complete)

**Completed:** 2026-03-08
**Phases:** 16–18 (3 phases, 4 plans)
**Requirements:** 15/15 satisfied
**Git range:** feat(16-01)..test(phase-17)
**LOC:** 6,247 TypeScript (+2,053 / -1,057 source changes)

Decoupled tree node construction from direct ConfigStore access by introducing a ViewModel layer. TreeViewModelBuilder pre-computes all display state (labels, descriptions, icons, contextValues, override resolution) and all 14 node types now accept typed ViewModel descriptors instead of raw config data. Comprehensive test suite validates builder output across all entity types.

**Key accomplishments:**
- Complete ViewModel type system (BaseVM + 15 per-type interfaces) for all tree node types
- TreeViewModelBuilder pre-computes override resolution and display state from raw ConfigStore data
- All 14 tree node constructors migrated from ScopedConfig/allScopes to typed ViewModel descriptors
- WorkspaceFolderNode extracted as standalone file; vmToNode mapper for NodeKind-based dispatch
- ConfigTreeProvider wired to builder with full bidirectional editor-tree sync preserved
- 23-test suite covering all 7 entity types, override resolution, and NodeContext preservation

### Tech Debt

- Dead code: HookKeyValueVM/Node/builder method unreachable after hook entry simplification (4 items, cosmetic)

---

## v0.3.x — Toolbar UX Improvements (Complete)

**Completed:** 2026-02-19
**Phases:** 1–5 (5 phases, 7 plans)
**Requirements:** 23/23 satisfied

Replaced 8 filter toolbar buttons with QuickPick multi-select, removed refresh button,
added User scope lock toggle, added move inline buttons. Post-milestone fixes: move icon
corrected to `$(arrow-swap)`, copy icons changed to `$(add)`, pane auto-activation disabled,
plugin/editValue inline buttons temporarily disabled.

**Key accomplishments:**
- QuickPick multi-select filter replacing 8 individual toolbar buttons
- User scope lock toggle with ephemeral state, icon swap, and lock-aware commands
- Move inline buttons alongside copy buttons on tree items
- Dead code cleanup and lock picker normalization

---

## v0.4.0 — Tree UX Refinements (Complete)

**Completed:** 2026-02-20
**Phases:** 6–8 (3 phases, 3 plans)
**Requirements:** 7/7 satisfied

User scope locked by default on activation with state-semantic lock icons in toolbar.
Collapse All and Expand All toolbar buttons for instant tree navigation.
Object-type settings expand to show key/value child nodes instead of dead-end `{N keys}`.
Toolbar order finalized: lock, filter, collapse, expand.

**Key accomplishments:**
- Lock-by-default with state-semantic toolbar icons
- Collapse All / Expand All toolbar buttons for instant tree navigation
- Object settings expand to reveal key/value child nodes

---

## v0.4.1 — Node Display Polish (Complete)

**Completed:** 2026-02-20
**Phases:** 9 (1 phase, 1 plan, 2 tasks)
**Requirements:** 3/3 satisfied

Project scope nodes show workspace-relative paths instead of full home paths.
Plugin descriptions cleaned up — checkbox conveys enabled/disabled state, no redundant text.
Hook entry nodes expand to reveal key-value child nodes matching the object settings pattern from v0.4.0.

---


## v0.5.0 — Hardening (Complete)

**Completed:** 2026-02-21
**Phases:** 10–15 (6 phases, 10 plans, 18 requirements)
**Requirements:** 18/18 satisfied (15 fully verified, 3 partial — cosmetic gaps only)
**Git range:** feat(10-02)..fix(semantic-icons)
**LOC:** 5,241 TypeScript (+1,314 / -379 source changes)

Fixed all identified bugs, reduced technical debt, and hardened error handling across the extension. Every write operation now has error propagation with recovery buttons, race conditions eliminated through in-flight write tracking, paths validated against whitelists with traversal/symlink protection, and all user-facing messages centralized with consistent prefixing.

**Key accomplishments:**
- Error propagation with scope-aware messages and retry/open-file recovery across all write operations
- Tree operation error guards and plugin checkbox rollback for resilient UI under failure
- In-flight write tracking with watcher suppression and maxWait debounce ceiling to eliminate race conditions
- Path safety hardening with write-path validation (whitelist, traversal, symlink checks) and input validation
- Resource leak fixes — Disposable pattern on tree provider, plugin metadata cache invalidation on reload
- Code quality cleanup — dead code removal, named constants for all timeouts, centralized "Claude Config:" messages

### Known Gaps

- Phase 14 missing VERIFICATION.md (implementation confirmed correct via code inspection)
- QUAL-04: pluginCommands.ts:39 missing "Claude Config:" prefix (cosmetic, 1-line fix)

---

