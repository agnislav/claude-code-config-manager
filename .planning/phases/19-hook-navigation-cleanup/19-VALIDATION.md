---
phase: 19
slug: hook-navigation-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha + VS Code test runner |
| **Config file** | `.vscode-test.mjs` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck && npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | NAV-01 | unit | `npm run test` | Partial (builder.test.ts:329 checks hook structure but not keyPath) | ⬜ pending |
| 19-01-02 | 01 | 1 | CLEN-01 | compile + grep | `npm run typecheck` | N/A (verified by successful compilation) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Consider adding keyPath assertion to existing hook test at `builder.test.ts:329` to verify the NAV-01 fix

*Existing infrastructure covers most phase requirements. One optional test enhancement for keyPath verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Click hook entry node opens correct JSON line | NAV-01 | VS Code editor navigation requires Extension Development Host | 1. Open Extension Host (F5) 2. Open a config with hooks 3. Click a hook entry leaf node 4. Verify editor opens and cursor is on the correct JSON line |
| No HookKeyValue references in codebase | CLEN-01 | Grep verification | Run `grep -r "HookKeyValue" src/` — expect zero matches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
