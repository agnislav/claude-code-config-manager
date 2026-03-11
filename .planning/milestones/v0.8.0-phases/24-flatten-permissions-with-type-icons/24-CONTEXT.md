# Phase 24: Flatten Permissions with Type Icons - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current 3-level permission hierarchy (Section → PermissionGroup → PermissionRule) with a flat 2-level structure (Section → PermissionRule). Each rule displays a type-aware icon and an inline button to switch its permission type. Requirements: PERM-01, PERM-02, PERM-03, PERM-04.

</domain>

<decisions>
## Implementation Decisions

### Rule label format
- Icon-only display: rule pattern as label, no type text prefix or description
- Icons: keep existing `check` (allow), `close` (deny), `question` (ask) from PERMISSION_CATEGORY_ICONS
- Default theme color for icons — type conveyed by icon shape alone, no color coding
- Overlap ThemeColor still applied to icons when overlap exists (same as current behavior)

### Sort order in flat list
- Category order: Allow → Ask → Deny (most permissive first)
- Within each category: file order (as written in JSON array)
- No visual separators between type groups — continuous flat list
- Icons provide sufficient visual distinction between types

### Add-rule flow
- Inline `+` button on the Permissions section node header
- No context menu entry for adding rules (inline `+` only)
- Clicking `+` opens QuickPick with Allow/Ask/Deny options (no default selection — user must pick)
- After type selection, input box for rule pattern
- Two-step flow: type → pattern

### Type-switch button
- Inline `$(edit)` pencil icon on each permission rule
- Also available via right-click context menu ("Change Type" entry)
- QuickPick shows all 3 types with current type marked as "(current)"
- Selecting a type applies immediately — no confirmation dialog
- Selecting the current type is a no-op (QuickPick dismisses)
- Writes to the correct config file: removes rule from old category array, adds to new category array

### Claude's Discretion
- Exact command registration and `when` clause patterns for new inline buttons
- How to handle the `permissionGroup` contextValue removal across package.json
- Error handling for type-switch write failures (follow existing showWriteError pattern)
- Whether to remove PermissionGroupNode and PermissionGroupVM entirely or leave as dead code for cleanup

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PERMISSION_CATEGORY_ICONS` (constants.ts): Maps allow→check, deny→close, ask→question — reuse directly on rule nodes
- `PERMISSION_CATEGORY_LABELS` (constants.ts): Maps allow→Allow, deny→Deny, ask→Ask — reuse in QuickPick
- `buildPermissionRule()` (builder.ts): Already builds PermissionRuleVM with overlap, tooltip, contextValue — promote to direct section children
- `PermissionRuleVM` (viewmodel/types.ts): Has `rule` and `category` fields — category drives icon selection
- `addPermissionRule` command (addCommands.ts): Existing add flow, needs rewiring from group node to section node
- `configWriter` (configWriter.ts): Write helpers for adding/removing from permission arrays

### Established Patterns
- Inline buttons via package.json `when` clauses with `viewItem =~` regex matching
- QuickPick for type selection (used in filter, move-to-scope)
- `showWriteError` for write failure recovery (retry + open file)
- Builder builds VMs → nodes are trivial mappers (Phase 16/17 pattern)

### Integration Points
- `builder.ts` `buildPermissionGroups()` → refactor to `buildPermissionRules()` returning flat PermissionRuleVM[]
- `package.json` menus → update `when` clauses: remove `permissionGroup` references, add inline edit button for `permissionRule`
- `addCommands.ts` → rewire from PermissionGroupNode context to SectionNode context with type QuickPick
- `vmToNode.ts` → remove PermissionGroup case from NodeKind switch (or leave for safety)
- `SectionType.Permissions` dispatch in builder → returns flat rule VMs instead of group VMs

</code_context>

<specifics>
## Specific Ideas

- The inline `+` on Permissions section mirrors how VS Code's own settings and Source Control show action buttons on section headers
- QuickPick for type selection should feel like the existing move-to-scope QuickPick — consistent interaction pattern
- The `$(edit)` pencil icon for type-switch is deliberate — it's a universal "change this" affordance that doesn't conflict with `$(arrow-swap)` already used for move

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-flatten-permissions-with-type-icons*
*Context gathered: 2026-03-11*
