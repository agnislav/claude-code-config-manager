import {
  ConfigScope,
  OverlapInfo,
  OverlapItem,
  PermissionCategory,
  SCOPE_PRECEDENCE,
  ScopedConfig,
} from '../types';
import { rulesOverlap } from '../utils/permissions';

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
 * Maps overlap state to git-themed color.
 * Priority: isOverriddenBy/isDuplicatedBy = red (losers),
 * overrides = green (winner), duplicates = yellow (redundant).
 */
export function getOverlapColor(overlap: OverlapInfo): 'red' | 'green' | 'yellow' | 'none' {
  if (overlap.isOverriddenBy || overlap.isDuplicatedBy) return 'red';
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

  // Sort by precedence, check higher-precedence scopes for conflicting rules
  const sorted = [...allScopes].sort((a, b) => precedenceOf(a.scope) - precedenceOf(b.scope));

  for (const sc of sorted) {
    if (precedenceOf(sc.scope) >= currentPrecedence) continue;
    if (!sc.config.permissions) continue;

    const categories: PermissionCategory[] = [
      PermissionCategory.Deny,
      PermissionCategory.Ask,
      PermissionCategory.Allow,
    ];

    for (const cat of categories) {
      if (cat === category) continue; // Same category is not a conflict
      const rules = sc.config.permissions[cat];
      if (!rules) continue;

      for (const higherRule of rules) {
        if (rulesOverlap(higherRule, rule)) {
          return {
            isOverriddenBy: { scope: sc.scope, value: cat },
            overriddenByCategory: cat,
          };
        }
      }
    }
  }

  return {};
}
