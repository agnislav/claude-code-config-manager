---
phase: 16
slug: viewmodel-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha ^10.2.0 |
| **Config file** | `tsconfig.test.json` (extends tsconfig.json, includes `test/**/*.ts`) |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | VM-01 | typecheck | `npm run typecheck` | N/A (type-level) | ⬜ pending |
| 16-01-02 | 01 | 1 | VM-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | VM-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | VM-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | VM-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 16-02-03 | 02 | 1 | VM-04 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 16-02-04 | 02 | 1 | VM-04 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 16-02-05 | 02 | 1 | VM-04 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 16-02-06 | 02 | 1 | VM-04 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 16-02-07 | 02 | 1 | VM-04 | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/` directory creation — directory does not currently exist
- [ ] `test/viewmodel/builder.test.ts` — covers VM-03, VM-04 (builder output correctness)
- [ ] `test/viewmodel/types.test.ts` — covers VM-01 (NodeKind completeness, interface shape assertions)
- [ ] `test/helpers/mockConfigStore.ts` — shared mock for ConfigStore with controllable ScopedConfig[] data
- [ ] `test/helpers/mockVscode.ts` — vscode module mock (ThemeIcon, TreeItemCollapsibleState, etc.)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ViewModel tree visually matches existing TreeView output | VM-04 | Requires visual inspection in Extension Development Host | Build extension, compare TreeView output side-by-side with ViewModel builder output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
