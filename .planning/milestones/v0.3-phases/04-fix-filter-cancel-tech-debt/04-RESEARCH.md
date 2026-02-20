# Phase 4: Fix Filter Cancel + Tech Debt Cleanup — Research

**Researched:** 2026-02-19
**Domain:** VS Code Extension — QuickPick cancel semantics, dead code removal, SUMMARY frontmatter normalization, lock picker consistency
**Confidence:** HIGH

## Summary

Phase 4 is a gap-closure and cleanup phase with no new libraries or architectural patterns. All work is
confined to existing files and follows patterns already established in Phases 1–3. The single requirement
(FILT-03) is a well-understood regression: immediate filter application was added in Plan 01-03 but
the corresponding cancel-restore logic (`previousFilter` snapshot + `accepted` flag + `onDidHide`
restore) was never implemented, despite the 01-03 SUMMARY claiming it was. The audit confirmed this
with grep evidence.

The tech debt items are all mechanical: two dead methods to delete, frontmatter to add to three
SUMMARY files, and one picker behavior to normalize. None require research beyond reading the current
codebase state. There are no external library decisions to make — the existing `vscode.QuickPick` API
is the only mechanism involved, and the correct pattern was already fully designed in Plan 01-03-PLAN.md.

**Primary recommendation:** Implement FILT-03 fix exactly as specified in the 01-03-PLAN.md reference
implementation (the `previousFilter`/`accepted` pattern). Do all four tech debt items in the same plan
as they are trivially small. This phase needs only one plan.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILT-03 | Dismissing QuickPick without accepting preserves the previous filter state (cancel = no change) | Fix is 4 lines: `previousFilter` snapshot before `qp.show()`, `let accepted = false`, `accepted = true` in `onDidAccept`, `if (!accepted) treeProvider.setSectionFilter(previousFilter)` in `onDidHide` before `dispose()` |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vscode (extension API) | already bundled | QuickPick API: `onDidChangeSelection`, `onDidAccept`, `onDidHide`, `dispose()` | The only API available in this context — no alternatives |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | already in use | `Set<SectionType>` for snapshot, `let accepted: boolean` | Type safety on filter state |

### Alternatives Considered

None — this is a one-file logic fix within the VS Code extension API. No library choices exist.

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure

No structural changes. All changes are within:

```
src/
├── extension.ts                          # FILT-03 fix: previousFilter + accepted pattern
├── tree/configTreeProvider.ts            # Tech debt: remove toggleSectionFilter(), selectAllSections()
.planning/phases/01-quickpick-multi-select-filter/
├── 01-01-SUMMARY.md                      # Tech debt: add requirements_completed frontmatter
├── 01-02-SUMMARY.md                      # Tech debt: add requirements_completed frontmatter
└── 01-03-SUMMARY.md                      # Tech debt: add requirements_completed frontmatter
```

### Pattern 1: QuickPick Cancel-Restore (FILT-03 Fix)

**What:** Snapshot filter state before opening picker; track `accepted` flag; restore snapshot in `onDidHide` when `!accepted`

**When to use:** Any `vscode.createQuickPick` with immediate application of selections where cancel must revert changes

**Example:**
```typescript
// Source: Plan 01-03-PLAN.md (reference implementation designed but not executed)
// In openSectionFilterPicker() in src/extension.ts

// Before qp.show() — after setting qp.selectedItems:
const previousFilter = new Set<SectionType>(treeProvider.sectionFilter);
let accepted = false;

// onDidAccept (replaces current implementation):
qp.onDidAccept(() => {
  accepted = true;
  qp.hide();
});

// onDidHide (replaces current implementation):
qp.onDidHide(() => {
  if (!accepted) {
    // Escape or focus loss — restore pre-open filter state
    treeProvider.setSectionFilter(previousFilter);
  }
  qp.dispose();
});
```

**Critical placement:** `previousFilter` snapshot MUST be taken AFTER `qp.selectedItems` is set (pre-selection block) but BEFORE `qp.show()`. If taken before pre-selection, the snapshot is correct anyway (it reads `treeProvider.sectionFilter` which hasn't changed), but placement after pre-selection is clearest.

**Note on current code:** The current `openSectionFilterPicker()` in `src/extension.ts` already has the immediate filter application in `onDidChangeSelection` (implemented correctly). It is ONLY missing the `previousFilter`/`accepted`/restore logic. The `onDidAccept` currently calls `qp.hide()` without setting `accepted`, and `onDidHide` currently only calls `qp.dispose()`. These two handlers are the only things that need changing plus adding the two variable declarations.

### Pattern 2: Dead Method Removal

**What:** Delete `toggleSectionFilter(section: SectionType)` and `selectAllSections()` from `ConfigTreeProvider`

**Evidence they are dead:**
- No call sites in `src/` — confirmed by grep: no command invokes them
- The 01-01-SUMMARY mentions them as "hooks ready for wiring" but 01-02 wired `setSectionFilter` instead
- The 01-03-PLAN Task 3 reference implementation also uses only `setSectionFilter`

**Risk:** LOW. Both methods are unreferenced. TypeScript strict mode means no implicit any — the compiler will confirm no remaining callers after removal.

**Verify after deletion:**
```bash
grep -rn 'toggleSectionFilter\|selectAllSections' src/ --include="*.ts"
# Must return zero matches
npm run typecheck  # Must pass
```

### Pattern 3: SUMMARY Frontmatter Normalization

**What:** Add `requirements_completed` frontmatter to Phase 1 SUMMARY files to match Phase 2–3 style

**Current state (confirmed by reading files):**

- `01-01-SUMMARY.md`: frontmatter has `phase`, `plan`, `status`, `started`, `completed` — NO `requirements_completed`
- `01-02-SUMMARY.md`: frontmatter has `phase`, `plan`, `status`, `started`, `completed` — NO `requirements_completed`
- `01-03-SUMMARY.md`: frontmatter has `phase`, `plan`, `status`, `tasks_completed` — NO `requirements_completed`

**Phase 2 style (simpler):** `requirements_delivered: [REFR-01, REFR-02, REFR-03]`

**Phase 3 style (richer):** `requirements-completed: [LOCK-06, LOCK-07, ...]`

**Recommended approach:** Use `requirements_completed` (underscore, matching the field name used in Phase 3's YAML and the audit's language). Add per-plan based on what each plan actually delivered:

| SUMMARY | Requirements to add |
|---------|---------------------|
| `01-01-SUMMARY.md` | `FILT-07`, `FILT-08` (removed old filter infrastructure and syncFilterContext) |
| `01-02-SUMMARY.md` | `FILT-01`, `FILT-02`, `FILT-04`, `FILT-05`, `FILT-06`, `FILT-09`, `FILT-10` (QuickPick filter implementation) |
| `01-03-SUMMARY.md` | `FILT-03` (partial — will be completed by Phase 4; OR: leave FILT-03 out and add it when Phase 4 closes it) |

**Decision point for planner:** Whether to add `FILT-03` to 01-03-SUMMARY (since it claimed to fix it) or leave it out and add it to Phase 4 plan SUMMARY instead. Recommendation: do NOT add FILT-03 to 01-03-SUMMARY (the 01-03 SUMMARY is historically inaccurate on this point), and instead add it to Phase 4's SUMMARY when the fix is complete.

### Pattern 4: Lock Picker Consistency Normalization

**What:** Normalize lock behavior in move/copy pickers to be consistent with `addCommands.pickScopeFilePath`

**Current inconsistency (confirmed by reading code):**

| Command | Locked scope handling |
|---------|----------------------|
| `pickScopeFilePath` (addCommands.ts line 224) | **Hides** locked scopes: `editableScopes.filter(s => !s.isReadOnly && !configStore.isScopeLocked(s.scope))` |
| `moveToScope` picker (moveCommands.ts line 48) | **Shows** locked scopes with `$(lock)` prefix, blocks selection with info message |
| `copySettingToScope` picker (moveCommands.ts line 147) | **Shows** locked scopes with `$(lock)` prefix, blocks selection with info message |
| `copyPermissionToScope` picker (moveCommands.ts line 241) | **Shows** locked scopes with `$(lock)` prefix, blocks selection with info message |

**Prior decision (2026-02-19):** "Copy FROM locked User scope is allowed (non-destructive); move FROM locked User is blocked (destructive)." This addresses the source behavior, not the target picker behavior.

**Normalization approach:** Two options —

**Option A (hide locked from target pickers):** Match `pickScopeFilePath` behavior. Remove locked scopes from move/copy target pickers. Simpler pickers, no need for `$(lock)` prefix or post-selection guard.

**Option B (show locked in add picker):** Match move/copy behavior. Update `pickScopeFilePath` to show locked scopes with `$(lock)` prefix and block selection.

**Recommendation:** Option A — hide locked scopes from move/copy target pickers. Reasoning:
1. `addCommands.pickScopeFilePath` was the most recently updated (Phase 3 Plan 02), representing the latest design intention
2. The audit explicitly flagged Option B as "UX note: functional but arguably not matching literal 'disabled' interpretation"
3. Hiding is simpler and less error-prone than showing-then-blocking
4. For move/copy operations (destructive), hiding a locked scope prevents any confusion

**Code change:** In `moveCommands.ts`, update all three `targetScopes`/`copySettingTargetScopes`/`copyPermTargetScopes` filters to add `&& !configStore.isScopeLocked(s.scope)`. Remove the post-selection `if (movePick.isLocked)` / `if (copySettingPick.isLocked)` / `if (permScopePick.isLocked)` guard blocks and the `isLocked` property from picker items. Remove the `$(lock)` prefix from labels.

### Anti-Patterns to Avoid

- **Setting `previousFilter` before pre-selection:** The snapshot should capture the real pre-open filter, not an intermediate state. Since `treeProvider.sectionFilter` doesn't change during `qp.items`/`qp.selectedItems` setup, placement is flexible but clearest after the selectedItems block.
- **Calling `setSectionFilter` in `onDidAccept`:** The filter is already applied live in `onDidChangeSelection`. `onDidAccept` must only set `accepted = true` and call `qp.hide()`.
- **Calling `qp.dispose()` before `onDidHide` restore:** `dispose()` must always be the last call in `onDidHide`, after any restore logic.
- **Removing `setSectionFilter` from `onDidChangeSelection`:** This was the intentional Gap 2 fix that must be preserved. Phase 4 adds restore semantics without removing immediate apply.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Snapshot of a `ReadonlySet<SectionType>` | Custom serialization | `new Set<SectionType>(treeProvider.sectionFilter)` | `Set` constructor accepts any iterable; `ReadonlySet` is iterable |
| Cancel detection | Timer-based or focus-check heuristics | `accepted` boolean flag pattern with `onDidHide` | The VS Code API fires `onDidHide` for BOTH accept and escape — only the flag distinguishes them |

**Key insight:** The VS Code QuickPick fires `onDidHide` whether the user pressed Escape, Enter/Accept, or clicked outside. The only way to distinguish cancel from accept is an explicit boolean flag set in `onDidAccept`.

## Common Pitfalls

### Pitfall 1: onDidHide fires on Accept too
**What goes wrong:** Developer assumes `onDidHide` only fires on cancel/escape, so they always restore `previousFilter`
**Why it happens:** The VS Code `QuickPick.onDidHide` event fires whenever the picker is hidden, regardless of how it was dismissed
**How to avoid:** Always use the `accepted` flag pattern: `let accepted = false` → set `true` in `onDidAccept` → check `if (!accepted)` in `onDidHide`
**Warning signs:** Filter always reverts even after pressing Enter to confirm

### Pitfall 2: Snapshot taken after first selection change
**What goes wrong:** `previousFilter` captures a partially-modified state instead of the pre-open state
**Why it happens:** Variable declared inside `onDidChangeSelection` callback instead of outside it
**How to avoid:** Declare `previousFilter` before any event handler registration and before `qp.show()`

### Pitfall 3: TypeScript error after dead code removal
**What goes wrong:** `toggleSectionFilter` or `selectAllSections` removal causes compile errors if referenced somewhere unexpected
**Why it happens:** Grep missed a reference (e.g., in a test file or type declaration)
**How to avoid:** Run `npm run typecheck` immediately after deletion; also grep all `*.ts` files including test directories

### Pitfall 4: Frontmatter field name inconsistency
**What goes wrong:** SUMMARY files end up with mixed field names (`requirements_completed` vs `requirements-completed` vs `requirements_delivered`)
**Why it happens:** Phase 2 used `requirements_delivered`, Phase 3 used `requirements-completed`
**How to avoid:** Pick one canonical name and apply consistently. Recommendation: `requirements_completed` (underscore style, matches audit language). Phase 3's hyphen style is a YAML quirk — both work as YAML keys but underscores are more conventional.

## Code Examples

Verified patterns from codebase inspection:

### Current openSectionFilterPicker() — What's Present (Correct)
```typescript
// src/extension.ts lines 243-280 — ALREADY CORRECT
qp.onDidChangeSelection((selected) => {
  // mutual exclusivity logic...
  latestSelection = [...qp.selectedItems];

  // Immediate filter application (Gap 2 fix — already implemented)
  const selectedSections = new Set<SectionType>();
  for (const item of latestSelection) {
    if (item === allItem) {
      treeProvider.setSectionFilter(new Set());
      return;
    }
    const idx = sectionItems.indexOf(item);
    if (idx >= 0) {
      selectedSections.add(SECTION_ORDER[idx]);
    }
  }
  treeProvider.setSectionFilter(selectedSections);
});
```

### What Needs to be ADDED (FILT-03 Fix)
```typescript
// src/extension.ts — add after qp.selectedItems pre-selection block, before qp.show()
const previousFilter = new Set<SectionType>(treeProvider.sectionFilter);
let accepted = false;

// Replace current onDidAccept (currently: qp.hide() only):
qp.onDidAccept(() => {
  accepted = true;
  qp.hide();
});

// Replace current onDidHide (currently: qp.dispose() only):
qp.onDidHide(() => {
  if (!accepted) {
    treeProvider.setSectionFilter(previousFilter);
  }
  qp.dispose();
});
```

### Dead Methods to Delete
```typescript
// src/tree/configTreeProvider.ts — DELETE both of these methods:

toggleSectionFilter(section: SectionType): void {       // lines 41-49
  if (this._sectionFilter.has(section)) {
    this._sectionFilter.delete(section);
  } else {
    this._sectionFilter.add(section);
  }
  this.updateFilterUI();
  this.refresh();
}

selectAllSections(): void {                              // lines 51-55
  this._sectionFilter.clear();
  this.updateFilterUI();
  this.refresh();
}
```

### pickScopeFilePath Pattern (add commands — the canonical locked-scope exclusion)
```typescript
// src/commands/addCommands.ts lines 224-226 — the reference pattern
const editableScopes = allScopes.filter(
  (s) => !s.isReadOnly && !configStore.isScopeLocked(s.scope),
);
```

### Move/Copy Target Picker Pattern (BEFORE normalization)
```typescript
// src/commands/moveCommands.ts lines 48-74 — current inconsistent pattern
const targetScopes = allScopes.filter(
  (s) => s.scope !== scope && !s.isReadOnly && s.scope !== ConfigScope.Managed,
  // Missing: && !configStore.isScopeLocked(s.scope)
);
// Then shows locked items with $(lock) prefix and blocks post-selection
```

### Move/Copy Target Picker Pattern (AFTER normalization — Option A)
```typescript
// Normalized to match pickScopeFilePath:
const targetScopes = allScopes.filter(
  (s) => s.scope !== scope
    && !s.isReadOnly
    && s.scope !== ConfigScope.Managed
    && !configStore.isScopeLocked(s.scope),  // ADD THIS
);
// Remove: isLocked property from picker items, $(lock) label prefix, post-selection guard block
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Apply filter only on Accept | Immediate apply on onDidChangeSelection | Plan 01-03 (01-03-PLAN.md, 2026-02-19) | Requires explicit cancel-restore logic |
| Per-section toolbar buttons | Single QuickPick multi-select | Plan 01-02 (2026-02-19) | Cleaner UX, single icon in toolbar |
| toggleSectionFilter / selectAllSections | setSectionFilter | Plan 01-02 | Old methods now dead code |

**Deprecated/outdated:**
- `toggleSectionFilter()`: superseded by `setSectionFilter()` in Plan 01-02. Never called. Delete.
- `selectAllSections()`: superseded by `setSectionFilter(new Set())` in Plan 01-02. Never called. Delete.
- `$(lock)` prefix + post-selection block in move/copy pickers: inconsistent with `pickScopeFilePath`. Normalize by hiding locked scopes from pickers.

## Open Questions

1. **Which requirements to list in 01-03-SUMMARY frontmatter?**
   - What we know: 01-03 attempted FILT-03 (Gap 2) but introduced a regression; Gap 1 (icons) and Gap 3 (TreeView description) were claims in the SUMMARY but the codebase evidence shows Gap 3 (`setTreeView`/`_treeView`) was never implemented either
   - What's unclear: Should 01-03-SUMMARY claim any requirements? It implemented immediate filter apply (part of FILT-04's spirit) but not FILT-03 (cancel)
   - Recommendation: Add no FILT requirements to 01-03-SUMMARY frontmatter since its primary goal (FILT-03 via Gap 2) regressed. Add `requirements_completed: []` or simply add the metadata field with a comment. OR: add only the requirements that ARE correctly implemented by 01-03 (Gap 1: icons in description — this IS present in current code). Gap 3 (`setTreeView`) is NOT present so cannot be claimed.

2. **Gap 3 (TreeView N/7 description) — is it implemented?**
   - What we know: Current `configTreeProvider.ts` has no `setTreeView` method, no `_treeView` field. `updateFilterUI` only calls `setContext`. The 01-02 and 01-03 SUMMARYs claimed `setTreeView` was added but grep shows zero matches.
   - What's unclear: Was `setTreeView` reverted? Was it a FILT-V2 feature?
   - Recommendation: This is out of scope for Phase 4. The FILT-V2 requirements cover TreeView description enhancements. Don't fix it here.

## Sources

### Primary (HIGH confidence)
- `src/extension.ts` — direct code inspection, lines 214-291: confirmed absence of `previousFilter`, `accepted`, and restore logic; confirmed presence of immediate filter application in `onDidChangeSelection`
- `src/tree/configTreeProvider.ts` — direct code inspection: confirmed `toggleSectionFilter` and `selectAllSections` are dead code with no callers; confirmed `updateFilterUI` has no `_treeView` reference
- `src/commands/moveCommands.ts` — direct code inspection: confirmed inconsistent lock picker behavior vs `addCommands.pickScopeFilePath`
- `src/commands/addCommands.ts` — direct code inspection: confirmed `pickScopeFilePath` excludes locked scopes via `!configStore.isScopeLocked()`
- `.planning/v1-MILESTONE-AUDIT.md` — direct reading: confirmed FILT-03 gap, tech debt items, and inconsistency findings
- `.planning/phases/01-quickpick-multi-select-filter/01-03-PLAN.md` — direct reading: confirmed the planned `previousFilter`/`accepted` pattern (designed but not executed)
- `.planning/phases/01-01-SUMMARY.md`, `01-02-SUMMARY.md`, `01-03-SUMMARY.md` — direct reading: confirmed missing `requirements_completed` frontmatter
- `.planning/phases/02-01-SUMMARY.md`, `03-01-SUMMARY.md`, `03-02-SUMMARY.md` — direct reading: confirmed `requirements_delivered`/`requirements-completed` patterns used in Phases 2–3

### Secondary (MEDIUM confidence)
None — all findings are from direct code inspection.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- FILT-03 fix: HIGH — root cause confirmed by grep, fix fully designed in 01-03-PLAN.md
- Dead code removal: HIGH — no callers confirmed by grep across all `.ts` files
- SUMMARY frontmatter: HIGH — missing field confirmed by reading all three files
- Lock picker normalization: HIGH — inconsistency confirmed by reading both files; Option A recommendation is judgment call (MEDIUM on the choice of direction, HIGH that the inconsistency exists)

**Research date:** 2026-02-19
**Valid until:** 2026-03-20 (stable codebase, 30-day estimate)
