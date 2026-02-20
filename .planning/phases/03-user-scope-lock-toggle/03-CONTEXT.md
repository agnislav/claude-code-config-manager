# Phase 3: User Scope Lock Toggle - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a lock toggle that makes the User scope read-only for the session. When locked, User scope tree items remain visible but non-editable. Lock state is ephemeral (resets on VS Code restart), lives in ConfigStore, and survives file-watcher reloads.

</domain>

<decisions>
## Implementation Decisions

### Blocked action feedback
- Locked User scope behaves like Managed scope: context menus for write actions (edit, delete, add) are hidden via `contextValue` read-only pattern — no menus appear, not "shown but blocked"
- If someone triggers an edit command via Command Palette on a locked item, show a brief info message: "User scope is currently locked. Click the lock icon in the toolbar to unlock." (helpful hint tone with actionable guidance)
- No modal dialogs — just `vscode.window.showInformationMessage()`

### Lock discoverability
- **Unlocked (default):** No lock icon on the User scope node. `$(lock)` inline hover button on the User scope tree item (click to lock)
- **Locked:** `$(lock)` icon NOT added to node (keep original scope icon). `$(unlock)` inline hover button on the User scope tree item (click to unlock). User scope node text is dimmed via FileDecorationProvider
- Icon reflects current state, not available action: `$(unlock)` = unlocked, `$(lock)` = locked
- Tooltip on inline buttons: "User scope: unlocked (click to lock)" / "User scope: locked (click to unlock)"
- **Placement:** Inline action on User scope tree item (`view/item/context` with `group: "inline"`), NOT a toolbar button. Lock icon only appears when hovering over the User scope row.

### Move/copy locked behavior
- User scope shown in target scope picker with `$(lock)` prefix: "$(lock) User" — not filtered out
- If user selects locked User scope as target: show info message "User scope is locked" and cancel the operation
- **Move FROM locked User scope:** Blocked (move deletes from source = write operation)
- **Copy FROM locked User scope:** Allowed (copy is non-destructive)
- **Move/copy TO locked User scope:** Blocked

### Scope indicator in tree
- When locked: User scope node text is dimmed via FileDecorationProvider (same mechanism Git uses for deleted files)
- Dimming applies to the scope node only, not children
- No '(locked)' description text — dim color alone is sufficient
- Original scope icon is preserved (no icon replacement)
- Child nodes under locked User scope: no visual change

### Claude's Discretion
- Exact ThemeColor for dimmed state (should match VS Code's existing "ignored" or "disabled" color conventions)
- FileDecorationProvider implementation details (resourceUri scheme, decoration caching)
- Exact wording of Command Palette lock message beyond the agreed tone
- How to handle edge case: locking while a User scope edit is in progress

</decisions>

<specifics>
## Specific Ideas

- "Like P2" — the user wants the locked state to follow the same read-only conventions already established by the Managed scope, where write actions simply don't appear in context menus
- Lock/unlock inline buttons on the User scope row, not toolbar buttons — associates the lock with what it controls
- Dim-only indicator (no text, no icon change) — minimal and clean

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-user-scope-lock-toggle*
*Context gathered: 2026-02-19*
