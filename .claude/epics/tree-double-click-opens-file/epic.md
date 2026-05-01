---
name: tree-double-click-opens-file
status: backlog
created: 2026-04-28T17:23:30Z
updated: 2026-05-01T14:59:25Z
progress: 0%
prd: .claude/prds/tree-double-click-opens-file.md
github: https://github.com/agnislav/claude-code-config-manager/issues/22
---

# Epic: tree-double-click-opens-file

## Overview

Add a double-click gesture on tree leaf nodes that opens the backing config file (if not already open) and positions the cursor at the matching JSON key. Implementation is fully contained inside the existing `claudeConfig.revealInFile` command handler — no new commands, no new tree node classes, no new user settings. The handler gains in-memory click-pair detection and an extracted `openAndPosition` helper.

## Architecture Decisions

1. **Detect double-click inside the bound command, not in the tree provider.** VS Code `TreeView` has no native double-click event, only `TreeItem.command` which fires once per activation gesture. Tracking last-click `{nodeId, time}` in module state inside the command is the standard workaround and keeps tree code agnostic of click semantics.

2. **Single-click semantics unchanged.** The existing reveal-only-if-open path runs first, every time. The double-click branch runs *additionally* on the qualifying second fire. This means single-click incurs zero added latency and no behavioral change — the new gesture is purely additive.

3. **Pass `nodeId` as a positional `arguments[]` element.** The command stays at id `claudeConfig.revealInFile`. Adding `nodeId` as the 3rd arg keeps the surface backward-compatible (omitted callers still work, they just lose dbl-click detection — currently no such callers exist outside the tree).

4. **Read `workbench.list.openMode` per-invocation, not at activation.** Users may toggle this VS Code setting at any time. Reading it on each handler entry is O(1) and avoids stale state.

5. **No throttling, no async timer.** The "wait for a possible 2nd click" approach (timeout-based) would add latency to every single click. We instead act on the 1st click immediately AND check the debounce on the 2nd click — works because `revealInFile` is silent for closed files, so a "premature" first action is invisible.

## Technical Approach

### Frontend Components
None. Tree-item construction (`baseNode.ts`) is unchanged — it already binds whatever `command` the view-model provides.

### Backend Services
- **`src/viewmodel/builder.ts`** — `computeCommand(collapsibleState, filePath, keyPath)` becomes `computeCommand(collapsibleState, filePath, keyPath, nodeId)`. Pass `ctx.id` (the same id used for `vm.id`) at all 9 call sites. The 3rd arg of the `vscode.Command.arguments` array becomes `nodeId`.
- **`src/commands/openFileCommands.ts`** — `revealInFile` handler:
  - Module-level `let lastClick: { nodeId: string; time: number } | null = null;`
  - Read `openMode` via `vscode.workspace.getConfiguration('workbench.list').get<string>('openMode')`.
  - Run all existing validations (lines 103-151) unchanged.
  - Run the existing reveal-only-if-open block (lines 154-173) unchanged — that's the single-click semantic.
  - **New branch** at the end:
    ```
    const isExplicitDoubleClick = openMode === 'doubleClick';
    const isDebounceMatch =
      nodeId !== undefined &&
      lastClick !== null &&
      lastClick.nodeId === nodeId &&
      now - lastClick.time < DOUBLE_CLICK_THRESHOLD_MS;
    if (isExplicitDoubleClick || isDebounceMatch) {
      await openAndPosition(uri, filePath, keyPath);
    }
    lastClick = nodeId !== undefined ? { nodeId, time: now } : null;
    ```
  - Extract `openAndPosition(uri, filePath, keyPath)` from existing reveal block (lines 161-173) — `showTextDocument` + `findKeyLine` + `selection`/`revealRange`. Used by both the existing reveal branch and the new dbl-click branch (DRY).
- **`src/constants.ts`** — `export const DOUBLE_CLICK_THRESHOLD_MS = 300;` near `MAX_KEYPATH_DEPTH`.

### Infrastructure
None.

## Implementation Strategy

Sequential within the epic, since 002 depends on 001's signature change:

1. **001 first** — pure signature plumbing; type-check after to catch any miss.
2. **002 second** — handler logic; uses the new `nodeId` arg.
3. **003 + 004 in parallel** — tests and CHANGELOG don't conflict.

Risk mitigations:
- Existing tests cover the silent-no-op single-click case → regression detector for free.
- New tests pin all four behavioral combinations (debounce-hit / debounce-miss / different-node / openMode=doubleClick) so future refactors can't silently break the contract.

## Task Breakdown Preview

- **001** — Implement double-click-to-open: `nodeId` plumbing + handler debounce + `openAndPosition` helper + 4 test cases + CHANGELOG entry. Single coherent change; nothing here is parallelizable. [parallel: false]

## Dependencies

- **Internal**: `findKeyLine` in `src/utils/jsonLocation.ts` (already used by reveal); `isFileOpenInAnyTab` (already used by reveal); `MESSAGES`, `MAX_KEYPATH_DEPTH` constants (already imported).
- **External**: VS Code 1.90+ (already required for `tabGroups`). `workbench.list.openMode` is a long-stable user setting.
- **PRD**: `.claude/prds/tree-double-click-opens-file.md`.

## Success Criteria (Technical)

- `npm run typecheck`, `npm run lint`, `npm run test` all green.
- New tests pass for: debounce-hit opens file, debounce-miss (timing) does not, debounce-miss (different node) does not, openMode=doubleClick opens on single fire.
- Existing reveal-only-if-open tests pass unchanged.
- Manual E2E: 5 closed-file double-clicks → 5 correctly positioned opens; 20 single-clicks → 0 opens.

## Estimated Effort

~1.5-2 hours, single task:
- nodeId plumbing across 9 call sites: ~15 min
- handler logic + extract helper: ~45 min
- 4 tests: ~30 min
- CHANGELOG line: ~5 min
- typecheck/lint/test + manual E2E in Extension Development Host: ~15 min
