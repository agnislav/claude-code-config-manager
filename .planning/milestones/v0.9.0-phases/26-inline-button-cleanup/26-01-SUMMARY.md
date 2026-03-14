---
phase: 26-inline-button-cleanup
plan: "01"
subsystem: manifest
tags: [inline-buttons, package.json, audit-matrix, ux-cleanup]
dependency_graph:
  requires: []
  provides: [correct-inline-button-slots, dead-guard-removal, plugin-guard-documentation]
  affects: [package.json, 25-AUDIT-MATRIX.md]
tech_stack:
  added: []
  patterns: [inline-button-slot-convention, && false-as-design-documentation]
key_files:
  created: []
  modified:
    - package.json
    - .planning/phases/25-audit-catalog-trivial-fixes/25-AUDIT-MATRIX.md
decisions:
  - "Dead editValue && false guard for envVar|sandboxProperty removed — not a suppressed feature, just a stale manifest artifact"
  - "Plugin && false guards (moveToScope, copyPluginToScope, deletePlugin) preserved — intentional design; checkbox UX model incompatible with inline move/copy/delete"
  - "EnvVar moveToScope repositioned from inline@0 to inline@1 to match ITEMS.md slot convention (edit@0, move@1, copy@2, delete@3)"
  - "Setting moveToScope repositioned from inline@0 to inline@1; copySettingToScope from inline@1 to inline@2"
metrics:
  duration_minutes: 2
  completed_date: "2026-03-12"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
  deviations: 0
---

# Phase 26 Plan 01: Inline Button Slot Cleanup Summary

**One-liner:** Removed dead editValue guard and corrected inline button slot positions (move@1, copy@2) for envVar and setting nodes to match ITEMS.md convention.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove dead guard and reposition inline button slots in package.json | 264d0a6 | package.json |
| 2 | Document plugin guard design decisions in audit matrix | 2856bbe | 25-AUDIT-MATRIX.md |

---

## What Was Done

### Task 1: package.json inline button cleanup

Removed the dead `editValue && false` entry that targeted `envVar|sandboxProperty`. This entry was a stale artifact — the `editValue` command itself is deferred to the EditValue phase (DEFR-06, DEFR-07) and the guard was never enabling anything.

Corrected three slot positions to match the ITEMS.md convention (`edit@0`, `move@1`, `copy@2`, `delete@3`):

| Entity | Command | Before | After |
|--------|---------|--------|-------|
| envVar | moveToScope | inline@0 | inline@1 |
| setting | moveToScope | inline@0 | inline@1 |
| setting | copySettingToScope | inline@1 | inline@2 |

Preserved unchanged:
- Plugin `&& false` guards at inline@1, inline@2, inline@3 (3 entries — intentional)
- `deleteItem` at inline@3 for all entity types
- `changePermissionType` at inline@0
- `copyPermissionToScope` at inline@2
- `addPermissionRule` at inline@0

### Task 2: Audit matrix documentation

Added formal Design Decision block to the Plugin section in `25-AUDIT-MATRIX.md`:
- Documents that plugin inline button guards are intentional and permanent
- Cites Phase 23 checkbox UX model, DEFR-01 tracking, REQUIREMENTS.md out-of-scope classification
- Explains `&& false` serves dual purpose: suppression + design documentation

Updated the disabled guards table row for the removed `editValue` guard to reflect its removal in Phase 26 and reference DEFR-06/DEFR-07 for the deferred EditValue phase.

---

## Verification

- `npm run compile`: PASS (TypeScript + esbuild bundle)
- `npm run lint`: PASS (1 pre-existing warning in builder.ts, 0 errors)
- Dead `editValue && false` guard: 0 entries (removed)
- Plugin `&& false` guards: 3 entries (preserved)
- EnvVar `moveToScope`: inline@1
- Setting `moveToScope`: inline@1
- Setting `copySettingToScope`: inline@2
- `deleteItem`: inline@3 (unchanged)
- Audit matrix Design Decision block: present

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Requirements Satisfied

- INLN-03: Dead editValue guard removed from package.json
- INLN-04: Inline button slot positions corrected to match ITEMS.md convention

---

## Self-Check: PASSED

Files verified:
- package.json: FOUND and modified
- .planning/phases/25-audit-catalog-trivial-fixes/25-AUDIT-MATRIX.md: FOUND and modified

Commits verified:
- 264d0a6: fix(26-01): remove dead editValue guard and reposition inline button slots
- 2856bbe: docs(26-01): document plugin guard design decisions in audit matrix
