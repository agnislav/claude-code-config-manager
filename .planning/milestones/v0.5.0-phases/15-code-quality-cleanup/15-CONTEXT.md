# Phase 15: Code Quality Cleanup - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove unused code, extract magic numbers into named constants, improve user-facing messages, and add safety guards across all command handlers — without changing any functional behavior. This is a pure cleanup phase covering QUAL-01 through QUAL-05 with expanded scope based on discussion.

</domain>

<decisions>
## Implementation Decisions

### Constant naming & grouping
- Naming pattern: `DETAIL_TIMEOUT_MS` — subject-first with timeout/debounce type suffix (e.g., `EDITOR_SYNC_TIMEOUT_MS`, `WATCHER_RELOAD_DEBOUNCE_MS`)
- Dedicated `// Timing Constants` section in constants.ts — grouped visually, easy to find
- Each constant gets a JSDoc comment with purpose AND rationale (e.g., `/** Editor-to-tree sync delay. 300ms balances responsiveness with debounce efficiency. */`)
- Extract ALL magic numbers, not just timeouts — retry counts, limits, any tunable hardcoded value

### Guard failure behavior
- All command handlers that access keyPath get validation guards (not just delete + move)
- Failure mode: log `console.warn` with details AND show `vscode.window.showErrorMessage` to user
- Error messages are developer-friendly with keyPath details (e.g., "Invalid config path: expected at least 2 segments, got [permissions]")
- Create a shared `validateKeyPath(keyPath, minLength)` helper in `utils/` — consistent behavior across all handlers

### Dead code sweep
- Full audit of entire `src/` for unreferenced exports, unused functions, dead branches, unused types/interfaces
- Delete all confirmed-unused code (git preserves history for recovery)
- No exceptions for commented-out code — delete all confirmed-unused code (git history preserves recovery). If managed-scope code becomes unused, delete it like any other dead code. To preserve intent for future enterprise support, prefer one of: (a) a design doc or issue linking to the planned feature, (b) a feature flag or conditional compilation guard, or (c) reliance on git history. If commented-out code is absolutely unavoidable, it MUST include the marker `PRESERVED FOR ENTERPRISE: [ticket/issue link]` and a cleanup expiry date (e.g., `// REMOVE BY: 2026-Q3`) so future maintainers know why it exists and when to act
- Clean up ALL unused imports across `src/`, not just in files being modified
- Remove unused type definitions and interfaces alongside runtime code

### Message consistency
- Full audit of every `showErrorMessage`, `showWarningMessage`, `showInformationMessage` for consistent tone and formatting
- Tone: concise + actionable — short messages with clear actions, no fluff
- Prefix all messages with "Claude Config:" for identification in VS Code's notification area
- Use SCOPE_LABELS map everywhere (not just delete confirmations) for human-readable scope names
- Centralize message strings in a MESSAGES object in constants.ts — single source of truth

### Claude's Discretion
- Exact organization of the MESSAGES object (by command type, by severity, etc.)
- Which utility helpers are worth keeping vs. deleting in ambiguous cases
- Grouping and ordering within the `// Timing Constants` section

</decisions>

<specifics>
## Specific Ideas

- Managed scope code that is actively used stays as-is; if any managed-scope code becomes unused, delete it (git preserves history). For future enterprise features, track intent via issues or design docs rather than commented-out code
- Error messages should include enough detail for a developer to diagnose the issue without opening DevTools
- The "Claude Config:" prefix matches the extension's display name for easy identification

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-code-quality-cleanup*
*Context gathered: 2026-02-20*
