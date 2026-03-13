---
phase: 28
slug: action-parity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mocha ^10.2.0 |
| **Config file** | `tsconfig.test.json`, entry at `test/runTests.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run compile`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 1 | ACTN-01 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 28-01-02 | 01 | 1 | ACTN-02 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 28-01-03 | 01 | 1 | ACTN-03 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 28-01-04 | 01 | 1 | ACTN-04 | unit | `npm run test` | ❌ W0 | ⬜ pending |
| 28-01-05 | 01 | 1 | ACTN-05 | unit | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/suite/commands/moveCommands.test.ts` — stubs for ACTN-01 (copyEnvVarToScope), ACTN-03 (copyMcpServerToScope)
- [ ] `test/suite/commands/editDeleteCommands.test.ts` — stubs for ACTN-04 (editValue settingKeyValue), ACTN-05 (deleteItem settingKeyValue)
- [ ] `test/suite/viewmodel/builder.test.ts` — stubs for ACTN-02 (MCP tooltip), ACTN-03 (MCP multi-scope rendering)

*All tests for Phase 28 are new — existing infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MCP tooltip renders correctly in TreeView | ACTN-02 | VS Code tooltip rendering requires Extension Host | Open TreeView, hover MCP server node, verify tooltip shows type/command |
| Inline buttons appear in correct positions | ACTN-01, ACTN-03, ACTN-04, ACTN-05 | Button visibility depends on VS Code `when` clause evaluation | Expand nodes in Extension Host, verify buttons at correct positions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
