---
phase: 22
slug: lock-test-coverage-doc-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha (via @vscode/test-electron) |
| **Config file** | `test/runTests.js` |
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
| 22-01-01 | 01 | 1 | LOCK-01 | unit | `npm run test` | ✅ (file exists, test case to add) | ⬜ pending |
| 22-01-02 | 01 | 1 | LOCK-02 | unit | `npm run test` | ✅ (file exists, test case to add) | ⬜ pending |
| 22-01-03 | 01 | 1 | LOCK-03 | unit | `npm run test` | ✅ (file exists, test case to add) | ⬜ pending |
| 22-01-04 | 01 | 1 | LOCK-02 | doc | manual | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The test file, helpers, and mock functions all exist. Only new test cases need to be added.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| REQUIREMENTS.md checkboxes checked | LOCK-01/02/03 | Documentation update | Verify LOCK-01, LOCK-02, LOCK-03 boxes are checked in REQUIREMENTS.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
