# Phase 13: Path Safety Hardening - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace string-based path operations (indexOf, lastIndexOf, substring) with Node.js `path` module functions, add write path validation to `configWriter`, and validate `revealInFile` inputs. This phase hardens existing functionality — no new features.

</domain>

<decisions>
## Implementation Decisions

### Validation failure UX
- Show VS Code error notification popup when a write path is rejected or revealInFile gets invalid input
- Error messages include the actual rejected path (e.g., "Cannot write to /etc/passwd: outside allowed config directories")
- revealInFile shows error message and takes no action on invalid input (no fallback navigation)
- All validation failures also log to a dedicated output channel (e.g., "Claude Config Manager") for debugging history

### Allowed path boundaries
- Writable scopes: User (`~/.claude/settings.json`), Project Shared (`.claude/settings.json`), Project Local (`.claude/settings.local.json`) only
- Managed scope remains read-only — writes to managed paths are rejected
- Validation uses exact file path whitelist, not directory-level matching
- Validation checks both whitelist match AND that the parent directory exists on disk
- Allowed config paths defined in `constants.ts` alongside existing path definitions

### Symlink & traversal policy
- Reject all symlinks — if the path involves a symlink at any level, reject the write
- Reject any path containing `../` traversal immediately without resolving
- Paths with spaces, Unicode, and special characters should work transparently via path module
- Add explicit test cases for spaces, Unicode, and special character edge cases
- revealInFile keyPath maximum depth: 10 levels

### Claude's Discretion
- Exact output channel naming and creation pattern
- How to detect symlinks efficiently (lstat vs realpath comparison)
- Order of validation checks (whitelist first vs traversal check first)
- Test file/fixture organization for edge case tests

</decisions>

<specifics>
## Specific Ideas

- Error messages should be actionable — tell the user what was wrong and what the allowed paths are
- The validation utility (`validateConfigPath()`) should live in configWriter but use constants from constants.ts
- Symlink rejection should be a clear, separate check so it can be upgraded to "resolve and allow" later

</specifics>

<deferred>
## Deferred Ideas

- Symlink resolution support — currently rejecting all symlinks, future phase could resolve symlinks and allow writes if the resolved path is in the whitelist
- Configurable allowed paths — currently hardcoded in constants.ts, could be made configurable via settings

</deferred>

---

*Phase: 13-path-safety-hardening*
*Context gathered: 2026-02-20*
