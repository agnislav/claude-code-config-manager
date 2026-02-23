---
phase: quick-fix
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/extension.ts
autonomous: true
requirements: [LOCK-FEEDBACK-01]

must_haves:
  truths:
    - "When User scope is locked and user toggles a plugin checkbox, an info message appears explaining the scope is locked"
    - "When User scope is locked and user invokes the togglePlugin command, an info message appears explaining the scope is locked"
    - "When User scope is unlocked, plugin toggles work as before with no regression"
  artifacts:
    - path: "src/extension.ts"
      provides: "Plugin toggle lock feedback for both checkbox and command paths"
      contains: "MESSAGES.userScopeLocked"
  key_links:
    - from: "src/extension.ts (onDidChangeCheckboxState handler)"
      to: "MESSAGES.userScopeLocked"
      via: "isReadOnly + scope check"
      pattern: "isReadOnly && node\\.nodeContext\\.scope === ConfigScope\\.User"
    - from: "src/extension.ts (togglePlugin command)"
      to: "MESSAGES.userScopeLocked"
      via: "isReadOnly + scope check"
      pattern: "isReadOnly && node\\.nodeContext\\.scope === ConfigScope\\.User"
---

<objective>
Add missing user feedback when plugin toggle is blocked by User scope lock.

Purpose: Two code paths in `src/extension.ts` silently swallow the lock guard for plugin toggles. Every other mutation command shows `MESSAGES.userScopeLocked` when the User scope is locked, but these two paths just `continue`/`return` without telling the user why nothing happened.

Output: Updated `src/extension.ts` with lock feedback messages in both plugin toggle paths.
</objective>

<execution_context>
@/Users/agnislav/.claude/get-shit-done/workflows/execute-plan.md
@/Users/agnislav/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/extension.ts
@src/constants.ts (MESSAGES.userScopeLocked)
@src/commands/editCommands.ts (reference pattern for lock guard feedback)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add lock feedback to both plugin toggle paths in extension.ts</name>
  <files>src/extension.ts</files>
  <action>
In `src/extension.ts`, apply the established lock-feedback pattern to the two plugin toggle code paths. The `MESSAGES` and `ConfigScope` imports already exist on lines 16-17.

**Fix 1 — `treeView.onDidChangeCheckboxState` handler (line ~133):**

Replace the guard:
```typescript
if (isReadOnly || !filePath || keyPath.length < 2) continue;
```

With:
```typescript
if (isReadOnly || !filePath || keyPath.length < 2) {
  if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
    vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
  }
  continue;
}
```

**Fix 2 — `claudeConfig.togglePlugin` command handler (line ~159):**

Replace the guard:
```typescript
if (isReadOnly || !filePath || keyPath.length < 2) return;
```

With:
```typescript
if (isReadOnly || !filePath || keyPath.length < 2) {
  if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
    vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
  }
  return;
}
```

Note: Use `continue` in Fix 1 (inside a `for` loop) and `return` in Fix 2 (inside a command handler). This matches the existing control flow exactly.
  </action>
  <verify>
    <automated>cd /Users/agnislav/Projects/Dardes/claude-code-config-manager && npm run compile 2>&1 | tail -5</automated>
    <manual>Verify both occurrences: grep -n "MESSAGES.userScopeLocked" src/extension.ts should show 2 matches</manual>
  </verify>
  <done>
Both plugin toggle paths in extension.ts show MESSAGES.userScopeLocked when User scope is locked — matching the pattern used by editCommands.ts, deleteCommands.ts, moveCommands.ts, and pluginCommands.ts. Compilation succeeds with no errors.
  </done>
</task>

</tasks>

<verification>
1. `npm run compile` passes with no type errors
2. `grep -c "MESSAGES.userScopeLocked" src/extension.ts` returns `2`
3. `grep -c "MESSAGES.userScopeLocked" src/commands/*.ts` returns `4` (unchanged — editCommands, deleteCommands, pluginCommands, moveCommands)
4. Total occurrences across codebase: 6 usages + 1 definition = consistent coverage
</verification>

<success_criteria>
- Both plugin toggle code paths in extension.ts show an informational message when the User scope is locked
- No other code paths are affected
- TypeScript compilation passes cleanly
- The fix follows the exact same pattern as all other lock-guarded commands
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-user-scope-lock-plugin-toggle-and-au/1-SUMMARY.md`
</output>
