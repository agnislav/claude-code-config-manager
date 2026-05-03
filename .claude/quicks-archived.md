# Quick Captures — Archived

Resolved or dropped quicks. New entries are appended under a dated header.

## Migrated from GSD (2026-04-22)

Completed quick tasks from the legacy `.planning/quick/` folder. These were small one-off fixes that shipped outside the milestone cadence.

- **2026-02-23 — User scope lock: plugin toggle feedback** (`src/extension.ts`, 5 min, commit `ab01e2b`)
  Plugin toggle had two code paths (`treeView.onDidChangeCheckboxState` and `claudeConfig.togglePlugin` command) that silently swallowed the lock guard when the User scope was locked. Added `MESSAGES.userScopeLocked` info message to both, bringing all 6 mutation paths to consistent lock-feedback behavior. Pattern established: every mutation guard for User scope must surface the lock message when `isReadOnly && scope === user`.

- **2026-02-26 — README screenshots** (`docs/images/*.png`, `README.md`, `.vscodeignore`, 1 min, commits `70eda85` + `4891d9d`)
  Moved 4 numbered screenshots from repo root to `docs/images/` with descriptive names (tree-overview, inline-actions, toolbar-overview, filter-sections), embedded them in `README.md` at contextually appropriate positions, and added `docs/**` to `.vscodeignore` so they don't bloat the published `.vsix`. Source PNGs were untracked, so plain `mv` + `git add` was used instead of `git mv`.

## Scoped into PRD: tree-click-reveal-only-if-open (2026-04-23)

- 2026-04-22: Tree click must NOT open the config file if it is not already opened — current behavior always opens; should only reveal/highlight when the file is already in an editor #ui #tree-click #behavior

## Covered by existing PRD: multi-select-item-operations (2026-05-01)

- 2026-04-22: Multiselect tree items for batch copy/move/delete across scopes (VS Code canSelectMany) #ui #batch-ops [migrated from .planning/todos/pending/2026-02-18]

## Scoped into PRD: tree-builder-perf (2026-05-01)

- 2026-04-22: Automatic CPU/memory profiling for tree builder — suspect: O(n²) permission overlap resolution with ~140 rules/scope #perf #tree-builder [migrated from .planning/todos/pending/2026-03-12]

## Audited → scoped into PRD: config-model-alignment (2026-05-01)

- 2026-04-23: Verify that all entities management from the extension really works or some of them need extra work #qa #verification
  → Audit result: all CRUD write paths are correct. Found UX bug: hooks and sandbox arrays shown as "overridden" when Claude Code actually concatenates them across scopes. PRD created.
