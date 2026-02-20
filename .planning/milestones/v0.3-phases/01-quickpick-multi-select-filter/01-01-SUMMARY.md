---
phase: 01-quickpick-multi-select-filter
plan: 01
status: complete
started: 2026-02-19T00:00:00Z
completed: 2026-02-19T00:00:00Z
requirements_completed: [FILT-07, FILT-08]
---

## What Was Built

Removed all old filter infrastructure — the 8 toolbar icon buttons, their 16 command registrations (inactive + active variants), and the `syncFilterContext()` / `FILTER_CTX_KEYS` machinery that drove icon-swap via `setContext`. The internal `_sectionFilter` Set and its public API remain intact for Plan 01-02 to wire to the new QuickPick command.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Remove filter command registrations from extension.ts | ✓ |
| 2 | Remove syncFilterContext and FILTER_CTX_KEYS from configTreeProvider.ts | ✓ |
| 3 | Remove filter commands and toolbar entries from package.json | ✓ |

## Key Files

### Created

(none expected for this plan)

### Modified

- src/extension.ts — Removed `SectionType` import, removed `filterAllCmd` and `filterAllActiveCmd` registrations, removed the `for (const st of Object.values(SectionType))` loop, removed both from `context.subscriptions.push()`.
- src/tree/configTreeProvider.ts — Removed `FILTER_CTX_KEYS` static property, removed `syncFilterContext()` private method, removed all three call sites (`constructor`, `toggleSectionFilter`, `selectAllSections`).
- package.json — Removed 16 filter command definitions from `contributes.commands`, 16 filter toolbar entries from `contributes.menus.view/title`, and 16 filter entries from `contributes.menus.commandPalette`.

## Self-Check

1. `npm run typecheck` — PASS (zero errors)
2. `npm run compile` — PASS (esbuild bundle builds)
3. `grep -r "syncFilterContext|FILTER_CTX_KEYS|claudeConfig_filter_|filterAllCmd|filterAllActiveCmd" src/ --include="*.ts"` — Zero matches
4. `grep "claudeConfig.filter" package.json` — Zero matches
5. `grep "claudeConfig.refresh" package.json` — Two matches (refresh button preserved)
6. TypeScript compiles without errors; `_sectionFilter` and its methods present and intact

## Deviations

None

## Notes for Next Plan

Plan 01-02 can now add the single `claudeConfig.filterSections` QuickPick command without conflicts. The following hooks are ready for wiring:
- `treeProvider.toggleSectionFilter(section: SectionType)` — toggles one section in/out of the filter Set and refreshes
- `treeProvider.selectAllSections()` — clears the filter Set (shows all) and refreshes
- `treeProvider.sectionFilter` — `ReadonlySet<SectionType>` getter for reading current state
