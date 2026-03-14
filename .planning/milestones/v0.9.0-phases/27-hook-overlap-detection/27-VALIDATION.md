---
phase: 27
slug: hook-overlap-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha (VS Code test runner) |
| **Config file** | `.mocharc` / `src/test/runTests.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | OVLP-01 | unit | `npm run test` | ✅ existing `overlapResolver.test.ts` | ⬜ pending |
| 27-01-02 | 01 | 1 | OVLP-01 | unit | `npm run test` | ✅ existing `overlapResolver.test.ts` | ⬜ pending |
| 27-01-03 | 01 | 1 | OVLP-01 | unit | `npm run test` | ✅ existing `overlapResolver.test.ts` | ⬜ pending |
| 27-01-04 | 01 | 1 | OVLP-01 | unit | `npm run test` | ✅ existing `builder.test.ts` | ⬜ pending |
| 27-01-05 | 01 | 1 | OVLP-02 | unit | `npm run test` | ✅ existing `builder.test.ts` | ⬜ pending |
| 27-01-06 | 01 | 1 | OVLP-02 | unit | `npm run test` | ✅ existing `builder.test.ts` | ⬜ pending |
| 27-01-07 | 01 | 1 | OVLP-02 | unit | `npm run test` | ✅ existing `builder.test.ts` | ⬜ pending |
| 27-01-08 | 01 | 1 | OVLP-02 | unit | `npm run test` | ✅ existing `builder.test.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/suite/config/overlapResolver.test.ts` — add `suite('resolveHookOverlap', ...)` block (file exists, add suite)
- [ ] `test/suite/viewmodel/builder.test.ts` — add hook overlap tests to `Override Resolution (TEST-02)` suite (file exists, add tests)

*No new test files needed — existing test files cover the new code paths.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
