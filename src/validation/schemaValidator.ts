/**
 * Lightweight structural validator for Claude Code config files.
 * No runtime JSON Schema library — we validate the most common mistakes by hand.
 */

export interface ValidationIssue {
  message: string;
  path: string;
  severity: 'error' | 'warning';
  /** 0-based line number in the source, if resolvable */
  line?: number;
}

const KNOWN_TOP_LEVEL_KEYS = new Set([
  'permissions',
  'env',
  'hooks',
  'sandbox',
  'enabledPlugins',
  'model',
  'smallFastModel',
  'outputStyle',
  'apiKeyHelper',
  'includeCoAuthoredBy',
  'trustWorkspaceConfig',
]);

const VALID_PERMISSION_CATEGORIES = new Set(['allow', 'deny', 'ask']);

const VALID_HOOK_EVENTS = new Set([
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SubagentStop',
]);

export function validateConfig(config: unknown, sourceText?: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    issues.push({
      message: 'Config must be a JSON object',
      path: '',
      severity: 'error',
      line: 0,
    });
    return issues;
  }

  const obj = config as Record<string, unknown>;

  // Warn about unknown top-level keys
  for (const key of Object.keys(obj)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      issues.push({
        message: `Unknown top-level key "${key}"`,
        path: key,
        severity: 'warning',
        line: findKeyLine(sourceText, key),
      });
    }
  }

  // Validate permissions
  if (obj.permissions !== undefined) {
    validatePermissions(obj.permissions, issues, sourceText);
  }

  // Validate env
  if (obj.env !== undefined) {
    validateEnv(obj.env, issues, sourceText);
  }

  // Validate hooks
  if (obj.hooks !== undefined) {
    validateHooks(obj.hooks, issues, sourceText);
  }

  // Validate enabledPlugins
  if (obj.enabledPlugins !== undefined) {
    validateEnabledPlugins(obj.enabledPlugins, issues, sourceText);
  }

  // Validate scalar settings types
  validateScalarType(obj, 'model', 'string', issues, sourceText);
  validateScalarType(obj, 'smallFastModel', 'string', issues, sourceText);
  validateScalarType(obj, 'outputStyle', 'string', issues, sourceText);
  validateScalarType(obj, 'apiKeyHelper', 'string', issues, sourceText);
  validateScalarType(obj, 'includeCoAuthoredBy', 'boolean', issues, sourceText);
  validateScalarType(obj, 'trustWorkspaceConfig', 'boolean', issues, sourceText);

  return issues;
}

function validatePermissions(
  permissions: unknown,
  issues: ValidationIssue[],
  sourceText?: string,
): void {
  if (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions)) {
    issues.push({
      message: '"permissions" must be an object',
      path: 'permissions',
      severity: 'error',
      line: findKeyLine(sourceText, 'permissions'),
    });
    return;
  }

  const perms = permissions as Record<string, unknown>;
  for (const [cat, rules] of Object.entries(perms)) {
    if (!VALID_PERMISSION_CATEGORIES.has(cat)) {
      issues.push({
        message: `Unknown permission category "${cat}". Valid: allow, deny, ask`,
        path: `permissions.${cat}`,
        severity: 'error',
        line: findKeyLine(sourceText, cat),
      });
      continue;
    }

    if (!Array.isArray(rules)) {
      issues.push({
        message: `"permissions.${cat}" must be an array of strings`,
        path: `permissions.${cat}`,
        severity: 'error',
        line: findKeyLine(sourceText, cat),
      });
      continue;
    }

    for (let i = 0; i < rules.length; i++) {
      if (typeof rules[i] !== 'string') {
        issues.push({
          message: `"permissions.${cat}[${i}]" must be a string`,
          path: `permissions.${cat}[${i}]`,
          severity: 'error',
        });
      }
    }
  }
}

function validateEnv(env: unknown, issues: ValidationIssue[], sourceText?: string): void {
  if (typeof env !== 'object' || env === null || Array.isArray(env)) {
    issues.push({
      message: '"env" must be an object',
      path: 'env',
      severity: 'error',
      line: findKeyLine(sourceText, 'env'),
    });
    return;
  }

  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      issues.push({
        message: `"env.${key}" must be a string, got ${typeof value}`,
        path: `env.${key}`,
        severity: 'error',
        line: findKeyLine(sourceText, key),
      });
    }
  }
}

function validateHooks(hooks: unknown, issues: ValidationIssue[], sourceText?: string): void {
  if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) {
    issues.push({
      message: '"hooks" must be an object',
      path: 'hooks',
      severity: 'error',
      line: findKeyLine(sourceText, 'hooks'),
    });
    return;
  }

  for (const [event, entries] of Object.entries(hooks as Record<string, unknown>)) {
    if (!VALID_HOOK_EVENTS.has(event)) {
      issues.push({
        message: `Unknown hook event "${event}". Valid: ${[...VALID_HOOK_EVENTS].join(', ')}`,
        path: `hooks.${event}`,
        severity: 'warning',
        line: findKeyLine(sourceText, event),
      });
    }

    if (!Array.isArray(entries)) {
      issues.push({
        message: `"hooks.${event}" must be an array`,
        path: `hooks.${event}`,
        severity: 'error',
        line: findKeyLine(sourceText, event),
      });
      continue;
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (typeof entry !== 'object' || entry === null) {
        issues.push({
          message: `"hooks.${event}[${i}]" must be an object`,
          path: `hooks.${event}[${i}]`,
          severity: 'error',
        });
        continue;
      }

      const e = entry as Record<string, unknown>;
      if (!Array.isArray(e.hooks)) {
        issues.push({
          message: `"hooks.${event}[${i}].hooks" must be an array`,
          path: `hooks.${event}[${i}].hooks`,
          severity: 'error',
        });
      }
    }
  }
}

function validateEnabledPlugins(
  plugins: unknown,
  issues: ValidationIssue[],
  sourceText?: string,
): void {
  if (typeof plugins !== 'object' || plugins === null || Array.isArray(plugins)) {
    issues.push({
      message: '"enabledPlugins" must be an object',
      path: 'enabledPlugins',
      severity: 'error',
      line: findKeyLine(sourceText, 'enabledPlugins'),
    });
    return;
  }

  for (const [key, value] of Object.entries(plugins as Record<string, unknown>)) {
    if (typeof value !== 'boolean') {
      issues.push({
        message: `"enabledPlugins.${key}" must be a boolean, got ${typeof value}`,
        path: `enabledPlugins.${key}`,
        severity: 'warning',
        line: findKeyLine(sourceText, key),
      });
    }
  }
}

function validateScalarType(
  obj: Record<string, unknown>,
  key: string,
  expectedType: string,
  issues: ValidationIssue[],
  sourceText?: string,
): void {
  if (obj[key] !== undefined && typeof obj[key] !== expectedType) {
    issues.push({
      message: `"${key}" must be a ${expectedType}, got ${typeof obj[key]}`,
      path: key,
      severity: 'error',
      line: findKeyLine(sourceText, key),
    });
  }
}

/**
 * Best-effort line number finder — searches for `"key":` in the source text.
 * Returns 0-based line number or undefined.
 */
function findKeyLine(sourceText: string | undefined, key: string): number | undefined {
  if (!sourceText) return undefined;
  const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:`);
  const lines = sourceText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i;
    }
  }
  return undefined;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
