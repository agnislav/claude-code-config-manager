# Phase 12: Write Lifecycle & Concurrency - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Track in-flight writes to prevent redundant file watcher reloads, clean up orphaned debounce timeouts, and add a maximum wait ceiling to debounce so continuous external changes still trigger periodic reloads. This is internal synchronization infrastructure — no new user-facing features.

</domain>

<decisions>
## Implementation Decisions

### Timing thresholds
- Regular debounce delay for file watcher: **300ms**
- Maximum wait ceiling (maxWait): **2000ms** (2 seconds) — ensures reload happens at least every 2s during continuous external changes
- In-flight write suppression: **no timeout** — trust the `finally` block to clear. If it doesn't clear, that's a bug to fix, not mask
- Multiple file writes tracked independently via `Set<string>` — no batch grouping concept

### Write failure behavior
- Fail fast — **no retry logic** in configWriter
- Show **VS Code error notification** (`vscode.window.showErrorMessage`) with file path and reason on write failure
- **Always reload** ConfigStore from disk after a write failure to ensure tree reflects truth-on-disk
- In-flight set **always cleared in `finally` block** regardless of success/failure — watcher resumes normally

### Observability & logging
- Create a dedicated **"Claude Config Manager" Output Channel** for diagnostic logs
- Log **write events only** (not file watcher events) — write start, write complete/fail, watcher suppressed/resumed
- Include **detailed context**: file paths, scope, timing (write duration), debounce state
- Use **wall clock timestamps** (HH:MM:SS.mmm format)

### Edge case handling
- On extension deactivation: **wait for in-flight writes to complete** before cleaning up
- Concurrent edit to same file while write is in-flight: **block the UI** (disable edit action) until first write completes
- Rapid external changes: **no warning** — silently reload at maxWait interval, debounce handles throttling
- Config file deletion while running: use current existing logic for absent files (no special handling added)

### Claude's Discretion
- Output channel log message formatting and prefixes
- Exact mechanism for blocking UI during in-flight writes (command enablement vs. early return)
- How `deactivate()` awaits in-flight writes (promise tracking approach)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for the implementation patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-write-lifecycle-concurrency*
*Context gathered: 2026-02-20*
