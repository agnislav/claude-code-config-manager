# Testing Guide

## Test Framework

The project uses **Mocha** v10.2.0 as the test framework:

- **Framework**: Mocha (TDD/BDD style)
- **Types**: @types/mocha ^10.0.6
- **VS Code Test Adapter**: @vscode/test-electron ^2.3.8

## Current Test Status

**Note**: As of February 2026, this project has **no test files** implemented. The test infrastructure is set up but unused.

- No `.test.ts` or `.spec.ts` files found in the codebase
- Test configuration exists but no tests have been written
- Test fixtures directory exists at `test-fixtures/` with sample config files but no test runner

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
- Includes both `src/` and `test/` directories

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

- Step 1: Type-check and compile tests using `tsconfig.test.json` into `out/`
- Step 2: Run tests with `node ./out/test/runTests.js` (VS Code test runner)
- Pre-test hook: Compile extension before tests

## Expected Test Structure

When tests are implemented, follow this structure:

### Directory Layout

```
test/
├── runTests.ts              # Entry point (required for VS Code test runner)
├── suite/                   # Test suites by feature
│   ├── config.test.ts       # Config loading, discovery, writing
│   ├── validation.test.ts   # Schema validation, diagnostics
│   ├── tree.test.ts         # Tree provider, node construction
│   └── commands.test.ts     # Command handlers
└── fixtures/                # Test data (reuse from test-fixtures/)
```

### Test File Pattern

Expected Mocha test file structure:

```typescript
import * as assert from 'assert';
import * as path from 'path';
import { loadConfigFile } from '../../src/config/configLoader';

suite('Config Loader', () => {
  const fixturesDir = path.join(__dirname, '../../test-fixtures');

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
  });
});
```

### Test Entry Point

The test runner would look for `out/test/runTests.js`:

```typescript
import * as path from 'path';
import * as Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  const testsDir = path.join(__dirname);
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

## Recommended Testing Areas

Based on the codebase architecture, these modules should be tested:

### 1. Config Discovery (`src/config/configDiscovery.ts`)

**What to test**:
- Discovers config files at all four scopes (managed, user, project shared, project local)
- Handles missing scopes gracefully
- Respects platform-specific paths (macOS vs Linux)

```typescript
test('should find user config at ~/.claude/settings.json', () => {
  const discovered = discoverConfigPaths();
  assert.ok(discovered.user.exists || !discovered.user.exists); // Optional
});
```

### 2. Config Loader (`src/config/configLoader.ts`)

**What to test**:
- Loads valid JSON files
- Handles missing files gracefully
- Strips BOM from file content
- Returns typed `ParseResult<T>`

```typescript
test('safeParseJson should handle valid JSON', () => {
  const result = safeParseJson<{ key: string }>('{"key": "value"}');
  assert.strictEqual(result.error, undefined);
  assert.deepStrictEqual(result.data, { key: 'value' });
});

test('safeParseJson should handle invalid JSON', () => {
  const result = safeParseJson('{ invalid }');
  assert.ok(result.error);
});
```

### 3. Config Writer (`src/config/configWriter.ts`)

**What to test**:
- Adds permission rules without duplicates
- Creates nested structures (permissions, hooks, etc.)
- Cleans up empty objects on deletion
- Handles file system errors

```typescript
test('should add permission rule to new config', () => {
  const tmpFile = createTempFile();
  addPermissionRule(tmpFile, PermissionCategory.Allow, 'Bash(npm run *)');
  const result = readJsonFile(tmpFile);
  assert.ok(result.data.permissions?.allow?.includes('Bash(npm run *)'));
});
```

### 4. Validation (`src/validation/schemaValidator.ts`)

**What to test**:
- Validates permission rules
- Checks hook event types
- Validates scalar types (string, boolean, number)
- Reports unknown keys as warnings
- Returns structured `ValidationIssue[]`

```typescript
test('should report invalid hook event', () => {
  const config = { hooks: { InvalidEvent: [] } };
  const issues = validateConfig(config);
  const hasError = issues.some(i => i.severity === 'error');
  assert.ok(hasError);
});

test('should warn about unknown top-level key', () => {
  const config = { unknownKey: 'value' };
  const issues = validateConfig(config);
  const hasWarning = issues.some(i => i.path === 'unknownKey');
  assert.ok(hasWarning);
});
```

### 5. Override Resolution (`src/config/overrideResolver.ts`)

**What to test**:
- Correctly merges configs across scopes
- Identifies overridden values
- Respects scope precedence (managed > projectLocal > projectShared > user)

```typescript
test('should resolve value from highest precedence scope', () => {
  const scopes = [
    { scope: ConfigScope.User, config: { model: 'user-model' } },
    { scope: ConfigScope.ProjectShared, config: { model: 'project-model' } },
  ];
  const resolved = resolveValue(scopes, ['model']);
  assert.strictEqual(resolved.effectiveValue, 'project-model');
  assert.strictEqual(resolved.definedInScope, ConfigScope.ProjectShared);
});
```

### 6. Tree Node Construction (`src/tree/nodes/*.ts`)

**What to test**:
- Node hierarchy is correctly built
- ContextValue is correctly computed
- Node IDs are unique and stable
- Child nodes are generated correctly

```typescript
test('should compute contextValue for editable node', () => {
  const ctx: NodeContext = {
    scope: ConfigScope.User,
    keyPath: ['env', 'VAR'],
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
    isReadOnly: false,
    isOverridden: true,
    overriddenByScope: ConfigScope.ProjectShared,
  };
  const node = new EnvVarNode('VAR=value', ctx);
  assert.strictEqual(node.contextValue, 'envVar.editable.overridden');
});
```

### 7. Utilities (`src/utils/*.ts`)

**What to test**:
- Permission rule parsing (extract tool and specifier)
- Permission rule overlap detection (wildcard matching)
- Platform-specific path resolution

```typescript
test('parsePermissionRule should extract tool and specifier', () => {
  const parsed = parsePermissionRule('Bash(npm run *)');
  assert.strictEqual(parsed.tool, 'Bash');
  assert.strictEqual(parsed.specifier, 'npm run *');
});

test('rulesOverlap should match wildcards', () => {
  const overlaps = rulesOverlap('Bash(npm run *)', 'Bash(npm run test)');
  assert.strictEqual(overlaps, true);
});

test('rulesOverlap should not match different tools', () => {
  const overlaps = rulesOverlap('Bash(npm)', 'WebFetch(*)');
  assert.strictEqual(overlaps, false);
});
```

## Test Fixtures

Directory: `test-fixtures/`

Currently contains sample config files:
- `.claude/` — directory structure for testing config discovery

### Adding Fixtures

Create sample config files in `test-fixtures/`:

```
test-fixtures/
├── .claude/
│   ├── settings.json        # Valid sample config
│   ├── settings.local.json  # Valid local override
│   ├── invalid.json         # Invalid JSON for error cases
│   └── minimal.json         # Minimal valid config
└── invalid-json/
    └── malformed.json       # Test BOM handling, parse errors
```

Example valid fixture:

```json
{
  "permissions": {
    "allow": ["Bash(npm run *)"],
    "deny": ["WebFetch(localhost:*)"],
    "ask": ["ModifyFile(src/**/*.ts)"]
  },
  "env": {
    "NODE_ENV": "production",
    "DEBUG": "false"
  },
  "sandbox": {
    "enabled": true
  }
}
```

## Mocking Patterns

### VS Code API Mocking

For testing tree providers and command handlers, mock VS Code APIs:

```typescript
import * as sinon from 'sinon';  // (if added as dev dependency)
import * as vscode from 'vscode';

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

Use Node's built-in `fs` for temporary files or mock with `memfs` (if added):

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

## Running Tests

Once tests are implemented:

```bash
# Run all tests
npm run test

# Watch mode (if Mocha --watch is configured)
npm run test -- --watch

# Run specific test file
npm run test -- out/test/suite/config.test.js

# Run with grep filter
npm run test -- --grep "should load config"
```

## Coverage Goals

While coverage metrics aren't enforced, aim to test:

- ✓ All public functions in config modules (loader, writer, discovery, validation)
- ✓ All utility functions (permissions parsing, path resolution)
- ✓ All tree node types (construction, context value, children)
- ✓ Happy path and error cases
- ✓ Edge cases (missing files, invalid JSON, empty objects)

## Future Testing Improvements

1. **Add test framework** to dev dependencies if not already included (`chai` for assertions, `sinon` for mocking)
2. **Create test suite** with at least 50+ tests covering core modules
3. **Enable coverage reporting** with `nyc` or similar
4. **Set up CI/CD** to run tests on every commit
5. **Test tree provider** construction with mock ConfigStore
6. **Test command handlers** with mock VS Code context
7. **Integration tests** for config reload, file watcher, diagnostics flow

## Current Blockers

The project structure supports testing, but implementation requires:

1. Creating `test/` directory with test files
2. Implementing `test/runTests.ts` entry point
3. Writing actual Mocha test suites
4. (Optional) Adding assertion/mocking libraries if not using Node's built-in `assert`
