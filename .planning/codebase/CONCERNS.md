# Codebase Concerns & Technical Debt

## Overview
This document identifies technical debt, potential bugs, security considerations, performance concerns, and fragile patterns in the Claude Code Config Manager extension. Each concern is rated by severity (Low/Medium/High).

---

## Critical Issues (High Severity)

### 1. Silent Failures in File Write Operations
**Location:** `src/config/configWriter.ts`, `src/utils/json.ts`
**Severity:** HIGH

The `writeJsonFile()` function can silently fail when:
- Directory creation fails due to permission issues
- File write fails due to permission issues
- The filesystem is full or mounted read-only

**Issue:**
```typescript
export function writeJsonFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });  // No error handling
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf-8');  // No error handling
}
```

No exceptions are thrown or caught, so callers (commands) don't know if changes were persisted. The config file might silently fail to save while the user thinks their changes are stored.

**Impact:** Data loss, configuration corruption, false sense of security.

**Recommendation:** Throw explicit errors from `writeJsonFile()` and propagate them through command handlers. Add try-catch with user-facing error messages.

---

### 2. Race Condition: File Watcher vs Concurrent Edits
**Location:** `src/watchers/fileWatcher.ts`, `src/config/configModel.ts`
**Severity:** HIGH

The file watcher and direct config writes can create race conditions:

```typescript
// File watcher debounces reloads
private debouncedReload(): void {
  if (this.reloadTimeout) {
    clearTimeout(this.reloadTimeout);
  }
  this.reloadTimeout = setTimeout(() => {
    this.configStore.reload();
    this.reloadTimeout = undefined;
  }, 300);  // 300ms debounce window
}
```

If a user:
1. Edits a value via the UI (triggering `configWriter`)
2. Externally edits the same file (triggering file watcher)
3. Both fire within 300ms

The reload might overwrite the UI edit or vice versa. The ConfigStore doesn't track in-flight writes.

**Impact:** Configuration inconsistency, lost user changes.

**Recommendation:**
- Add write acknowledgment tracking before reload
- Use file modification timestamps to detect external changes
- Implement atomic writes with backup/rollback
- Display warning if external changes conflict with pending writes

---

### 3. Unhandled JSON Parse Errors in Config Loader
**Location:** `src/config/configModel.ts`, `src/config/configLoader.ts`
**Severity:** HIGH

When loading config files, parse errors are returned but not always handled:

```typescript
private buildScopedConfigs(discovered: DiscoveredPaths): ScopedConfig[] {
  const scopes: ScopedConfig[] = [];

  const managedResult = loadConfigFile(discovered.managed.path);
  scopes.push({
    scope: ConfigScope.Managed,
    filePath: discovered.managed.path,
    fileExists: discovered.managed.exists,
    config: managedResult.data,  // May be {} if parse failed
    isReadOnly: true,
  });
  // ... no validation that managedResult.error is empty
}
```

A corrupted config file silently becomes an empty object `{}`. The user is unaware that the config was ignored.

**Impact:** Silent configuration loss, non-obvious bugs.

**Recommendation:**
- Check `error` field from parse results
- Log errors to output channel
- Display warning/error in UI for corrupted configs
- Prevent reload until corruption is fixed

---

### 4. No Validation of File Paths Before Operations
**Location:** All file operation commands
**Severity:** HIGH

File paths are used without validation:

```typescript
// In openFileCommands.ts
export function registerOpenFileCommands(context: vscode.ExtensionContext, _configStore: ConfigStore): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeConfig.createConfigFile', async (node?: ConfigTreeNode) => {
      const filePath = node?.nodeContext?.filePath;
      if (!filePath) return;

      const dir = filePath.substring(0, filePath.lastIndexOf('/'));  // String parsing, not path.dirname
      fs.mkdirSync(dir, { recursive: true });  // No symlink check
      fs.writeFileSync(filePath, '{}\n', 'utf-8');
    }),
  );
}
```

No checks for:
- Symlink attacks (e.g., `~/.claude/settings.json` symlinked to `/etc/passwd`)
- Path traversal (`..` sequences)
- Absolute vs relative path confusion
- Directory vs file confusion

**Impact:** Potential security vulnerability (file system escaping), data corruption.

**Recommendation:**
- Use `path.resolve()` to normalize paths
- Validate that resolved path stays within expected boundaries
- Add symlink checks before write operations
- Use `fs.realpath()` and verify canonicalized path

---

## Significant Issues (Medium Severity)

### 5. Memory Leak: Editor-Tree Sync Loop
**Location:** `src/extension.ts` (lines 101-153)
**Severity:** MEDIUM

The editor-tree sync uses timeout flags and closure-captured state:

```typescript
let suppressEditorSync = false;
let suppressTreeSync = false;
let syncTimeout: ReturnType<typeof setTimeout> | undefined;

treeView.onDidChangeSelection(() => {
  if (suppressTreeSync) return;
  suppressEditorSync = true;
  setTimeout(() => { suppressEditorSync = false; }, 500);  // New closure every time
});

const syncEditorToTree = (editor: vscode.TextEditor) => {
  if (suppressEditorSync) return;
  // ...
  suppressTreeSync = true;
  treeView.reveal(node, { select: true, focus: false, expand: true }).then(
    () => setTimeout(() => { suppressTreeSync = false; }, 100),  // Another closure
    () => { suppressTreeSync = false; },
  );
};
```

Multiple hidden timeouts are created and stacked if events fire rapidly. The timeout references may pile up if the extension handles high-frequency editor selection changes.

**Impact:** Memory growth over time, potential UI lag.

**Recommendation:**
- Use a single debounce manager instead of multiple timeouts
- Store timeout IDs and clear before creating new ones
- Consider using RxJS operators (debounceTime, distinctUntilChanged)

---

### 6. Incomplete Error Handling in Tree Node Operations
**Location:** `src/tree/configTreeProvider.ts`
**Severity:** MEDIUM

The tree provider assumes certain operations won't fail:

```typescript
findNodeByKeyPath(
  scope: ConfigScope,
  keyPath: string[],
  workspaceFolderKey?: string,
): ConfigTreeNode | undefined {
  for (let len = keyPath.length; len > 0; len--) {
    const prefix = keyPath.slice(0, len);
    const roots = this.getChildren();  // Could throw if config is invalid
    const found = this.walkForNode(roots, scope, prefix, workspaceFolderKey);
    if (found) return found;
  }
  return undefined;
}
```

If `getChildren()` throws or returns unexpected data, the entire tree navigation breaks. No try-catch means the entire tree UI may crash.

**Impact:** Tree view becomes unusable on unexpected data.

**Recommendation:**
- Wrap tree operations in try-catch
- Log errors and return safe defaults
- Display user-friendly error message if tree navigation fails

---

### 7. Potential Array Index Out of Bounds in keyPath Handling
**Location:** `src/commands/editCommands.ts`, `src/commands/deleteCommands.ts`, multiple command files
**Severity:** MEDIUM

Array indexing without bounds checking:

```typescript
// In editCommands.ts
if (rootKey === 'env' && keyPath.length === 2) {
  setEnvVar(filePath, keyPath[1], newValue);  // Assumes index 1 exists
}
```

While the length check exists, other code paths don't:

```typescript
// In deleteCommands.ts
const itemName = node.label?.toString() ?? keyPath[keyPath.length - 1];
// What if keyPath is empty?
```

**Impact:** Undefined behavior, cryptic errors.

**Recommendation:**
- Add utility function `safeKeyPath(keyPath, depth)` with bounds checking
- Validate keyPath structure before use
- Return early with error message if keyPath is malformed

---

### 8. Plugin Metadata Service Singleton Not Invalidated on Config Changes
**Location:** `src/utils/pluginMetadata.ts`, `src/extension.ts`
**Severity:** MEDIUM

The `PluginMetadataService` is a singleton with caching:

```typescript
export class PluginMetadataService {
  private static instance: PluginMetadataService | undefined;
  private registry: InstalledPluginsRegistry | undefined;
  private manifestCache = new Map<string, PluginManifest | null>();

  static getInstance(): PluginMetadataService {
    if (!PluginMetadataService.instance) {
      PluginMetadataService.instance = new PluginMetadataService();
    }
    return PluginMetadataService.instance;
  }
}
```

When a plugin is added/removed or the registry changes, the cache is not invalidated. The UI might show stale plugin metadata.

**Impact:** Stale plugin descriptions, incorrect plugin status.

**Recommendation:**
- Invalidate plugin cache on config reload: `PluginMetadataService.getInstance().invalidate()`
- Call this in `ConfigStore.reload()` or listen to `onDidChange` events
- Add subscription cleanup in extension deactivation

---

### 9. No Handling of MCP Config Path Validation
**Location:** `src/config/configModel.ts`, `src/config/configDiscovery.ts`
**Severity:** MEDIUM

MCP config path is hardcoded but not validated:

```typescript
// In configDiscovery.ts
const mcpPath = path.join(root, MCP_CONFIG_FILE);  // MCP_CONFIG_FILE = '.mcp.json'

// In configModel.ts
const mcpResult = discovered.mcp ? loadMcpFile(discovered.mcp.path) : undefined;
scopes.push({
  // ...
  mcpConfig: mcpResult?.data,
  mcpFilePath: discovered.mcp?.path,
  // ...
});
```

If `.mcp.json` exists but is invalid JSON, the error is silently ignored. Users won't know their MCP config is broken.

**Impact:** MCP servers fail to load without user awareness.

**Recommendation:**
- Log parse errors for MCP files
- Display diagnostic warning if MCP config is invalid
- Validate MCP config structure (mcpServers object)

---

### 10. Fragile JSON Location Detection in findKeyPathAtLine
**Location:** `src/utils/jsonLocation.ts`
**Severity:** MEDIUM

The JSON line-to-keyPath detection uses brittle regex and heuristics:

```typescript
// String array element: "value" or "value",
const strMatch = trimmed.match(/^"([^"]*)"[,]?$/);
if (strMatch) {
  return { indent, type: 'arrayElement', key: strMatch[1] };
}
```

This fails if:
- String contains escaped quotes: `"say \"hello\""`
- JSON has comments (though spec doesn't allow them)
- Line is indented but empty or is a closing bracket
- Mixed tabs and spaces

The reverse mapping (line → keyPath) may produce incorrect results, causing "Reveal in File" to jump to wrong location.

**Impact:** Editor-tree sync may reveal wrong line in file.

**Recommendation:**
- Consider using a proper JSON parser (jsonc-parser or similar)
- Add test cases for edge cases
- Handle escaped characters properly
- Fall back gracefully if parse fails

---

### 11. No Timeout on File Watcher Debounce Loop
**Location:** `src/watchers/fileWatcher.ts`
**Severity:** MEDIUM

The file watcher debounce can theoretically accumulate uncanceled timeouts:

```typescript
private debouncedReload(): void {
  if (this.reloadTimeout) {
    clearTimeout(this.reloadTimeout);  // Good
  }
  this.reloadTimeout = setTimeout(() => {
    this.configStore.reload();
    this.reloadTimeout = undefined;
  }, 300);
}
```

While the timeout is cleared before creating a new one, if many file changes occur rapidly (e.g., git operations, find-replace in IDE), the reload is deferred indefinitely. If 1000 file changes occur in 1ms intervals, the reload waits until 300ms after the last change.

**Impact:** Stale config state during high-frequency file changes.

**Recommendation:**
- Add maximum debounce time (e.g., reload at least every 5 seconds)
- Use `setTimeout(..., debounce, { maxWait: 5000 })` pattern or implement manually

---

## Minor Issues (Low Severity)

### 12. Unused Parameter in Command Handlers
**Location:** `src/commands/*.ts`
**Severity:** LOW

Several functions have unused `_configStore` parameter:

```typescript
// editCommands.ts
export function registerEditCommands(
  context: vscode.ExtensionContext,
  _configStore: ConfigStore,  // Underscore prefix acknowledges unused
): void {
```

This is a convention (underscore prefix) but indicates dead code. If the parameter is truly unused, it should be removed.

**Impact:** None (conventions are followed), but code clarity.

**Recommendation:**
- Remove unused parameters unless they're required by a calling interface
- Lint rule already enforced by ESLint (`@typescript-eslint/no-unused-vars`)

---

### 13. Hard-Coded Platform Paths May Exclude Windows
**Location:** `src/utils/platform.ts`
**Severity:** LOW

Platform detection only handles macOS and Linux:

```typescript
export function getManagedSettingsPath(): string {
  const platform = process.platform;
  if (platform === 'darwin') {
    return path.join(MANAGED_PATH_MACOS, MANAGED_SETTINGS_FILENAME);
  }
  // Linux and WSL
  return path.join(MANAGED_PATH_LINUX, MANAGED_SETTINGS_FILENAME);
}
```

No explicit handling for Windows. If Claude Code is ported to Windows, the managed settings path will be wrong. The code defaults to Linux path, which is not ideal.

**Impact:** If Windows support is added, managed config will be looked up in wrong location.

**Recommendation:**
- Add explicit Windows path constant
- Add `if (process.platform === 'win32')` branch
- Add comment explaining platform assumptions

---

### 14. No Validation of Plugin ID Format
**Location:** `src/commands/addCommands.ts`, `src/commands/pluginCommands.ts`
**Severity:** LOW

Plugin IDs are accepted as user input without validation:

```typescript
const pluginId = keyPath[1];  // Assumed to be valid plugin ID format
```

Plugin IDs should follow a specific format (no spaces, special characters). Invalid plugin IDs could cause issues in downstream systems.

**Impact:** Invalid plugin IDs stored in config.

**Recommendation:**
- Define plugin ID validation regex (e.g., `/^[a-zA-Z0-9_-]+$/`)
- Validate plugin IDs when adding them
- Show error if plugin ID is invalid

---

### 15. Missing Error Type Guards in Exception Handlers
**Location:** Multiple files, e.g., `src/config/configWriter.ts`
**Severity:** LOW

Error handling uses generic `Error` casting without proper type guards:

```typescript
function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });  // Could throw non-Error exceptions
}

// Callers do:
} catch (error) {
  vscode.window.showErrorMessage(
    `Failed to add permission rule: ${error instanceof Error ? error.message : String(error)}`,
  );
}
```

This is actually *correct*, but many error handlers in commands don't check for `instanceof Error` before accessing `.message`.

**Impact:** Potential TypeError if non-Error objects are thrown.

**Recommendation:**
- Create a utility: `function getErrorMessage(error: unknown): string`
- Use consistently across all error handlers

---

### 16. No Tests for File System Edge Cases
**Location:** Test suite
**Severity:** LOW

The codebase lacks test coverage for:
- Corrupted JSON files
- Missing parent directories
- Permission errors
- Symlink scenarios
- Concurrent file writes
- Large JSON files

**Impact:** Bugs in production that could be caught by tests.

**Recommendation:**
- Add unit tests for `configLoader.ts` with malformed JSON
- Add tests for `fileWatcher.ts` with rapid file changes
- Mock filesystem for deterministic testing
- Test path validation with symlinks

---

### 17. Diagnostic Line Number May Be Inaccurate
**Location:** `src/validation/schemaValidator.ts`
**Severity:** LOW

The line number detection for validation issues is approximate:

```typescript
function findKeyLine(sourceText: string | undefined, key: string): number | undefined {
  if (!sourceText) return undefined;
  const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:`);
  const lines = sourceText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i;  // Finds first matching line, may not be exact key location
    }
  }
  return undefined;
}
```

If the same key appears multiple times (e.g., in different objects or nested), the regex returns the first match. The diagnostic points to wrong line.

**Impact:** Diagnostic highlights wrong location, confusing user.

**Recommendation:**
- Use a proper JSON parser to get exact line/column of keys
- Consider using `jsonc-parser` library which provides positions

---

### 18. Plugin Checkbox State Not Persisted on Reload
**Location:** `src/extension.ts` (lines 77-86)
**Severity:** LOW

Plugin checkbox state is tied to tree item state but may not reflect actual config:

```typescript
treeView.onDidChangeCheckboxState((e) => {
  for (const [item, state] of e.items) {
    const node = item as ConfigTreeNode;
    if (node.nodeType !== 'plugin') continue;
    const { filePath, keyPath } = node.nodeContext;
    if (!filePath || keyPath.length < 2) continue;
    const enabled = state === vscode.TreeItemCheckboxState.Checked;
    setPluginEnabled(filePath, keyPath[1], enabled);
  }
});
```

If the config file fails to write, the checkbox remains in the UI state but the actual config is stale. Reloading the extension would reset the checkbox.

**Impact:** UI state diverges from actual config state.

**Recommendation:**
- Only update checkbox state after write succeeds
- Roll back UI state if write fails
- Show warning if write fails

---

## Security Considerations

### 19. Path Traversal Risk in File Operations
**Location:** `src/commands/openFileCommands.ts`, `src/config/configWriter.ts`
**Severity:** MEDIUM (Security)

Insufficient validation on file paths before operations allows potential directory traversal:

```typescript
const dir = filePath.substring(0, filePath.lastIndexOf('/'));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(filePath, content, 'utf-8');
```

A malicious node context could construct paths like `/../../etc/passwd`. While the config paths are internally generated, they could be exploited if the extension loads config from untrusted sources.

**Recommendation:**
- Always use `path.resolve()` and validate against base directories
- Check that resolved path stays within expected boundary
- Use a whitelist of allowed directories

---

### 20. Command Arguments Not Validated
**Location:** `src/commands/openFileCommands.ts` (revealInFile)
**Severity:** MEDIUM (Security)

The `revealInFile` command accepts filePath as argument without validation:

```typescript
vscode.commands.registerCommand(
  'claudeConfig.revealInFile',
  async (filePath: string, keyPath: string[]) => {
    if (!filePath || !fs.existsSync(filePath)) return;
    // ...
  },
);
```

A VS Code command can be triggered from extensions/user scripts with arbitrary arguments. If `filePath` is attacker-controlled, it could access files outside the config scope.

**Recommendation:**
- Validate that filePath is one of the known config file paths
- Use a whitelist of allowed file paths
- Never construct paths from untrusted user input

---

### 21. JSON Parse Allows Arbitrary Objects
**Location:** `src/utils/json.ts`
**Severity:** LOW (Design)

The JSON parser accepts any valid JSON, which could be a prototype pollution risk:

```typescript
export function safeParseJson<T = unknown>(content: string): ParseResult<T> {
  try {
    const cleaned = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
    const data = JSON.parse(cleaned) as T;  // No validation
    return { data };
  } catch (e) {
    // ...
  }
}
```

If a config file contains `__proto__` or `constructor` keys, it could theoretically affect object prototypes. Modern Node.js mitigates this, but it's a consideration.

**Recommendation:**
- After parsing, validate structure against expected schema
- Filter out dangerous keys if needed
- Use Object.assign or spread operator to create clean objects

---

## Performance Concerns

### 22. No Pagination for Large Config Files
**Location:** `src/tree/configTreeProvider.ts`, tree node files
**Severity:** LOW (Performance)

If a config has thousands of rules (e.g., 5000 permission rules), the entire tree is built at once:

```typescript
getChildren(element?: ConfigTreeNode): ConfigTreeNode[] {
  const cacheKey = element?.id ?? '__root__';
  const cached = this.childrenCache.get(cacheKey);
  if (cached) return cached;

  let children: ConfigTreeNode[];
  if (element) {
    children = element.getChildren();  // Could be huge array
  }
  // ...
  this.childrenCache.set(cacheKey, children);
  return children;
}
```

No lazy loading or pagination. Tree rendering could be slow for large configs.

**Impact:** UI lag for users with large config files.

**Recommendation:**
- Implement virtual scrolling / lazy loading for large sections
- Limit initial children count and provide "Load More" button
- Profile tree rendering with large configs

---

### 23. File Reading on Every Validation Check
**Location:** `src/validation/diagnostics.ts`
**Severity:** LOW (Performance)

Each validation reads the file from disk:

```typescript
validateFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    // ...
    return;
  }

  let sourceText: string;
  try {
    sourceText = fs.readFileSync(filePath, 'utf-8');  // Sync read, blocks
  } catch {
    return;
  }

  const parsed = safeParseJson<Record<string, unknown>>(sourceText);
  const uri = vscode.Uri.file(filePath);

  if (parsed.error) {
    // ...
  }

  const issues = validateConfig(parsed.data, sourceText);
}
```

Uses synchronous I/O which blocks the extension host. For large files, this could freeze the UI.

**Impact:** Potential UI freeze during validation.

**Recommendation:**
- Use async I/O (`fs.promises.readFile`)
- Cache file content when possible
- Throttle validation for frequently-changing files

---

### 24. No Cache Invalidation for Override Resolver
**Location:** `src/config/overrideResolver.ts`
**Severity:** LOW (Performance)

Override resolution functions are called frequently and perform linear searches:

```typescript
function findHighestPrecedenceScope(
  key: string,
  allScopes: ScopedConfig[],
): ConfigScope | undefined {
  let best: ConfigScope | undefined;
  let bestPrecedence = Infinity;

  for (const sc of allScopes) {  // Linear search each time
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
```

These results could be cached per scope set. Rebuilding the tree calls these functions many times with the same inputs.

**Impact:** Unnecessary computation when tree refreshes.

**Recommendation:**
- Add memoization for override resolution
- Invalidate cache only when config changes
- Profile tree rebuild performance

---

## Fragile Patterns

### 25. Tight Coupling Between Nodes and ConfigStore
**Location:** `src/tree/nodes/*.ts`
**Severity:** LOW (Design)

Tree nodes construct themselves from scoped configs without a clear separation:

```typescript
// In ScopeNode, PermissionGroupNode, etc.
constructor(
  scopedConfig: ScopedConfig,
  allScopes: ScopedConfig[],
  workspaceFolderUri?: string,
  sectionFilter?: ReadonlySet<SectionType>,
) {
  // Nodes directly access config data
  const permissions = scopedConfig.config.permissions;
  // ...
}
```

Nodes are tightly coupled to config structure. Changes to config format require updating many node files.

**Impact:** Hard to refactor, higher maintenance burden.

**Recommendation:**
- Consider a data adapter layer between ConfigStore and tree nodes
- Reduce direct config access in nodes
- Use factory functions for node creation

---

### 26. Magic String Constants in Tree Node Implementation
**Location:** Multiple node files
**Severity:** LOW

Tree item construction uses magic strings without constants:

```typescript
// In nodes
const codeSection = node.nodeContext.section;
if (codeSection === SectionType.Permissions) {
  // ...
}
```

Some magic strings appear only in conditional logic, not constants. Typos would cause silent failures.

**Impact:** Hard to find and refactor.

**Recommendation:**
- Extract section/type strings to constants or enum
- Use type guards to enforce strings are from known set

---

## Documentation Gaps

### 27. No JSDoc for Public Functions
**Location:** Utility functions, command files
**Severity:** LOW

Many exported functions lack documentation:

```typescript
// No JSDoc
export function safeParseJson<T = unknown>(content: string): ParseResult<T> {
  // ...
}

// No JSDoc
export function validateConfig(config: unknown, sourceText?: string): ValidationIssue[] {
  // ...
}
```

IDE hover help is minimal. Developers must read implementation to understand behavior.

**Impact:** Harder to use APIs, potential misuse.

**Recommendation:**
- Add JSDoc comments for all exported functions
- Document parameters, return type, exceptions
- Add usage examples for complex functions

---

## Summary Table

| # | Issue | Severity | Type | File |
|---|-------|----------|------|------|
| 1 | Silent file write failures | HIGH | Error Handling | configWriter.ts |
| 2 | File watcher race condition | HIGH | Concurrency | fileWatcher.ts, configModel.ts |
| 3 | Unhandled JSON parse errors | HIGH | Error Handling | configModel.ts |
| 4 | No file path validation | HIGH | Security | openFileCommands.ts |
| 5 | Memory leak in editor-tree sync | MEDIUM | Performance | extension.ts |
| 6 | Incomplete tree node error handling | MEDIUM | Robustness | configTreeProvider.ts |
| 7 | Array index out of bounds | MEDIUM | Robustness | editCommands.ts, deleteCommands.ts |
| 8 | Plugin cache not invalidated | MEDIUM | Correctness | pluginMetadata.ts |
| 9 | No MCP config validation | MEDIUM | Error Handling | configModel.ts |
| 10 | Fragile JSON line detection | MEDIUM | Robustness | jsonLocation.ts |
| 11 | No debounce timeout ceiling | MEDIUM | Performance | fileWatcher.ts |
| 12 | Unused parameters | LOW | Code Quality | addCommands.ts, editCommands.ts |
| 13 | Windows path support missing | LOW | Maintenance | platform.ts |
| 14 | No plugin ID validation | LOW | Robustness | addCommands.ts |
| 15 | Missing error type guards | LOW | Robustness | Multiple |
| 16 | No edge case tests | LOW | Testing | Test suite |
| 17 | Diagnostic line number inaccuracy | LOW | UX | schemaValidator.ts |
| 18 | Checkbox state not persisted | LOW | Correctness | extension.ts |
| 19 | Path traversal risk | MEDIUM | Security | openFileCommands.ts |
| 20 | Command arguments not validated | MEDIUM | Security | openFileCommands.ts |
| 21 | JSON parse allows arbitrary objects | LOW | Security | json.ts |
| 22 | No pagination for large configs | LOW | Performance | configTreeProvider.ts |
| 23 | Sync file I/O in validation | LOW | Performance | diagnostics.ts |
| 24 | No override resolver cache | LOW | Performance | overrideResolver.ts |
| 25 | Tight node-config coupling | LOW | Design | tree/nodes/*.ts |
| 26 | Magic strings in nodes | LOW | Code Quality | tree/nodes/*.ts |
| 27 | Missing JSDoc | LOW | Documentation | utils/*.ts |

---

## Recommended Fixes (Priority Order)

### Immediate (Next Release)
1. Add error handling and validation to `writeJsonFile()` ⚠️ Data loss risk
2. Implement write acknowledgment tracking in ConfigStore
3. Add file path validation with symlink checks
4. Handle JSON parse errors in configModel.ts
5. Add plugin cache invalidation on config reload

### Short Term (Next 2-3 Weeks)
6. Fix editor-tree sync memory leak with debounce manager
7. Add try-catch around tree node operations
8. Implement proper JSON location detection
9. Add file debounce timeout ceiling
10. Add comprehensive tests for edge cases

### Medium Term (Next Sprint)
11. Replace sync file I/O with async in diagnostics
12. Implement override resolution memoization
13. Add pagination/lazy loading for large configs
14. Improve error messages with file watcher diagnostics

### Long Term (Technical Debt)
15. Add JSDoc documentation
16. Refactor node-config tight coupling
17. Add Windows path support
18. Implement proper JSON parser for diagnostics
