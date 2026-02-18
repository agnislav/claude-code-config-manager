import {
  ConfigScope,
  PermissionCategory,
  ResolvedValue,
  SCOPE_PRECEDENCE,
  ScopedConfig,
} from '../types';
import { rulesOverlap } from '../utils/permissions';

/**
 * Returns the precedence index for a scope (lower = higher precedence).
 */
function precedenceOf(scope: ConfigScope): number {
  return SCOPE_PRECEDENCE.indexOf(scope);
}

/**
 * Finds the highest-precedence scope that defines a given top-level config key.
 */
function findHighestPrecedenceScope(
  key: string,
  allScopes: ScopedConfig[],
): ConfigScope | undefined {
  let best: ConfigScope | undefined;
  let bestPrecedence = Infinity;

  for (const sc of allScopes) {
    const value = sc.config[key];
    if (value !== undefined) {
      const p = precedenceOf(sc.scope);
      if (p < bestPrecedence) {
        bestPrecedence = p;
        best = sc.scope;
      }
    }
  }

  return best;
}

/**
 * Resolves a scalar setting across all scopes.
 * Returns the effective value and whether it's overridden in the given scope.
 */
export function resolveScalarOverride(
  key: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): ResolvedValue {
  const currentSc = allScopes.find((s) => s.scope === currentScope);
  const currentValue = currentSc?.config[key];

  const winningScope = findHighestPrecedenceScope(key, allScopes);
  const winningSc = allScopes.find((s) => s.scope === winningScope);
  const effectiveValue = winningSc?.config[key];

  const isOverridden =
    currentValue !== undefined &&
    winningScope !== undefined &&
    winningScope !== currentScope &&
    precedenceOf(winningScope) < precedenceOf(currentScope);

  return {
    effectiveValue,
    definedInScope: winningScope ?? currentScope,
    isOverridden,
    overriddenByScope: isOverridden ? winningScope : undefined,
  };
}

/**
 * Checks if a permission rule in a given scope is overridden by a conflicting
 * rule in a higher-precedence scope.
 *
 * A rule is considered overridden if:
 * - A higher-precedence scope has an overlapping rule in a *different* category
 *   (e.g., Managed denies "Bash(curl *)" while User allows "Bash(curl *)")
 * - A higher-precedence scope has the same rule in the *same* category
 *   (redundant but not harmful — we still flag it for visibility)
 */
export function resolvePermissionOverride(
  category: PermissionCategory,
  rule: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): { isOverridden: boolean; overriddenByScope?: ConfigScope; overriddenByCategory?: string } {
  const currentPrecedence = precedenceOf(currentScope);

  // Check higher-precedence scopes for conflicting rules
  for (const sc of allScopes) {
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
            isOverridden: true,
            overriddenByScope: sc.scope,
            overriddenByCategory: cat,
          };
        }
      }
    }
  }

  return { isOverridden: false };
}

/**
 * Checks if an environment variable in a given scope is overridden
 * by the same key in a higher-precedence scope.
 */
export function resolveEnvOverride(
  envKey: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): { isOverridden: boolean; overriddenByScope?: ConfigScope } {
  const currentPrecedence = precedenceOf(currentScope);

  for (const sc of allScopes) {
    if (precedenceOf(sc.scope) >= currentPrecedence) continue;
    if (sc.config.env && envKey in sc.config.env) {
      return { isOverridden: true, overriddenByScope: sc.scope };
    }
  }

  return { isOverridden: false };
}

/**
 * Checks if a sandbox property in a given scope is overridden
 * by the same property in a higher-precedence scope.
 */
export function resolveSandboxOverride(
  sandboxKey: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): { isOverridden: boolean; overriddenByScope?: ConfigScope } {
  const currentPrecedence = precedenceOf(currentScope);

  for (const sc of allScopes) {
    if (precedenceOf(sc.scope) >= currentPrecedence) continue;
    if (!sc.config.sandbox) continue;

    // Handle nested keys like "network.allowedDomains"
    const keys = sandboxKey.split('.');
    let obj: Record<string, unknown> = sc.config.sandbox as Record<string, unknown>;
    let found = true;

    for (const k of keys) {
      if (obj && typeof obj === 'object' && k in obj) {
        obj = obj[k] as Record<string, unknown>;
      } else {
        found = false;
        break;
      }
    }

    if (found) {
      return { isOverridden: true, overriddenByScope: sc.scope };
    }
  }

  return { isOverridden: false };
}

/**
 * Checks if a plugin entry in a given scope is overridden
 * by the same plugin in a higher-precedence scope.
 */
export function resolvePluginOverride(
  pluginId: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): { isOverridden: boolean; overriddenByScope?: ConfigScope } {
  const currentPrecedence = precedenceOf(currentScope);

  for (const sc of allScopes) {
    if (precedenceOf(sc.scope) >= currentPrecedence) continue;
    if (sc.config.enabledPlugins && pluginId in sc.config.enabledPlugins) {
      return { isOverridden: true, overriddenByScope: sc.scope };
    }
  }

  return { isOverridden: false };
}
