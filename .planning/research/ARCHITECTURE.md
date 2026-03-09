# Architecture Patterns: v0.7.0 Visual Fidelity Integration

**Domain:** VS Code TreeView extension — visual overlap indicators, lock-aware plugin toggling, hook leaf editor navigation
**Researched:** 2026-03-08
**Confidence:** HIGH (analysis based on full codebase audit of builder.ts, overrideResolver.ts, configTreeProvider.ts, extension.ts, jsonLocation.ts, pluginCommands.ts, pluginNode.ts, and all node types)

---

## Existing Architecture Summary

```
Config Files on disk
  -> configDiscovery (find paths per scope)
  -> configLoader (parse JSON)
  -> ConfigStore (in-memory model, emits change events)
  -> overrideResolver (compute effective values)
  -> TreeViewModelBuilder (build VM descriptors with pre-computed display state)
  -> ConfigTreeProvider (bridge: caches VMs, maps to ConfigTreeNode via vmToNode)
  -> VS Code TreeView UI
```

Key architectural properties:
- **TreeViewModelBuilder** is the single computation layer. It calls overrideResolver functions and produces fully pre-computed `BaseVM` trees with all display properties (label, description, icon, tooltip, contextValue, command).
- **Tree nodes** are thin wrappers. Each node type constructor just calls `super(vm)` — zero computation.
- **ConfigTreeProvider** holds a `cachedRootVMs: BaseVM[]` rebuilt on every `refresh()`.
- **overrideResolver** has 5 functions: `resolveScalarOverride`, `resolvePermissionOverride`, `resolveEnvOverride`, `resolvePluginOverride`, `resolveSandboxOverride`. Each returns `{ isOverridden, overriddenByScope }`.
- **Lock state** is applied in `buildSingleRoot()`/`buildMultiRoot()`: if `configStore.isScopeLocked(scope)`, the `ScopedConfig` is spread with `isReadOnly: true`.

---

## Feature 1: Visual Overlap Indicators

### Problem

When the same entity (e.g., an env var `API_KEY`, a plugin `@foo/bar`, a setting `model`) appears in multiple scopes, each scope's node shows the entity independently. The only current indicator is override dimming — but that only tells you "a higher-precedence scope wins," not "which other scopes also define this." Users cannot see the full cross-scope picture at a glance.

### What "Overlap" Means

An entity "overlaps" when it exists in 2+ scopes. This is different from "override" (which is directional: higher-precedence scope overrides lower). Overlap is bidirectional: if `model` exists in both User and Project Shared, each node should indicate the other scope.

### Integration Point: overrideResolver.ts

The existing `resolve*Override` functions already scan `allScopes` but only look for higher-precedence scopes. To detect overlap, the resolver needs to also find same-key definitions in lower-precedence scopes.

**New function signature (recommended):**

```typescript
export interface OverlapInfo {
  /** Scopes (other than current) where this entity is also defined. */
  otherScopes: ConfigScope[];
  /** Whether a higher-precedence scope overrides this one (existing behavior). */
  isOverridden: boolean;
  overriddenByScope?: ConfigScope;
}

export function resolveScalarOverlap(
  key: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): OverlapInfo;
```

**Decision: extend existing functions or add new ones?** Add new `resolve*Overlap` functions. Existing `resolve*Override` functions are used by the builder and have a stable return type. Adding overlap detection to new functions avoids breaking the existing API and keeps each function focused.

### Integration Point: TreeViewModelBuilder (builder.ts)

The builder calls resolver functions in each `build*VM` method. For overlap indicators, each entity-level builder method needs to:

1. Call the new `resolve*Overlap` function (in addition to existing override call, or replacing it since overlap is a superset).
2. Use the `otherScopes` array to compute:
   - **description text:** e.g., `"value (also in User, Project Local)"` — append overlap info after existing description.
   - **tooltip:** Add a section listing all scopes where this entity appears with their values.
   - **badge/decoration:** Not needed — VS Code TreeItem has no native badge. Description text suffices.

**Affected builder methods (7 entity types with cross-scope semantics):**

| Entity Type | Builder Method | Current Override Call | New Overlap Call |
|-------------|---------------|---------------------|-----------------|
| Setting | `buildSettingVM` | `resolveScalarOverride` | `resolveScalarOverlap` |
| SettingKeyValue | `buildSettingKeyValueVM` | `resolveScalarOverride` | Inherits parent overlap |
| EnvVar | `buildEnvVars` | `resolveEnvOverride` | `resolveEnvOverlap` |
| Plugin | `buildPlugins` | `resolvePluginOverride` | `resolvePluginOverlap` |
| SandboxProperty | `buildSandboxPropertyVM` | `resolveSandboxOverride` | `resolveSandboxOverlap` |
| PermissionRule | `buildPermissionRule` | `resolvePermissionOverride` | `resolvePermissionOverlap` |
| McpServer | `buildMcpServers` | None (no override today) | `resolveMcpServerOverlap` |

**MCP Servers note:** MCP servers currently have no override detection at all (`isOverridden: false` hardcoded). Overlap detection would be the first cross-scope awareness for MCP servers. This is straightforward — check if the same server name appears in other scopes.

### Integration Point: VM Types (viewmodel/types.ts)

No new VM types needed. Overlap information flows through existing `description`, `tooltip`, and `nodeContext` fields. The `nodeContext.isOverridden` and `nodeContext.overriddenByScope` remain unchanged — overlap is an additional display concern, not a state concern.

**Optional enhancement:** Add `otherScopes?: ConfigScope[]` to `NodeContext` if commands need to know about overlap. However, since overlap is purely visual, keeping it in description/tooltip only (computed by builder) is cleaner.

### Integration Point: Helper Functions (builder.ts)

The existing `applyOverrideSuffix` function appends override info to descriptions. Add a companion:

```typescript
function applyOverlapSuffix(
  description: string,
  otherScopes: ConfigScope[],
): string {
  if (otherScopes.length === 0) return description;
  const names = otherScopes.map(s => SCOPE_LABELS[s]).join(', ');
  return `${description} (also in ${names})`.trim();
}
```

### No New Files Required

All changes are modifications to existing files:
- `overrideResolver.ts` — add `resolve*Overlap` functions
- `builder.ts` — call overlap resolvers, update description/tooltip computation
- Optionally `viewmodel/types.ts` if `NodeContext` needs `otherScopes`

### Test Impact

Existing builder tests validate override behavior. New tests needed for:
- Overlap detection with 2, 3, 4 scopes defining the same entity
- Overlap + override combined (entity in User and Project Local — User sees "also in Project Local", Project Local sees override + overlap)
- MCP server overlap (new capability)
- Entities present in only one scope (no overlap indicator)

---

## Feature 2: Lock-Aware Plugin Checkbox Toggle

### Problem

When User scope is locked, plugin checkboxes still appear interactive. Clicking a checkbox triggers `onDidChangeCheckboxState`, which detects `isReadOnly` and shows "User scope is locked" — but VS Code has already toggled the visual checkbox state. The `treeProvider.refresh()` call reverts it, but there is a visible flicker.

### Root Cause Analysis

The bug has two aspects:

1. **VS Code TreeView behavior:** `onDidChangeCheckboxState` fires AFTER the checkbox visual state has already changed. There is no way to prevent the visual toggle — only revert it.

2. **Current mitigation (lines 128-139 of extension.ts):**
```typescript
if (isReadOnly || !filePath || keyPath.length < 2) {
  if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
    vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
  }
  treeProvider.refresh();  // <-- Reverts checkbox, but causes flicker
  continue;
}
```

### Integration Point: TreeViewModelBuilder (builder.ts)

The builder already computes `checkboxState` for plugins in `buildPlugins()`. When User scope is locked, `scopedConfig.isReadOnly` is `true` (set in `buildSingleRoot`). The fix: **do not emit `checkboxState` on the PluginVM when the scope is read-only**.

```typescript
// In buildPlugins(), change:
checkboxState: enabled
  ? vscode.TreeItemCheckboxState.Checked
  : vscode.TreeItemCheckboxState.Unchecked,

// To:
checkboxState: scopedConfig.isReadOnly
  ? undefined  // No checkbox for read-only plugins
  : enabled
    ? vscode.TreeItemCheckboxState.Checked
    : vscode.TreeItemCheckboxState.Unchecked,
```

When `checkboxState` is `undefined`, VS Code renders no checkbox at all. This is correct behavior: locked/read-only plugins should not show a toggleable checkbox.

### Integration Point: BaseNode (baseNode.ts)

The `ConfigTreeNode` base constructor already handles `checkboxState` being undefined:
```typescript
if (vm.checkboxState !== undefined) {
  this.checkboxState = vm.checkboxState;
}
```
No change needed here.

### Integration Point: extension.ts (onDidChangeCheckboxState handler)

The handler at lines 128-157 should remain as a safety net, but with the builder fix, the checkbox will not be rendered for read-only plugins, so the handler will never fire for them. The existing guard is still valuable for edge cases (e.g., race between lock toggle and checkbox click).

### Alternative Considered: FileDecorationProvider Approach

Could use the existing `PluginDecorationProvider` to disable checkbox appearance. Rejected because `FileDecoration` controls color/badge/tooltip, not checkbox presence. The `checkboxState` property on `TreeItem` is the only mechanism.

### No New Files Required

Single change in `builder.ts`. The fix is a one-line conditional.

### Test Impact

- Test that `PluginVM.checkboxState` is `undefined` when `scopedConfig.isReadOnly` is `true`
- Test that `PluginVM.checkboxState` is `Checked`/`Unchecked` when `scopedConfig.isReadOnly` is `false`
- Existing override tests remain unchanged

---

## Feature 3: Hook Leaf Editor Navigation Fix

### Problem

Clicking a hook entry leaf node triggers `claudeConfig.revealInFile` with a keyPath like `['hooks', 'PreToolUse', '0', '0']` (event type, matcher index, hook index). The `findKeyLine` function in `jsonLocation.ts` navigates to the wrong line.

### Root Cause Analysis

The hook JSON structure is:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo hello"
          }
        ]
      }
    ]
  }
}
```

The keyPath `['hooks', 'PreToolUse', '0', '0']` means:
1. `hooks` — top-level object key (indent 2)
2. `PreToolUse` — nested object key (indent 4)
3. `0` — first element of the array (the matcher object)
4. `0` — this is wrong. The fourth segment should navigate into the matcher's `hooks` array and find the first hook entry.

**The bug:** The keyPath uses `['hooks', eventType, matcherIndex, hookIndex]` but the JSON structure has an intermediate `hooks` key inside each matcher. The actual JSON path is `hooks.PreToolUse[0].hooks[0]`, which as a keyPath should be `['hooks', 'PreToolUse', '0', 'hooks', '0']`.

### Integration Point: TreeViewModelBuilder (builder.ts)

The `buildHookEntryVM` method constructs the keyPath:
```typescript
keyPath: ['hooks', eventType, String(matcherIndex), String(hookIndex)],
```

This should be:
```typescript
keyPath: ['hooks', eventType, String(matcherIndex), 'hooks', String(hookIndex)],
```

The missing `'hooks'` segment (the matcher's `hooks` array key) causes `findKeyLine` to interpret the fourth segment as an array index at the wrong nesting level.

### Integration Point: jsonLocation.ts (findKeyLine)

The `findKeyLine` function itself is correct — it properly handles both object keys (string segments) and array indices (numeric segments). The bug is in the keyPath construction, not the navigation function.

Verify by tracing:
1. `'hooks'` — finds `"hooks":` at indent 2. OK.
2. `'PreToolUse'` — finds `"PreToolUse":` at indent 4. OK.
3. `'0'` — numeric, finds first array element (the matcher object `{`). OK.
4. `'0'` — numeric, tries to find first array element starting from the matcher `{` line. But the next array-like content is `"hooks": [...]` inside the matcher, and the function looks for a `[` bracket. It finds the `[` in `"hooks": [`, then counts elements — landing on the hook object. This might accidentally work in some cases or land on the wrong line depending on formatting.

**With the fix** `['hooks', 'PreToolUse', '0', 'hooks', '0']`:
1-3: Same as above.
4. `'hooks'` — string segment, finds `"hooks":` at indent 8 inside the matcher. Correct.
5. `'0'` — numeric, finds first element of the hooks array. Correct.

### Integration Point: findKeyPathAtLine (reverse direction)

The `findKeyPathAtLine` function in `jsonLocation.ts` builds keyPaths from cursor position back to root. When the cursor is on a hook command line (e.g., `"command": "echo hello"`), it should produce `['hooks', 'PreToolUse', '0', 'hooks', '0', 'command']`. The existing implementation uses `countArrayElementIndex` to detect array element `{` braces and emit numeric indices.

**This function likely already produces the correct 5-segment path** because it walks the actual JSON indentation structure. The mismatch is that the builder produces a 4-segment path, so `findNodeByKeyPath` in `ConfigTreeProvider` fails to match when the editor cursor is on a hook property.

### Integration Point: ConfigTreeProvider.findNodeByKeyPath

The tree walk in `findNodeByKeyPath` does prefix matching:
```typescript
if (
  scopeMatch &&
  keyPath.length < ctx.keyPath.length &&
  keyPath.every((seg, i) => seg === ctx.keyPath[i])
) {
  return node;
}
```

With the corrected 5-segment keyPath `['hooks', 'PreToolUse', '0', 'hooks', '0']`, this will correctly match against editor-derived 6-segment paths like `['hooks', 'PreToolUse', '0', 'hooks', '0', 'command']`.

### Integration Point: HookKeyValue Dead Code

The `HookKeyValueVM`, `HookKeyValueNode`, and `buildHookKeyValueVM` are dead code from v0.6.0. The builder method exists but is never called. Project requirements include cleaning this up. This is independent of the navigation fix but should be done in the same milestone.

### No New Files Required

Single change in `builder.ts` line 929: add `'hooks'` segment to keyPath.

### Test Impact

- Test that `HookEntryVM.nodeContext.keyPath` includes the `'hooks'` segment
- Test that `HookEntryVM.command.arguments[1]` (the keyPath passed to revealInFile) includes the `'hooks'` segment
- Verify `findKeyLine` navigates correctly with the corrected keyPath on sample hook JSON
- Verify editor-to-tree sync works for hook properties (findKeyPathAtLine produces matching path)

---

## Component Boundaries

| Component | Current Responsibility | v0.7.0 Changes |
|-----------|----------------------|----------------|
| `overrideResolver.ts` | Override detection (higher-precedence wins) | Add overlap detection (all scopes defining same entity) |
| `builder.ts` | Pre-compute all VM display properties | Call overlap resolvers, fix hook keyPath, conditional checkbox |
| `viewmodel/types.ts` | VM type definitions | No changes needed |
| `configTreeProvider.ts` | Bridge VMs to TreeView, caching, tree walk | No changes needed |
| `tree/nodes/*.ts` | Thin VM wrappers | No changes needed |
| `jsonLocation.ts` | JSON line finder (forward and reverse) | No changes needed (bug is in keyPath, not finder) |
| `extension.ts` | Command registration, checkbox handler | No changes needed (existing guard remains as safety net) |
| `constants.ts` | Labels, icons, config keys | No changes needed |

### Modified Files Summary

| File | Change Type | Scope |
|------|------------|-------|
| `src/config/overrideResolver.ts` | ADD functions | 5-6 new `resolve*Overlap` functions |
| `src/viewmodel/builder.ts` | MODIFY | Call overlap resolvers in 7 entity builders, fix hook keyPath (1 line), conditional checkboxState (1 line) |

### New Files: None

All three features integrate through modifications to existing files. The architecture absorbs these changes cleanly because:
1. The ViewModel builder is the single computation layer — all display logic lives there.
2. The override resolver is the single cross-scope analysis layer — overlap extends it naturally.
3. Tree nodes are pure consumers of pre-computed VMs — they need no changes.

---

## Data Flow Changes

### Current Flow (unchanged)
```
ConfigStore -> overrideResolver -> TreeViewModelBuilder -> VM tree -> ConfigTreeProvider -> TreeView
```

### v0.7.0 Addition
```
ConfigStore -> overrideResolver (override + overlap) -> TreeViewModelBuilder -> VM tree -> ConfigTreeProvider -> TreeView
                                   ^                          |
                                   |                          +-- description includes overlap info
                                   +-- new resolve*Overlap functions called alongside resolve*Override
```

The data flow direction does not change. No new event channels, no new state stores, no new providers. The change is purely additive computation within the existing pipeline.

---

## Recommended Build Order

Build order based on dependency analysis and risk:

### Phase 1: Hook Leaf Navigation Fix (smallest, zero dependencies)

**Why first:** Single-line fix in `builder.ts`. No new functions, no new types. Immediately testable with manual verification. Zero risk of breaking other features.

**Changes:**
1. Fix keyPath in `buildHookEntryVM` (builder.ts line 929)
2. Add test for correct keyPath structure
3. Manual verification: click hook entry leaf, verify editor navigates to correct line

### Phase 2: Lock-Aware Plugin Checkbox (small, zero dependencies)

**Why second:** Single conditional in `builder.ts`. No new functions. Immediately testable. Eliminates user-visible flicker bug.

**Changes:**
1. Add `scopedConfig.isReadOnly` guard to `checkboxState` in `buildPlugins` (builder.ts)
2. Add test for undefined checkboxState when read-only
3. Manual verification: lock User scope, verify no checkbox on User plugins

### Phase 3: Visual Overlap Indicators (largest, builds on existing resolver pattern)

**Why last:** Requires new resolver functions, builder modifications across 7 entity types, and new test coverage. Highest scope but follows established patterns.

**Changes:**
1. Add `OverlapInfo` interface and `resolve*Overlap` functions to `overrideResolver.ts`
2. Add `applyOverlapSuffix` helper to `builder.ts`
3. Update 7 `build*VM` methods to call overlap resolvers and include overlap info in description/tooltip
4. Add comprehensive overlap tests

### Phase 4: Dead Code Cleanup (independent, do anytime)

**Why separate:** Removing `HookKeyValueVM`, `HookKeyValueNode`, `buildHookKeyValueVM`, and `NodeKind.HookKeyValue` is independent housekeeping. Can be done in any phase but logically pairs with Phase 1 (hook-related cleanup).

**Changes:**
1. Remove `buildHookKeyValueVM` from `builder.ts`
2. Remove `HookKeyValueVM` from `viewmodel/types.ts`
3. Remove `NodeKind.HookKeyValue` from `viewmodel/types.ts`
4. Remove `hookKeyValueNode.ts` from `tree/nodes/`
5. Remove `HookKeyValue` case from `vmToNode.ts`
6. Verify no remaining references

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding Overlap State to NodeContext
**What:** Storing `otherScopes[]` in `NodeContext` for command handlers to consume.
**Why bad:** `NodeContext` is a contract shared across all commands. Overlap is a display-only concern. Adding it to `NodeContext` invites commands to make decisions based on overlap (e.g., "don't allow delete if entity is in multiple scopes"), which is a policy decision that does not belong in node metadata.
**Instead:** Keep overlap information in `description` and `tooltip` only. If a future command needs overlap awareness, it can call the resolver directly.

### Anti-Pattern 2: Computing Overlap in Node Constructors
**What:** Moving overlap resolution into tree node `getChildren()` or constructors.
**Why bad:** Violates the v0.6.0 architecture where nodes are pure VM consumers. Reintroduces the coupling that v0.6.0 eliminated.
**Instead:** All computation in `TreeViewModelBuilder`. Nodes just render.

### Anti-Pattern 3: Separate "Overlap" Tree Nodes
**What:** Creating new node types like `OverlapIndicatorNode` to show cross-scope references.
**Why bad:** Adds tree depth, makes the tree harder to scan, introduces new node types that need contextValue patterns and command handling.
**Instead:** Overlap information belongs in the existing entity node's description and tooltip.

### Anti-Pattern 4: Hiding Checkbox vs. Disabling It
**What:** Using a "disabled" visual state for checkboxes instead of removing them.
**Why bad:** VS Code TreeItem has no "disabled checkbox" concept. Any checkbox renders as interactive. The only options are: show checkbox (clickable) or no checkbox.
**Instead:** Set `checkboxState: undefined` for read-only plugins. No checkbox = not interactive.

---

## Scalability Considerations

| Concern | Current (3 scopes visible) | At 4 scopes (Managed visible) | With overlap |
|---------|---------------------------|-------------------------------|-------------|
| Resolver calls per entity | 1 override call | 1 override call | 1 overlap call (replaces override) |
| Description length | Short ("value") | Short | Longer ("value (also in User, Project Local)") |
| Tooltip complexity | Simple override warning | Simple | Rich multi-scope summary |
| Builder build time | ~ms | ~ms | ~ms (linear scan of 4 scopes per entity) |

Performance is not a concern. The resolver scans at most 4 scopes per entity, and the total entity count across all scopes is typically under 100.

---

## Sources

- Full codebase audit of `src/` (42 files, ~6,247 LOC)
- VS Code TreeItem API: `checkboxState` property behavior (training data, HIGH confidence — well-established API)
- VS Code `onDidChangeCheckboxState` event behavior (training data, HIGH confidence)
- JSON structure of Claude Code settings files (project's own test fixtures and schema)
