# Phase 24: Flatten Permissions with Type Icons - Research

**Researched:** 2026-03-11
**Domain:** VS Code TreeView restructuring, inline button patterns, permission type switching
**Confidence:** HIGH

## Summary

This phase replaces the 3-level permission hierarchy (Section -> PermissionGroup -> PermissionRule) with a flat 2-level structure (Section -> PermissionRule). Each rule node gets a type-aware icon from the existing `PERMISSION_CATEGORY_ICONS` map and an inline `$(edit)` button to switch types via QuickPick. The Permissions section node gains an inline `$(add)` button for adding new rules.

The codebase is well-structured for this change. The builder already has `buildPermissionRule()` which does all the heavy lifting (overlap detection, tooltip, contextValue). The refactor primarily involves: (1) changing `buildPermissionGroups()` to return flat `PermissionRuleVM[]` sorted by category then file order, (2) adding a `category` field to `PermissionRuleVM`, (3) swapping the generic `symbol-event` icon for the category-specific icons from `PERMISSION_CATEGORY_ICONS`, (4) registering a new `changePermissionType` command, and (5) updating package.json menus.

**Primary recommendation:** Refactor `buildPermissionGroups` -> `buildPermissionRules` in builder.ts, add `category` to `PermissionRuleVM`, wire new command + inline buttons in package.json. Remove PermissionGroupNode/VM or mark as dead code.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Icon-only display: rule pattern as label, no type text prefix or description
- Icons: keep existing `check` (allow), `close` (deny), `question` (ask) from PERMISSION_CATEGORY_ICONS
- Default theme color for icons -- type conveyed by icon shape alone, no color coding
- Overlap ThemeColor still applied to icons when overlap exists (same as current behavior)
- Category order: Allow -> Ask -> Deny (most permissive first)
- Within each category: file order (as written in JSON array)
- No visual separators between type groups -- continuous flat list
- Inline `+` button on the Permissions section node header (no context menu entry for adding rules)
- Two-step add flow: type -> pattern
- Inline `$(edit)` pencil icon on each permission rule for type-switch
- Also available via right-click context menu ("Change Type" entry)
- QuickPick shows all 3 types with current type marked as "(current)"
- Selecting a type applies immediately -- no confirmation dialog
- Selecting the current type is a no-op
- Writes to the correct config file: removes rule from old category array, adds to new category array

### Claude's Discretion
- Exact command registration and `when` clause patterns for new inline buttons
- How to handle the `permissionGroup` contextValue removal across package.json
- Error handling for type-switch write failures (follow existing showWriteError pattern)
- Whether to remove PermissionGroupNode and PermissionGroupVM entirely or leave as dead code for cleanup

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERM-01 | Permission rules display as flat list directly under Permissions section node (no Allow/Ask/Deny group nodes) | Refactor `buildPermissionGroups` to return `PermissionRuleVM[]` directly; SectionType.Permissions dispatch returns flat rules |
| PERM-02 | Permission rule icons reflect their permission type (allow/deny/ask) using distinct visual icons | Add `category` field to `PermissionRuleVM`; use `PERMISSION_CATEGORY_ICONS[category]` instead of hardcoded `symbol-event` |
| PERM-03 | Flat permission list maintains correct contextValue for edit/delete/move operations | `contextValue` already computed by `computeStandardContextValue('permissionRule', ...)` -- unchanged; `keyPath` format `['permissions', category, rule]` preserved |
| PERM-04 | Inline button on permission rules to switch between Allow/Ask/Deny groups via QuickPick dropdown | New `changePermissionType` command; inline `$(edit)` button via package.json `when` clause on `permissionRule.editable` |
</phase_requirements>

## Architecture Patterns

### Current Permission Tree Structure (BEFORE)
```
SectionNode (Permissions)
  -> PermissionGroupNode (Allow)  [icon: check]
       -> PermissionRuleNode      [icon: symbol-event]
       -> PermissionRuleNode      [icon: symbol-event]
  -> PermissionGroupNode (Deny)   [icon: close]
       -> PermissionRuleNode      [icon: symbol-event]
  -> PermissionGroupNode (Ask)    [icon: question]
       -> PermissionRuleNode      [icon: symbol-event]
```

### Target Permission Tree Structure (AFTER)
```
SectionNode (Permissions)  [inline: $(add)]
  -> PermissionRuleNode    [icon: check]    [inline: $(edit), $(arrow-swap), etc.]
  -> PermissionRuleNode    [icon: check]    [inline: $(edit), $(arrow-swap), etc.]
  -> PermissionRuleNode    [icon: question] [inline: $(edit), $(arrow-swap), etc.]
  -> PermissionRuleNode    [icon: close]    [inline: $(edit), $(arrow-swap), etc.]
```

### Key Code Changes

#### 1. Add `category` to PermissionRuleVM (viewmodel/types.ts)

Currently `PermissionRuleVM` has `rule` and `overriddenByCategory` but NO `category` field. The category is only on `PermissionGroupVM`. Must add:

```typescript
export interface PermissionRuleVM extends BaseVM {
  kind: NodeKind.PermissionRule;
  rule: string;
  category: string; // NEW: 'allow' | 'deny' | 'ask'
  overriddenByCategory?: string;
}
```

#### 2. Refactor builder.ts: buildPermissionGroups -> buildPermissionRules

Current `buildPermissionGroups()` returns `PermissionGroupVM[]`. Refactor to `buildPermissionRules()` returning `PermissionRuleVM[]` in the sort order: Allow -> Ask -> Deny.

The existing `buildPermissionRule()` private method already does all the real work. The refactored method just collects rules from all three categories in the desired order, passes category to each, and returns a flat array.

```typescript
private buildPermissionRules(
  scopedConfig: ScopedConfig,
  allScopes: ScopedConfig[],
): PermissionRuleVM[] {
  const perms = scopedConfig.config.permissions;
  if (!perms) return [];

  const result: PermissionRuleVM[] = [];
  // Sort order: allow -> ask -> deny (most permissive first)
  for (const category of ['allow', 'ask', 'deny'] as const) {
    const rules = perms[category] ?? [];
    const seen = new Set<string>();
    for (const rule of rules) {
      if (seen.has(rule)) continue;
      seen.add(rule);
      result.push(
        this.buildPermissionRule(rule, category as PermissionCategory, scopedConfig, allScopes),
      );
    }
  }
  return result;
}
```

#### 3. Update buildPermissionRule icon logic

Current icon: `new vscode.ThemeIcon('symbol-event', ...)` -- always the same icon regardless of category.

New icon: Use `PERMISSION_CATEGORY_ICONS[category]` (check/close/question). Apply overlap dimming with `disabledForeground` only when overlap exists, otherwise no ThemeColor (default theme color per locked decision).

```typescript
icon: new vscode.ThemeIcon(
  PERMISSION_CATEGORY_ICONS[category] ?? 'circle',
  hasOverlap ? new vscode.ThemeColor('disabledForeground') : undefined,
),
```

Note: Current code uses `new vscode.ThemeColor('icon.foreground')` for non-overlapped state. Per locked decision, use default theme color (no color arg = undefined), not explicit `icon.foreground`.

#### 4. Store category in PermissionRuleVM

The `buildPermissionRule` method already receives `category` as a parameter. Just add it to the returned object:

```typescript
return {
  kind: NodeKind.PermissionRule,
  rule,
  category, // NEW
  overriddenByCategory: overlap.overriddenByCategory,
  // ... rest unchanged
};
```

#### 5. Update buildSectionChildren dispatch

Change the Permissions case:
```typescript
case SectionType.Permissions:
  return this.buildPermissionRules(scopedConfig, allScopes);
```

#### 6. New command: changePermissionType

Register in a new file or in editCommands.ts:

```typescript
vscode.commands.registerCommand(
  'claudeConfig.changePermissionType',
  async (node?: ConfigTreeNode) => {
    if (!node?.nodeContext) return;
    const { filePath, keyPath, isReadOnly } = node.nodeContext;
    if (isReadOnly || !filePath) return;
    if (keyPath[0] !== 'permissions' || keyPath.length !== 3) return;

    const currentCategory = keyPath[1] as PermissionCategory;
    const rule = keyPath[2];

    const items = [
      { label: 'Allow', value: PermissionCategory.Allow, description: currentCategory === 'allow' ? '(current)' : '' },
      { label: 'Ask', value: PermissionCategory.Ask, description: currentCategory === 'ask' ? '(current)' : '' },
      { label: 'Deny', value: PermissionCategory.Deny, description: currentCategory === 'deny' ? '(current)' : '' },
    ];

    const pick = await vscode.window.showQuickPick(items, {
      placeHolder: 'Change permission type',
    });
    if (!pick || pick.value === currentCategory) return;

    try {
      removePermissionRule(filePath, currentCategory, rule);
      addPermissionRule(filePath, pick.value, rule);
    } catch (error) {
      await showWriteError(filePath, error, () => {
        removePermissionRule(filePath, currentCategory, rule);
        addPermissionRule(filePath, pick.value, rule);
      });
    }
  },
);
```

#### 7. package.json changes

**New command definition:**
```json
{
  "command": "claudeConfig.changePermissionType",
  "title": "Change Permission Type",
  "category": "Claude Config",
  "icon": "$(edit)"
}
```

**Inline buttons on permission rules:**
```json
{
  "command": "claudeConfig.changePermissionType",
  "when": "view == claudeConfigTree && viewItem =~ /^permissionRule\\.editable/",
  "group": "inline@-1"
}
```

Note: Use a low group order (like `inline@-1` or rearrange existing inline buttons) so the edit pencil appears first/leftmost, before move/copy/delete.

**Inline `+` on Permissions section:**
```json
{
  "command": "claudeConfig.addPermissionRule",
  "when": "view == claudeConfigTree && viewItem =~ /^section\\.permissions\\.editable/",
  "group": "inline@0"
}
```

**Remove old permissionGroup context menu entry:**
Remove or replace line 245-247 (addPermissionRule on `permissionGroup.editable`). The add flow now triggers from section node's inline button.

**Context menu "Change Type" entry:**
```json
{
  "command": "claudeConfig.changePermissionType",
  "when": "view == claudeConfigTree && viewItem =~ /^permissionRule\\.editable/",
  "group": "1_edit"
}
```

**Hide from command palette:**
```json
{
  "command": "claudeConfig.changePermissionType",
  "when": "false"
}
```

#### 8. Rewire addPermissionRule command

Current: Resolves filePath from node context (expects PermissionGroupNode with `permissions/allow` keyPath).

New: The command is invoked from either (a) the Permissions section inline `+` button or (b) with no node at all. Already has the QuickPick for category selection and then input box for rule pattern. Just needs to handle the section node context properly -- the section node's `filePath` is already populated, so `resolveFilePath` works as-is.

The current flow already: QuickPick category -> InputBox rule -> write. This matches the locked decision (two-step: type -> pattern). No change needed to the command logic itself, only the `when` clause in package.json.

#### 9. Dead code cleanup (Claude's Discretion)

**Recommendation: Remove PermissionGroupNode and PermissionGroupVM entirely.**

Rationale:
- No other code references PermissionGroupNode except vmToNode.ts
- Leaving dead code creates confusion for future contributors
- The NodeKind.PermissionGroup enum member, PermissionGroupVM interface, and PermissionGroupNode class can all be removed
- vmToNode.ts case for NodeKind.PermissionGroup should be removed
- This is a clean, small deletion with no risk

Files affected:
- `src/viewmodel/types.ts` -- remove `PermissionGroupVM` interface and `PermissionGroup` from `NodeKind` enum
- `src/tree/nodes/permissionGroupNode.ts` -- delete file
- `src/tree/vmToNode.ts` -- remove PermissionGroup case and import
- `src/viewmodel/builder.ts` -- remove PermissionGroupVM import, remove `buildPermissionGroups` method

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission write (add/remove) | Custom JSON manipulation | Existing `addPermissionRule` / `removePermissionRule` in configWriter | Already handles JSON read-modify-write with proper error handling |
| Type-aware icons | New icon map | `PERMISSION_CATEGORY_ICONS` in constants.ts | Already maps allow->check, deny->close, ask->question |
| Category labels | Hardcoded strings | `PERMISSION_CATEGORY_LABELS` in constants.ts | Already maps allow->Allow, deny->Deny, ask->Ask |
| Write error recovery | Custom error handling | `showWriteError` pattern | Established pattern with retry + open file |

## Common Pitfalls

### Pitfall 1: Type-switch as two separate writes
**What goes wrong:** Calling `removePermissionRule` then `addPermissionRule` as two operations means the tree refreshes twice, and if the second write fails, the rule is deleted but not re-added.
**How to avoid:** The configWriter uses synchronous `writeJsonFileSync` calls. Both operations happen on the same tick before fileWatcher fires. The retry in `showWriteError` retries both operations together. This is safe because writes are synchronous and the file watcher is debounced (300ms).

### Pitfall 2: keyPath format must stay consistent
**What goes wrong:** Delete/move/copy commands parse `keyPath` as `['permissions', category, rule]` with `keyPath.length === 3`. If the flat list changes keyPath format, all downstream commands break.
**How to avoid:** Keep the exact same keyPath format: `['permissions', category, rule]`. The `category` segment is critical -- it tells delete/move which array to target. The builder already generates this correctly in `buildPermissionRule`.

### Pitfall 3: Inline button ordering conflicts
**What goes wrong:** VS Code inline buttons appear right-to-left in descending group order. Getting the wrong order makes the UI confusing.
**How to avoid:** Use explicit `group` ordering. Current permission rule inline buttons: `inline@0` (move), `inline@1` (copy), `inline@2` (delete). Add the edit pencil at a lower number or rearrange. Suggested: `inline@0` (changeType/edit), `inline@1` (move), `inline@2` (copy), `inline@3` (delete).

### Pitfall 4: Section contextValue pattern for inline add button
**What goes wrong:** The section node contextValue is `section.permissions.editable` (computed as `section.${sectionType}.${editability}`). The `when` clause must match this exactly.
**How to avoid:** Use `viewItem =~ /^section\\.permissions\\.editable/` in the `when` clause. Verify by checking `computeStandardContextValue` in builder.ts -- it generates `section.permissions.editable` for editable permissions sections.

### Pitfall 5: Overlap icon color vs. type icon
**What goes wrong:** Current permission rule icon is always `symbol-event`. Changing to category-specific icons means the overlap dimming logic must work with `check`, `close`, and `question` icons.
**How to avoid:** The overlap logic applies `ThemeColor('disabledForeground')` as a color parameter on the ThemeIcon constructor. This works with any icon ID. Just pass the category icon ID instead of `symbol-event`. Already confirmed in codebase -- other node types (settings, envVar) use the same pattern with different base icons.

## Code Examples

### Existing addPermissionRule command (already correct flow)
```typescript
// Source: src/commands/addCommands.ts lines 24-54
// Already implements: QuickPick(Allow/Deny/Ask) -> InputBox(rule) -> write
// Only change needed: package.json when clause (permissionGroup.editable -> section.permissions.editable + inline)
```

### Existing configWriter permission operations
```typescript
// Source: src/config/configWriter.ts
export function addPermissionRule(filePath: string, category: PermissionCategory, rule: string): void;
export function removePermissionRule(filePath: string, category: PermissionCategory, rule: string): void;
// Both are synchronous, handle JSON read-modify-write internally
```

### Permission category constants
```typescript
// Source: src/constants.ts
export const PERMISSION_CATEGORY_ICONS: Record<string, string> = {
  allow: 'check',
  deny: 'close',
  ask: 'question',
};
export const PERMISSION_CATEGORY_LABELS: Record<string, string> = {
  allow: 'Allow',
  deny: 'Deny',
  ask: 'Ask',
};
```

## Open Questions

1. **Inline button visual ordering**
   - What we know: VS Code renders inline buttons from right-to-left in descending group order within the `inline` group
   - What's unclear: Whether `inline@-1` is valid or if we should renumber all existing inline buttons
   - Recommendation: Renumber all inline buttons: edit@0, move@1, copy@2, delete@3

2. **Section node inline `+` alongside section icon**
   - What we know: Other sections (env, hooks, mcpServers) use context menu "Add" on section node, not inline buttons
   - What's unclear: Whether adding an inline `+` to Permissions section but not others creates visual inconsistency
   - Recommendation: Follow locked decision (inline `+` on Permissions only). If user wants consistency later, add inline `+` to other sections in a future phase.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of builder.ts, types.ts, addCommands.ts, deleteCommands.ts, moveCommands.ts, configWriter.ts, package.json
- CONTEXT.md locked decisions from user discussion

### Secondary (MEDIUM confidence)
- VS Code TreeView API inline button behavior (from existing working patterns in this codebase)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing code
- Architecture: HIGH - clear refactor path, well-understood builder pattern
- Pitfalls: HIGH - identified from direct code analysis of existing write/read patterns

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- internal refactor, no external dependencies)
