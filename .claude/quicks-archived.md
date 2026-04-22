# Quick Captures — Archived

Resolved or dropped quicks. New entries are appended under a dated header.

## Migrated from GSD (2026-04-22)

Completed quick tasks from the legacy `.planning/quick/` folder. These were small one-off fixes that shipped outside the milestone cadence.

- **2026-02-23 — User scope lock: plugin toggle feedback** (`src/extension.ts`, 5 min, commit `ab01e2b`)
  Plugin toggle had two code paths (`treeView.onDidChangeCheckboxState` and `claudeConfig.togglePlugin` command) that silently swallowed the lock guard when the User scope was locked. Added `MESSAGES.userScopeLocked` info message to both, bringing all 6 mutation paths to consistent lock-feedback behavior. Pattern established: every mutation guard for User scope must surface the lock message when `isReadOnly && scope === user`.

- **2026-02-26 — README screenshots** (`docs/images/*.png`, `README.md`, `.vscodeignore`, 1 min, commits `70eda85` + `4891d9d`)
  Moved 4 numbered screenshots from repo root to `docs/images/` with descriptive names (tree-overview, inline-actions, toolbar-overview, filter-sections), embedded them in `README.md` at contextually appropriate positions, and added `docs/**` to `.vscodeignore` so they don't bloat the published `.vsix`. Source PNGs were untracked, so plain `mv` + `git add` was used instead of `git mv`.
