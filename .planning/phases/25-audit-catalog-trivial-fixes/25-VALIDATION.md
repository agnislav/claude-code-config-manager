---
phase: 25
slug: audit-catalog-trivial-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha (via VS Code test runner) |
| **Config file** | `test/runTests.ts` + `tsconfig.test.json` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run compile && npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-xx | 01 | 1 | AUDIT-01 | manual-only | N/A (documentation) | N/A | ⬜ pending |
| 25-01-xx | 01 | 1 | AUDIT-02 | manual-only | N/A (documentation) | N/A | ⬜ pending |
| 25-02-xx | 02 | 1 | TRIV-01 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 25-02-xx | 02 | 1 | TRIV-02 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 25-02-xx | 02 | 1 | TRIV-03 | unit | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/suite/viewmodel/builder.test.ts` — add TRIV-01 test: sandbox section description shows property count
- [ ] `test/suite/viewmodel/builder.test.ts` — add TRIV-02 test: HookEntry description shows hook type prefix
- [ ] `test/suite/viewmodel/builder.test.ts` — add TRIV-03 test: EnvVar tooltip contains key=value and scope info

*Existing test file and infrastructure sufficient — no new files or framework config needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audit matrix completeness | AUDIT-01 | Documentation deliverable — no code to test | Review 25-AUDIT-MATRIX.md covers all 14 node types × 4 audit vectors |
| Finding classification accuracy | AUDIT-02 | Subjective classification — requires human judgment | Review each finding labeled OK/Intentional/Gap with rationale |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
