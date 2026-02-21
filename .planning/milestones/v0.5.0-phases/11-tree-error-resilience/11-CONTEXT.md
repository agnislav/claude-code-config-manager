# Phase 11: Tree Error Resilience - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Make TreeView rendering and tree operations error-proof. Wrap tree node operations in try-catch guards so malformed data never crashes the extension or leaves the UI in an incorrect state. Plugin checkbox failures rollback UI state. Covers ERR-04 (tree operation error guards) and ERR-05 (plugin checkbox rollback).

</domain>

<decisions>
## Implementation Decisions

### Error guard scope (ERR-04)
- Wrap `getChildren()` and `findNodeByKeyPath()` at the **provider level** in `configTreeProvider.ts`
- **Also wrap individual node-level `getChildren()` overrides** in every node class (scopeNode, sectionNode, settingNode, mcpServerNode, hookEventNode, envVarNode, permissionGroupNode, pluginNode, sandboxPropertyNode, settingKeyValueNode, etc.)
- Provider-level catch returns `[]` for getChildren, `undefined` for findNodeByKeyPath
- Individual node-level catch returns `[]` (empty children)
- `console.error` for all caught errors (debugging via Developer Tools)

### Error notifications (ERR-04)
- Use `vscode.window.showWarningMessage()` for tree operation errors (not showErrorMessage — tree still works, just degraded)
- No action buttons on tree error notifications — just inform: "Tree rendering error in [node]: [message]"
- **No deduplication** — notify every time an error occurs, even if repeated on refresh
- Each error gets its own notification

### Checkbox rollback (ERR-05)
- On write failure in `onDidChangeCheckboxState` or `togglePlugin`, call `treeProvider.refresh()` to rebuild tree from disk state
- This effectively reverts the checkbox since the write didn't persist
- Brief visual flash from full refresh is acceptable
- Error notification handled by existing `showWriteError` from Phase 10 (with "Open File" + "Retry" buttons)

### Claude's Discretion
- Exact error message wording for tree rendering errors
- Whether to add `console.error` at provider level, node level, or both
- How to identify the failing node in the warning message (node type, scope, keyPath)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow Phase 10's established error handling patterns where applicable.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-tree-error-resilience*
*Context gathered: 2026-02-20*
