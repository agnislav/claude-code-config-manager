---
phase: 17
slug: node-migration
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-07
audited: 2026-03-08
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha ^10.2.0 + @vscode/test-electron ^2.3.8 |
| **Config file** | .vscode-test.mjs |
| **Quick run command** | `npm run compile && npm run lint` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run compile && npm run lint`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | VM-09 | smoke | `npm run compile` | N/A | ✅ green |
| 17-01-02 | 01 | 1 | VM-09 | smoke | `npm run compile` | N/A | ✅ green |
| 17-01-03 | 01 | 2 | VM-05, VM-06, VM-07 | unit | `npm run test` | ✅ builder.test.ts | ✅ green |
| 17-01-04 | 01 | 2 | VM-05, VM-07, VM-08 | smoke | `npm run compile` | N/A | ✅ green |
| 17-01-05 | 01 | 3 | VM-05, VM-06 | unit | `npm run compile && npm run lint` | N/A | ✅ green |
| 17-01-06 | 01 | 3 | VM-10 | manual | F5 debug: editor-tree sync | N/A | ✅ verified |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or stubs needed.

- [x] `npm run compile` — type-checks all wiring and constructor changes
- [x] `npm run lint` — ESLint strict mode catches unused imports
- [x] `npm run test` — Mocha suite covers end-to-end behavior + static analysis checks
- [x] VM-07 test: scans all node files for ScopedConfig/allScopes (zero results)
- [x] VM-08 test: scans workspaceFolderNode.ts for ConfigStore (zero results)
- [x] VM-09 test: verifies configTreeProvider.ts calls builder.build()

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Editor-tree bidirectional sync | VM-10 | Requires VS Code Extension Development Host | F5 debug: open config file, move cursor between keys, verify tree selection follows; click tree node, verify editor navigates |
| Context menu bindings preserved | VM-10 | Requires visual verification | F5 debug: right-click each node type, verify correct menu items appear |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

## Validation Audit 2026-03-08

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |
