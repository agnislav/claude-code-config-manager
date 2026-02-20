---
milestone: v1.0
audited: 2026-02-19
status: gaps_found
scores:
  requirements: 22/23
  phases: 3/3
  integration: 6/7
  flows: 3/3
gaps:
  requirements:
    - id: "FILT-03"
      status: "unsatisfied"
      phase: "1 — QuickPick Multi-Select Filter"
      claimed_by_plans: ["01-03-PLAN (gap fix)"]
      completed_by_plans: ["01-03-SUMMARY claims fix applied — code contradicts"]
      verification_status: "passed (stale — pre-regression)"
      evidence: "Plan 01-03 introduced immediate filter application on onDidChangeSelection (Gap 2 fix). The SUMMARY claims cancel-restore via previousFilter/accepted flag was also implemented, but neither variable exists in extension.ts (grep confirms zero matches). Pressing Escape after changing selections leaves the in-progress filter active instead of reverting to the pre-open state."
  integration:
    - from: "Phase 1 plan 01-03 (Gap 2 fix)"
      to: "FILT-03 requirement"
      issue: "Immediate filter application in onDidChangeSelection broke cancel semantics. The claimed previousFilter/accepted restore logic was never implemented."
  flows: []
tech_debt:
  - phase: 01-quickpick-multi-select-filter
    items:
      - "Dead code: toggleSectionFilter() and selectAllSections() remain as unreferenced public methods on ConfigTreeProvider"
      - "Metadata gap: No requirements_completed frontmatter in any Phase 1 SUMMARY (01-01, 01-02, 01-03)"
  - phase: 03-user-scope-lock-toggle
    items:
      - "UX note: Locked User scope appears in move/copy pickers with $(lock) prefix rather than being hidden; selection is blocked with info message — functional but arguably not matching literal 'disabled' interpretation"
---

# Milestone v1.0 Audit — Toolbar UX Improvements

**Audited:** 2026-02-19
**Status:** gaps_found
**Requirements:** 22/23 satisfied (1 unsatisfied)

## Phase Verification Summary

| Phase | Directory | VERIFICATION.md | Status | Requirements |
|-------|-----------|-----------------|--------|--------------|
| 1 — QuickPick Multi-Select Filter | `01-quickpick-multi-select-filter/` | `01-VERIFICATION.md` | passed | 9/10 (FILT-03 regression) |
| 2 — Remove Refresh Toolbar Button | `02-remove-refresh-toolbar-button/` | `02-VERIFICATION.md` | passed | 3/3 |
| 3 — User Scope Lock Toggle | `03-user-scope-lock-toggle/` | `VERIFICATION.md` | passed | 10/10 |

## Requirements Cross-Reference (3-Source)

### Source 1: Phase VERIFICATION.md Files

- Phase 1: FILT-01..10 all PASS (note: FILT-03 PASS is stale — verified before plan 01-03 regression)
- Phase 2: REFR-01..03 all PASS
- Phase 3: LOCK-01..10 all PASS

### Source 2: SUMMARY.md Frontmatter

- Phase 1 summaries (01-01, 01-02, 01-03): No `requirements_completed` frontmatter field
- Phase 2 summary (02-01): `requirements_delivered: [REFR-01, REFR-02, REFR-03]`
- Phase 3 summaries: `requirements-completed: [LOCK-06..10]` (03-01) + `[LOCK-01..05]` (03-02)

### Source 3: REQUIREMENTS.md Traceability Table

All 23 requirements show `Pending` status (checkboxes unchecked).

### Cross-Reference Matrix

| Requirement | VERIFICATION | SUMMARY Frontmatter | REQUIREMENTS.md | Final Status |
|-------------|-------------|---------------------|-----------------|--------------|
| FILT-01 | passed | missing | `[ ]` | **satisfied** |
| FILT-02 | passed | missing | `[ ]` | **satisfied** |
| FILT-03 | passed (stale) | missing | `[ ]` | **unsatisfied** |
| FILT-04 | passed | missing | `[ ]` | **satisfied** |
| FILT-05 | passed | missing | `[ ]` | **satisfied** |
| FILT-06 | passed | missing | `[ ]` | **satisfied** |
| FILT-07 | passed | missing | `[ ]` | **satisfied** |
| FILT-08 | passed | missing | `[ ]` | **satisfied** |
| FILT-09 | passed | missing | `[ ]` | **satisfied** |
| FILT-10 | passed | missing | `[ ]` | **satisfied** |
| REFR-01 | passed | listed | `[ ]` | **satisfied** |
| REFR-02 | passed | listed | `[ ]` | **satisfied** |
| REFR-03 | passed | listed | `[ ]` | **satisfied** |
| LOCK-01 | passed | listed | `[ ]` | **satisfied** |
| LOCK-02 | passed | listed | `[ ]` | **satisfied** |
| LOCK-03 | passed | listed | `[ ]` | **satisfied** |
| LOCK-04 | passed | listed | `[ ]` | **satisfied** |
| LOCK-05 | passed | listed | `[ ]` | **satisfied** |
| LOCK-06 | passed | listed | `[ ]` | **satisfied** |
| LOCK-07 | passed | listed | `[ ]` | **satisfied** |
| LOCK-08 | passed | listed | `[ ]` | **satisfied** |
| LOCK-09 | passed | listed | `[ ]` | **satisfied** |
| LOCK-10 | passed | listed | `[ ]` | **satisfied** |

**Orphaned requirements:** None (all 23 requirements appear in at least one phase VERIFICATION.md).

## Unsatisfied Requirements Detail

### FILT-03: Dismissing QuickPick without accepting preserves the previous filter state

**Requirement:** "Dismissing QuickPick without accepting preserves the previous filter state (cancel = no change)"

**Root cause:** Plan 01-03 introduced immediate filter application on `onDidChangeSelection` to fix UAT Gap 2 (user wants to see filter results while picker is open). The fix was supposed to also implement cancel-restore: save the pre-open filter in `previousFilter`, track an `accepted` flag, and restore in `onDidHide` when `!accepted`.

**Evidence of gap:**
- `src/extension.ts` lines 214–291: `openSectionFilterPicker()` has no `previousFilter` variable, no `accepted` flag, no restore logic in `onDidHide`
- `grep -n 'previousFilter\|accepted' src/extension.ts` returns zero matches
- 01-03-SUMMARY.md self-check claims "previousFilter appears in 2 places" and "accepted flag appears in 3 places" — neither exists in the current code

**Impact:** When user opens the filter picker, changes selections (tree updates immediately), then presses Escape, the tree retains the in-progress filter state instead of reverting. This is a UX regression compared to the pre-01-03 behavior where cancel was inherently safe because the filter was only applied on Accept.

**Fix estimate:** Add 3 lines: (1) `const previousFilter = new Set(treeProvider.sectionFilter)` before `qp.show()`, (2) `let accepted = false` declaration, (3) `accepted = true` in `onDidAccept`, (4) `if (!accepted) treeProvider.setSectionFilter(previousFilter)` in `onDidHide` before `dispose()`.

## Integration Checker Report

### Cross-Phase Wiring

| Check | Status | Notes |
|-------|--------|-------|
| package.json commands coexistence | PASS | Phase 1 filter, Phase 2 refresh, Phase 3 lock commands all present and correct |
| extension.ts registrations | PASS | All commands registered, subscriptions pushed, context keys initialized |
| ConfigTreeProvider interactions | PASS | Filter + lock propagation work independently; `_sectionFilter` and `effectiveReadOnly` are orthogonal |
| ScopeNode contextValue compatibility | PASS | New `scope.{scope}.{editable\|readOnly}` format matches all existing `/^scope\./` regex `when` clauses |
| package.json when clause integrity | PASS | No broken `when` clauses from the Phase 3 contextValue format change |

### E2E Flows

| Flow | Status | Notes |
|------|--------|-------|
| Filter + Lock | PASS | Filter narrows sections → lock makes User scope read-only → edits blocked → correct |
| Lock + Move | PASS | Locked User scope shown with $(lock) prefix in picker → selection blocked with info message |
| Lock + File Watcher | PASS | `_lockedScopes` survives `reload()` → tree rebuilds with lock intact |
| Filter + Cancel | **FAIL** | Immediate filter application + missing cancel-restore = FILT-03 regression |

### Integration Wiring Gaps

| From → To | Issue | Affected Requirements |
|-----------|-------|----------------------|
| Plan 01-03 → FILT-03 | Immediate filter apply broke cancel semantics; restore logic never implemented | FILT-03 |

## Tech Debt

### Phase 1: QuickPick Multi-Select Filter

- **Dead code:** `toggleSectionFilter()` and `selectAllSections()` remain as unreferenced public methods on `ConfigTreeProvider`. These were part of the old per-section filter system. No commands call them. Poses no functional problem but should be cleaned up.
- **Metadata gap:** No `requirements_completed` frontmatter in any Phase 1 SUMMARY file (01-01, 01-02, 01-03). All other phases have this metadata.

### Phase 3: User Scope Lock Toggle

- **UX inconsistency:** Locked User scope appears in move/copy target pickers with `$(lock)` prefix and blocks selection with info message, while `addCommands.pickScopeFilePath` hides locked scopes entirely. Behavior is functional but inconsistent across command types.

## Conclusion

**22 of 23 requirements are satisfied.** The single gap (FILT-03) is a regression from plan 01-03 where the immediate-apply behavior was added without the corresponding cancel-restore logic. The fix is small (4 lines) and well-understood. All cross-phase integration is sound. All E2E flows work correctly except the filter cancel path.

---
*Audit completed: 2026-02-19*
*Sources: Phase VERIFICATION.md files, SUMMARY.md frontmatter, REQUIREMENTS.md traceability, integration checker (code inspection), manual code review*
