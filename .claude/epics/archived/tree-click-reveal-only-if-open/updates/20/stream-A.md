---
issue: 20
stream: Reveal-only-if-open implementation + tests + docs
started: 2026-04-28T10:45:02Z
completed: 2026-04-28T10:50:00Z
status: completed
---

## Scope
- Add `isFileOpenInAnyTab(uri: vscode.Uri): boolean` helper in `src/commands/openFileCommands.ts`.
- Gate the `showTextDocument` call inside `claudeConfig.revealInFile` after validation 7.
- New test file `test/suite/commands/openFileCommands.test.ts` covering reveal path and no-op path.
- CHANGELOG entry under `[Unreleased]` documenting the behavior change.

## Progress
- 2026-04-28T10:45:02Z: stream started — analysis written, beginning implementation
- 2026-04-28T10:46:00Z: helper + handler gate added in `src/commands/openFileCommands.ts` (15 lines, including a log line for the skip path)
- 2026-04-28T10:47:00Z: `test/runTests.ts` extended to launch with `test-fixtures/` as workspace folder so project-shared paths land in `buildKnownConfigPaths()`; new test file `test/suite/commands/openFileCommands.test.ts` with 4 cases (helper closed/open + command reveal/no-op)
- 2026-04-28T10:48:00Z: `npm run typecheck` + `npm run lint` clean; `npm run test` 136 passing (4 new)
- 2026-04-28T10:50:00Z: CHANGELOG `[Unreleased] / ### Changed` line added; ready to commit + PR
