---
phase: 29
slug: permission-overlap-performance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha (VS Code extension test runner) |
| **Config file** | `.vscode/launch.json` |
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
| 29-01-01 | 01 | 1 | PERF-02 | unit | `npm run test` | existing | ⬜ pending |
| 29-01-02 | 01 | 1 | PERF-01 | unit | `npm run test` | existing | ⬜ pending |
| 29-01-03 | 01 | 1 | PERF-01, PERF-02 | unit | `npm run test` | existing | ⬜ pending |
| 29-01-04 | 01 | 1 | PERF-01 | unit | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/suite/config/overlapResolver.test.ts` — add `computePermissionOverlapMap` test stubs for PERF-01 parity verification

*Existing infrastructure covers most phase requirements. One new test suite section needed for batch function.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Expand All" on 140+ rules completes without perceptible hang | PERF-01, PERF-02 | Perceived responsiveness is subjective; requires VS Code Extension Host | 1. Load test config with 140+ rules per scope 2. Click "Expand All" 3. Verify no visible freeze |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
