# Phase 10: Error Handling Foundation - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Surfacing file write failures and config parse errors to users instead of failing silently. Three error scenarios: write failures (ERR-01), corrupted config file parsing (ERR-02), and invalid MCP config parsing (ERR-03). This phase builds the error handling infrastructure that subsequent phases depend on.

</domain>

<decisions>
## Implementation Decisions

### Error message UX
- Direct & technical tone — developer-oriented, no fluff (e.g., "Failed to write User settings (~/.claude/settings.json): Permission denied")
- Always show scope label + file path in error messages (e.g., "User settings (~/.claude/settings.json)")
- Include specific JSON parse position (line/column) in config parse error messages
- Use `showErrorMessage()` for both write failures and parse errors — treat them equally as errors

### Recovery actions
- Write failure notifications include "Open File" and "Retry" action buttons
- Parse error notifications include "Open File" button that navigates to the exact line/column of the parse error
- Auto-create missing config files with parent directories when writing, and show info message: "Created [Scope] settings ([path])"
- Prevent edits to Managed scope configs in the UI — don't show edit/delete commands (read-only by design)

### Diagnostic depth
- Notification only for parse errors — no VS Code Diagnostics (squiggly underlines); VS Code's built-in JSON validation already handles that
- Use `console.error`/`console.warn` for debugging via Developer Tools — no dedicated output channel
- Separate error notification per broken file when multiple configs have parse errors simultaneously

### Claude's Discretion
- Notification style (modal vs non-modal) — pick what's standard for VS Code extensions
- Exact error message wording within the direct/technical tone
- How to structure the retry mechanism internally

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-error-handling-foundation*
*Context gathered: 2026-02-20*
