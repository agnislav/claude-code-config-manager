---
phase: 26
slug: inline-button-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (manifest-only changes) |
| **Config file** | package.json |
| **Quick run command** | `npm run compile` |
| **Full suite command** | `npm run compile && npm run lint` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run compile`
- **After every plan wave:** Run `npm run compile && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | INLN-03 | manual | `npm run compile` | ✅ | ⬜ pending |
| 26-01-02 | 01 | 1 | INLN-04 | manual | `npm run compile` | ✅ | ⬜ pending |
| 26-01-03 | 01 | 1 | INLN-03 | manual | visual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

This phase modifies only `package.json` menu contributions (JSON manifest). No TypeScript changes, no new test files needed. Compile + lint confirms JSON validity.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dead editValue guard removed | INLN-03 | JSON deletion — no programmatic test | Verify `editValue` with `&& false` no longer exists in package.json `view/item/context` |
| Plugin guards documented | INLN-03 | Documentation task | Verify audit matrix has plugin guard documentation |
| EnvVar inline buttons at correct positions | INLN-04 | VS Code menu rendering | Open Extension Host, expand EnvVar node, verify button order matches ITEMS.md |
| Setting inline buttons at correct positions | INLN-04 | VS Code menu rendering | Open Extension Host, expand Setting node, verify button order matches ITEMS.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
