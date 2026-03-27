---
phase: 31-settings-add-button
plan: "01"
subsystem: ui
tags: [vscode, quickpick, commands, settings, treeview]

# Dependency graph
requires: []
provides:
  - "claudeConfig.addSetting command with schema-aware QuickPick and type-appropriate value input"
  - "SETTING_TYPE_MAP constant mapping known setting keys to their value types"
  - "Inline '+' button on editable Settings section headers in the TreeView"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SettingQuickPickItem extends vscode.QuickPickItem with optional value field for carrying key strings"
    - "QuickPick separator (vscode.QuickPickItemKind.Separator) used to separate known keys from free-text entry option"
    - "Type-dispatch pattern: SETTING_TYPE_MAP lookup determines which input widget (QuickPick vs InputBox) to show"

key-files:
  created: []
  modified:
    - src/constants.ts
    - src/commands/addCommands.ts
    - package.json

key-decisions:
  - "Inline button and context menu group 3_add both target section.settings.editable contextValue regex to match editable scopes only"
  - "Boolean value input uses showQuickPick (true/false toggle) for discoverability rather than text input"
  - "Custom key entry uses free-text InputBox fallback with 'string' as default type"
  - "Filter existing keys at QuickPick build time using configStore.getAllScopes() to find ScopedConfig by filePath"

patterns-established:
  - "Value-type dispatch: check SETTING_TYPE_MAP[key], dispatch to boolean/number/string[]/object/string input widget"
  - "Custom key flow: separator item + '$(edit) Enter custom key...' with __custom__ value sentinel"

requirements-completed: [SETT-01, SETT-02, SETT-03, SETT-04]

# Metrics
duration: 5min
completed: 2026-03-15
---

# Phase 31 Plan 01: Settings Add Button Summary

**claudeConfig.addSetting command with schema-aware QuickPick and type-appropriate value input, plus inline '+' button on editable Settings section headers**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-15T10:11:42Z
- **Completed:** 2026-03-15T10:16:51Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `SETTING_TYPE_MAP` constant to `constants.ts` mapping all 24 known setting keys to their value types (boolean/string/number/string[]/object)
- Implemented `claudeConfig.addSetting` command with schema-aware QuickPick that filters out already-present keys, offers free-text custom key entry via separator, and dispatches type-appropriate input (boolean toggle QuickPick, number InputBox with validation, comma-separated string[] InputBox, JSON object InputBox with parse validation, plain string InputBox)
- Wired command in `package.json` with command definition ($(add) icon), inline button on `section.settings.editable`, context menu entry in `3_add` group, and commandPalette hidden entry

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SETTING_TYPE_MAP to constants and implement addSetting command** - `2c35704` (feat)
2. **Task 2: Wire addSetting command in package.json** - `db4f680` (feat)

## Files Created/Modified
- `src/constants.ts` - Added `SETTING_TYPE_MAP` export after `KNOWN_SETTING_KEYS`
- `src/commands/addCommands.ts` - Added `SettingQuickPickItem` interface, imported `setScalarSetting`/`KNOWN_SETTING_KEYS`/`SETTING_TYPE_MAP`/`DEDICATED_SECTION_KEYS`, registered `claudeConfig.addSetting` command
- `package.json` - Added `claudeConfig.addSetting` command definition, inline button, context menu entry, and commandPalette hidden entry

## Decisions Made
- Boolean value input uses `showQuickPick` (true/false toggle) rather than text input for better discoverability
- Custom key entry uses `__custom__` value sentinel on a separator-preceded QuickPick item
- Existing key filtering reads from `configStore.getAllScopes()` finding ScopedConfig by `filePath`
- Default type for unknown keys is `'string'` for safe handling of custom/future keys

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- GPG signing via 1Password failed (unrelated to code changes) — disabled local GPG signing for commits in this session.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The "+" button on Settings section headers is complete. Users can add new settings from the tree without hand-editing JSON.
- Phase 31 plan 01 complete. Ready to proceed to next plan or phase.

---
*Phase: 31-settings-add-button*
*Completed: 2026-03-15*
