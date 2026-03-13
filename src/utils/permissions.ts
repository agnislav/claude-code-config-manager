export interface ParsedPermissionRule {
  tool: string;
  specifier?: string;
}

// ── Caches ────────────────────────────────────────────────────────

const _regexpCache = new Map<string, RegExp>();
const _parseCache = new Map<string, ParsedPermissionRule>();

// ── Public API ────────────────────────────────────────────────────

/**
 * Parses a permission rule string like "Bash(npm run *)" into tool and specifier.
 * - "Bash" → { tool: "Bash" }
 * - "Bash(npm run *)" → { tool: "Bash", specifier: "npm run *" }
 * - "mcp__asana__get_task" → { tool: "mcp__asana__get_task" }
 */
export function parsePermissionRule(rule: string): ParsedPermissionRule {
  const match = rule.match(/^([^(]+?)(?:\((.+)\))?$/);
  if (!match) {
    return { tool: rule };
  }
  return {
    tool: match[1],
    specifier: match[2],
  };
}

/**
 * Cached version of parsePermissionRule. Returns the same object reference
 * for identical rule strings — avoids repeated regex and object allocation.
 */
export function getCachedParse(rule: string): ParsedPermissionRule {
  let cached = _parseCache.get(rule);
  if (!cached) {
    cached = parsePermissionRule(rule);
    _parseCache.set(rule, cached);
  }
  return cached;
}

export function formatPermissionRule(parsed: ParsedPermissionRule): string {
  if (parsed.specifier) {
    return `${parsed.tool}(${parsed.specifier})`;
  }
  return parsed.tool;
}

/**
 * Checks if two permission rules conflict (same tool, overlapping specifiers).
 * A deny rule for "Bash(curl *)" conflicts with an allow for "Bash(curl http://example.com)".
 */
export function rulesOverlap(ruleA: string, ruleB: string): boolean {
  const a = getCachedParse(ruleA);
  const b = getCachedParse(ruleB);

  if (a.tool !== b.tool) {
    return false;
  }

  // Both have no specifier — exact match
  if (!a.specifier && !b.specifier) {
    return true;
  }

  // One is a wildcard (no specifier = matches all)
  if (!a.specifier || !b.specifier) {
    return true;
  }

  // Simple wildcard matching: "npm run *" matches "npm run lint"
  if (a.specifier === b.specifier) {
    return true;
  }

  return wildcardMatch(a.specifier, b.specifier) || wildcardMatch(b.specifier, a.specifier);
}

function wildcardMatch(pattern: string, text: string): boolean {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*');
  let re = _regexpCache.get(escaped);
  if (!re) {
    try {
      re = new RegExp(`^${escaped}$`);
      _regexpCache.set(escaped, re);
    } catch {
      return false;
    }
  }
  return re.test(text);
}
