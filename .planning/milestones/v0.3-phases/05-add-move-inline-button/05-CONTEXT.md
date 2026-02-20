# Phase 5: Add Move Inline Button - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a move inline icon button alongside the existing copy icon button on tree items that support copy-to-scope. The move button invokes the existing move-to-scope command infrastructure. This provides a one-click move action instead of requiring the context menu.

</domain>

<decisions>
## Implementation Decisions

### Icon choice
- Use `$(arrow-both)` icon (vertical double-headed arrow) for the move button
- Tooltip text: "Move to Scope..."
- Only show on `.editable` items — no visibility on read-only scope items

### Button placement
- Move button appears **before** the copy button (leftmost action button)
- Layout for permissionRule/setting: `[move]` `[copy]` `[delete]`
- Layout for plugin: `[readme]` `[move]` `[copy]` `[delete]` (4 buttons is acceptable)
- Existing button order shifts right to accommodate move at lower `inline@` position

### Node types
- Move inline button matches the **copy button pattern**: permissionRule, plugin, setting
- This directly satisfies MOVE-01 ("items that show copy also show move")
- If moveToScope doesn't currently support plugins, the command scope needs extending

### Move confirmation
- Clicking the move button shows a **confirmation dialog** before opening the scope picker
- Move is destructive (removes from source), so an extra confirmation step prevents accidental moves
- This differs from the copy flow which goes straight to the picker

### Claude's Discretion
- Confirmation dialog wording and style
- Exact `inline@N` numbering to achieve the desired button order
- How to extend moveToScope to support plugins (if needed)
- Lock-aware behavior for the inline button (follow existing patterns from Phase 3)

</decisions>

<specifics>
## Specific Ideas

- User wants a separate document listing all item types and their inline buttons (a button inventory/reference)
- The `$(arrow-both)` icon was chosen specifically to contrast visually with `$(copy)` — vertical vs horizontal metaphor

</specifics>

<deferred>
## Deferred Ideas

- Separate document with list of item types (permission, plugin, etc.) and their buttons — useful reference but not part of this phase's implementation

</deferred>

---

*Phase: 05-add-move-inline-button*
*Context gathered: 2026-02-19*
