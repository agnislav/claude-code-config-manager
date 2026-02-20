# Phase 1: QuickPick Multi-Select Filter - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the 8 toolbar icon buttons (All + 7 sections) with a single filter icon that opens a `vscode.createQuickPick` multi-select picker. Remove all associated command registrations and `setContext` machinery. The existing filter logic (empty set = All; individual selections = inclusive filter) is preserved — only the trigger mechanism changes.

</domain>

<decisions>
## Implementation Decisions

### Filter active indicator
- Use TreeView `description` property to show filter state
- Format: "3/7" style count — exact wording is Claude's discretion
- Description is empty when unfiltered (no "7/7" in default state)
- Count only — no section names in the description

### Picker item presentation
- Each section item has a codicon icon matching its tree icon + text label
- No description line (gray text) on items — just icon + label, keeps it compact
- Top item is labeled "All" (not "Show All Sections")
- "All" is a regular selectable item at position 0, not a separator
- Mutual exclusivity: selecting "All" deselects individual sections; selecting an individual section deselects "All"

### Toolbar icon
- Use `$(filter)` codicon for the filter button
- Switch to `$(filter-filled)` when any filter is active (anything but "All")
- Dynamic tooltip: "Filter Sections" when unfiltered, "Filter Sections (3/7)" when filtered

### Section ordering
- Sections appear in the same order as the current filter bar (which matches the tree order)
- Preserves existing muscle memory from the toolbar icon layout

### Claude's Discretion
- Exact codicon icons for each section item in the picker
- Exact tooltip wording format
- Internal implementation of the mutual exclusivity between "All" and individual items

</decisions>

<specifics>
## Specific Ideas

- The "All" item at position 0 acts as a quick reset — one click to clear all filters
- Icon swap (filter → filter-filled) provides instant visual feedback without reading text

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-quickpick-multi-select-filter*
*Context gathered: 2026-02-18*
