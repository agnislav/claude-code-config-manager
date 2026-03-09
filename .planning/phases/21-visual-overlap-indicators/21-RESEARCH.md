# Phase 21: Visual Overlap Indicators - Research

**Researched:** 2026-03-09
**Domain:** VS Code TreeView FileDecorationProvider, MarkdownString tooltips, cross-scope overlap detection
**Confidence:** HIGH

## Summary

Phase 21 introduces a new overlap detection system that replaces the existing override system (`isOverridden`/`overriddenByScope`). The new model uses four directional fields (`overrides`, `isOverriddenBy`, `duplicates`, `isDuplicatedBy`) that distinguish between value-differing overrides and same-value duplicates. Visual indicators include FileDecoration color tinting (red/green/yellow) and MarkdownString tooltips showing overlap relationships.

The existing codebase already has two FileDecorationProvider implementations (PluginDecorationProvider and LockDecorationProvider) that establish the pattern. The override system is well-isolated: `isOverridden`/`overriddenByScope` are consumed only in `builder.ts`, `types.ts`, `overrideResolver.ts`, and `builder.test.ts` -- no commands or tree nodes read them directly. This makes migration safe.

**Primary recommendation:** Create a new `overlapResolver.ts` module that returns the four directional fields per entity, then migrate `builder.ts` to consume overlap data instead of old override data, add an `OverlapDecorationProvider` using `resourceUri` with query-encoded overlap state, and update tooltips with MarkdownString overlap content.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Terminology**: Overlap (umbrella), Override (values differ), Duplicate (values same)
- **State model**: 4 directional fields: `overrides`, `isOverriddenBy`, `duplicates`, `isDuplicatedBy` -- nearest-neighbor only, each points to at most one item
- **Color tinting**: FileDecorationProvider with color-only approach (no badges, no description text for overlap). Priority: isOverriddenBy/isDuplicatedBy = Red, overrides = Green, duplicates = Yellow/amber
- **Tooltip format**: Overlap info appended below existing tooltip with separator. Format: icon + bold relationship + scope + value + effective status. Uses MarkdownString.
- **Override migration**: Fully migrate from old `isOverridden`/`overriddenByScope` to new overlap fields. Single source of truth.
- **Entity coverage**: All 5 types (settings, env vars, plugins, MCP servers, sandbox properties)
- **Value comparison**: Deep equality for override vs duplicate determination
- **Gray avoided**: Already used for plugin dimming (disabled state)

### Claude's Discretion
- Exact FileDecoration theme color tokens for red/green/yellow
- Internal structure of the overlap resolver (new module or extension of overrideResolver)
- How overlap data flows through ViewModel types (new fields on BaseVM, NodeContext, or separate)
- Test strategy and mock patterns for overlap scenarios

### Deferred Ideas (OUT OF SCOPE)
- OVLP-03: Description text showing "also in [Scope]" on tree item
- OVLP-04: FileDecoration badge ("2x") for entities in multiple scopes

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OVLP-01 | User sees tooltip listing all scopes where a config entity also appears, showing each scope's value and override status | Overlap resolver computes directional fields; builder appends MarkdownString tooltip with scope/value/status per overlap relationship |
| OVLP-02 | Overlap detection works independently from override detection (new fields, not reusing isOverridden) | New overlap resolver with 4 new fields replaces old `isOverridden`/`overriddenByScope`; old fields removed from NodeContext and ResolvedValue |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vscode (API) | ^1.85.0 | FileDecorationProvider, MarkdownString, ThemeColor, Uri | Extension host API -- only option |

### Supporting
No additional libraries needed. All functionality uses built-in VS Code API and Node.js JSON.stringify for deep equality.

## Architecture Patterns

### New Module: Overlap Resolver

**Recommendation:** Create a new `src/config/overlapResolver.ts` rather than extending the existing `overrideResolver.ts`. Rationale:
- The old resolver returns `{ isOverridden, overriddenByScope }` -- a fundamentally different shape from the new 4-field model
- The old resolver will be deleted after migration is complete
- Clean separation makes it easier to test the new logic independently

### Overlap Data Type

```typescript
// Source: CONTEXT.md decisions
export interface OverlapItem {
  scope: ConfigScope;
  value: unknown;
}

export interface OverlapInfo {
  overrides?: OverlapItem;        // I win, values differ (nearest lower-precedence)
  isOverriddenBy?: OverlapItem;   // I lose, values differ (nearest higher-precedence)
  duplicates?: OverlapItem;       // I win, values same (nearest lower-precedence)
  isDuplicatedBy?: OverlapItem;   // I lose, values same (nearest higher-precedence)
}
```

### Flow: Where Overlap Data Lives

**Recommendation:** Add overlap fields to `NodeContext` (replacing `isOverridden`/`overriddenByScope`). This is the simplest migration path since NodeContext already carries scope metadata through the tree.

```typescript
// Updated NodeContext
export interface NodeContext {
  scope: ConfigScope;
  section?: SectionType;
  keyPath: string[];
  isReadOnly: boolean;
  // OLD: isOverridden, overriddenByScope -- REMOVED
  overlap: OverlapInfo;           // NEW: replaces old override fields
  workspaceFolderUri?: string;
  filePath?: string;
}
```

### FileDecoration: OverlapDecorationProvider

**Pattern:** Follow the established PluginDecorationProvider/LockDecorationProvider pattern. Each entity that can overlap gets a `resourceUri` with a dedicated scheme and query-encoded overlap state.

```typescript
export const OVERLAP_URI_SCHEME = 'claude-config-overlap';

// URI construction in builder:
resourceUri: vscode.Uri.from({
  scheme: OVERLAP_URI_SCHEME,
  path: `/${scope}/${entityType}/${entityKey}`,
  query: overlapColorState, // 'red' | 'green' | 'yellow' | 'none'
})
```

### Recommended Theme Color Tokens

Based on the git diff metaphor decided by the user:

| Overlap State | Color | Recommended Token | Rationale |
|---------------|-------|-------------------|-----------|
| `isOverriddenBy` or `isDuplicatedBy` (red) | Red/shadowed | `gitDecoration.deletedResourceForeground` | Git deleted = removed/losing, consistent metaphor |
| `overrides` (green) | Green/winning | `gitDecoration.addedResourceForeground` | Git added = new/winning value |
| `duplicates` (yellow) | Yellow/amber | `editorWarning.foreground` | Warning = harmless but worth noting |

**Confidence: HIGH** -- These are standard VS Code theme tokens present in all themes. `gitDecoration.deletedResourceForeground` renders as red, `gitDecoration.addedResourceForeground` as green, and `editorWarning.foreground` as yellow/amber across all default themes.

### Recommended Project Structure Changes

```
src/config/
├── overlapResolver.ts     # NEW: 4-field overlap detection
├── overrideResolver.ts    # DELETED after migration (or kept temporarily)
├── configDiscovery.ts     # unchanged
├── configLoader.ts        # unchanged
├── configModel.ts         # unchanged
└── configWriter.ts        # unchanged
src/tree/
├── overlapDecorations.ts  # NEW: OverlapDecorationProvider
├── lockDecorations.ts     # unchanged
└── nodes/                 # unchanged (BaseNode reads from VM)
```

### Pattern: Overlap Resolution Algorithm

For each entity in a given scope, find nearest neighbors in both directions:

```typescript
function resolveOverlap(
  entityKey: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
  getValueFn: (sc: ScopedConfig) => unknown | undefined,
): OverlapInfo {
  const currentValue = getValueFn(allScopes.find(s => s.scope === currentScope)!);
  if (currentValue === undefined) return {};

  const currentPrecedence = SCOPE_PRECEDENCE.indexOf(currentScope);
  const result: OverlapInfo = {};

  // Find nearest higher-precedence neighbor (lower index)
  for (const sc of allScopes) {
    const p = SCOPE_PRECEDENCE.indexOf(sc.scope);
    if (p >= currentPrecedence) continue;
    const otherValue = getValueFn(sc);
    if (otherValue === undefined) continue;

    const item = { scope: sc.scope, value: otherValue };
    if (deepEqual(currentValue, otherValue)) {
      result.isDuplicatedBy = item;
    } else {
      result.isOverriddenBy = item;
    }
    break; // nearest only
  }

  // Find nearest lower-precedence neighbor (higher index)
  for (const sc of allScopes) {
    const p = SCOPE_PRECEDENCE.indexOf(sc.scope);
    if (p <= currentPrecedence) continue;
    const otherValue = getValueFn(sc);
    if (otherValue === undefined) continue;

    const item = { scope: sc.scope, value: otherValue };
    if (deepEqual(currentValue, otherValue)) {
      result.duplicates = item;
    } else {
      result.overrides = item;
    }
    break; // nearest only
  }

  return result;
}
```

**Key insight:** The algorithm iterates `allScopes` sorted by SCOPE_PRECEDENCE. For "higher precedence" neighbors, walk from the highest precedence toward `currentScope`; for "lower precedence", walk from `currentScope` toward the lowest. Take the first match in each direction (nearest-neighbor).

### Pattern: Tooltip Construction

```typescript
function buildOverlapTooltip(
  existingTooltip: string | vscode.MarkdownString | undefined,
  overlap: OverlapInfo,
): string | vscode.MarkdownString | undefined {
  const lines: string[] = [];

  if (overlap.isOverriddenBy) {
    lines.push(`$(arrow-down) **Overridden by** ${SCOPE_LABELS[overlap.isOverriddenBy.scope]}: \`${formatValue(overlap.isOverriddenBy.value)}\` (effective)`);
  }
  if (overlap.isDuplicatedBy) {
    lines.push(`$(arrow-down) **Duplicated by** ${SCOPE_LABELS[overlap.isDuplicatedBy.scope]}: \`${formatValue(overlap.isDuplicatedBy.value)}\` (effective)`);
  }
  if (overlap.overrides) {
    lines.push(`$(arrow-up) **Overrides** ${SCOPE_LABELS[overlap.overrides.scope]}: \`${formatValue(overlap.overrides.value)}\``);
  }
  if (overlap.duplicates) {
    lines.push(`$(arrow-up) **Duplicates** ${SCOPE_LABELS[overlap.duplicates.scope]}: \`${formatValue(overlap.duplicates.value)}\``);
  }

  if (lines.length === 0) return existingTooltip;

  // Append to existing tooltip with separator
  const overlapSection = lines.join('\n\n');
  if (existingTooltip instanceof vscode.MarkdownString) {
    return new vscode.MarkdownString(existingTooltip.value + '\n\n---\n\n' + overlapSection);
  }
  if (typeof existingTooltip === 'string') {
    return new vscode.MarkdownString(existingTooltip + '\n\n---\n\n' + overlapSection);
  }
  return new vscode.MarkdownString(overlapSection);
}
```

### Anti-Patterns to Avoid
- **Reusing `isOverridden` for overlap:** Violates OVLP-02. The new model must use entirely separate fields.
- **Storing overlap in description text:** The CONTEXT.md explicitly says "no description text changes for overlap" and STATE.md warns "`node.description` used for edit pre-fill -- overlap text must stay in tooltips only."
- **Using badge property on FileDecoration:** Deferred to OVLP-04. This phase is color-only.
- **Using arrays in overlap fields:** Nearest-neighbor only -- each field points to at most one item.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep equality comparison | Custom recursive comparison | `JSON.stringify(a) === JSON.stringify(b)` | Sufficient for config values (small, serializable). Key ordering consistent since values come from same JSON parser. If needed, sort keys first. |
| Theme colors | Custom hex colors | `new vscode.ThemeColor('gitDecoration.deletedResourceForeground')` | Adapts to user's theme automatically |
| Markdown tooltip | Custom HTML | `vscode.MarkdownString` with codicon support | Built-in VS Code API with icon support |

## Common Pitfalls

### Pitfall 1: resourceUri Conflicts Between Decoration Providers
**What goes wrong:** Multiple FileDecorationProviders all respond to the same URI, causing unexpected color mixing.
**Why it happens:** Each provider calls `provideFileDecoration` for every URI. If the overlap scheme collides with plugin or lock schemes, unexpected decorations appear.
**How to avoid:** Use a unique URI scheme (`claude-config-overlap`) distinct from `claude-config-plugin` and `claude-config-lock`. Each provider checks `uri.scheme` first and returns `undefined` for non-matching schemes.
**Warning signs:** Tree items showing wrong colors, especially plugins showing overlap colors instead of disabled dimming.

### Pitfall 2: MCP Servers Currently Have No Override Resolution
**What goes wrong:** `buildMcpServers()` currently doesn't pass `allScopes` and always sets `isOverridden: false`.
**Why it happens:** MCP servers are loaded from separate `.mcp.json` files, and cross-scope resolution was never implemented for them.
**How to avoid:** The overlap resolver needs a dedicated `resolveMcpOverlap` function that checks `mcpConfig.mcpServers` across scopes. The value getter for MCP servers must access `sc.mcpConfig?.mcpServers?.[name]` not `sc.config`.
**Warning signs:** MCP servers never showing overlap colors even when defined in multiple scopes.

### Pitfall 3: Permission Overlap is Category-Sensitive
**What goes wrong:** Treating permission rules as simple key-based overlap misses the semantic: a rule in `allow` conflicting with the same rule in `deny` is an override (different category), not a duplicate.
**Why it happens:** Permission overlap uses glob matching (`rulesOverlap()`) across categories, not exact key matching.
**How to avoid:** For permissions, the "value" for deep equality comparison should include the category. Two rules with the same pattern but different categories are overrides, not duplicates.
**Warning signs:** Permission rules showing "duplicate" colors when they're actually overridden by a different category.

### Pitfall 4: JSON.stringify Key Ordering for Deep Equality
**What goes wrong:** `JSON.stringify({a:1, b:2}) !== JSON.stringify({b:2, a:1})` -- objects with same properties in different order compare as unequal.
**Why it happens:** JSON.stringify preserves insertion order.
**How to avoid:** For simple scalar values (strings, booleans, numbers), direct `===` comparison suffices. For objects/arrays (MCP server configs, sandbox network config), use a deterministic stringify with sorted keys: `JSON.stringify(val, Object.keys(val).sort())` or a proper deep-equal utility.
**Warning signs:** Entities showing as "override" (green) when they're actually identical (should be yellow).

### Pitfall 5: NodeContext.isOverridden Removal Breaks Tests
**What goes wrong:** Existing `builder.test.ts` has 8+ assertions on `nodeContext.isOverridden` and `nodeContext.overriddenByScope`.
**Why it happens:** Tests directly assert on old field names.
**How to avoid:** Update tests to assert on `nodeContext.overlap.isOverriddenBy` (etc.) instead. This is a mechanical migration.
**Warning signs:** Test compilation errors after removing old fields.

### Pitfall 6: contextValue '.overridden' Suffix Must Still Work
**What goes wrong:** `computeStandardContextValue` appends `.overridden` when `isOverridden` is true. If this suffix is removed, menu visibility might break.
**Why it happens:** `package.json` `when` clauses may use regex matching on contextValue.
**How to avoid:** Verified: `package.json` has NO `when` clauses matching `.overridden`. The suffix is generated but never consumed for menu visibility. It can be safely replaced with overlap-derived logic. The `computeStandardContextValue` function should derive overridden status from `overlap.isOverriddenBy !== undefined`.
**Warning signs:** Context menu items disappearing after migration. (Low risk given verification above.)

## Code Examples

### Deep Equal Utility

```typescript
// Simple deterministic deep equality for config values
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  const aStr = JSON.stringify(a, (_, v) =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([k1], [k2]) => k1.localeCompare(k2)))
      : v
  );
  const bStr = JSON.stringify(b, (_, v) =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([k1], [k2]) => k1.localeCompare(k2)))
      : v
  );
  return aStr === bStr;
}
```

### OverlapDecorationProvider

```typescript
// Source: follows established PluginDecorationProvider pattern
import * as vscode from 'vscode';

export const OVERLAP_URI_SCHEME = 'claude-config-overlap';

export class OverlapDecorationProvider implements vscode.FileDecorationProvider {
  readonly onDidChangeFileDecorations = undefined;

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== OVERLAP_URI_SCHEME) return undefined;

    switch (uri.query) {
      case 'red':
        return { color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground') };
      case 'green':
        return { color: new vscode.ThemeColor('gitDecoration.addedResourceForeground') };
      case 'yellow':
        return { color: new vscode.ThemeColor('editorWarning.foreground') };
      default:
        return undefined;
    }
  }
}
```

### Overlap Color Determination

```typescript
function getOverlapColor(overlap: OverlapInfo): string {
  // Priority order from CONTEXT.md
  if (overlap.isOverriddenBy || overlap.isDuplicatedBy) return 'red';
  if (overlap.overrides) return 'green';
  if (overlap.duplicates) return 'yellow';
  return 'none';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `isOverridden: boolean` + `overriddenByScope?: ConfigScope` | `overlap: OverlapInfo` with 4 directional fields | Phase 21 | Richer overlap model distinguishing override vs duplicate |
| `computeOverrideTooltip()` | `buildOverlapTooltip()` with MarkdownString append | Phase 21 | Tooltip shows all overlap relationships, not just "overridden by X" |
| `applyOverrideSuffix()` | Derives description suffix from `overlap.isOverriddenBy` | Phase 21 | Same visual behavior, different data source |
| No MCP server overlap detection | Full overlap detection for MCP servers | Phase 21 | MCP servers now show overlap like all other entity types |
| `disabledForeground` ThemeColor for overridden items | Git-themed colors (red/green/yellow) via FileDecoration | Phase 21 | More expressive visual feedback |

## Migration Impact Analysis

### Files to Modify

| File | Change | Risk |
|------|--------|------|
| `src/types.ts` | Replace `isOverridden`/`overriddenByScope` in NodeContext and ResolvedValue with `OverlapInfo` | LOW -- well-isolated |
| `src/config/overrideResolver.ts` | Delete entirely (replaced by overlapResolver.ts) | LOW -- only consumed by builder.ts |
| `src/viewmodel/builder.ts` | Replace all override resolution calls with overlap resolution; update tooltip/description/icon/contextValue logic | MEDIUM -- largest change, many methods |
| `src/viewmodel/types.ts` | No change needed (BaseVM.nodeContext already carries NodeContext) | NONE |
| `src/tree/nodes/baseNode.ts` | No change needed (reads VM fields transparently) | NONE |
| `src/extension.ts` | Register OverlapDecorationProvider | LOW -- follows existing pattern |
| `test/suite/viewmodel/builder.test.ts` | Update assertions from `isOverridden` to `overlap.isOverriddenBy` | LOW -- mechanical |

### Files to Create

| File | Purpose |
|------|---------|
| `src/config/overlapResolver.ts` | New overlap resolution logic |
| `src/tree/overlapDecorations.ts` | OverlapDecorationProvider |

### Consumer Impact

- **Commands** (`src/commands/*`): Do NOT read `isOverridden` -- no changes needed
- **Tree nodes** (`src/tree/nodes/*`): Do NOT read `isOverridden` directly -- no changes needed
- **package.json `when` clauses**: Do NOT match `.overridden` pattern -- no changes needed

## Open Questions

1. **Permission overlap with glob matching**
   - What we know: Current `resolvePermissionOverride` uses `rulesOverlap()` for glob pattern matching across categories
   - What's unclear: Should permission overlap use the same glob matching, or exact string matching for the "same entity" check?
   - Recommendation: Keep glob matching for permission overlap (consistency with existing behavior). The category difference determines override vs non-conflict, and the glob overlap determines if two rules interact at all.

2. **MCP server value comparison**
   - What we know: MCP servers have complex configs (stdio with args/env, or SSE with URL/headers)
   - What's unclear: Is the entire config object the "value" for deep comparison?
   - Recommendation: Use the full config object. Two MCP servers with same name but different commands are overrides; same name and identical config are duplicates.

3. **resourceUri conflicts with existing PluginNode resourceUri**
   - What we know: PluginNode already sets `resourceUri` for the plugin decoration scheme. Each TreeItem can only have one `resourceUri`.
   - What's unclear: How to apply both plugin disabled dimming AND overlap coloring.
   - Recommendation: Overlap color takes precedence since it provides more information. Alternatively, combine both states into a single URI scheme, or use the overlap color for plugins that have overlap and the plugin disabled color only for non-overlapping disabled plugins. This needs careful design in the planning phase.

## Sources

### Primary (HIGH confidence)
- VS Code Theme Color reference: https://code.visualstudio.com/api/references/theme-color -- verified git decoration and warning color tokens
- Codebase analysis: `src/config/overrideResolver.ts`, `src/viewmodel/builder.ts`, `src/types.ts`, `src/tree/nodes/pluginNode.ts`, `src/tree/lockDecorations.ts` -- current override system, FileDecoration patterns
- CONTEXT.md decisions -- locked implementation choices

### Secondary (MEDIUM confidence)
- VS Code FileDecorationProvider API -- verified through existing codebase implementations (PluginDecorationProvider, LockDecorationProvider)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- using only built-in VS Code API, no external dependencies
- Architecture: HIGH -- extending established patterns (FileDecorationProvider, MarkdownString tooltips, NodeContext), migration path is clear and well-isolated
- Pitfalls: HIGH -- identified through direct codebase analysis (MCP server gap, permission category semantics, resourceUri conflict, test migration)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- VS Code API changes infrequently)
