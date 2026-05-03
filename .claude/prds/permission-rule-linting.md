---
name: permission-rule-linting
description: Lint permission rules for specificity conflicts, compound Bash command gotchas, and hook deduplication indicators — surfaces problems users can't see from raw config files
status: backlog
created: 2026-05-03T02:00:00Z
---

# PRD: permission-rule-linting

## Source Ideas

- Verified reference `vault/projects/_references/cc_config_reference.md`, edge cases #11, #12.
- config-model-alignment research (May 2026) — permission specificity and compound command patterns surfaced as high-frequency user surprises.

## Executive Summary

Users write permission rules that look correct but behave unexpectedly at runtime. Three patterns cause most of the confusion:

1. **Specificity collisions** — A broad `allow: ["Bash(npm *)"]` and a specific `deny: ["Bash(npm run deploy)"]` coexist. Which wins? Claude Code uses specificity matching (most specific wins), but users assume array order or scope precedence. The extension should surface these collisions.

2. **Compound Bash command bypass** — `allow: ["Bash(git status *)"]` permits `git status -sb` but NOT `git status && git diff`. Shell operators (`&&`, `||`, `;`, `|`, `>`, `$(...)`, backticks) trigger explicit permission prompts regardless of allow patterns. Users don't know this until Claude asks for permission on something they thought was allowed.

3. **Hook deduplication vs co-existence** — When the exact same hook command appears in two scopes, Claude Code deduplicates it (runs once). When different hooks exist for the same event, both run. The extension should distinguish these two cases visually.

## User Stories

### Story 1: Specificity conflict warning

**As** a user with `allow: ["Bash(npm *)"]` in User scope and `deny: ["Bash(npm run deploy)"]` in Project scope
**I want** the extension to show that the deny is more specific and will win for `npm run deploy` while the allow covers everything else
**So that** I understand the effective behavior without trial and error.

### Story 2: Compound command warning

**As** a user with `allow: ["Bash(git *)"]` who wonders why `git status && git diff` still prompts
**I want** the extension to flag that shell operators bypass pattern matching
**So that** I know to wrap compound commands in scripts.

### Story 3: Hook dedup indicator

**As** a user with the same `PreToolUse` hook command in User and Project scope
**I want** the extension to show "deduplicated — runs once" (not "co-exists — both run")
**So that** I know the duplicate is harmless, not doubling side effects.

**Acceptance**: Identical command hooks (same command string) show a "deduplicated" indicator distinct from the "co-exists" indicator used for different hooks on the same event (from config-model-alignment FR2).

## Functional Requirements

### FR1: Permission specificity analyzer

For each permission rule, check all rules across all scopes for specificity overlaps:
- Same tool, overlapping specifiers (glob intersection), different categories → flag as "specificity conflict."
- Show which rule is more specific and will win at runtime.
- Use the glob/gitignore matching logic from `utils/permissions.ts`.

### FR2: Compound Bash command diagnostic

When a `Bash(...)` permission rule's specifier does NOT contain shell operators but the user's config has Bash allow rules:
- Show an info-level diagnostic or tooltip: "Shell operators (&&, ||, ;, |, >) in commands bypass this pattern and will always prompt."
- This is educational, not a warning — the rule itself is valid.

### FR3: Hook dedup vs co-existence indicator

Extend config-model-alignment's FR2 (hook co-existence) with a third state:
- **Co-exists** (blue/default) — different hooks for the same event across scopes. Both run.
- **Deduplicated** (grey/muted) — identical command string in multiple scopes. Runs once. The duplicate is harmless but redundant.
- **Exact duplicate** (yellow) — identical event + matcher + command + all fields. Fully redundant.

## Dependencies

- config-model-alignment (FR2 — hook co-existence model must land first).
- `src/utils/permissions.ts` — existing `rulesOverlap()` and `parsePermissionRule()`.

## Out of Scope

- Rewriting the permission matching engine — we surface Claude Code's behavior, not change it.
- Auto-fixing rules (e.g., suggesting script wrappers for compound commands).
