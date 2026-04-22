---
phase: 18
slug: verification-and-cleanup
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-07
audited: 2026-03-08
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha ^10.2.0 + @vscode/test-electron ^2.3.8 |
| **Config file** | tsconfig.test.json (exists, references test/) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 0 | TEST-01 | scaffold | `npm run test` | ✅ runTests.ts, index.ts | ✅ green |
| 18-01-02 | 01 | 1 | TEST-01 | unit | `npm run test` | ✅ builder.test.ts | ✅ green |
| 18-01-03 | 01 | 1 | TEST-02 | unit | `npm run test` | ✅ builder.test.ts | ✅ green |
| 18-01-04 | 01 | 1 | TEST-03 | unit | `npm run test` | ✅ builder.test.ts | ✅ green |
| 18-01-05 | 01 | 2 | VM-11 | static check | `npm run test` | ✅ builder.test.ts | ✅ green |
| 18-01-06 | 01 | 2 | VM-12 | static check | `npm run test` | ✅ builder.test.ts | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/runTests.ts` — @vscode/test-electron launcher
- [x] `test/suite/index.ts` — Mocha runner with glob discovery
- [x] `test/suite/viewmodel/builder.test.ts` — 26 tests covering all entity types, overrides, NodeContext, cleanup verification
- [x] Verify `npm run test` script works with scaffold

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

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
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
