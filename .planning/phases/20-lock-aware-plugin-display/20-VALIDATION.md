---
phase: 20
slug: lock-aware-plugin-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha (VS Code test runner) |
| **Config file** | `.vscode-test.mjs` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run compile && npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | LOCK-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | LOCK-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 20-01-03 | 01 | 1 | LOCK-03 | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New test cases in `test/suite/viewmodel/builder.test.ts` — locked plugin VM tests for enabled/disabled states
- Existing `createMockConfigStore` with `lockedScopes` option covers lock test setup — no new fixtures needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual checkbox removal in TreeView | LOCK-01, LOCK-02 | VS Code TreeItem rendering not testable in unit tests | 1. Lock User scope 2. Verify enabled plugins show checkmark icon 3. Verify disabled plugins show no icon 4. Unlock and verify checkboxes return |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
