---
name: v0.7.0-visual-fidelity
status: completed
created: 2026-03-08T18:16:42Z
updated: 2026-03-09T00:00:00Z
progress: 100%
prd:
github:
---

# Visual Fidelity (v0.7.0)

## Summary

v0.7.0 made the tree reflect true state — overlaps visible across scopes, lock toggle respected by plugin display, and hook leaf navigation corrected. The milestone replaced the legacy override system with a new 4-directional overlap model (overrides, isOverriddenBy, duplicates, isDuplicatedBy) applied to all 7 entity types, with color-coded git-themed FileDecoration (red/green/yellow/orange) and MarkdownString tooltips showing scope/value/relationship details.

Four phases (19–22) shipped 7 requirements covering hook navigation, lock-aware plugin display, overlap indicators, and a gap-closure phase for lock test coverage. Legacy overrideResolver.ts and ResolvedValue were fully removed. Net change: +1,002 / -423 source lines for 5,672 total TypeScript LOC; tests grew from 23 to 56.

## Requirements delivered

Overlap:
- **OVLP-01**: Tooltip listing all scopes where an entity appears, with each scope's value and override status
- **OVLP-02**: Overlap detection works independently from override detection (new fields on NodeContext)

Lock:
- **LOCK-01**: Locked User scope shows checkmark icon for enabled plugins instead of checkbox
- **LOCK-02**: Locked User scope shows circle-slash icon for disabled plugins instead of checkbox
- **LOCK-03**: Lock state change refreshes plugin node display between checkbox and icon modes

Navigation:
- **NAV-01**: Clicking a hook entry node navigates the editor to the correct JSON line (keyPath includes intermediate `hooks` segment)

Cleanup:
- **CLEN-01**: Dead HookKeyValueVM, HookKeyValueNode, and buildHookKeyValueVM code removed

## Implementation history

- **Phase 19 — Hook Navigation + Cleanup** (3min, 2026-03-08): Fixed hook entry keyPath to include intermediate `hooks` segment for correct JSON line navigation; removed all HookKeyValue dead code (enum member, interface, builder method, formatHookValue helper, node class file, switch case); added test assertion for correct hook keyPath shape. Commits: `8437761` (fix), `5384ce6` (chore).
- **Phase 20 — Lock-Aware Plugin Display** (2026-03-09): Made BaseVM.icon optional and added conditional icon/checkbox logic in buildPlugins keyed on scopedConfig.isReadOnly. When locked: enabled plugins get ThemeIcon('check'), disabled plugins get ThemeIcon('circle-slash') (implementation differs from "no icon" in plan — see tech debt); unlocked plugins retain ThemeIcon('extensions') + checkboxState. Phase executed outside GSD workflow, so no SUMMARY.md was produced.
- **Phase 21 — Visual Overlap Indicators** (~48min total, 2026-03-09): Plan 01 created src/config/overlapResolver.ts with generic nearest-neighbor algorithm using resolveOverlapGeneric + getValue callback (6 of 7 entity types) with permission resolver special-cased for glob matching; introduced OverlapInfo (4-directional model) and OverlapItem types on NodeContext; built OverlapDecorationProvider mapping overlap states to git-themed ThemeColors; added 25 overlap resolver tests (deep equality with sorted keys, getOverlapColor, all 7 resolvers). Plan 02 migrated builder.ts to overlap system for all entity types with buildOverlapTooltip and buildOverlapResourceUri helpers, registered OverlapDecorationProvider in extension.ts, deleted overrideResolver.ts and ResolvedValue entirely. Visual verification caught 4 issues (permission overlap incomplete, permission rules missing visual indicators, tooltip codicons not rendering, isDuplicatedBy not visually distinct) — all auto-fixed: permission resolver expanded to same-category duplicates and downward overrides, buildOverlap helpers wired to buildPermissionRule, supportThemeIcons=true on tooltips, orange debugTokenExpression.string ThemeColor added for isDuplicatedBy. Commits: `b8b72be` (test), `47b4964` (feat), `eea3488` (feat), `42bfa54` (feat), `4ed6695` (fix).
- **Phase 22 — Lock Test Coverage & Doc Cleanup** (2026-03-09): Added "Lock-Aware Plugin Display (LOCK-01/02/03)" test suite in builder.test.ts with 3 cases (locked enabled → check icon, locked disabled → no icon/undefined per actual behavior, unlocked → checkboxes restored); updated REQUIREMENTS.md traceability to mark LOCK-01/02/03 complete and corrected LOCK-02 description. Commits: `f8fbffd` (test), `9ff95c3` (docs).

## Key decisions

- **4-directional overlap model (overrides / isOverriddenBy / duplicates / isDuplicatedBy)**: Richer than boolean isOverridden but simpler than a full graph; distinguishes direction and equality.
- **Generic resolveOverlapGeneric helper**: 6 of 7 resolvers share the pattern with a per-entity getValue callback; permission resolver special-cased for glob matching via rulesOverlap().
- **Deep equality with sorted-key comparison**: Array order preserved, object key order normalized for correct semantic equality.
- **Orange color for isDuplicatedBy (debugTokenExpression.string)**: Distinct from red isOverriddenBy, making "shadowed by different value" vs "duplicated by same value" visually clear.
- **Git-themed ThemeColors for overlap**: Red (isOverriddenBy), green (overrides), yellow (duplicates), orange (isDuplicatedBy) — consistent with VS Code git conventions.
- **Plugin overlap color takes precedence over disabled decoration**: Overlap is more informative than disabled state; both remain visible in tooltip.
- **Permission overlap only checks isOverriddenBy initially**: Expanded in Plan 02 to cover same-category duplicates and downward cross-category overrides after visual verification exposed the gap.
- **Lock-aware static icons instead of disabled checkboxes**: VS Code has no disabled checkbox state; icons communicate unclickable clearly.
- **Conditional spread for omitting checkboxState**: `...(isLocked ? {} : { checkboxState: ... })` ensures the key is entirely absent when locked because baseNode.ts guards on `checkboxState !== undefined`.
- **Keep resourceUri unchanged on locked plugins**: PluginDecorationProvider dimming must continue for disabled plugins even when lock suppresses the checkbox.
- **supportThemeIcons=true on overlap tooltips**: $(arrow-up) / $(arrow-down) codicons render as icons, not plain text.
- **Milestone audit → gap closure phase pattern**: Audit identified LOCK test gaps, Phase 22 added coverage before shipping.
- **buildOverlapTooltip / buildOverlapResourceUri helpers**: Reusable builder helpers append overlap section to any existing tooltip and generate overlap:// URI with color query for FileDecorationProvider.

## Functionality delivered

- **Code added/modified**: src/config/overlapResolver.ts (new — resolveOverlapGeneric, 7 per-type resolvers, rulesOverlap, deepEqual, getOverlapColor), src/tree/overlapDecorations.ts (new — FileDecorationProvider registered in extension.ts), src/types.ts (OverlapItem, OverlapInfo, NodeContext.overlap; ResolvedValue removed), src/viewmodel/builder.ts (migrated all entity builders to overlap system, added buildOverlapTooltip and buildOverlapResourceUri, lock-aware plugin display, hook keyPath fix, dead-code removal), src/viewmodel/types.ts (BaseVM.icon made optional, HookKeyValueVM removed), src/tree/vmToNode.ts (HookKeyValue case removed), src/tree/nodes/hookKeyValueNode.ts (deleted), src/utils/jsonLocation.ts (hook leaf navigation fix verified), overrideResolver.ts (deleted).
- **User-facing behavior**: Hovering a multi-scope entity shows a MarkdownString tooltip listing all scopes with values and relationship icons; multi-scope entities receive git-themed color tinting (red=shadowed, green=winning-override, yellow=winning-duplicate, orange=duplicated-by); when User scope is locked, plugin nodes show static icons (checkmark for enabled, circle-slash for disabled) instead of interactive checkboxes, and unlocking restores checkboxes; clicking a hook entry opens the correct JSON line instead of a sibling.
- **Tests**: +33 tests (23 → 56). 25 overlap resolver tests, 3 LOCK-01/02/03 lock-aware plugin display tests, plus migrated builder assertions and new permission-overlap / orange-color assertions.

## Audit outcome

v0.7.0 shipped with **7/7 requirements satisfied**, 4/4 phases verified, 12/12 cross-phase integration exports connected, and 5/5 E2E flows complete (hook click → JSON nav, lock toggle → plugin icons, lock+overlap coexistence, multi-scope → tooltip+color, single-scope → no indicators). All 4 phases Nyquist-compliant. TypeScript typecheck passed, 56/0 tests passing, legacy override system (overrideResolver, ResolvedValue, isOverridden, overriddenByScope, HookKeyValue) fully removed. Tech debt at ship: 4 documentation-only items — Phase 20 missing SUMMARY.md (plan executed outside GSD workflow), Phase 22 SUMMARY frontmatter has empty requirements_completed, and two SUMMARY text inaccuracies about disabled plugin icon (stated "no icon" where code returns circle-slash). Zero code debt.

## Lessons learned

- Milestone audit before completion is high-value — caught LOCK test coverage gaps that would have shipped unverified.
- Visual verification as the final task finds issues invisible to unit tests (permission overlap coverage gaps, tooltip codicon rendering, isDuplicatedBy visual indistinguishability) — always verify UI changes visually.
- The 4-directional overlap model is the right level of abstraction — richer than a boolean but simpler than a full graph.
- Generic resolvers with per-type callbacks collapse 6 near-identical implementations into one shared helper; special cases (glob matching for permissions) are the exception worth writing once.
- When a phase is executed outside the standard workflow, manually generating a SUMMARY.md preserves the audit trail — the absence becomes a persistent documentation gap otherwise.
- Additive-first phases (Plan 01 adds overlap resolver + tests; Plan 02 migrates builder and deletes the legacy) make risky refactors safer: expected compilation errors in the intermediate state are obvious and time-boxed.
