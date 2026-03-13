import {
  ConfigScope,
  HookCommand,
  HookEventType,
  OverlapInfo,
  OverlapItem,
  PermissionCategory,
  SCOPE_PRECEDENCE,
  ScopedConfig,
} from '../types';
import { getCachedParse, ParsedPermissionRule, rulesOverlap } from '../utils/permissions';

export type { OverlapInfo, OverlapItem };

// ── Deep equality ───────────────────────────────────────────────

/**
 * Deterministic deep equality. Objects are compared with sorted keys
 * (key order independent). Array order matters. Primitives use ===.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const bKeys = Object.keys(bObj).sort();
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key, i) => key === bKeys[i] && deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

// ── Color mapping ───────────────────────────────────────────────

/**
 * Maps overlap state to color.
 * red = overridden (loses, different value wins above),
 * orange = duplicated (loses, same value exists above — redundant),
 * green = overrides (wins, different value below),
 * yellow = duplicates (wins, same value below).
 */
export function getOverlapColor(
  overlap: OverlapInfo,
): 'red' | 'orange' | 'green' | 'yellow' | 'none' {
  if (overlap.isOverriddenBy) return 'red';
  if (overlap.isDuplicatedBy) return 'orange';
  if (overlap.overrides) return 'green';
  if (overlap.duplicates) return 'yellow';
  return 'none';
}

// ── Internal helpers ────────────────────────────────────────────

function precedenceOf(scope: ConfigScope): number {
  return SCOPE_PRECEDENCE.indexOf(scope);
}

/**
 * Generic nearest-neighbor overlap resolver.
 * Finds the closest higher-precedence and lower-precedence scopes
 * that define the entity, then uses deepEqual to classify as
 * override (values differ) or duplicate (values match).
 */
function resolveOverlapGeneric(
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
  getValue: (sc: ScopedConfig) => unknown | undefined,
): OverlapInfo {
  const currentPrecedence = precedenceOf(currentScope);
  const currentSc = allScopes.find((s) => s.scope === currentScope);
  if (!currentSc) return {};

  const currentValue = getValue(currentSc);
  if (currentValue === undefined) return {};

  // Sort by precedence index (lower index = higher precedence)
  const sorted = [...allScopes].sort((a, b) => precedenceOf(a.scope) - precedenceOf(b.scope));

  const result: OverlapInfo = {};

  // Find nearest higher-precedence scope (lower precedence index) that has the entity
  let nearestHigher: ScopedConfig | undefined;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const sc = sorted[i];
    if (precedenceOf(sc.scope) >= currentPrecedence) continue;
    if (getValue(sc) !== undefined) {
      nearestHigher = sc;
      break;
    }
  }

  // Find nearest lower-precedence scope (higher precedence index) that has the entity
  let nearestLower: ScopedConfig | undefined;
  for (const sc of sorted) {
    if (precedenceOf(sc.scope) <= currentPrecedence) continue;
    if (getValue(sc) !== undefined) {
      nearestLower = sc;
      break;
    }
  }

  if (nearestHigher) {
    const higherValue = getValue(nearestHigher);
    if (deepEqual(currentValue, higherValue)) {
      result.isDuplicatedBy = { scope: nearestHigher.scope, value: higherValue };
    } else {
      result.isOverriddenBy = { scope: nearestHigher.scope, value: higherValue };
    }
  }

  if (nearestLower) {
    const lowerValue = getValue(nearestLower);
    if (deepEqual(currentValue, lowerValue)) {
      result.duplicates = { scope: nearestLower.scope, value: lowerValue };
    } else {
      result.overrides = { scope: nearestLower.scope, value: lowerValue };
    }
  }

  return result;
}

// ── Public resolvers ────────────────────────────────────────────

export function resolveSettingOverlap(
  key: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): OverlapInfo {
  return resolveOverlapGeneric(currentScope, allScopes, (sc) => {
    const val = sc.config[key];
    return val !== undefined ? val : undefined;
  });
}

export function resolveEnvOverlap(
  envKey: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): OverlapInfo {
  return resolveOverlapGeneric(currentScope, allScopes, (sc) => {
    return sc.config.env?.[envKey];
  });
}

export function resolvePluginOverlap(
  pluginId: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): OverlapInfo {
  return resolveOverlapGeneric(currentScope, allScopes, (sc) => {
    const plugins = sc.config.enabledPlugins;
    if (plugins && pluginId in plugins) {
      return plugins[pluginId];
    }
    return undefined;
  });
}

export function resolveMcpOverlap(
  serverName: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): OverlapInfo {
  return resolveOverlapGeneric(currentScope, allScopes, (sc) => {
    return sc.mcpConfig?.mcpServers?.[serverName];
  });
}

export function resolveSandboxOverlap(
  sandboxKey: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): OverlapInfo {
  return resolveOverlapGeneric(currentScope, allScopes, (sc) => {
    if (!sc.config.sandbox) return undefined;
    const keys = sandboxKey.split('.');
    let obj: unknown = sc.config.sandbox;
    for (const k of keys) {
      if (obj && typeof obj === 'object' && k in (obj as Record<string, unknown>)) {
        obj = (obj as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }
    return obj;
  });
}

export function resolveHookOverlap(
  eventType: HookEventType,
  matcherPattern: string | undefined,
  hook: HookCommand,
  hookIndex: number,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): OverlapInfo {
  return resolveOverlapGeneric(currentScope, allScopes, (sc) => {
    const matchers = sc.config.hooks?.[eventType];
    if (!matchers) return undefined;
    for (const matcher of matchers) {
      if ((matcher.matcher ?? '') !== (matcherPattern ?? '')) continue;
      const h = matcher.hooks[hookIndex];
      return h !== undefined ? h : undefined;
    }
    return undefined;
  });
}

/**
 * Permission overlap resolver. Special-cased: uses glob matching instead of
 * exact key equality. Only checks isOverriddenBy direction (higher-precedence
 * scopes). overrides/duplicates are always undefined for permissions.
 */
export function resolvePermissionOverlap(
  category: PermissionCategory,
  rule: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): OverlapInfo & { overriddenByCategory?: string } {
  const currentPrecedence = precedenceOf(currentScope);
  const sorted = [...allScopes].sort((a, b) => precedenceOf(a.scope) - precedenceOf(b.scope));

  const result: OverlapInfo & { overriddenByCategory?: string } = {};

  const categories: PermissionCategory[] = [
    PermissionCategory.Deny,
    PermissionCategory.Ask,
    PermissionCategory.Allow,
  ];

  // Check higher-precedence scopes (nearest first, scanning from just above current)
  for (let i = sorted.length - 1; i >= 0; i--) {
    const sc = sorted[i];
    if (precedenceOf(sc.scope) >= currentPrecedence) continue;
    if (!sc.config.permissions) continue;

    // Cross-category conflict (override) takes priority
    let foundCrossCategory = false;
    for (const cat of categories) {
      if (cat === category) continue;
      const catRules = sc.config.permissions[cat];
      if (!catRules) continue;
      for (const higherRule of catRules) {
        if (rulesOverlap(higherRule, rule)) {
          result.isOverriddenBy = { scope: sc.scope, value: cat };
          result.overriddenByCategory = cat;
          foundCrossCategory = true;
          break;
        }
      }
      if (foundCrossCategory) break;
    }
    if (foundCrossCategory) break;

    // Same-category duplicate
    const sameCatRules = sc.config.permissions[category];
    if (sameCatRules) {
      for (const higherRule of sameCatRules) {
        if (higherRule === rule) {
          result.isDuplicatedBy = { scope: sc.scope, value: category };
          break;
        }
      }
      if (result.isDuplicatedBy) break;
    }
  }

  // Check lower-precedence scopes (nearest first, scanning from just below current)
  for (const sc of sorted) {
    if (precedenceOf(sc.scope) <= currentPrecedence) continue;
    if (!sc.config.permissions) continue;

    // Cross-category: this rule overrides a different-category rule below
    let foundCrossCategory = false;
    for (const cat of categories) {
      if (cat === category) continue;
      const catRules = sc.config.permissions[cat];
      if (!catRules) continue;
      for (const lowerRule of catRules) {
        if (rulesOverlap(rule, lowerRule)) {
          result.overrides = { scope: sc.scope, value: cat };
          foundCrossCategory = true;
          break;
        }
      }
      if (foundCrossCategory) break;
    }
    if (foundCrossCategory) break;

    // Same-category duplicate
    const sameCatRules = sc.config.permissions[category];
    if (sameCatRules) {
      for (const lowerRule of sameCatRules) {
        if (lowerRule === rule) {
          result.duplicates = { scope: sc.scope, value: category };
          break;
        }
      }
      if (result.duplicates) break;
    }
  }

  return result;
}

// ── Batch permission overlap map ─────────────────────────────────

type RuleEntry = {
  scope: ConfigScope;
  category: PermissionCategory;
  rule: string;
  parsed: ParsedPermissionRule;
};

/**
 * Builds an index of all permission rules grouped by tool name.
 * This eliminates cross-tool comparisons by pre-grouping entries.
 */
function buildToolIndex(allScopes: ScopedConfig[]): Map<string, RuleEntry[]> {
  const index = new Map<string, RuleEntry[]>();
  const categories: PermissionCategory[] = [
    PermissionCategory.Allow,
    PermissionCategory.Ask,
    PermissionCategory.Deny,
  ];
  for (const sc of allScopes) {
    if (!sc.config.permissions) continue;
    for (const category of categories) {
      const rules = sc.config.permissions[category];
      if (!rules) continue;
      for (const rule of rules) {
        const parsed = getCachedParse(rule);
        const bucket = index.get(parsed.tool);
        const entry: RuleEntry = { scope: sc.scope, category, rule, parsed };
        if (bucket) {
          bucket.push(entry);
        } else {
          index.set(parsed.tool, [entry]);
        }
      }
    }
  }
  return index;
}

/**
 * Computes overlap info for every (scope, category, rule) triple in a single
 * batched pass. Uses tool-name indexing so only rules with the same tool are
 * ever compared — eliminating the O(R²) cross-tool scan of the per-rule resolver.
 *
 * The returned Map is keyed by `${scope}/${category}/${rule}`. Each value
 * matches what `resolvePermissionOverlap` would return for the same inputs.
 *
 * `resolvePermissionOverlap` is preserved unchanged for backward compatibility.
 */
export function computePermissionOverlapMap(
  allScopes: ScopedConfig[],
): Map<string, OverlapInfo & { overriddenByCategory?: string }> {
  const result = new Map<string, OverlapInfo & { overriddenByCategory?: string }>();
  const toolIndex = buildToolIndex(allScopes);

  // Pre-compute precedence for all scopes once
  const scopePrecMap = new Map<ConfigScope, number>(
    allScopes.map((sc) => [sc.scope, precedenceOf(sc.scope)]),
  );

  for (const bucket of toolIndex.values()) {
    // Sort entire bucket by precedence once (ascending = highest precedence first)
    bucket.sort(
      (a, b) =>
        (scopePrecMap.get(a.scope) ?? precedenceOf(a.scope)) -
        (scopePrecMap.get(b.scope) ?? precedenceOf(b.scope)),
    );

    for (let idx = 0; idx < bucket.length; idx++) {
      const entry = bucket[idx];
      const { scope, category, rule } = entry;
      const currentPrecedence = scopePrecMap.get(scope) ?? precedenceOf(scope);
      const overlap: OverlapInfo & { overriddenByCategory?: string } = {};

      // ── Higher-precedence entries (lower index in sorted bucket) ──
      // Walk backwards from idx-1 to find nearest higher-precedence scope
      let nearestHigherPrec: number | undefined;
      let foundCrossCategoryAbove = false;

      for (let i = idx - 1; i >= 0; i--) {
        const higher = bucket[i];
        const higherPrec = scopePrecMap.get(higher.scope) ?? precedenceOf(higher.scope);
        if (higherPrec >= currentPrecedence) continue;

        if (nearestHigherPrec !== undefined && higherPrec !== nearestHigherPrec) {
          if (overlap.isOverriddenBy || overlap.isDuplicatedBy) break;
        }
        nearestHigherPrec = higherPrec;

        if (higher.category !== category && rulesOverlap(higher.rule, rule)) {
          overlap.isOverriddenBy = { scope: higher.scope, value: higher.category };
          overlap.overriddenByCategory = higher.category;
          foundCrossCategoryAbove = true;
          break;
        }
      }

      if (!foundCrossCategoryAbove) {
        nearestHigherPrec = undefined;
        for (let i = idx - 1; i >= 0; i--) {
          const higher = bucket[i];
          const higherPrec = scopePrecMap.get(higher.scope) ?? precedenceOf(higher.scope);
          if (higherPrec >= currentPrecedence) continue;
          if (nearestHigherPrec !== undefined && higherPrec !== nearestHigherPrec) break;
          nearestHigherPrec = higherPrec;

          if (higher.category === category && higher.rule === rule) {
            overlap.isDuplicatedBy = { scope: higher.scope, value: category };
            break;
          }
        }
      }

      // ── Lower-precedence entries (higher index in sorted bucket) ──
      let nearestLowerPrec: number | undefined;
      let foundCrossCategoryBelow = false;

      for (let i = idx + 1; i < bucket.length; i++) {
        const lower = bucket[i];
        const lowerPrec = scopePrecMap.get(lower.scope) ?? precedenceOf(lower.scope);
        if (lowerPrec <= currentPrecedence) continue;

        if (nearestLowerPrec !== undefined && lowerPrec !== nearestLowerPrec) {
          if (overlap.overrides || overlap.duplicates) break;
        }
        nearestLowerPrec = lowerPrec;

        if (lower.category !== category && rulesOverlap(rule, lower.rule)) {
          overlap.overrides = { scope: lower.scope, value: lower.category };
          foundCrossCategoryBelow = true;
          break;
        }
      }

      if (!foundCrossCategoryBelow) {
        nearestLowerPrec = undefined;
        for (let i = idx + 1; i < bucket.length; i++) {
          const lower = bucket[i];
          const lowerPrec = scopePrecMap.get(lower.scope) ?? precedenceOf(lower.scope);
          if (lowerPrec <= currentPrecedence) continue;
          if (nearestLowerPrec !== undefined && lowerPrec !== nearestLowerPrec) break;
          nearestLowerPrec = lowerPrec;

          if (lower.category === category && lower.rule === rule) {
            overlap.duplicates = { scope: lower.scope, value: category };
            break;
          }
        }
      }

      result.set(`${scope}/${category}/${rule}`, overlap);
    }
  }

  return result;
}
