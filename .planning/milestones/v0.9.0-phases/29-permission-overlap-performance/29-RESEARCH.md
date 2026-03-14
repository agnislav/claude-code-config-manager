# Phase 29: Permission Overlap Performance - Research

**Researched:** 2026-03-13
**Domain:** Algorithm optimization — permission overlap resolution in TypeScript/VS Code extension
**Confidence:** HIGH

## Summary

Phase 29 replaces a per-rule O(R²) overlap resolution algorithm with a batch-indexed algorithm. The
current implementation calls `resolvePermissionOverlap()` once per rule per scope during tree build.
Each call scans all other scopes, then within each scope scans all rules across all three categories
(allow/deny/ask) calling `rulesOverlap()` for every pair. With 140+ rules per scope and 4 scopes, the
worst case is approximately 140 × 4 × 3 × 140 = ~235,000 `rulesOverlap()` calls per tree build.
Each `rulesOverlap()` call parses both rules with a regex and may compile a new `RegExp` object for
wildcard matching.

The fix is a single-pass batch resolver: parse every rule once (keyed by tool name), then for each
(scope × rule) pair, check only the rules in other scopes that share the same tool name. A compiled
`RegExp` cache eliminates redundant re-compilation. The result is O(R×G) where G is average group
size per tool name — far below O(R²) in practice because most rules reference different tools.

**Primary recommendation:** Implement `computePermissionOverlapMap()` — a batch function that
accepts all scopes and returns `Map<string, OverlapInfo>` keyed by a canonical rule identity string
`${scope}/${category}/${rule}`. The builder calls this once per scope build and looks up each rule's
`OverlapInfo` from the map instead of calling `resolvePermissionOverlap()` per rule.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 | Pre-index rules by tool name, cache parsed results, and compute all overlaps in a single pass | Batch resolver function pre-indexes `ParsedPermissionRule` objects by tool name; one pass populates the entire `OverlapInfo` map for all rules across all scopes |
| PERF-02 | Eliminate redundant RegExp compilations and unnecessary cross-tool comparisons | `wildcardMatch` currently compiles `new RegExp(...)` on every call; a module-level `Map<string, RegExp>` cache eliminates re-compilation; tool-name indexing eliminates cross-tool pairs entirely |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (built-in) | 5.x (project-level) | Batch resolver, RegExp cache, index structures | Already the project language; no new dependency |
| Node.js `Map` | n/a | O(1) lookup cache for parsed rules and compiled RegExp | Native; no import needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Mocha (existing) | project-level | Run regression tests that must pass unchanged | All existing `overlapResolver.test.ts` tests must stay green |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Module-level RegExp cache (`Map<string, RegExp>`) | LRU cache library | LRU adds a dependency; the specifier space is bounded by real config files — plain `Map` is sufficient |
| Batch map returned from builder | Memoizing individual `resolvePermissionOverlap` calls with a WeakMap/closure | Per-call memoization still has O(R²) structure for first call; batch is fundamentally better and cleaner |

**Installation:**
No new packages. Pure TypeScript refactoring inside existing source files.

## Architecture Patterns

### Recommended Project Structure

No new files required. Changes are confined to:

```
src/
├── utils/
│   └── permissions.ts       # Add RegExp cache; parsePermissionRule becomes cached
├── config/
│   └── overlapResolver.ts   # Add computePermissionOverlapMap(); keep resolvePermissionOverlap() for backward compat (or internal use)
└── viewmodel/
    └── builder.ts           # buildPermissionRules() calls computePermissionOverlapMap() once, then looks up each rule
```

### Pattern 1: Tool-Name Index for Cross-Scope Lookups

**What:** Pre-group all permission rules (across all scopes and categories) by `parsed.tool`. When
resolving overlaps for rule R in scope S, only compare against rules in the same tool group.

**When to use:** Any time the comparison predicate requires a "same tool" precondition before
proceeding to wildcard matching — which is exactly `rulesOverlap()`'s first check.

**Example:**
```typescript
// Source: analysis of src/utils/permissions.ts rulesOverlap()
// rulesOverlap() returns false immediately when tool names differ — so we never need to compare cross-tool rules

type RuleEntry = { scope: ConfigScope; category: PermissionCategory; rule: string; parsed: ParsedPermissionRule };

function buildToolIndex(allScopes: ScopedConfig[]): Map<string, RuleEntry[]> {
  const index = new Map<string, RuleEntry[]>();
  for (const sc of allScopes) {
    if (!sc.config.permissions) continue;
    for (const category of [PermissionCategory.Allow, PermissionCategory.Ask, PermissionCategory.Deny] as const) {
      for (const rule of sc.config.permissions[category] ?? []) {
        const parsed = getCachedParse(rule);          // cache hit after first parse
        const bucket = index.get(parsed.tool) ?? [];
        bucket.push({ scope: sc.scope, category, rule, parsed });
        index.set(parsed.tool, bucket);
      }
    }
  }
  return index;
}
```

### Pattern 2: RegExp Compilation Cache

**What:** Hoist the `RegExp` construction in `wildcardMatch()` behind a module-level `Map<string, RegExp>`.
The pattern string (after escaping) is the cache key.

**When to use:** Any time the same specifier appears in multiple rules (common: `*`, `npm run *`,
`/path/*`).

**Example:**
```typescript
// Source: analysis of src/utils/permissions.ts wildcardMatch()
const _regexpCache = new Map<string, RegExp>();

function wildcardMatch(pattern: string, text: string): boolean {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*');
  let re = _regexpCache.get(escaped);
  if (!re) {
    try { re = new RegExp(`^${escaped}$`); } catch { return false; }
    _regexpCache.set(escaped, re);
  }
  return re.test(text);
}
```

### Pattern 3: Batch OverlapInfo Map

**What:** `computePermissionOverlapMap()` returns a `Map<string, OverlapInfo & { overriddenByCategory?: string }>`.
The key is `${scope}/${category}/${rule}` — exactly the same triple used by `buildPermissionRule()`.
The builder calls it once at the top of `buildPermissionRules()` and replaces the per-rule
`resolvePermissionOverlap()` call with a map lookup.

**When to use:** Whenever building the full permission section for any scope.

**Example (interface sketch):**
```typescript
// computePermissionOverlapMap returns OverlapInfo for every (scope, category, rule) triple
export function computePermissionOverlapMap(
  allScopes: ScopedConfig[],
): Map<string, OverlapInfo & { overriddenByCategory?: string }> {
  const toolIndex = buildToolIndex(allScopes);
  const result = new Map<string, OverlapInfo & { overriddenByCategory?: string }>();

  for (const [, bucket] of toolIndex) {
    // bucket = all rules with the same tool, across all scopes/categories
    for (const entry of bucket) {
      const key = `${entry.scope}/${entry.category}/${entry.rule}`;
      result.set(key, resolveOverlapForEntry(entry, bucket));
    }
  }
  return result;
}
```

**Builder usage:**
```typescript
private buildPermissionRules(scopedConfig: ScopedConfig, allScopes: ScopedConfig[]): PermissionRuleVM[] {
  const overlapMap = computePermissionOverlapMap(allScopes);  // single call
  const perms = scopedConfig.config.permissions;
  if (!perms) return [];

  const result: PermissionRuleVM[] = [];
  for (const category of ['allow', 'ask', 'deny'] as const) {
    const seen = new Set<string>();
    for (const rule of perms[category] ?? []) {
      if (seen.has(rule)) continue;
      seen.add(rule);
      const key = `${scopedConfig.scope}/${category}/${rule}`;
      const overlap = overlapMap.get(key) ?? {};
      result.push(this.buildPermissionRuleFromOverlap(rule, category, overlap, scopedConfig));
    }
  }
  return result;
}
```

### Anti-Patterns to Avoid

- **Per-rule resolvePermissionOverlap calls inside loops:** The current pattern calls a function that
  internally re-sorts and re-iterates `allScopes` for every rule. At 140 rules × 4 scopes = 560
  calls, each doing 3× inner category iterations with regex parsing, this is the bottleneck.
- **Keeping `new RegExp()` inside `wildcardMatch()`:** Without caching, identical patterns (e.g.,
  `.*` from `*`) are recompiled hundreds of times per build cycle.
- **Moving `computePermissionOverlapMap` into `buildPermissionRules` loop body:** The batch map must
  be computed once per `buildPermissionRules` call, not once per rule iteration.
- **Changing the public signature of `resolvePermissionOverlap`:** Existing tests import and call it
  directly. It must remain unchanged (or be kept as a thin wrapper around the new internals) so the
  test suite passes without modification.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Memoization framework | Custom memo decorator | Module-level `Map` | No runtime dep needed; bounded key space |
| Glob matching library | Custom glob engine | Existing `wildcardMatch` (cached) | Already correct; only RegExp reuse is missing |
| LRU eviction | Size-limited cache | Unbounded `Map` | Rule sets are bounded by real config file sizes; no eviction needed in practice |

**Key insight:** The performance problem is algorithmic (O(R²) comparisons) and implementation-level
(redundant RegExp compilation). Neither requires new libraries. The fix is purely structural.

## Common Pitfalls

### Pitfall 1: Breaking the Public API of resolvePermissionOverlap

**What goes wrong:** Tests in `overlapResolver.test.ts` directly import and invoke
`resolvePermissionOverlap()`. If the function signature or behavior changes, ~8 tests fail.

**Why it happens:** Refactoring internals into a batch function is tempting to also change the
public function.

**How to avoid:** Keep `resolvePermissionOverlap()` unchanged. The batch function
`computePermissionOverlapMap()` is a new addition that calls the same internal logic, or shares
helper functions with it.

**Warning signs:** Any edit to `resolvePermissionOverlap`'s export signature or return shape.

### Pitfall 2: Map Key Collision

**What goes wrong:** Two different rules with the same (scope, category, rule) string produce the
same map key and one entry overwrites the other.

**Why it happens:** The key format must be collision-resistant. Using just `rule` as the key
ignores scope and category.

**How to avoid:** Key format must be `${scope}/${category}/${rule}`. The existing
`buildPermissionRule()` method already constructs `ctx.keyPath = ['permissions', category, rule]`
— so `${scope}/${category}/${rule}` is the natural canonical identity.

**Warning signs:** Test failures on the "same rule in different categories" test case.

### Pitfall 3: computePermissionOverlapMap Called Once Per Rule Instead of Once Per Section

**What goes wrong:** If `computePermissionOverlapMap(allScopes)` is called inside the per-rule
loop body, the O(R) improvement is lost. The map itself is O(R) to build; calling it R times is
O(R²) again.

**Why it happens:** Refactoring incrementally without checking call site placement.

**How to avoid:** Call `computePermissionOverlapMap` exactly once at the start of
`buildPermissionRules`, before the category/rule loops.

**Warning signs:** Performance unchanged after refactor.

### Pitfall 4: RegExp Cache Growing Unboundedly Across Test Runs

**What goes wrong:** Module-level `Map` persists across Mocha test cases in the same process.
If tests modify the cache state, later tests may see stale entries.

**Why it happens:** Module-level singletons survive test isolation boundaries.

**How to avoid:** RegExp compilation is deterministic (same pattern → same RegExp behavior),
so cache persistence across tests is safe. The concern is only if tests deliberately inject
malformed patterns expecting `catch` behavior — verify the existing `wildcardMatch` tests still
pass.

**Warning signs:** `try/catch` path in `wildcardMatch` no longer exercised (if tests check it).

### Pitfall 5: Cross-Tool Comparison Still Occurring

**What goes wrong:** If the tool-name index is built incorrectly (e.g., case-folding mismatch,
wrong key extraction), rules that should be in separate buckets end up together — causing extra
comparisons and potentially false overlap detections.

**Why it happens:** Tool names are case-sensitive in `rulesOverlap()` (`a.tool !== b.tool` uses
strict equality). The index must use the same extracted `tool` string.

**How to avoid:** Use `parsePermissionRule(rule).tool` as the index key without any
transformation (no `.toLowerCase()`, no trimming beyond what the regex already does).

**Warning signs:** False positive overlaps between `Bash` and `bash` rules.

## Code Examples

Verified patterns from source code analysis:

### Current Per-Rule Call Site (to be replaced)
```typescript
// Source: src/viewmodel/builder.ts buildPermissionRule() line 466
const overlap = resolvePermissionOverlap(category, rule, scopedConfig.scope, allScopes);
```

### Current resolvePermissionOverlap Inner Structure (complexity source)
```typescript
// Source: src/config/overlapResolver.ts lines 227-317
// For each rule: sorts allScopes, then scans each scope's categories, calling rulesOverlap per pair
// rulesOverlap: calls parsePermissionRule twice + potentially new RegExp(...)
```

### Current wildcardMatch — Where RegExp Is Allocated
```typescript
// Source: src/utils/permissions.ts lines 60-67
function wildcardMatch(pattern: string, text: string): boolean {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*');
  try {
    return new RegExp(`^${escaped}$`).test(text);  // new RegExp every call
  } catch {
    return false;
  }
}
```

### Lookup Pattern in Builder (after refactor)
```typescript
// Builder buildPermissionRules() — call map once, then look up
const overlapMap = computePermissionOverlapMap(allScopes);
const key = `${scopedConfig.scope}/${category}/${rule}`;
const overlap = overlapMap.get(key) ?? {};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| O(R²) per-rule resolve | Batch indexed O(R×G) | Phase 29 | Eliminates perceptible hang at 140+ rules |
| `new RegExp()` per wildcard call | Module-level `Map<string, RegExp>` cache | Phase 29 | Eliminates repeated compilation for common patterns |

**Deprecated/outdated after this phase:**
- Per-rule `resolvePermissionOverlap()` call in `buildPermissionRules()`: replaced by map lookup.
- Uncached `wildcardMatch()`: replaced by cached version.

## Open Questions

1. **Should `resolvePermissionOverlap` remain exported after the refactor?**
   - What we know: It is imported and tested directly in `overlapResolver.test.ts`
   - What's unclear: Whether the planner should keep it as a thin delegating wrapper or leave it
     fully intact alongside the new batch function
   - Recommendation: Keep it fully intact; do not remove or delegate — lowest regression risk

2. **Should `computePermissionOverlapMap` live in `overlapResolver.ts` or a new file?**
   - What we know: All other overlap logic lives in `overlapResolver.ts`; the project convention is
     to keep related logic co-located
   - Recommendation: Add it to `overlapResolver.ts` as a new export alongside the existing
     per-entity resolvers

3. **Is `allScopes` re-passed per scope in `buildPermissionRules` or is there a global context?**
   - What we know: `buildPermissionRules(scopedConfig, allScopes)` receives `allScopes` — the full
     set across all scopes — every time; the batch map computation uses `allScopes` not just the
     current scope's rules
   - Recommendation: This is already correct; `computePermissionOverlapMap(allScopes)` covers all
     scopes in one call, making the result correct for all rules across all scopes simultaneously

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha (VS Code extension test runner) |
| Config file | `.vscode/launch.json` (Extension Development Host) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Batch map pre-indexes rules by tool name; single-pass overlap computation | unit | `npm run test` (overlapResolver.test.ts suite) | existing |
| PERF-02 | No redundant RegExp compilation; no cross-tool comparisons | unit | `npm run test` (permissions.ts wildcardMatch path) | existing |
| Regression | All existing overlapResolver tests pass unchanged | unit | `npm run test` | existing — 103 passing |

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** All 103+ tests green before `/gsd:verify-work`

### Wave 0 Gaps

No new test files are required for this phase. The existing test suite covers:
- `resolvePermissionOverlap()` — must stay green (no behavioral change)
- `rulesOverlap()` and `parsePermissionRule()` — covered in builder tests indirectly

However, the planner SHOULD add targeted performance-correctness tests for
`computePermissionOverlapMap()` to verify:

- [ ] `test/suite/config/overlapResolver.test.ts` — add `computePermissionOverlapMap` test suite:
  - `returns same OverlapInfo as resolvePermissionOverlap for each rule` (parity test)
  - `handles 140+ rules per scope without throwing`
  - `all rules from all scopes are present as keys in the map`

These are not strictly required for the phase to pass (success criteria #4 says "existing test
suite passes unchanged"), but they are the right way to lock in the new batch function's
correctness.

## Sources

### Primary (HIGH confidence)
- `src/config/overlapResolver.ts` — full source read; complexity analysis is direct code observation
- `src/utils/permissions.ts` — full source read; RegExp allocation confirmed at line 62
- `src/viewmodel/builder.ts` — full source read; per-rule call site at line 466 confirmed
- `test/suite/config/overlapResolver.test.ts` — full source read; 8 resolvePermissionOverlap tests identified

### Secondary (MEDIUM confidence)
- `ROADMAP.md` Phase 29 description — confirms "O(R²) → O(R×G)" target algorithm description and
  "pre-index rules by tool name" as requirement language
- `test/suite/viewmodel/builder.test.ts` — confirmed builder test structure and existing passing tests

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; pure refactoring within existing TypeScript
- Architecture: HIGH — call sites identified in source; new function shape derived directly from existing code
- Pitfalls: HIGH — derived from direct code inspection; not from web sources

**Research date:** 2026-03-13
**Valid until:** Stable indefinitely (no external dependencies)
