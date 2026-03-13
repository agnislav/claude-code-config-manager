# Phase 26: Inline Button Cleanup - Research

**Researched:** 2026-03-12
**Domain:** VS Code extension `package.json` `menus` contribution point — inline button ordering and guard cleanup
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INLN-03 | Dead `&& false` editValue guard removed (cleanup); plugin `&& false` guards documented as intentional design decisions | Exact lines in package.json identified; intentional vs dead distinction confirmed by REQUIREMENTS.md DEFR-06/07 |
| INLN-04 | Uniform inline button ordering applied — fixed positions per action type (edit@0, move@1, copy@2, delete@3) across all entity types | All misaligned entries identified; target positions confirmed from ITEMS.md |
</phase_requirements>

---

## Summary

Phase 26 is a pure `package.json` surgery task. All work is in the `contributes.menus."view/item/context"` array. No TypeScript changes are needed; no commands are being added, removed, or renamed. The goal is to align the `group` attribute of existing inline button entries to match the ITEMS.md convention (edit@0, move@1, copy@2, delete@3) and remove one dead guard.

There are exactly four lines to change (group values on four entries) and one entry block to delete entirely (the dead `editValue` guard). Documentation of plugin guards requires updating audit artifacts, not source code.

The change surface is small and the risk is low. VS Code collapses sparse inline slot positions — e.g., a single button at `inline@3` renders as the only button with no gap artifacts. Reordering from `inline@0` to `inline@1` for `moveToScope` on envVar and setting nodes changes the visual rendering order but does not break command registration.

**Primary recommendation:** One plan is sufficient. Execute all five changes (remove 1 entry, update 4 `group` values) in a single atomic commit. Document plugin guards in the Phase 25 audit artifact.

---

## Standard Stack

This phase touches only `package.json` — no library versions apply. The relevant VS Code extension manifest mechanism is the `menus` contribution point.

### VS Code `menus."view/item/context"` Inline Buttons

| Attribute | Mechanics |
|-----------|-----------|
| `"group": "inline@N"` | Renders as an icon button directly on the tree row. `N` controls left-to-right ordering within the inline group. |
| VS Code slot collapsing | Gaps in `N` are not visible. `inline@3` with no `@0/@1/@2` renders as a single leftmost button. |
| `when` clause | Standard VS Code `when` expression. `&& false` unconditionally suppresses the item — the entry has zero effect and is effectively dead. |
| `viewItem =~ /regex/` | Matches against the tree item's `contextValue` string. |

**Confidence:** HIGH — behavior confirmed by project history (Phases 5, 24 used same mechanism) and direct reading of current package.json.

---

## Architecture Patterns

### Current vs Target State (ITEMS.md is source of truth)

The full diff of required changes in `package.json` lines 280-344:

#### REMOVE (dead guard — INLN-03)

```json
// Lines 300-303 — DELETE this entire entry block
{
  "command": "claudeConfig.editValue",
  "when": "view == claudeConfigTree && viewItem =~ /\\.editable/ && viewItem =~ /envVar|sandboxProperty/ && false",
  "group": "inline@1"
}
```

**Why dead:** The `&& false` makes this entry permanently inactive. The underlying editValue command exists but inline editing for envVar and sandboxProperty is deferred to a future EditValue phase (DEFR-06, DEFR-07). Removing this dead entry cleans up confusion without changing any user-visible behavior.

#### UPDATE (position changes — INLN-04)

| Entry (command + viewItem match) | Current `group` | Target `group` | Reason |
|----------------------------------|-----------------|----------------|--------|
| `moveToScope` where `^envVar\.editable` (line 306-309) | `inline@0` | `inline@1` | ITEMS.md: EnvVar move is at slot 1 (no edit button at slot 0 for envVar) |
| `moveToScope` where `^setting\.editable` (line 330-333) | `inline@0` | `inline@1` | ITEMS.md: Setting move is at slot 1 (no edit button at slot 0 for setting) |
| `copySettingToScope` where `^setting\.editable` (line 335-338) | `inline@1` | `inline@2` | ITEMS.md: Setting copy is at slot 2 |

**The `deleteItem` entry at `inline@3` (line 340-343) is already correct — no change needed.**

#### DOCUMENT ONLY (plugin guards — INLN-03)

Lines 286-298 contain three plugin guard entries with `&& false`:
- `moveToScope` for `^plugin\.editable` at `inline@1 && false`
- `copyPluginToScope` for `^plugin\.editable` at `inline@2 && false`
- `deletePlugin` for `^plugin\.editable` at `inline@3 && false`

These are **intentional** — plugin interaction uses a checkbox toggle model (Phase 23). Move/copy/delete for plugins are listed in REQUIREMENTS.md as `DEFR-01` and explicitly noted as Out of Scope: "Intentionally disabled; copy works via context menu, toggle via checkbox." These guards must NOT be removed. They serve as placeholders and documentation of the design decision.

Documentation action: add a comment block to the Phase 25 audit artifact noting these as intentional design decisions.

### Full Target State After Phase 26 (confirming ITEMS.md)

| Entity | Slot | Command | Visibility |
|--------|------|---------|------------|
| Plugin | inline@0 | openPluginReadme | always |
| PermissionRule | inline@0 | changePermissionType | `.editable` |
| PermissionRule | inline@1 | moveToScope | `.editable` |
| PermissionRule | inline@2 | copyPermissionToScope | `.editable` (note: ITEMS.md says `always` but this is Phase 28 scope; do not change now) |
| EnvVar | inline@1 | moveToScope | `.editable` |
| EnvVar | inline@3 | deleteItem | `.editable` |
| Setting | inline@1 | moveToScope | `.editable` |
| Setting | inline@2 | copySettingToScope | `.editable` |
| Setting | inline@3 | deleteItem | `.editable` |
| HookEntry | inline@3 | deleteItem | `.editable` |
| McpServer | inline@3 | deleteItem | `.editable` |
| SandboxProperty | inline@3 | deleteItem | `.editable` |

**Note on `copyPermissionToScope` visibility:** ITEMS.md shows `always` for permissionRule copy (line 62), but the current package.json uses `.editable`. Changing this visibility is not listed in Phase 26 success criteria and would be a scope expansion. Leave it unchanged; flag it in audit notes for Phase 28 if relevant.

**Note on EnvVar copyToScope:** ITEMS.md shows `copyToScope` at `inline@2` for EnvVar, but this command does not exist yet (ACTN-01, Phase 28). Do not add it in Phase 26.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Position ordering | Custom middleware/abstraction layer | Direct `group` attribute values in package.json |
| Guard documentation | New documentation format | Comment inline in existing audit artifact |

---

## Common Pitfalls

### Pitfall 1: Confusing Dead Guards with Intentional Guards

**What goes wrong:** Removing all `&& false` guards including the intentional plugin ones.
**Why it happens:** They look the same syntactically.
**How to avoid:** The dead guard is `editValue` targeting `envVar|sandboxProperty`. The intentional guards are `moveToScope`, `copyPluginToScope`, `deletePlugin` targeting `plugin.editable`. Keep the plugin guards.
**Warning signs:** If you see a plugin move/copy/delete button appear in the tree, you removed an intentional guard.

### Pitfall 2: Changing EnvVar Slot Position But Missing the Cascade

**What goes wrong:** Moving `moveToScope` for envVar from `inline@0` to `inline@1` but forgetting the visual consequence.
**Why it happens:** No gap artifact — VS Code collapses, so moving from @0 to @1 with no @0 present means the button still renders first. This is correct behavior and expected.
**How to avoid:** Verify visually by launching the extension development host (F5) and hovering over an envVar node in an editable scope.

### Pitfall 3: Modifying TypeScript When Only package.json Is Needed

**What goes wrong:** Editing node files, command files, or contextValue logic.
**Why it happens:** Inline button position feels like it should involve code.
**How to avoid:** Button positions are controlled entirely by `"group"` in package.json. TypeScript only controls `contextValue`, which controls which buttons are shown — not their order. This phase does not change contextValue logic.

### Pitfall 4: Scope Creep Into ITEMS.md Gaps

**What goes wrong:** Also fixing `copyPermissionToScope` visibility (`always` vs `.editable`), or adding `copyToScope` for envVar.
**Why it happens:** ITEMS.md shows the full target state and these discrepancies are visible.
**How to avoid:** Phase 26 success criteria covers only INLN-03 and INLN-04 as stated. EnvVar copy is Phase 28 (ACTN-01). Visibility correctness for copy buttons is not in Phase 26 success criteria.

---

## Code Examples

### Pattern: Updating a `group` value in package.json `menus`

Current (incorrect):
```json
{
  "command": "claudeConfig.moveToScope",
  "when": "view == claudeConfigTree && viewItem =~ /^envVar\\.editable/",
  "group": "inline@0"
}
```

Target (correct):
```json
{
  "command": "claudeConfig.moveToScope",
  "when": "view == claudeConfigTree && viewItem =~ /^envVar\\.editable/",
  "group": "inline@1"
}
```

Only the `group` value changes. The `command` and `when` clause are unchanged.

### Pattern: Removing a dead entry block

Remove this entire block (lines 300-303):
```json
{
  "command": "claudeConfig.editValue",
  "when": "view == claudeConfigTree && viewItem =~ /\\.editable/ && viewItem =~ /envVar|sandboxProperty/ && false",
  "group": "inline@1"
}
```

The comma preceding or following this block must also be cleaned up to maintain valid JSON.

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Mocha (VS Code extension test runner) |
| Config file | `.mocharc.json` (or via `npm run test`) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INLN-03 | Dead editValue guard is absent from package.json | manual-only | n/a | n/a |
| INLN-03 | Plugin `&& false` guards remain in package.json (intentional) | manual-only | n/a | n/a |
| INLN-04 | EnvVar moveToScope is at inline@1 | manual-only | n/a | n/a |
| INLN-04 | Setting moveToScope is at inline@1 | manual-only | n/a | n/a |
| INLN-04 | Setting copySettingToScope is at inline@2 | manual-only | n/a | n/a |

**Manual-only justification:** These requirements are pure package.json manifest changes. There is no TypeScript logic to unit test. Validation is by: (1) JSON diff inspection, (2) visual launch in Extension Development Host (F5), (3) hover over editable nodes to confirm button order.

The existing test suite (`npm run test`) covers TreeDataProvider and overlapResolver logic — none of it exercises inline button slot ordering, which is VS Code's responsibility at render time.

### Sampling Rate

- **Per task commit:** `npm run compile` (type-check + bundle; confirms no TypeScript regressions)
- **Per wave merge:** `npm run test`
- **Phase gate:** `npm run test` green + visual inspection in Extension Development Host before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements (no new test files needed; the changes are manifest-only and not unit-testable).

---

## Open Questions

1. **Audit artifact location for plugin guard documentation**
   - What we know: Phase 25 created an audit matrix. Plugin `&& false` guards need to be documented there.
   - What's unclear: Exact file path for the Phase 25 audit artifact.
   - Recommendation: Planner should locate the Phase 25 audit artifact (likely `.planning/phases/25-audit-catalog-trivial-fixes/`) and add a documentation task that appends the intentional plugin guard rationale.

---

## Sources

### Primary (HIGH confidence)

- Direct read of `package.json` lines 280-344 — current inline button state, exact line numbers
- `.planning/ITEMS.md` — source of truth for target inline button positions
- `.planning/REQUIREMENTS.md` — INLN-03, INLN-04 definitions; DEFR-01, DEFR-06, DEFR-07 scope exclusions
- `.planning/ROADMAP.md` — Phase 26 success criteria

### Secondary (MEDIUM confidence)

- VS Code extension manifest documentation (group attribute behavior, slot collapsing) — inferred from project history across Phases 5, 24 and direct observation of current package.json patterns

---

## Metadata

**Confidence breakdown:**
- Change identification: HIGH — all five changes identified from direct source file inspection
- VS Code slot mechanics: HIGH — confirmed by existing working entries (delete@3 with no fill at 0/1/2 works correctly)
- Scope boundary (what NOT to do): HIGH — REQUIREMENTS.md deferred items and success criteria are unambiguous

**Research date:** 2026-03-12
**Valid until:** Stable indefinitely — package.json manifest mechanics do not change with VS Code minor releases
