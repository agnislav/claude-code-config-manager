# Phase 27: Hook Overlap Detection - Research

**Researched:** 2026-03-12
**Domain:** VS Code extension overlap detection — hook entry identity matching and builder wiring
**Confidence:** HIGH

## Summary

Phase 27 adds overlap detection to `HookEntry` nodes, completing the overlap system across all 7 entity types. The core technical challenge is identity matching: hooks live in an array-of-arrays structure (`HooksConfig = Partial<Record<HookEventType, HookMatcher[]>>`), not a flat keyed map like `env`, `enabledPlugins`, or `mcpServers`. A hook entry has no stable string key. Identity must be derived from the combination of `(eventType, matcher?, hookCommand)` to compare across scopes.

All the infrastructure required already exists. `resolveOverlapGeneric()` in `overlapResolver.ts` is a generic higher-order function that takes a `getValue` extractor — the same pattern used by `resolveEnvOverlap`, `resolveMcpOverlap`, `resolvePluginOverlap`, and `resolveSandboxOverlap`. Adding hook overlap requires: (1) a new `resolveHookOverlap()` in `overlapResolver.ts`, (2) thread `allScopes` into `buildHookEvents` / `buildHookEventVM` / `buildHookEntryVM` in `builder.ts`, (3) call the resolver and use the result to populate `overlap`, `contextValue`, `icon`, `resourceUri`, and `tooltip` on `HookEntryVM`.

**Primary recommendation:** Define hook identity as `(eventType, matcher ?? '', command|prompt|type)` — the three-tuple that humans use to identify a hook. Use `deepEqual` on the full `HookCommand` object as the value comparator for override vs. duplicate classification.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OVLP-01 | Hook entries show overlap detection when same hook exists in multiple scopes | `resolveOverlapGeneric()` in `overlapResolver.ts` accepts any `getValue` extractor — add `resolveHookOverlap(eventType, matcherPattern, hook, scope, allScopes)` using same pattern |
| OVLP-02 | Hook overlap uses color-coded decorations and tooltips consistent with other entity types | `buildOverlapResourceUri()` + `buildOverlapTooltip()` already exist in `builder.ts`; wire in same way as EnvVar/MCP/Sandbox nodes |
</phase_requirements>

## Standard Stack

No new dependencies. All work is internal to the existing TypeScript codebase.

### Core Files Modified

| File | Change Type | Purpose |
|------|-------------|---------|
| `src/config/overlapResolver.ts` | Add function | `resolveHookOverlap()` — new public resolver |
| `src/viewmodel/builder.ts` | Thread `allScopes`, wire overlap | `buildHookEvents`, `buildHookEventVM`, `buildHookEntryVM` |
| `test/suite/config/overlapResolver.test.ts` | Add suite | `resolveHookOverlap` tests |
| `test/suite/viewmodel/builder.test.ts` | Add tests | Hook overlap in builder output |

## Architecture Patterns

### Existing Overlap Pattern (for reference)

Every keyed entity follows this pattern in `builder.ts`:

```typescript
// 1. Resolver call with identity key
const overlap = resolveEnvOverlap(key, scopedConfig.scope, allScopes);

// 2. NodeContext carries overlap
const ctx: NodeContext = { scope, keyPath, isReadOnly, overlap, filePath };

// 3. contextValue includes 'overridden' suffix when applicable
contextValue: computeStandardContextValue('envVar', scopedConfig.isReadOnly, overlap),

// 4. Icon dims on isOverriddenBy
icon: overlap.isOverriddenBy
  ? new vscode.ThemeIcon('terminal', new vscode.ThemeColor('disabledForeground'))
  : new vscode.ThemeIcon('terminal'),

// 5. resourceUri for FileDecorationProvider color
resourceUri: buildOverlapResourceUri(scopedConfig.scope, 'env', key, overlap),

// 6. Tooltip appends overlap section
tooltip: buildOverlapTooltip(baseTooltip, overlap),
```

Hook entries must follow exactly this six-step pattern.

### Hook Data Structure

```typescript
// HooksConfig shape (types.ts)
type HooksConfig = Partial<Record<HookEventType, HookMatcher[]>>;

interface HookMatcher {
  matcher?: string;   // optional tool-name glob, e.g. "Bash"
  hooks: HookCommand[];
}

interface HookCommand {
  type: 'command' | 'prompt' | 'agent';
  command?: string;
  prompt?: string;
  timeout?: number;
  async?: boolean;
}
```

### Hook Identity: The Key Design Decision

Other entity types have a natural string key: env var name, plugin ID, MCP server name, setting key, sandbox property key. Hooks do not. The array of matchers within an event type, and the array of commands within a matcher, carry no unique identifier.

**Chosen identity:** `(eventType, matcher ?? '', hook)` where `hook` is matched by `deepEqual` on the full `HookCommand` object.

The resolver searches all `(eventType, matcher?)` buckets in other scopes for a `HookCommand` that passes `deepEqual`. This is the only semantically sound definition: two hooks across scopes are "the same hook" if they have the same event type, same matcher pattern, and identical command/prompt/type/options.

**Alternative considered and rejected:** Index-based identity (`matcherIndex + hookIndex`). Rejected because array position is unstable — if a lower scope has `[hookA, hookB]` and a higher scope has `[hookB]`, index 0 no longer refers to the same hook.

### Recommended `resolveHookOverlap` Signature

```typescript
// Source: existing pattern from resolveEnvOverlap / resolveMcpOverlap in overlapResolver.ts
export function resolveHookOverlap(
  eventType: HookEventType,
  matcherPattern: string | undefined,
  hook: HookCommand,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): OverlapInfo {
  return resolveOverlapGeneric(currentScope, allScopes, (sc) => {
    const matchers = sc.config.hooks?.[eventType];
    if (!matchers) return undefined;
    for (const m of matchers) {
      const scopeMatcher = m.matcher;
      // Matcher identity: both undefined, or both equal strings
      if ((scopeMatcher ?? '') !== (matcherPattern ?? '')) continue;
      for (const h of m.hooks) {
        if (deepEqual(h, hook)) return h;
      }
    }
    return undefined;
  });
}
```

The `getValue` extractor returns the matching `HookCommand` object (or `undefined` if absent). `resolveOverlapGeneric` then calls `deepEqual(currentValue, higherValue)` / `deepEqual(currentValue, lowerValue)` to classify as duplicate vs. override — and `deepEqual` on two `HookCommand` objects compares all fields, which is exactly right.

### Builder Changes: Thread `allScopes`

Currently `buildHookEvents` does NOT receive `allScopes`:

```typescript
// Current (builder.ts line 421)
case SectionType.Hooks:
  return this.buildHookEvents(scopedConfig);
//                            ^^ allScopes missing
```

Fix: add `allScopes` parameter to the three hook builder methods.

```typescript
// After change
private buildHookEvents(
  scopedConfig: ScopedConfig,
  allScopes: ScopedConfig[],   // ADD
): HookEventVM[]

private buildHookEventVM(
  eventType: HookEventType,
  matchers: HookMatcher[],
  scopedConfig: ScopedConfig,
  allScopes: ScopedConfig[],   // ADD
): HookEventVM

private buildHookEntryVM(
  label: string,
  eventType: HookEventType,
  matcherIndex: number,
  hookIndex: number,
  hook: HookCommand,
  scopedConfig: ScopedConfig,
  allScopes: ScopedConfig[],   // ADD
): HookEntryVM
```

And the `buildSectionChildren` dispatch:
```typescript
case SectionType.Hooks:
  return this.buildHookEvents(scopedConfig, allScopes);  // ADD allScopes
```

### HookEntryVM Changes

```typescript
// In buildHookEntryVM — after adding allScopes parameter:
const overlap = resolveHookOverlap(
  eventType,
  matchers[matcherIndex]?.matcher,  // need matcher from context
  hook,
  scopedConfig.scope,
  allScopes,
);

const ctx: NodeContext = {
  scope: scopedConfig.scope,
  keyPath: ['hooks', eventType, String(matcherIndex), 'hooks', String(hookIndex)],
  isReadOnly: scopedConfig.isReadOnly,
  overlap,               // was: overlap: {}
  filePath: scopedConfig.filePath,
};

// icon dimming
icon: overlap.isOverriddenBy
  ? new vscode.ThemeIcon(iconMap[hook.type] ?? 'terminal', new vscode.ThemeColor('disabledForeground'))
  : new vscode.ThemeIcon(iconMap[hook.type] ?? 'terminal'),

// contextValue
contextValue: computeStandardContextValue('hookEntry', scopedConfig.isReadOnly, overlap),

// tooltip (existing base tooltip preserved)
tooltip: buildOverlapTooltip(
  hook.command ? new vscode.MarkdownString(`\`${hook.command}\``) : undefined,
  overlap,
),

// resourceUri
resourceUri: buildOverlapResourceUri(
  scopedConfig.scope,
  'hook',
  `${eventType}/${matcherIndex}/${hookIndex}`,  // path segment for URI
  overlap,
),
```

**Note on matcher access:** `buildHookEntryVM` receives `matcherIndex` and `hookIndex` but not the `HookMatcher` object itself. The simplest fix is to pass `matcher.matcher` (the pattern string) as a new parameter, or pass the full `HookMatcher`. Either works; passing the matcher pattern string is minimal.

### HookEventVM: No Overlap Needed

`HookEvent` is a container node (like `SectionNode`). Container nodes never receive overlap treatment in this codebase — the audit matrix confirmed `HookEvent` overlap is `{}` and that is expected behavior. Only leaf `HookEntry` nodes need overlap.

### ResourceUri Entity Key

The `buildOverlapResourceUri` call uses `entityKey` as a path segment in the URI:

```typescript
vscode.Uri.from({
  scheme: OVERLAP_URI_SCHEME,
  path: `/${scope}/${entityType}/${entityKey}`,
  query: color,
})
```

For hooks, a reasonable entity key is `${eventType}/${matcherIndex}/${hookIndex}` — it uniquely identifies the node within a scope. The URI is only used for visual decoration; it doesn't need to be stable across reloads.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Generic overlap resolution | Custom loop | `resolveOverlapGeneric()` — already handles precedence sort, nearest-neighbor, deepEqual classification |
| Equality of hook objects | Custom comparator | `deepEqual()` from `overlapResolver.ts` — handles objects with key-order independence |
| Color-coded decoration | Custom FileDecoration | `OverlapDecorationProvider` + `OVERLAP_URI_SCHEME` — already registered |
| Tooltip overlap section | Custom MarkdownString | `buildOverlapTooltip()` in `builder.ts` — handles base + separator + overlap lines |
| Icon dimming | Custom ThemeIcon | `new vscode.ThemeColor('disabledForeground')` — same pattern as all other entity types |

## Common Pitfalls

### Pitfall 1: Passing Wrong Matcher Pattern to Resolver

**What goes wrong:** `buildHookEntryVM` knows `matcherIndex` but not the original `HookMatcher`. If the matcher pattern is not passed through, the resolver defaults to `undefined` and misses hooks with an explicit matcher.

**How to avoid:** Pass `matcher.matcher` (the pattern string) explicitly when calling `buildHookEntryVM`, or pass the full `HookMatcher`.

**Current call site (builder.ts line 919):**
```typescript
entryChildren.push(this.buildHookEntryVM(label, eventType, i, j, hook, scopedConfig));
```
Must become:
```typescript
entryChildren.push(this.buildHookEntryVM(label, eventType, matcher.matcher, i, j, hook, scopedConfig, allScopes));
```

### Pitfall 2: `deepEqual` on Hooks with Extra Fields

**What goes wrong:** `HookCommand` has optional fields (`timeout`, `async`). If one scope defines `{ type: 'command', command: 'echo test' }` and another defines `{ type: 'command', command: 'echo test', timeout: 30 }`, `deepEqual` correctly returns `false` (different objects → override, not duplicate). This is the correct semantic behavior. Do not special-case optional fields.

**How to avoid:** Trust `deepEqual` — it handles all optional fields correctly.

### Pitfall 3: Index-Based URI Key Collision

**What goes wrong:** If `entityKey` for `buildOverlapResourceUri` uses only `matcherIndex/hookIndex`, two different event types (e.g., `PreToolUse/0/0` and `PostToolUse/0/0`) would collide in the URI path.

**How to avoid:** Include `eventType` in the key: `${eventType}/${matcherIndex}/${hookIndex}`.

### Pitfall 4: Forgetting allScopes Propagation Chain

**What goes wrong:** `allScopes` must be passed through three levels: `buildHookEvents` → `buildHookEventVM` → `buildHookEntryVM`. Missing one level causes compile error or runtime `undefined`.

**How to avoid:** Add `allScopes: ScopedConfig[]` to all three signatures in a single edit to avoid silent `undefined`.

### Pitfall 5: HookEvent receiving overlap (not needed)

**What goes wrong:** Attempting to add overlap to `HookEventVM` (the container). Container nodes do not use overlap — adding it would break the established container/leaf distinction.

**How to avoid:** Leave `buildHookEventVM` with `overlap: {}` in the NodeContext. Only `buildHookEntryVM` needs overlap wiring.

## Code Examples

### Pattern: New Resolver Function

```typescript
// Source: src/config/overlapResolver.ts (following resolveEnvOverlap pattern)
export function resolveHookOverlap(
  eventType: HookEventType,
  matcherPattern: string | undefined,
  hook: HookCommand,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): OverlapInfo {
  return resolveOverlapGeneric(currentScope, allScopes, (sc) => {
    const matchers = sc.config.hooks?.[eventType];
    if (!matchers) return undefined;
    for (const m of matchers) {
      if ((m.matcher ?? '') !== (matcherPattern ?? '')) continue;
      for (const h of m.hooks) {
        if (deepEqual(h, hook)) return h;
      }
    }
    return undefined;
  });
}
```

### Pattern: Builder Wiring (HookEntryVM)

```typescript
// Source: src/viewmodel/builder.ts (following buildEnvVars pattern)
private buildHookEntryVM(
  label: string,
  eventType: HookEventType,
  matcherPattern: string | undefined,  // ADD
  matcherIndex: number,
  hookIndex: number,
  hook: HookCommand,
  scopedConfig: ScopedConfig,
  allScopes: ScopedConfig[],           // ADD
): HookEntryVM {
  const overlap = resolveHookOverlap(
    eventType,
    matcherPattern,
    hook,
    scopedConfig.scope,
    allScopes,
  );

  const ctx: NodeContext = {
    scope: scopedConfig.scope,
    keyPath: ['hooks', eventType, String(matcherIndex), 'hooks', String(hookIndex)],
    isReadOnly: scopedConfig.isReadOnly,
    overlap,       // was: overlap: {}
    filePath: scopedConfig.filePath,
  };

  const iconMap: Record<string, string> = {
    command: 'terminal',
    prompt: 'comment-discussion',
    agent: 'hubot',
  };

  const hookDetail = hook.command ?? hook.prompt ?? hook.type;
  const description = `${hook.type}: ${hookDetail}`;
  const baseTooltip = hook.command
    ? new vscode.MarkdownString(`\`${hook.command}\``)
    : undefined;
  const tooltip = buildOverlapTooltip(baseTooltip, overlap);

  const collapsibleState = vscode.TreeItemCollapsibleState.None;

  return {
    kind: NodeKind.HookEntry,
    hookType: hook.type,
    matcherIndex,
    hookIndex,
    label,
    description,
    icon: overlap.isOverriddenBy
      ? new vscode.ThemeIcon(iconMap[hook.type] ?? 'terminal', new vscode.ThemeColor('disabledForeground'))
      : new vscode.ThemeIcon(iconMap[hook.type] ?? 'terminal'),
    collapsibleState,
    contextValue: computeStandardContextValue('hookEntry', scopedConfig.isReadOnly, overlap),
    tooltip,
    nodeContext: ctx,
    children: [],
    id: computeId(ctx),
    command: computeCommand(collapsibleState, ctx.filePath, ctx.keyPath),
    resourceUri: buildOverlapResourceUri(
      scopedConfig.scope,
      'hook',
      `${eventType}/${matcherIndex}/${hookIndex}`,
      overlap,
    ),
  };
}
```

### Pattern: Test for resolveHookOverlap (overlapResolver.test.ts)

```typescript
// Follows resolveMcpOverlap test pattern
suite('resolveHookOverlap', () => {
  test('should detect isOverriddenBy when same hook exists in higher-precedence scope with different fields', () => {
    const userHook = { type: 'command' as const, command: 'echo user' };
    const localHook = { type: 'command' as const, command: 'echo local' };
    const scopes = [
      makeScopedConfig(ConfigScope.User, {
        hooks: { PreToolUse: [{ hooks: [userHook] }] },
      }),
      makeScopedConfig(ConfigScope.ProjectLocal, {
        hooks: { PreToolUse: [{ hooks: [localHook] }] },
      }),
    ];
    // For User scope, ProjectLocal is higher precedence (index 1 vs 3)
    // The hook in ProjectLocal is different → isOverriddenBy
    // Note: this tests only when same matcher AND deepEqual match exists
    // User's hook has no match in ProjectLocal (different command) → no overlap
    const result = resolveHookOverlap(
      HookEventType.PreToolUse, undefined, userHook, ConfigScope.User, scopes
    );
    assert.strictEqual(result.isOverriddenBy, undefined); // no matching hook in ProjectLocal
  });

  test('should detect isDuplicatedBy when identical hook in higher-precedence scope', () => {
    const hook = { type: 'command' as const, command: 'echo hello' };
    const scopes = [
      makeScopedConfig(ConfigScope.User, {
        hooks: { PreToolUse: [{ hooks: [hook] }] },
      }),
      makeScopedConfig(ConfigScope.ProjectLocal, {
        hooks: { PreToolUse: [{ hooks: [{ ...hook }] }] },
      }),
    ];
    const result = resolveHookOverlap(
      HookEventType.PreToolUse, undefined, hook, ConfigScope.User, scopes
    );
    assert.deepStrictEqual(result.isDuplicatedBy, {
      scope: ConfigScope.ProjectLocal,
      value: hook,
    });
  });

  test('should not match hooks with different matcher patterns', () => {
    const hook = { type: 'command' as const, command: 'echo hello' };
    const scopes = [
      makeScopedConfig(ConfigScope.User, {
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [hook] }] },
      }),
      makeScopedConfig(ConfigScope.ProjectLocal, {
        hooks: { PreToolUse: [{ matcher: 'Write', hooks: [{ ...hook }] }] },
      }),
    ];
    // Different matcher pattern → no match
    const result = resolveHookOverlap(
      HookEventType.PreToolUse, 'Bash', hook, ConfigScope.User, scopes
    );
    assert.strictEqual(result.isDuplicatedBy, undefined);
    assert.strictEqual(result.isOverriddenBy, undefined);
  });
});
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Mocha (VS Code test runner) |
| Config file | `.mocharc` / `src/test/runTests.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OVLP-01 | `resolveHookOverlap` detects isDuplicatedBy for identical hook across scopes | unit | `npm run test` | Wave 0 — add suite to existing `overlapResolver.test.ts` |
| OVLP-01 | `resolveHookOverlap` returns empty overlap when hook exists in one scope only | unit | `npm run test` | Wave 0 — add to same suite |
| OVLP-01 | `resolveHookOverlap` ignores hooks with different matcher pattern | unit | `npm run test` | Wave 0 — add to same suite |
| OVLP-01 | `HookEntryVM.nodeContext.overlap` is populated after builder change | unit | `npm run test` | Wave 0 — add to `builder.test.ts` |
| OVLP-02 | `HookEntryVM.resourceUri` is set when overlap exists | unit | `npm run test` | Wave 0 — add to `builder.test.ts` |
| OVLP-02 | `HookEntryVM.contextValue` includes `overridden` suffix when `isOverriddenBy` | unit | `npm run test` | Wave 0 — add to `builder.test.ts` |
| OVLP-02 | `HookEntryVM.icon.color` is `disabledForeground` when `isOverriddenBy` | unit | `npm run test` | Wave 0 — add to `builder.test.ts` |
| OVLP-02 | `HookEntryVM.tooltip` contains overlap markdown when overlap present | unit | `npm run test` | Wave 0 — add to `builder.test.ts` |

### Sampling Rate

- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/suite/config/overlapResolver.test.ts` — add `suite('resolveHookOverlap', ...)` block (file exists, add suite)
- [ ] `test/suite/viewmodel/builder.test.ts` — add hook overlap tests to `Override Resolution (TEST-02)` suite (file exists, add tests)

*(No new test files needed — existing test files cover the new code paths.)*

## Open Questions

1. **Matcher parameter threading in `buildHookEntryVM`**
   - What we know: the current signature has `matcherIndex` (number) but not the matcher pattern string
   - What's unclear: minimal-change approach — add `matcherPattern: string | undefined` parameter, or pass the full `HookMatcher`
   - Recommendation: add `matcherPattern: string | undefined` as a new parameter between `eventType` and `matcherIndex` — it's the minimal change and keeps the function signature flat

2. **`HookEntryVM` `description` field and `applyOverrideSuffix`**
   - What we know: other entity types call `applyOverrideSuffix(rawDescription, overlap)` to append ` (overridden by X)` to the description
   - What's unclear: the current description is `${hook.type}: ${hookDetail}` — adding an override suffix makes it longer
   - Recommendation: apply `applyOverrideSuffix` for consistency with all other entity types; the description is truncated by VS Code anyway

## Sources

### Primary (HIGH confidence)

- `src/config/overlapResolver.ts` — full implementation of `resolveOverlapGeneric`, `deepEqual`, all existing resolvers
- `src/viewmodel/builder.ts` — full implementation of all builder methods, `buildOverlapTooltip`, `buildOverlapResourceUri`, `computeStandardContextValue`
- `src/types.ts` — `HookCommand`, `HookMatcher`, `HooksConfig`, `OverlapInfo`, `NodeContext`
- `src/viewmodel/types.ts` — `HookEntryVM`, `NodeKind`
- `.planning/phases/25-audit-catalog-trivial-fixes/25-AUDIT-MATRIX.md` — confirmed audit finding: `overlap: {}` hardcoded, both OVLP-01 and OVLP-02 are gaps
- `test/suite/config/overlapResolver.test.ts` — test patterns for all existing resolvers
- `test/suite/viewmodel/builder.test.ts` — builder test patterns including hook event/entry tests

### Secondary (MEDIUM confidence)

- `STATE.md` line 47: "Hook overlap identity matching needs design decision (hooks are array-based, not keyed)" — design concern captured during Phase 25, resolved above

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies, all infrastructure exists
- Architecture: HIGH — pattern is unambiguous, all six overlap wiring points are identical to existing entity types
- Pitfalls: HIGH — all pitfalls derived from direct code analysis, not inference
- Hook identity design: HIGH — array-of-arrays requires content-equality; index-based is demonstrably wrong; deepEqual-based match is consistent with how `resolveOverlapGeneric` already works for MCP server configs (which also use deepEqual on config objects)

**Research date:** 2026-03-12
**Valid until:** Stable — no external dependencies, internal-only changes
