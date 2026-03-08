---
phase: 16
slug: viewmodel-layer
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-06
audited: 2026-03-08
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha ^10.2.0 + @vscode/test-electron ^2.3.8 |
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
| 16-01-01 | 01 | 1 | VM-01 | typecheck | `npm run typecheck` | N/A (type-level) | ✅ green |
| 16-01-02 | 01 | 1 | VM-01 | unit | `npm test` | ✅ builder.test.ts | ✅ green |
| 16-01-03 | 01 | 1 | VM-02 | unit | `npm test` | ✅ builder.test.ts | ✅ green |
| 16-02-01 | 02 | 1 | VM-03 | unit | `npm test` | ✅ builder.test.ts | ✅ green |
| 16-02-02 | 02 | 1 | VM-03 | unit | `npm test` | ✅ builder.test.ts | ✅ green |
| 16-02-03 | 02 | 1 | VM-04 | unit | `npm test` | ✅ builder.test.ts | ✅ green |
| 16-02-04 | 02 | 1 | VM-04 | unit | `npm test` | ✅ builder.test.ts | ✅ green |
| 16-02-05 | 02 | 1 | VM-04 | unit | `npm test` | ✅ builder.test.ts | ✅ green |
| 16-02-06 | 02 | 1 | VM-04 | unit | `npm test` | ✅ builder.test.ts | ✅ green |
| 16-02-07 | 02 | 1 | VM-04 | unit | `npm test` | ✅ builder.test.ts | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/` directory creation
- [x] `test/suite/viewmodel/builder.test.ts` — covers VM-01 through VM-04 (entity types, override resolution, NodeContext)
- [x] Test helpers: createMockConfigStore, makeScopedConfig, findVM, findAllVMs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ViewModel tree visually matches existing TreeView output | VM-04 | Requires visual inspection in Extension Development Host | Build extension, compare TreeView output side-by-side with ViewModel builder output |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

## Validation Audit 2026-03-08

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
