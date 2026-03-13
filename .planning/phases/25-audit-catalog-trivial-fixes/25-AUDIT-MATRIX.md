# Phase 25: Audit Matrix

**Generated:** 2026-03-12
**Method:** Code analysis of `src/viewmodel/builder.ts`, `src/viewmodel/types.ts`, `package.json` menus, `src/types.ts`, `src/constants.ts`
**Scope:** All 12 NodeKind values across 5 audit vectors

> **Note on node type count:** The `NodeKind` enum (`src/viewmodel/types.ts`) defines exactly 12 values. The CONTEXT.md reference to "14 node types" likely counts conceptual groupings visible in the tree hierarchy (e.g., PermissionGroup headers for allow/deny/ask, and the tree root). This audit covers all 12 NodeKind members. There is no `PermissionGroup` NodeKind -- permission rules are flat `PermissionRule` nodes grouped by category within the Permissions section.

---

## Summary Overview

| Node Type | Tooltip | Inline Buttons | Context Menu | Click | Overlap | Status |
|-----------|---------|----------------|--------------|-------|---------|--------|
| WorkspaceFolder | OK | OK | OK | OK | OK | 5 OK |
| Scope | OK | OK | OK | OK | OK | 5 OK |
| Section | OK | 1 Gap | OK | OK | OK | 4 OK, 1 Gap |
| PermissionRule | OK | OK | OK | OK | OK | 5 OK |
| Setting | OK | OK | OK | OK | OK | 5 OK |
| SettingKeyValue | OK | 1 Gap | 1 Gap | OK | OK | 3 OK, 2 Gap |
| EnvVar | 1 Gap | 1 Gap | 1 Gap | OK | OK | 2 OK, 3 Gap |
| Plugin | OK | 1 Intentional | OK | OK | OK | 4 OK, 1 Intentional |
| McpServer | OK | 1 Gap | OK | OK | OK | 4 OK, 1 Gap |
| SandboxProperty | OK | 1 Gap | OK | OK | OK | 4 OK, 1 Gap |
| HookEvent | OK | OK | OK | OK | OK | 5 OK |
| HookEntry | OK | 1 Gap | OK | OK | 1 Gap | 3 OK, 2 Gap |

**Totals:** 48 OK, 1 Intentional, 11 Gap

---

## Detailed Findings

### EnvVar

**1. Tooltip -- Gap (TRIV-03)**
- **Current behavior:** `buildOverlapTooltip(undefined, overlap)` -- no base tooltip content; only overlap info shown when overlap exists, otherwise `undefined`
- **Expected behavior:** Base tooltip with `**KEY** = \`value\`` and scope context, with overlap appended
- **Classification:** Gap

**2. Inline Buttons -- Gap (INLN-01)**
- **Current behavior:** `moveToScope` at `inline@0` for editable envVar. An `editValue` entry exists but is disabled with `&& false` guard (package.json line 302). No other inline buttons.
- **Expected behavior:** Edit inline button should be enabled for editable envVar nodes
- **Classification:** Gap

**3. Context Menu -- Gap (ACTN-01)**
- **Current behavior:** `editValue` (1_edit group), `deleteItem` (1_edit group), `moveToScope` (2_move group). No copy-to-scope action.
- **Expected behavior:** Copy-to-scope action matching the pattern available for permissions and settings
- **Classification:** Gap

### SettingKeyValue

**1. Inline Buttons -- Gap (ACTN-04, ACTN-05)**
- **Current behavior:** `deleteItem` at `inline@3` for editable settingKeyValue nodes. No edit or move/copy inline buttons.
- **Expected behavior:** Edit inline button for editing child values; delete is present but edit is missing
- **Classification:** Gap

**2. Context Menu -- Gap (ACTN-04)**
- **Current behavior:** `deleteItem` available via context menu (matches `setting` pattern in delete when clause). No `editValue` -- the edit when clause matches `setting|envVar|sandboxProperty` but NOT `settingKeyValue`.
- **Expected behavior:** `editValue` should be available for settingKeyValue nodes to edit child values inline
- **Classification:** Gap

### Plugin

**1. Inline Buttons -- Intentional**
- **Current behavior:** Three inline button entries exist (`moveToScope` at `inline@1`, `copyPluginToScope` at `inline@2`, `deletePlugin` at `inline@3`) but all are disabled with `&& false` guards (package.json lines 287-298). Only `openPluginReadme` at `inline@0` is active. Toggle is via checkbox (unlocked) or `togglePlugin` context menu (locked).
- **Expected behavior:** N/A -- intentionally disabled
- **Classification:** Intentional -- Plugin interaction model uses checkbox for enable/disable; move/copy/delete as inline buttons conflicts with the checkbox UX. Copy works via context menu. Per REQUIREMENTS.md out of scope.

- **Design Decision (Phase 26 -- INLN-03):** The three `&& false` guards on plugin inline buttons (`moveToScope`, `copyPluginToScope`, `deletePlugin`) are confirmed intentional and must be preserved. Rationale:
  - Plugin interaction uses a checkbox toggle model (Phase 23)
  - Move/copy/delete as inline buttons conflicts with checkbox UX
  - Copy is available via context menu for locked scopes
  - These are tracked as DEFR-01 in REQUIREMENTS.md and listed as Out of Scope
  - The `&& false` guards serve as both suppression and documentation of the design decision

### Section

**1. Inline Buttons -- Gap (INLN-04)**
- **Current behavior:** `addPermissionRule` at `inline@0` for permissions section only. No inline add buttons for other sections (env, hooks, mcpServers sections only have add via context menu).
- **Expected behavior:** Uniform inline button pattern for "Add" across sections that support adding items
- **Classification:** Gap

### McpServer

**1. Inline Buttons -- Gap (ACTN-02, ACTN-03)**
- **Current behavior:** `deleteItem` at `inline@3` for editable mcpServer nodes. No other inline buttons.
- **Expected behavior:** Inline button set should be reviewed and potentially enriched. Currently only delete is available inline.
- **Classification:** Gap

### SandboxProperty

**1. Inline Buttons -- Gap (INLN-02)**
- **Current behavior:** `deleteItem` at `inline@3` is active. The `editValue` guard for `envVar|sandboxProperty` was removed in Phase 26 (INLN-03); edit deferred to future EditValue phase (DEFR-07).
- **Expected behavior:** Edit inline button deferred per DEFR-07; delete-only is correct for now
- **Classification:** Intentional (deferred)

### HookEntry

**1. Inline Buttons -- Gap (INLN-04)**
- **Current behavior:** `deleteItem` at `inline@3` for editable hookEntry nodes. No other inline buttons.
- **Expected behavior:** Inline button consistency review needed; currently only delete available
- **Classification:** Gap

**2. Overlap -- Gap (OVLP-01, OVLP-02)**
- **Current behavior:** `overlap: {}` hardcoded in `buildHookEntryVM()` (line 942). No overlap resolution function called. Same for `buildHookEventVM()` (line 899).
- **Expected behavior:** Hook entries should participate in overlap detection when the same hook exists across multiple scopes, with color-coded decorations and tooltips
- **Classification:** Gap

---

## Supplementary Analysis

### Tooltip Details (All OK entries)

| Node Type | Tooltip Implementation | Notes |
|-----------|----------------------|-------|
| WorkspaceFolder | `undefined` | Container node, no tooltip expected |
| Scope | `MarkdownString(SCOPE_DESCRIPTIONS[scope])` | Rich description per scope |
| Section | `undefined` | Container node, no tooltip expected |
| PermissionRule | Override warning MarkdownString + overlap tooltip | Shows cross-category override info |
| Setting | JSON preview MarkdownString for objects + overlap | Scalar settings get overlap-only |
| SettingKeyValue | JSON preview MarkdownString for objects + overlap | Inherits parent overlap |
| Plugin | Plugin description from metadata service + overlap | Rich tooltip from registry |
| McpServer | Server type + command/URL MarkdownString + overlap | Structured base tooltip |
| SandboxProperty | Array list MarkdownString for arrays + overlap | Scalar properties get overlap-only |
| HookEvent | `undefined` | Container node, no tooltip expected |
| HookEntry | Command in backticks MarkdownString (command type) or `undefined` | Only command-type hooks get tooltip |

### Click Behavior Details (All OK)

| Node Type | Collapsible | Click Command | Notes |
|-----------|-------------|---------------|-------|
| WorkspaceFolder | Expanded | None | Container: expand/collapse |
| Scope | Collapsed | None | Container: expand/collapse |
| Section | Collapsed | None | Container: expand/collapse |
| PermissionRule | None | `revealInFile` | Leaf: navigates to config |
| Setting | None or Collapsed | `revealInFile` (leaf only) | Object settings expand; scalars navigate |
| SettingKeyValue | None | `revealInFile` | Leaf: navigates to config |
| EnvVar | None | `revealInFile` | Leaf: navigates to config |
| Plugin | None | `revealInFile` | Leaf: navigates to config |
| McpServer | None | `revealInFile` | Leaf: navigates to config |
| SandboxProperty | None | `revealInFile` | Leaf: navigates to config |
| HookEvent | Collapsed | None | Container: expand/collapse |
| HookEntry | None | `revealInFile` | Leaf: navigates to config |

### Overlap Detection Details (All OK except HookEntry/HookEvent)

| Node Type | Overlap Function | Tooltip Integration | Resource URI | Icon Dimming |
|-----------|-----------------|---------------------|-------------|-------------|
| PermissionRule | `resolvePermissionOverlap` | Yes (override warning + overlap) | Yes | Yes (disabledForeground) |
| Setting | `resolveSettingOverlap` | Yes (overlap) | Yes | Yes (disabledForeground) |
| SettingKeyValue | `resolveSettingOverlap` (parent) | Yes (overlap) | Yes | Yes (ThemeColor) |
| EnvVar | `resolveEnvOverlap` | Yes (overlap only -- no base) | Yes | Yes (disabledForeground) |
| Plugin | `resolvePluginOverlap` | Yes (metadata + overlap) | Yes | N/A (checkbox mode) |
| McpServer | `resolveMcpOverlap` | Yes (base + overlap) | Yes | Yes (disabledForeground) |
| SandboxProperty | `resolveSandboxOverlap` | Yes (array list + overlap) | Yes | Yes (disabledForeground) |
| HookEvent | None (`overlap: {}`) | No | No | No |
| HookEntry | None (`overlap: {}`) | No | No | No |

### Context Menu Details (All OK except noted)

| Node Type | Context Menu Actions | Notes |
|-----------|---------------------|-------|
| WorkspaceFolder | None | No context menu items match `workspaceFolder` |
| Scope | `openFile`, `createConfigFile` (if missing) | Navigation group |
| Section (permissions) | `addPermissionRule` | Add group |
| Section (env) | `addEnvVar` | Add group |
| Section (mcpServers) | `addMcpServer` | Add group |
| Section (hooks) | `addHook` | Add group; also matches `hookEvent` |
| Section (other) | None | Sandbox, Plugins, Settings sections have no add |
| PermissionRule | `changePermissionType`, `deleteItem`, `moveToScope` | Full CRUD except add (at section) |
| Setting | `editValue`, `deleteItem`, `moveToScope` | Full edit/delete/move for editable |
| SettingKeyValue | `deleteItem` only | Missing `editValue` -- Gap |
| EnvVar | `editValue`, `deleteItem`, `moveToScope` | Missing copy-to-scope -- Gap |
| Plugin | `togglePlugin`, `deleteItem`, `openPluginReadme` | Toggle via context when locked |
| McpServer | `deleteItem` | Delete only; add at section level |
| SandboxProperty | `editValue`, `deleteItem` | Edit + delete for editable |
| HookEvent | `addHook` | Matched by `hookEvent` in when clause |
| HookEntry | `deleteItem` | Delete only |

### `&& false` Disabled Guards

| Line | Command | Target | Status |
|------|---------|--------|--------|
| 287 | `moveToScope` | plugin.editable | Intentional (out of scope) |
| 292 | `copyPluginToScope` | plugin.editable | Intentional (out of scope) |
| 297 | `deletePlugin` | plugin.editable | Intentional (checkbox UX) |
| 302 | `editValue` | envVar\|sandboxProperty | Removed in Phase 26 (INLN-03) -- editValue for envVar/sandboxProperty deferred to EditValue phase (DEFR-06, DEFR-07) |
| 307 | `moveToScope` | envVar.editable | Active (no `&& false`) |

**Correction:** Line 307 (`moveToScope` for `envVar.editable`) does NOT have `&& false` -- it is active. The research noted "5 entries with `&& false` guards" but line 307 is a separate active entry. The actual `&& false` guarded entries are 4: lines 287, 292, 297, 302.

---

## Gap Tracking Table

| Gap ID | Node Type | Vector | Description | Target Phase | Requirement ID |
|--------|-----------|--------|-------------|-------------|----------------|
| G-01 | EnvVar | Tooltip | No base tooltip; overlap-only | Phase 25 | TRIV-03 |
| G-02 | EnvVar | Inline Buttons | Edit inline button disabled with `&& false` | Phase 26 | INLN-01 |
| G-03 | EnvVar | Context Menu | Missing copy-to-scope action | Phase 28 | ACTN-01 |
| G-04 | SandboxProperty | Inline Buttons | Edit inline button disabled with `&& false` | Phase 26 | INLN-02 |
| G-05 | SettingKeyValue | Inline Buttons | No edit inline button for child values | Phase 28 | ACTN-04 |
| G-06 | SettingKeyValue | Context Menu | No editValue in context menu | Phase 28 | ACTN-04 |
| G-07 | HookEntry | Overlap | No overlap resolution; hardcoded empty overlap | Phase 27 | OVLP-01 |
| G-08 | HookEvent | Overlap | No overlap resolution; hardcoded empty overlap | Phase 27 | OVLP-02 |
| G-09 | McpServer | Inline Buttons | Only delete inline; missing enriched inline UX | Phase 28 | ACTN-02, ACTN-03 |
| G-10 | Section | Inline Buttons | Only permissions section has inline add button | Phase 26 | INLN-04 |
| G-11 | HookEntry | Inline Buttons | Only delete inline; no other inline buttons | Phase 26 | INLN-04 |

**Coverage check:** All v0.9.0 requirement IDs appear in the tracking table:
- TRIV-03: G-01
- INLN-01: G-02
- INLN-02: G-04
- INLN-04: G-10, G-11
- OVLP-01: G-07
- OVLP-02: G-08
- ACTN-01: G-03
- ACTN-02: G-09
- ACTN-03: G-09
- ACTN-04: G-05, G-06
- ACTN-05: (covered by G-06 -- deleteItem already exists in context menu for settingKeyValue via the broad delete when clause; inline delete at `inline@3` also exists. The gap is specifically about explicit SettingKeyValue delete support in REQUIREMENTS.md. Since `deleteItem` when clause includes `setting` which matches the broader pattern, this is partially covered but may need SettingKeyValue-specific handling.)

**TRIV-01 and TRIV-02 notes:** These are display fixes (sandbox section count, hookEntry description) that are not audit *gaps* in the 5 vectors but are tracked separately as display improvements. They do not appear in the gap tracking table because they affect the `description` field, which is not an audit vector per CONTEXT.md. They are addressed in plan 25-02.

---

*Audit matrix generated: 2026-03-12*
*Source: Code analysis only -- no Extension Development Host testing*
