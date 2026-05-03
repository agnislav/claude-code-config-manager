---
name: permission-scaffolding
description: Scaffold curated permission bundles (read-only git, bash basics, deny-list, etc.) into a chosen scope, with per-rule selection and safe merging into existing configs
status: backlog
created: 2026-04-23T14:53:06Z
---

# PRD: permission-scaffolding

## Executive Summary

Setting up a fresh Claude Code project from zero permissions is a cold start: users either leave permissions empty (and get prompted for every tool call) or hand-type dozens of rules from memory or other projects. There is no curated starting point.

This PRD adds a **"Scaffold permissions"** action that presents the user with a library of named bundles (e.g., "Read-only git operations", "Safe bash basics", "Common deny-list") — each bundle is a set of rules classified as `allow`, `deny`, or `ask`. The user picks which bundles to apply and, optionally, drills into each bundle to toggle individual rules off. The resulting set is merged into the target scope (user / project shared / project local) with conflict-aware semantics: existing rules are preserved, duplicates are skipped, and supersets / subsets are reported rather than silently overwritten.

The feature leans on existing primitives — `parsePermissionRule`, `rulesOverlap`, and the write layer already used by `addPermissionRule` — so the new surface is mostly UX and bundle authoring, not algorithmic.

## Problem Statement

**What**: Users starting a new project have no quick way to establish sensible permission defaults, and users working on existing projects have no structured way to adopt a curated set of rules without manual copy-paste.

**Why now**:
- The extension has matured the single-rule add flow (`claudeConfig.addPermissionRule`), but each add is one rule at a time. First-time setup of a real project needs dozens.
- `rulesOverlap()` already exists in `src/utils/permissions.ts` — the merge-safety primitive is in place.
- The community has converged on a small set of recurring permission archetypes (read-only tooling, safe bash, guarded deny-list). Shipping these as first-class presets saves each user from reinventing them.
- Users migrating from older configs or onboarding teammates will want reproducible starting points, not hand-rolled ones.

## User Stories

### Story 1: First-time project setup
**As** a developer who just cloned a project and sees the extension's empty-permissions state
**I want** to run "Scaffold permissions" and apply "Safe bash basics" + "Read-only git" to Project Shared
**So that** I have a sensible committed baseline in under a minute without hand-typing 20 rules.

**Acceptance criteria:**
- A "Scaffold permissions…" action is available from the Permissions section (toolbar button or context menu on the Permissions node) and from the command palette.
- Target scope picker lists User, Project Shared, Project Local (not Managed). Default pre-selects Project Shared when a workspace is open.
- Bundle picker shows each bundle with a title and 1-line description; multi-select with checkboxes.
- Before commit, a preview shows the net change: *N rules added, M skipped (duplicates/subsets)*.
- Confirming writes once to the target scope's config file.

### Story 2: Adopting bundles into an existing config
**As** a user with ~40 permission rules already in my Project Shared scope
**I want** to add the "Common deny-list" bundle without disturbing my existing rules
**So that** I can harden my config without manually reconciling overlaps.

**Acceptance criteria:**
- Scaffolding into a non-empty scope never removes or rewrites existing rules.
- Rules from the bundle that are exact duplicates of existing rules are skipped silently.
- Rules from the bundle that overlap existing rules (superset or subset per `rulesOverlap`) are reported per-rule in the preview with the existing rule shown, so the user can decide whether to keep or uncheck.
- The write is a single atomic update to the target scope file.

### Story 3: Fine-grained selection within a bundle
**As** a cautious user applying "Safe bash basics"
**I want** to expand the bundle and uncheck `tail` and `head` because my project doesn't use them
**So that** I scaffold only the subset I actually want.

**Acceptance criteria:**
- Each bundle in the picker is expandable; expanding reveals the individual rules with per-rule checkboxes.
- "Select all" / "Deselect all" affordances at the bundle level.
- Unchecking individual rules reduces the set without affecting other bundles.

## Functional Requirements

### FR1: Bundle catalog
A built-in catalog of bundles ships with the extension. Initial set (not exhaustive, negotiable during implementation):

| Bundle | Category Mix | Example Rules |
|---|---|---|
| **Read-only git operations** | allow | `Bash(git status:*)`, `Bash(git log:*)`, `Bash(git diff:*)`, `Bash(git show:*)`, `Bash(git branch:*)`, `Bash(git remote:*)` |
| **Safe bash basics** | allow | `Bash(ls:*)`, `Bash(pwd)`, `Bash(cat:*)`, `Bash(echo:*)`, `Bash(which:*)`, `Bash(env)` |
| **Filesystem read tools** | allow | `Read`, `Grep`, `Glob`, `LS` |
| **Web research** | allow | `WebFetch`, `WebSearch` |
| **Common deny-list** | deny | `Bash(rm -rf *)`, `Bash(git push --force*)`, `Bash(git reset --hard*)`, `Bash(curl * | sh)` |
| **Ask-on-mutation** | ask | `Bash(npm install:*)`, `Bash(git commit:*)`, `Bash(git push:*)`, `Edit`, `Write` |

Each bundle is defined as:
```ts
type PermissionBundle = {
  id: string;                  // kebab-case stable id
  title: string;               // human-readable label
  description: string;         // one-line summary for picker
  rules: Array<{ category: 'allow' | 'deny' | 'ask'; rule: string }>;
};
```

### FR2: Bundle source — built-in, with user extensibility (decision point)
- **Built-in bundles**: shipped in `src/scaffolding/bundles.ts` (or JSON equivalent), version-pinned to the extension.
- **User bundles** *(assumption, see Constraints)*: users can point to a local `.claude/permission-bundles.json` in the workspace or a `~/.claude/permission-bundles.json` globally to register their own bundles alongside the built-ins. Loaded lazily when the scaffold command is invoked.

### FR3: UX — two-step QuickPick flow
1. **Target scope picker**: QuickPick listing User, Project Shared, Project Local. Shows the file path of each.
2. **Bundle & rule picker**: QuickPick with `canPickMany: true`, each bundle rendered as a picker group with its rules nested as sub-items.
   - Alternative considered: `Webview` panel with a richer UI. Rejected for v1 — QuickPick is faster to build and consistent with existing extension UX.

### FR4: Merge & conflict semantics
- Use `rulesOverlap(bundleRule, existingRule)` against every existing rule in the target scope's category.
- Classification per incoming bundle rule:
  - **new**: no existing rule overlaps → include.
  - **duplicate**: exact string match with an existing rule → skip silently.
  - **subset**: an existing rule already covers it (e.g., existing `Bash(git:*)` covers incoming `Bash(git status:*)`) → skip, report in preview.
  - **superset**: the incoming rule is broader than an existing rule (e.g., incoming `Bash(git:*)` covers existing `Bash(git status:*)`) → include but flag in preview so the user can uncheck if they want to keep the narrow rule as-is.
  - **cross-category conflict** (e.g., existing `deny` matches a new `allow`) → exclude with a warning; never scaffold a rule that contradicts an existing rule.

### FR5: Preview step
- Before the write, show a modal summary:
  - N rules will be **added**
  - M rules **skipped as duplicate/subset**
  - K rules **flagged** (supersets / cross-category conflicts) with reasons
- User confirms or cancels. No write on cancel.

### FR6: Merge write
- Single write to the target scope via the existing `configWriter`.
- Preserves existing rule order; appends new rules at the end of their respective `allow` / `deny` / `ask` arrays.
- No rewrite, reorder, or dedup of existing rules.

### FR7: Entry points
- Toolbar button on the Permissions section header: `Scaffold…` (icon: `library-add` or similar).
- Context menu on the Permissions node in either scope view or entity view (when that ships): `Scaffold permissions…`.
- Command palette: `Claude Config: Scaffold Permissions…`.
- Optional: empty-state affordance — when a scope's Permissions section is empty, render a hint node `"Click to scaffold permissions"` that triggers the command pre-targeted to that scope.

### FR8: Read-only scope handling
- Managed scope is excluded from the target picker.
- If the workspace is not open, Project Shared / Project Local are excluded.
- Locked User scope is excluded until unlocked (reuse existing lock check).

## Non-Functional Requirements

- **Performance**: bundle catalog load and the conflict scan complete in < 100 ms for a catalog of 10 bundles (~80 rules total) against an existing config with 200 rules per scope.
- **Extensibility**: adding a new built-in bundle is a single-file edit with no schema changes.
- **Safety**: the feature is strictly additive. It never deletes or modifies an existing rule.
- **Idempotence**: running the same scaffold twice produces no changes on the second run (all rules are duplicates).
- **Accessibility**: picker items expose meaningful `description` and `detail` strings for screen readers.
- **No new runtime deps**.

## Success Criteria

- A brand-new workspace with no `.claude/settings.json` can be bootstrapped with "Safe bash basics" + "Read-only git" in ≤ 4 user actions (trigger, pick scope, pick bundles, confirm).
- Scaffolding any bundle twice is a no-op on the second run (verified by test).
- Scaffolding into a populated scope never changes existing rules (verified by snapshot test of the written file).
- The preview accurately classifies every incoming rule across the four outcomes (new / duplicate / subset / superset) on a reference matrix of 20 hand-crafted cases.
- `CHANGELOG.md` documents the feature and lists the shipped bundles under the target milestone.

## Constraints & Assumptions

### Constraints
- Target scopes limited to User, Project Shared, Project Local (Managed is read-only).
- Uses the existing `configWriter` — no new write path.
- Uses `rulesOverlap` / `parsePermissionRule` unchanged. Any edge cases those helpers miss today will also be missed by scaffolding; no new parser logic introduced.
- Bundle content is prescriptive but opinionated — the list ships with defaults that will be reviewed as part of the PR.

### Assumptions (flagged as decisions — please confirm or overturn)
1. **User-authored bundles (FR2)**: supported in v1 via a local + global JSON file. Alternative: built-in only for v1, user bundles in a follow-up. Simpler scope but loses an obvious power-user path.
2. **QuickPick UI (FR3)** rather than webview. Keeps parity with existing UX and avoids webview lifecycle complexity. Alternative: webview for a checklist-style picker with descriptions visible.
3. **Merge is strictly additive (FR4, FR6)**: never touches existing rules even when a scaffolded rule subsumes them. Alternative: offer "replace narrow existing rule with broader scaffolded rule" as a user choice during preview.
4. **Cross-category conflicts excluded (FR4)**: incoming `allow` that conflicts with existing `deny` is dropped silently except for the warning. Alternative: offer to migrate / promote the rule with explicit user confirmation.
5. **Empty-state hint node (FR7, optional)**: render a clickable "Click to scaffold" affordance when a scope's Permissions is empty. Opt-in-to-include for v1 or defer.
6. **Bundle content**: the initial catalog above is a starting proposal, not a commitment. Exact rule strings will be validated against current Claude Code tool names and pattern syntax during implementation.

## Out of Scope

- **Unscaffold / remove bundle** — the inverse operation (removing rules that match a bundle) is not provided. Users delete rules manually or via multi-select (separate PRD).
- **Rule authoring editor** — a rich editor for writing permission patterns is out of scope; users still type raw rules via the existing `addPermissionRule` flow.
- **Bundle versioning / upgrade** — if a built-in bundle changes between extension versions, we do not retroactively migrate already-scaffolded configs.
- **Sharing bundles via registry / URL** — no network fetch of remote bundles in v1.
- **Hooks / env var / MCP scaffolding** — this PRD is permissions-only. Parallel features for other entity types are separate PRDs.
- **Team-wide enforcement** — scaffolding writes into the chosen scope; it does not interact with Managed scope or any policy-distribution mechanism.

## Dependencies

### Internal
- `src/utils/permissions.ts` — `parsePermissionRule`, `rulesOverlap` (reused unchanged).
- `src/commands/addCommands.ts` — reference for the single-rule add pattern; the scaffold command is a batched sibling, not a replacement.
- `src/config/configWriter.ts` — single write per scope. May need a small helper to accept multiple rules in one write call if `addPermissionRule` currently reads-modifies-writes per rule.
- `src/config/overlapResolver.ts` — conflict classification may reuse `computePermissionOverlapMap` patterns.
- `src/tree/configTreeProvider.ts` — Permissions section toolbar + empty-state hint node.
- `src/constants.ts` — labels, icons.
- New module: `src/scaffolding/bundles.ts` (built-in catalog) and `src/scaffolding/bundleLoader.ts` (merge of built-in + user bundles).
- `package.json` — new command `claudeConfig.scaffoldPermissions`, menu entries, `when` clauses.

### External
- No new VS Code APIs. Uses `QuickPick` with `canPickMany`, same as existing filter UI.

### Documentation
- Update `.claude/context/features.md` with the new capability and the built-in bundle list.
- `CHANGELOG.md` entry under the target milestone.
- `README.md` — add a section / screenshot demonstrating the scaffold flow.
- Optional: a top-level `docs/bundles.md` enumerating the built-in bundles and their rules for discoverability outside the extension UI.
