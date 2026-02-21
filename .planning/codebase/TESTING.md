# Testing Guide

## Test Framework

The project uses **Mocha** v10.2.0 as the test framework with the VS Code test runner:

- **Framework**: Mocha (TDD/BDD style)
- **Types**: @types/mocha ^10.0.6
- **VS Code Test Adapter**: @vscode/test-electron ^2.3.8
- **Language**: TypeScript compiled via `tsconfig.test.json`

## Current Test Status

**As of February 2026**: This project has **no test files** implemented. The test infrastructure is fully set up but no tests have been written.

- No `.test.ts` or `.spec.ts` files found in the codebase
- Test configuration exists in `tsconfig.test.json` and `package.json`
- Test fixtures directory exists at `test-fixtures/` with sample config files
- Test runner entry point needs to be created at `test/runTests.ts`

## Test Configuration

### TypeScript Configuration for Tests

File: `tsconfig.test.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "out"
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- Extends the main tsconfig (keeps all strict settings)
- Changes output directory to `out/` (separate from `dist/`)
- Includes both `src/` and `test/` directories for compilation

### Test Runner Setup

File: `package.json`

```json
{
  "scripts": {
    "test": "tsc -p tsconfig.test.json && node ./out/test/runTests.js",
    "pretest": "npm run compile"
  }
}
```

Execution flow:
1. **pretest** hook: Compile extension via `npm run compile` (ensures dist/ is up to date)
2. **test** step 1: Type-check and compile tests using `tsconfig.test.json` into `out/`
3. **test** step 2: Run tests with `node ./out/test/runTests.js` (VS Code test runner adapter)

### Build Artifacts

- Extension build: `dist/extension.js` (production bundle)
- Test compilation: `out/` directory (test runner + test files)
- Source maps: Generated for debugging

## Expected Test Structure

When tests are implemented, follow this structure:

### Directory Layout

```
test/
├── runTests.ts              # Entry point (required for VS Code test runner)
├── suite/                   # Test suites organized by feature/module
│   ├── config.test.ts       # Config loading, discovery, writing
│   ├── validation.test.ts   # Schema validation, diagnostics
│   ├── tree.test.ts         # Tree provider, node construction
│   ├── commands.test.ts     # Command handlers
│   ├── utils.test.ts        # Utility functions (permissions, platform, JSON)
│   └── integration.test.ts  # Integration tests (config → tree → UI)
└── fixtures/                # Reusable test data
    ├── .claude/
    │   ├── settings.json
    │   ├── settings.local.json
    │   ├── invalid.json
    │   └── minimal.json
    └── mcp/
        └── client.json
```

### Test File Pattern

Expected Mocha test file structure:

```typescript
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { loadConfigFile } from '../../src/config/configLoader';

suite('Config Loader', () => {
  const fixturesDir = path.join(__dirname, '../fixtures');

  test('should load valid config file', () => {
    const result = loadConfigFile(path.join(fixturesDir, '.claude/settings.json'));
    assert.strictEqual(result.error, undefined);
    assert.ok(result.data);
  });

  test('should handle missing files gracefully', () => {
    const result = loadConfigFile('/nonexistent/path.json');
    assert.strictEqual(result.data, {});
  });

  test('should parse JSON with BOM', () => {
    // Test BOM handling in safeParseJson
    const bomContent = '\ufeff{"key": "value"}';
    const result = safeParseJson<Record<string, unknown>>(bomContent);
    assert.strictEqual(result.error, undefined);
    assert.deepStrictEqual(result.data, { key: 'value' });
  });
});
```

### Test Entry Point

Create `test/runTests.ts`:

```typescript
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10000,  // Mocha timeout in milliseconds
  });

  const testsDir = path.join(__dirname, 'suite');
  const files = await glob('**/**.test.js', { cwd: testsDir });

  for (const file of files) {
    mocha.addFile(path.resolve(testsDir, file));
  }

  return new Promise((c, e) => {
    mocha.run((failures) => {
      if (failures > 0) {
        e(new Error(`${failures} tests failed`));
      } else {
        c();
      }
    });
  });
}
```

Then export and run via VS Code:
```typescript
import { run } from './runTests';

if (require.main === module) {
  run().catch(process.exit);
}
```

## Recommended Testing Areas

Based on the codebase architecture, these modules should be tested (in priority order):

### 1. JSON Utilities (`src/utils/json.ts`)

**What to test**:
- `safeParseJson()` handles valid JSON
- `safeParseJson()` handles invalid JSON with error
- `safeParseJson()` strips BOM from content
- `readJsonFile()` reads existing files
- `readJsonFile()` handles missing files (returns empty object)
- `writeJsonFile()` writes formatted JSON (2 spaces, trailing newline)
- `writeJsonFile()` creates parent directories

```typescript
test('safeParseJson should handle valid JSON', () => {
  const result = safeParseJson<{ key: string }>('{"key": "value"}');
  assert.strictEqual(result.error, undefined);
  assert.deepStrictEqual(result.data, { key: 'value' });
});

test('safeParseJson should handle invalid JSON', () => {
  const result = safeParseJson('{ invalid }');
  assert.ok(result.error);
  assert.ok(result.error.includes('JSON'));
});

test('safeParseJson should strip BOM', () => {
  const bomJson = '\ufeff{"test": true}';
  const result = safeParseJson<Record<string, unknown>>(bomJson);
  assert.strictEqual(result.error, undefined);
  assert.strictEqual(result.data.test, true);
});

test('readJsonFile should handle ENOENT gracefully', () => {
  const result = readJsonFile('/nonexistent/file.json');
  assert.deepStrictEqual(result.data, {});
});

test('writeJsonFile should create parent directories', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  try {
    const filePath = path.join(tmpDir, 'subdir/test.json');
    writeJsonFile(filePath, { test: true });
    assert.ok(fs.existsSync(filePath));
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('"test"'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});
```

### 2. Permission Utilities (`src/utils/permissions.ts`)

**What to test**:
- `parsePermissionRule()` extracts tool and specifier
- `parsePermissionRule()` handles rules with and without specifier
- `parsePermissionRule()` handles nested parentheses
- `formatPermissionRule()` formats back correctly
- `rulesOverlap()` detects wildcard matches
- `rulesOverlap()` rejects different tools

```typescript
test('parsePermissionRule should extract tool and specifier', () => {
  const parsed = parsePermissionRule('Bash(npm run *)');
  assert.strictEqual(parsed.tool, 'Bash');
  assert.strictEqual(parsed.specifier, 'npm run *');
});

test('parsePermissionRule should handle rule without specifier', () => {
  const parsed = parsePermissionRule('Bash');
  assert.strictEqual(parsed.tool, 'Bash');
  assert.strictEqual(parsed.specifier, undefined);
});

test('rulesOverlap should match wildcards', () => {
  const overlaps = rulesOverlap('Bash(npm run *)', 'Bash(npm run test)');
  assert.strictEqual(overlaps, true);
});

test('rulesOverlap should not match different tools', () => {
  const overlaps = rulesOverlap('Bash(npm)', 'WebFetch(*)');
  assert.strictEqual(overlaps, false);
});

test('formatPermissionRule should reverse parse', () => {
  const parsed = { tool: 'Bash', specifier: 'npm run *' };
  const formatted = formatPermissionRule(parsed);
  assert.strictEqual(formatted, 'Bash(npm run *)');
});
```

### 3. Config Discovery (`src/config/configDiscovery.ts`)

**What to test**:
- Discovers config files at all four scopes (when they exist)
- Handles missing scopes gracefully
- Respects platform-specific paths
- Discovers workspace folder configs

```typescript
test('should discover user config at standard path', () => {
  const discovered = discoverConfigPaths();
  assert.ok(discovered);
  // Check structure even if file doesn't exist
  assert.ok('user' in discovered);
});

test('should mark files as existing or missing', () => {
  const discovered = discoverConfigPaths();
  // Can iterate over scopes
  for (const scope of ['managed', 'user', 'projectShared', 'projectLocal']) {
    assert.ok(scope in discovered);
    assert.ok('exists' in discovered[scope]);
  }
});
```

### 4. Config Loader (`src/config/configLoader.ts`)

**What to test**:
- Loads valid config JSON files
- Returns typed `ParseResult<T>`
- Handles missing files (ENOENT)
- Handles parse errors in JSON
- Handles invalid file permissions (EACCES)

```typescript
test('loadConfigFile should parse valid config', () => {
  const tmpFile = path.join(os.tmpdir(), 'valid.json');
  fs.writeFileSync(tmpFile, JSON.stringify({ model: 'test-model' }));
  try {
    const result = loadConfigFile(tmpFile);
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.data.model, 'test-model');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('loadConfigFile should handle missing files', () => {
  const result = loadConfigFile('/nonexistent/config.json');
  assert.deepStrictEqual(result.data, {});
});

test('loadMcpFile should return McpConfig type', () => {
  const result = loadMcpFile('/nonexistent/mcp.json');
  assert.ok('servers' in result.data);  // McpConfig interface
});
```

### 5. Schema Validator (`src/validation/schemaValidator.ts`)

**What to test**:
- Validates permission rule categories (allow/deny/ask)
- Checks hook event types against enum
- Validates scalar types (string, boolean, number)
- Reports unknown top-level keys as warnings
- Returns structured `ValidationIssue[]`
- Maps line numbers when sourceText provided

```typescript
test('should report invalid hook event as error', () => {
  const config = { hooks: { InvalidEvent: [] } };
  const issues = validateConfig(config);
  const hasError = issues.some(i => i.severity === 'error' && i.path.includes('InvalidEvent'));
  assert.ok(hasError);
});

test('should warn about unknown top-level key', () => {
  const config = { unknownKey: 'value' };
  const issues = validateConfig(config);
  const hasWarning = issues.some(i => i.path === 'unknownKey' && i.severity === 'warning');
  assert.ok(hasWarning);
});

test('should validate scalar types', () => {
  const config = { model: 123 };  // Should be string
  const issues = validateConfig(config);
  const hasTypeError = issues.some(i => i.path === 'model' && i.severity === 'error');
  assert.ok(hasTypeError);
});

test('should find line numbers in sourceText', () => {
  const sourceText = '{\n  "model": "test",\n  "unknown": true\n}';
  const config = { model: 'test', unknown: true };
  const issues = validateConfig(config, sourceText);
  const unknownIssue = issues.find(i => i.path === 'unknown');
  assert.ok(unknownIssue && unknownIssue.line !== undefined);
});
```

### 6. Config Writer (`src/config/configWriter.ts`)

**What to test** (use temp files for isolation):
- `addPermissionRule()` creates nested structure
- `addPermissionRule()` doesn't add duplicates
- `setEnvVar()` sets or updates environment variable
- `setScalarSetting()` sets top-level setting
- `deleteItem()` removes items and cleans up empty objects
- `setMcpServer()` creates MCP server entries
- File path validation (rejects traversal, symlinks)

```typescript
function createTempFile(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  return path.join(tmpDir, 'settings.json');
}

function cleanupTempFile(tmpFile: string): void {
  const tmpDir = path.dirname(tmpFile);
  fs.rmSync(tmpDir, { recursive: true });
}

test('addPermissionRule should create permissions structure', () => {
  const tmpFile = createTempFile();
  try {
    addPermissionRule(tmpFile, PermissionCategory.Allow, 'Bash(npm run *)');
    const result = readJsonFile(tmpFile);
    assert.ok(result.data.permissions?.allow?.includes('Bash(npm run *)'));
  } finally {
    cleanupTempFile(tmpFile);
  }
});

test('addPermissionRule should not add duplicates', () => {
  const tmpFile = createTempFile();
  try {
    addPermissionRule(tmpFile, PermissionCategory.Allow, 'Bash(npm run *)');
    addPermissionRule(tmpFile, PermissionCategory.Allow, 'Bash(npm run *)');
    const result = readJsonFile(tmpFile);
    const count = result.data.permissions?.allow?.length ?? 0;
    assert.strictEqual(count, 1);
  } finally {
    cleanupTempFile(tmpFile);
  }
});

test('setEnvVar should set environment variable', () => {
  const tmpFile = createTempFile();
  try {
    setEnvVar(tmpFile, 'NODE_ENV', 'production');
    const result = readJsonFile(tmpFile);
    assert.strictEqual(result.data.env?.NODE_ENV, 'production');
  } finally {
    cleanupTempFile(tmpFile);
  }
});

test('deleteItem should clean up empty objects', () => {
  const tmpFile = createTempFile();
  try {
    setEnvVar(tmpFile, 'TEST_VAR', 'value');
    deleteItem(tmpFile, ['env', 'TEST_VAR']);
    const result = readJsonFile(tmpFile);
    // env object should be removed if empty
    assert.strictEqual(result.data.env, undefined);
  } finally {
    cleanupTempFile(tmpFile);
  }
});

test('validateConfigPath should reject path traversal', () => {
  assert.throws(() => {
    validateConfigPath('../../../etc/passwd');
  }, /path traversal/);
});

test('validateConfigPath should reject symlinks', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  try {
    const symlink = path.join(tmpDir, 'link.json');
    const target = path.join(tmpDir, 'target.json');
    fs.writeFileSync(target, '{}');
    fs.symlinkSync(target, symlink);
    assert.throws(() => {
      validateConfigPath(symlink);
    }, /symbolic link/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});
```

### 7. Override Resolver (`src/config/overrideResolver.ts`)

**What to test**:
- Correctly resolves value from highest precedence scope
- Identifies overridden values
- Respects scope precedence (managed > projectLocal > projectShared > user)
- Returns complete `ResolvedValue<T>` metadata

```typescript
test('should resolve value from highest precedence scope', () => {
  const scopes: ScopedConfig[] = [
    { scope: ConfigScope.User, data: { model: 'user-model' }, fileExists: true },
    { scope: ConfigScope.ProjectShared, data: { model: 'project-model' }, fileExists: true },
  ];
  const resolved = resolveScalarValue(scopes, 'model');
  assert.strictEqual(resolved.effectiveValue, 'project-model');
  assert.strictEqual(resolved.definedInScope, ConfigScope.ProjectShared);
});

test('should mark value as overridden', () => {
  const scopes: ScopedConfig[] = [
    { scope: ConfigScope.User, data: { model: 'user-model' }, fileExists: true },
    { scope: ConfigScope.ProjectLocal, data: { model: 'local-model' }, fileExists: true },
  ];
  const userScope = scopes[0];
  const resolved = resolveScalarValue(scopes, 'model', userScope);
  assert.strictEqual(resolved.isOverridden, true);
  assert.strictEqual(resolved.overriddenByScope, ConfigScope.ProjectLocal);
});

test('should handle missing values gracefully', () => {
  const scopes: ScopedConfig[] = [
    { scope: ConfigScope.User, data: {}, fileExists: true },
  ];
  const resolved = resolveScalarValue(scopes, 'missingKey');
  assert.strictEqual(resolved.effectiveValue, undefined);
  assert.strictEqual(resolved.definedInScope, undefined);
});
```

### 8. Tree Node Construction (`src/tree/nodes/*.ts`)

**What to test**:
- Node hierarchy is correctly built
- `contextValue` is correctly computed
- Node IDs are unique and stable
- `finalize()` is called properly
- Child nodes are generated correctly

```typescript
test('should compute contextValue for editable node', () => {
  const ctx: NodeContext = {
    scope: ConfigScope.User,
    keyPath: ['env', 'VAR'],
    filePath: '/test/settings.json',
    isReadOnly: false,
    isOverridden: false,
  };
  const node = new EnvVarNode('VAR=value', ctx);
  assert.strictEqual(node.contextValue, 'envVar.editable');
});

test('should add .overridden suffix when overridden', () => {
  const ctx: NodeContext = {
    scope: ConfigScope.User,
    keyPath: ['env', 'VAR'],
    filePath: '/test/settings.json',
    isReadOnly: false,
    isOverridden: true,
    overriddenByScope: ConfigScope.ProjectShared,
  };
  const node = new EnvVarNode('VAR=value', ctx);
  assert.strictEqual(node.contextValue, 'envVar.editable.overridden');
});

test('should mark read-only nodes correctly', () => {
  const ctx: NodeContext = {
    scope: ConfigScope.Managed,
    keyPath: ['permissions'],
    filePath: '/managed/settings.json',
    isReadOnly: true,
    isOverridden: false,
  };
  const node = new SectionNode('Permissions', SectionType.Permissions, ctx);
  assert.strictEqual(node.contextValue, 'section.readOnly');
});

test('node ID should be unique and stable', () => {
  const ctx: NodeContext = {
    scope: ConfigScope.User,
    keyPath: ['env', 'VAR'],
    filePath: '/test/settings.json',
    isReadOnly: false,
    isOverridden: false,
    workspaceFolderUri: 'file:///workspace',
  };
  const node1 = new EnvVarNode('VAR=value', ctx);
  const node2 = new EnvVarNode('VAR=value', ctx);
  assert.strictEqual(node1.id, node2.id);
  assert.ok(node1.id?.includes('VAR'));
});

test('ScopeNode should return section children', () => {
  const scopeCtx: NodeContext = {
    scope: ConfigScope.User,
    keyPath: [],
    filePath: '/test/settings.json',
    isReadOnly: false,
    isOverridden: false,
  };
  const config = {
    permissions: { allow: [] },
    env: { TEST: 'value' },
  };
  const scopeNode = new ScopeNode(scopeCtx, config);
  const children = scopeNode.getChildren();
  assert.ok(children.length > 0);
  assert.ok(children.some(c => c.nodeType === 'section'));
});
```

### 9. Config Tree Provider (`src/tree/configTreeProvider.ts`)

**What to test**:
- Builds tree hierarchy correctly
- Caches children properly
- Refreshes on config change
- Handles multi-root workspaces
- Section filtering works

```typescript
test('should build tree hierarchy', () => {
  const mockStore = createMockConfigStore();
  const provider = new ConfigTreeProvider(mockStore);
  const rootChildren = provider.getChildren();
  assert.ok(rootChildren.length > 0);
  assert.ok(rootChildren.some(c => c.nodeType === 'scope'));
});

test('should cache children', () => {
  const mockStore = createMockConfigStore();
  const provider = new ConfigTreeProvider(mockStore);
  const root = provider.getChildren();
  const cached = provider.getChildren();
  assert.strictEqual(root.length, cached.length);
});

test('should refresh on config change', (done) => {
  const mockStore = createMockConfigStore();
  const provider = new ConfigTreeProvider(mockStore);
  let refreshCount = 0;
  provider.onDidChangeTreeData(() => refreshCount++);
  mockStore._fireChange();
  setTimeout(() => {
    assert.ok(refreshCount > 0);
    done();
  }, 50);
});
```

### 10. Validation Utils (`src/utils/validation.ts`)

**What to test**:
- `validateKeyPath()` accepts valid paths
- `validateKeyPath()` rejects short paths
- Proper error messages shown to user

```typescript
test('validateKeyPath should accept valid paths', () => {
  const valid = validateKeyPath(['env', 'VAR'], 2, 'test');
  assert.strictEqual(valid, true);
});

test('validateKeyPath should reject short paths', () => {
  const invalid = validateKeyPath(['env'], 2, 'test');
  assert.strictEqual(invalid, false);
});
```

## Test Fixtures

Directory: `test-fixtures/`

### Current Fixtures

Located at `/Users/agnislav/Projects/Dardes/claude-code-config-manager/test-fixtures/`:
- `.claude/` — directory structure for testing config discovery

### Recommended Fixtures to Add

Create comprehensive fixtures in `test-fixtures/`:

```
test-fixtures/
├── .claude/
│   ├── settings.json        # Valid sample config (comprehensive)
│   ├── settings.local.json  # Valid local override
│   ├── invalid.json         # Invalid JSON for error cases
│   ├── minimal.json         # Minimal valid config
│   ├── with-bom.json        # Config with BOM prefix
│   └── permissions.json     # Config focused on permissions
├── mcp/
│   └── client.json          # Valid MCP config
└── invalid-json/
    ├── malformed.json       # Syntax errors
    └── truncated.json       # Incomplete JSON
```

Example comprehensive fixture (`test-fixtures/.claude/settings.json`):

```json
{
  "permissions": {
    "allow": ["Bash(npm run *)", "ModifyFile(src/**/*.ts)"],
    "deny": ["WebFetch(localhost:*)", "Bash(rm -rf)"],
    "ask": ["ModifyFile(**/*)", "WebFetch(*)"]
  },
  "env": {
    "NODE_ENV": "production",
    "DEBUG": "false",
    "CUSTOM_VAR": "custom_value"
  },
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": false,
    "excludedCommands": ["sudo", "su"],
    "network": {
      "allowedDomains": ["github.com", "npm.org"],
      "deniedDomains": ["localhost", "127.0.0.1"]
    }
  },
  "hooks": {
    "SessionStart": [
      {
        "matcher": "workspace:typescript",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "You are working with TypeScript"
          }
        ]
      }
    ]
  },
  "model": "claude-opus",
  "outputStyle": "streaming"
}
```

Minimal fixture (`test-fixtures/.claude/minimal.json`):

```json
{
  "model": "claude-opus"
}
```

## Mocking Patterns

### VS Code API Mocking

For testing tree providers and command handlers, mock VS Code APIs:

```typescript
// Simple mock
const mockContext: vscode.ExtensionContext = {
  subscriptions: [],
  workspaceState: {
    get: () => undefined,
    update: async () => {},
    keys: () => [],
  },
  // ... other required properties
} as any;

// Or use a mocking library (if added as dev dependency):
import * as sinon from 'sinon';

test('should register command', () => {
  const stub = sinon.stub(vscode.commands, 'registerCommand').returns({
    dispose: () => {},
  });
  registerAddCommands(mockContext, mockConfigStore);
  assert.ok(stub.called);
  stub.restore();
});
```

### File System Mocking

Use Node's built-in `fs` for temporary files:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
}

function cleanupTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true });
}

test('should write config file', () => {
  const tmpDir = createTempDir();
  try {
    const filePath = path.join(tmpDir, 'settings.json');
    writeJsonFile(filePath, { key: 'value' });
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('"key"'));
  } finally {
    cleanupTempDir(tmpDir);
  }
});
```

### ConfigStore Mock

Create a simple mock for testing components that depend on ConfigStore:

```typescript
class MockConfigStore implements Partial<ConfigStore> {
  private _onDidChange = new vscode.EventEmitter<string | undefined>();
  readonly onDidChange = this._onDidChange.event;

  private configs = new Map<string, ScopedConfig[]>();

  constructor(configs?: Map<string, ScopedConfig[]>) {
    if (configs) {
      this.configs = configs;
    }
  }

  getScopedConfig(scope: ConfigScope, uri?: string): ScopedConfig | undefined {
    return this.configs.get(uri ?? '__global__')?.find(c => c.scope === scope);
  }

  getAllScopes(uri?: string): ScopedConfig[] {
    return this.configs.get(uri ?? '__global__') ?? [];
  }

  isMultiRoot(): boolean {
    return false;
  }

  _fireChange(uri?: string): void {
    this._onDidChange.fire(uri);
  }
}
```

## Running Tests

Once tests are implemented:

```bash
# Run all tests
npm run test

# Run specific test file (after compilation)
node out/test/runTests.js --grep "Config Loader"

# Run tests in watch mode (requires Mocha --watch configured)
npm run test -- --watch

# Debug tests in VS Code
# Add to .vscode/launch.json and press F5
```

### Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Run Tests",
  "program": "${workspaceFolder}/out/test/runTests.js",
  "runtimeArgs": ["--nolazy"],
  "env": { "NODE_ENV": "test" },
  "protocol": "inspector",
  "console": "integratedTerminal"
}
```

## Coverage Goals

While coverage metrics aren't enforced, aim to test:

- **Config modules** (80%+ coverage)
  - ✓ All public functions in config loader, writer, discovery
  - ✓ Happy path and error cases for JSON operations
  - ✓ Edge cases (missing files, invalid JSON, empty objects)

- **Utility functions** (85%+ coverage)
  - ✓ Permission rule parsing and overlap detection
  - ✓ Path resolution across platforms
  - ✓ Validation utilities with edge cases

- **Tree nodes** (75%+ coverage)
  - ✓ Node construction and contextValue generation
  - ✓ Children generation for each node type
  - ✓ Override detection and styling

- **Validation** (80%+ coverage)
  - ✓ All validation checks (permissions, hooks, types)
  - ✓ Error vs warning classification
  - ✓ Line number resolution

- **Commands** (60%+ coverage)
  - ✓ Core command logic (add, edit, delete, move)
  - ✓ Error handling paths
  - ✓ File write safety checks

## Testing Best Practices

### Isolation

- Use temporary directories for file operations
- Clean up after each test
- Mock VS Code APIs to avoid side effects

### Naming

- Test names describe what is being tested: `test('should load valid config file', ...)`
- Group related tests in suites: `suite('Config Loader', ...)`

### Assertions

- Use `assert` from Node.js built-in or `chai` for readable assertions
- One logical assertion per test (though multiple checks for the same concept are OK)
- Use `assert.ok()`, `assert.strictEqual()`, `assert.deepStrictEqual()`, `assert.throws()`

### Fixtures

- Reuse test fixtures from `test-fixtures/` when possible
- Create minimal fixtures for specific test cases
- Document what each fixture tests

### Error Testing

- Test both happy path and error paths
- Use `assert.throws()` for exceptions
- Validate error messages contain useful context

## Future Testing Improvements

1. **Coverage reporting** with `nyc` or `c8`
2. **Performance benchmarks** for config loading and tree building
3. **Integration tests** for config reload, file watcher, diagnostics flow
4. **Command handler tests** with mock VS Code context
5. **Multi-workspace tests** simulating multiple workspace folders
6. **CI/CD pipeline** to run tests on every commit
7. **Visual regression tests** for tree rendering (advanced)

## Current Blockers

The project structure supports testing, but implementation requires:

1. Creating `test/` directory with test files
2. Implementing `test/runTests.ts` entry point for VS Code test runner
3. Writing Mocha test suites in `test/suite/*.test.ts`
4. Creating comprehensive test fixtures
5. (Optional) Adding assertion/mocking libraries (`chai`, `sinon`) to `devDependencies`

All configuration is already in place; only test implementation is needed.
