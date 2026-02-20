# Milestones: Claude Code Config Manager

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

