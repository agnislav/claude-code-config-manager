# Phase 20: Lock-Aware Plugin Display - Research

**Researched:** 2026-03-09
**Domain:** VS Code TreeView checkbox/icon conditional rendering
**Confidence:** HIGH

## Summary

This phase requires a small, focused change in `TreeViewModelBuilder.buildPlugins()` to conditionally render either a checkbox or a static icon based on the `isReadOnly` flag already propagated through the lock mechanism. The existing architecture fully supports this: `isScopeLocked()` already sets `isReadOnly: true` on `ScopedConfig`, the builder already receives this flag, and `baseNode.ts` already conditionally applies `checkboxState` only when defined.

The change is entirely in the ViewModel layer. No tree provider changes, no new node types, no new commands. The `PluginDecorationProvider` (dimming for disabled plugins) continues to work unchanged since it keys off `resourceUri.query`.

**Primary recommendation:** Modify `buildPlugins()` in `builder.ts` to branch on `scopedConfig.isReadOnly` -- when true, omit `checkboxState` and set `icon` to `$(check)` for enabled or `undefined` for disabled.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Enabled plugin icon (LOCK-01):** Use `$(check)` ThemeIcon, replaces `$(extensions)` icon entirely, default theme color, no checkbox state when locked
- **Disabled plugin appearance (LOCK-02):** No icon at all (don't set `iconPath` or `ThemeIcon`), keep dimming via `PluginDecorationProvider`, let VS Code handle indentation naturally
- **Lock toggle transition (LOCK-03):** Pure ViewModel approach in `buildPlugins` method, builder conditionally sets `checkboxState` and `icon` based on `scopedConfig.isReadOnly`, no tree provider changes needed, on unlock checkboxes restore from config file value

### Claude's Discretion
- Exact conditional logic placement within `buildPlugins` (early return vs inline ternary)
- Whether to extract locked plugin icon as a constant in `constants.ts`
- Test strategy for checkbox/icon swap behavior

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOCK-01 | When User scope is locked, plugin nodes show checkmark icon for enabled plugins instead of checkbox | `buildPlugins()` already has `scopedConfig.isReadOnly`; set `icon: new ThemeIcon('check')` and omit `checkboxState` |
| LOCK-02 | When User scope is locked, disabled plugins show no icon instead of checkbox | Set `icon: undefined` and omit `checkboxState`; dimming still works via `PluginDecorationProvider` keyed on `resourceUri.query` |
| LOCK-03 | Lock state change refreshes plugin node display between checkbox and icon modes | `lockScope()`/`unlockScope()` fire `onDidChange` which triggers full tree rebuild via existing flow |
</phase_requirements>

## Architecture Patterns

### Modification Target

The only file that needs modification is `src/viewmodel/builder.ts`, specifically the `buildPlugins()` method (line 661). The return object at line 703-726 currently unconditionally sets:
- `icon: new vscode.ThemeIcon('extensions')` (line 709)
- `checkboxState: enabled ? Checked : Unchecked` (lines 716-718)

### Pattern: Conditional VM Properties Based on ReadOnly

The change follows this pattern in the return object:

```typescript
// When locked: static icon, no checkbox
// When unlocked: extensions icon, checkbox
icon: scopedConfig.isReadOnly
  ? (enabled ? new vscode.ThemeIcon('check') : undefined)
  : new vscode.ThemeIcon('extensions'),
...(scopedConfig.isReadOnly
  ? {}
  : {
      checkboxState: enabled
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked,
    }),
```

Alternative (cleaner with local variables):

```typescript
const isLocked = scopedConfig.isReadOnly;
const icon = isLocked
  ? (enabled ? new vscode.ThemeIcon('check') : undefined)
  : new vscode.ThemeIcon('extensions');
const checkboxState = isLocked
  ? undefined
  : enabled
    ? vscode.TreeItemCheckboxState.Checked
    : vscode.TreeItemCheckboxState.Unchecked;
```

### BaseVM Type Consideration

`BaseVM.icon` is typed as `vscode.ThemeIcon` (not optional). For disabled locked plugins where we want no icon, we need to handle the type. Options:
1. Make `icon` optional in `BaseVM` (`icon?: vscode.ThemeIcon`) -- but this affects all node types
2. Use a transparent/blank icon -- goes against the decision
3. Set `icon` to `undefined` with a type assertion -- pragmatic for this case

Check how `baseNode.ts` uses it: line 16 sets `this.iconPath = vm.icon`. VS Code TreeItem's `iconPath` accepts `undefined`, so passing `undefined` works at runtime. The cleanest approach: make `BaseVM.icon` optional (`icon?: vscode.ThemeIcon`).

### Existing Lock Flow (No Changes Needed)

```
User clicks lock toggle
  -> ConfigStore.lockScope(ConfigScope.User)
  -> _lockedScopes.add(scope)
  -> _onDidChange.fire()
  -> ConfigTreeProvider rebuilds tree
  -> builder.buildTree() picks up isReadOnly: true
  -> buildPlugins() now returns VMs with icons instead of checkboxes
  -> Tree renders updated nodes
```

The checkbox toggle handler in `extension.ts` (line 133) already guards against `isReadOnly` and shows `MESSAGES.userScopeLocked` -- this continues to work but will be less likely to trigger since locked plugins won't have checkboxes to click.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon removal | Custom decoration hack | Set `icon: undefined` in VM | VS Code TreeItem natively supports undefined iconPath |
| Checkbox removal | Re-render workaround | Omit `checkboxState` from VM | `baseNode.ts` already conditionally applies checkboxState only when defined |

## Common Pitfalls

### Pitfall 1: BaseVM Type Mismatch
**What goes wrong:** `BaseVM.icon` is currently non-optional `ThemeIcon`, setting `undefined` causes TypeScript error
**Why it happens:** The type was defined assuming all nodes always have icons
**How to avoid:** Make `icon` field optional in `BaseVM` interface (`icon?: vscode.ThemeIcon`). This is safe because `baseNode.ts` sets `this.iconPath = vm.icon` which already handles undefined correctly.

### Pitfall 2: Checkbox Still Appearing After Lock
**What goes wrong:** If `checkboxState` is set to any value (even attempting `undefined` via property), VS Code may still show a checkbox
**Why it happens:** VS Code TreeItem treats `checkboxState` presence differently from absence
**How to avoid:** Use conditional spread (`...{}`) or simply don't include the `checkboxState` key in the returned object when locked. The `baseNode.ts` constructor already has `if (vm.checkboxState !== undefined)` guard.

### Pitfall 3: resourceUri Must Remain Set
**What goes wrong:** If `resourceUri` is accidentally removed for locked plugins, dimming via `PluginDecorationProvider` breaks
**Why it happens:** Developer might think "no icon means no decoration"
**How to avoid:** Keep `resourceUri` unchanged regardless of lock state -- it drives the decoration provider for text dimming.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha (VS Code test runner) |
| Config file | `.vscode-test.mjs` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOCK-01 | Locked enabled plugin has check icon, no checkbox | unit | `npm test` (builder.test.ts) | Needs new test case |
| LOCK-02 | Locked disabled plugin has no icon, no checkbox | unit | `npm test` (builder.test.ts) | Needs new test case |
| LOCK-03 | Lock toggle swaps between checkbox and icon modes | unit | `npm test` (builder.test.ts) | Needs new test case |

### Sampling Rate
- **Per task commit:** `npm run compile && npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `test/suite/viewmodel/builder.test.ts` -- tests for locked plugin VMs with enabled/disabled states
- Existing test infrastructure (`createMockConfigStore` with `lockedScopes` option) already supports lock testing -- no new fixtures needed

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/viewmodel/builder.ts` lines 661-727 (buildPlugins method)
- Direct codebase inspection: `src/viewmodel/types.ts` (BaseVM and PluginVM interfaces)
- Direct codebase inspection: `src/tree/nodes/baseNode.ts` (VM-to-TreeItem mapping, conditional checkboxState)
- Direct codebase inspection: `src/tree/nodes/pluginNode.ts` (PluginDecorationProvider)
- Direct codebase inspection: `src/config/configModel.ts` lines 89-101 (lock/unlock mechanism)
- Direct codebase inspection: `src/extension.ts` lines 127-157 (checkbox toggle handler with isReadOnly guard)
- Direct codebase inspection: `test/suite/viewmodel/builder.test.ts` (existing test patterns, mock store)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, pure VM logic change
- Architecture: HIGH - single method modification, all patterns already established in codebase
- Pitfalls: HIGH - identified from direct type inspection and VS Code TreeItem API knowledge

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- internal codebase change only)
