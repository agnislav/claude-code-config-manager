# Phase 18: Verification and Cleanup - Research

**Researched:** 2026-03-07
**Domain:** Unit testing (Mocha), dead-code cleanup, VS Code extension testing
**Confidence:** HIGH

## Summary

Phase 18 has two distinct workstreams: (1) writing unit tests for TreeViewModelBuilder covering all 7 entity types with override resolution and NodeContext verification, and (2) confirming the cleanup requirements VM-11 and VM-12 are already satisfied (they were completed as side effects of Phase 17).

The builder (`src/viewmodel/builder.ts`) is a pure data transformer: it takes a ConfigStore (which provides ScopedConfig arrays) and produces a tree of BaseVM objects. This makes it highly testable -- the tests need to mock ConfigStore's interface methods and assert on the VM output tree. The primary challenge is that the builder imports `vscode` types (ThemeIcon, ThemeColor, Uri, MarkdownString, TreeItemCollapsibleState, TreeItemCheckboxState) which are not available outside the VS Code Extension Host. The project uses `@vscode/test-electron` and Mocha, but currently has **zero test files** -- the test infrastructure was never created (noted in Phase 17 summary). Tests must either run inside the VS Code Extension Host via `@vscode/test-electron`, or mock the `vscode` module.

**Primary recommendation:** Write unit tests that run inside `@vscode/test-electron` Extension Host, using Mocha, with fixture-based ScopedConfig arrays. For cleanup, verify via automated grep assertions that the decoupling invariants hold.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Unit tests for TreeViewModelBuilder covering all 7 entity types | Builder is pure VM factory; tests create ScopedConfig fixtures, call `build()`, assert on VM tree structure. 7 entity types: permissions, settings, env vars, plugins, sandbox, hooks, MCP servers. |
| TEST-02 | Unit tests verify override resolution produces correct display state per scope | Builder calls overrideResolver functions internally; tests need multi-scope fixtures where User scope values are overridden by ProjectLocal. Assert on `isOverridden`, `description` suffix, icon ThemeColor, contextValue `.overridden` suffix. |
| TEST-03 | Unit tests verify NodeContext preservation (contextValue strings, keyPaths) | Assert `vm.nodeContext.keyPath` matches expected paths, `vm.contextValue` matches `{nodeType}.{editable|readOnly}[.overridden]` pattern, `vm.nodeContext.scope` and `vm.nodeContext.filePath` propagate correctly. |
| VM-11 | Dead override resolver imports removed from node files | Already complete -- grep confirms zero `overrideResolver` imports in `src/tree/nodes/`. Phase 17 migration eliminated all such imports. Test can verify via a grep-style assertion. |
| VM-12 | baseNode simplified -- no ScopedConfig-dependent logic | Already complete -- `src/tree/nodes/baseNode.ts` is 32 lines, imports only `BaseVM` and `NodeContext`, has no ScopedConfig reference. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mocha | ^10.2.0 | Test runner | Already in devDependencies |
| @vscode/test-electron | ^2.3.8 | VS Code Extension Host test runner | Already in devDependencies; required for `vscode` module access |
| @types/mocha | ^10.0.6 | Mocha type definitions | Already in devDependencies |
| assert (node built-in) | N/A | Assertions | Standard for VS Code extension tests; no external assertion lib needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| glob | ^10.3.10 | Test file discovery | Already in devDependencies; used by test runner to find test files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @vscode/test-electron | Mock vscode module manually | Fragile mocks for ThemeIcon/Uri/MarkdownString; Extension Host is more reliable |
| Node assert | chai | Would add a dependency; assert is sufficient for this scope |

**Installation:**
```bash
# No new packages needed -- all test dependencies already present
```

## Architecture Patterns

### Recommended Test Structure
```
test/
├── runTests.ts          # @vscode/test-electron launcher
├── suite/
│   ├── index.ts         # Mocha runner setup (glob-based test discovery)
│   └── viewmodel/
│       └── builder.test.ts  # TreeViewModelBuilder unit tests
```

### Pattern 1: ConfigStore Test Double
**What:** A minimal stub implementing only the methods TreeViewModelBuilder calls: `getWorkspaceFolderKeys()`, `getAllScopes()`, `isMultiRoot()`, `isScopeLocked()`, `getDiscoveredPaths()`.
**When to use:** Every builder test.
**Example:**
```typescript
function createMockConfigStore(
  scopedConfigs: ScopedConfig[],
  options?: { multiRoot?: boolean; lockedScopes?: ConfigScope[] }
): ConfigStore {
  const store = {
    getWorkspaceFolderKeys: () => ['__global__'],
    getAllScopes: () => scopedConfigs,
    isMultiRoot: () => options?.multiRoot ?? false,
    isScopeLocked: (scope: ConfigScope) =>
      options?.lockedScopes?.includes(scope) ?? false,
    getDiscoveredPaths: () => undefined,
  } as unknown as ConfigStore;
  return store;
}
```

### Pattern 2: ScopedConfig Fixture Factory
**What:** Helper to create ScopedConfig objects with minimal boilerplate.
**When to use:** Every test case that needs config data.
**Example:**
```typescript
function makeScopedConfig(
  scope: ConfigScope,
  config: Partial<ClaudeCodeConfig>,
  overrides?: Partial<ScopedConfig>,
): ScopedConfig {
  return {
    scope,
    filePath: `/mock/${scope}/settings.json`,
    fileExists: true,
    config: config as ClaudeCodeConfig,
    isReadOnly: scope === ConfigScope.Managed,
    ...overrides,
  };
}
```

### Pattern 3: VM Tree Traversal Helpers
**What:** Utility functions to find VMs in the builder output by kind, label, or keyPath.
**When to use:** Assertions that need to locate specific nodes in the nested VM tree.
**Example:**
```typescript
function findVM(vms: BaseVM[], kind: NodeKind, label?: string): BaseVM | undefined {
  for (const vm of vms) {
    if (vm.kind === kind && (!label || vm.label === label)) return vm;
    const found = findVM(vm.children, kind, label);
    if (found) return found;
  }
  return undefined;
}

function findAllVMs(vms: BaseVM[], kind: NodeKind): BaseVM[] {
  const result: BaseVM[] = [];
  for (const vm of vms) {
    if (vm.kind === kind) result.push(vm);
    result.push(...findAllVMs(vm.children, kind));
  }
  return result;
}
```

### Anti-Patterns to Avoid
- **Mocking vscode module outside Extension Host:** ThemeIcon, Uri, MarkdownString have complex constructors; use real vscode module via @vscode/test-electron instead.
- **Testing tree nodes directly:** Nodes are now thin wrappers; test the builder output (VMs) instead.
- **Snapshot-based testing:** VM objects contain vscode.ThemeIcon instances that don't serialize cleanly; use property-level assertions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VS Code module mocking | Custom vscode mock | @vscode/test-electron Extension Host | ThemeIcon, Uri, MarkdownString need real VS Code runtime |
| Test file discovery | Manual file list | glob + Mocha suite pattern | Standard pattern for VS Code extension tests |
| Assertion library | Custom matchers | Node assert + helper functions | Sufficient for property-level VM assertions |

**Key insight:** The builder produces plain objects (VMs) whose properties are easy to assert on. The complexity is in setting up the test environment (Extension Host), not in the assertions themselves.

## Common Pitfalls

### Pitfall 1: Missing Test Infrastructure
**What goes wrong:** The project has `tsconfig.test.json` and test dependencies but zero test files. The `npm run test` script expects `out/test/runTests.js` which does not exist.
**Why it happens:** Tests were deferred during initial development; Phase 17 noted this.
**How to avoid:** Create the full test scaffold: `test/runTests.ts`, `test/suite/index.ts`, and test files. Follow VS Code extension test boilerplate exactly.
**Warning signs:** `npm run test` fails with "Cannot find module" before any test runs.

### Pitfall 2: PluginMetadataService Singleton
**What goes wrong:** `builder.ts` calls `PluginMetadataService.getInstance().getDescription()` during plugin VM construction. In test environment, this reads from disk paths that won't exist.
**Why it happens:** Singleton pattern with filesystem access.
**How to avoid:** The method returns `undefined` when the file doesn't exist, which is safe -- the tooltip just won't have a description. No special handling needed.
**Warning signs:** None expected; just be aware the description field will be undefined in test output.

### Pitfall 3: vscode.workspace.asRelativePath in Builder
**What goes wrong:** The builder calls `vscode.workspace.asRelativePath()` for project scope descriptions. In Extension Host test environment with no actual workspace, this may return the full path.
**Why it happens:** No workspace folder open during test.
**How to avoid:** Don't assert on exact scope description strings for project scopes, or open a test workspace folder.
**Warning signs:** Scope description assertion failures in CI.

### Pitfall 4: Asserting on vscode.ThemeIcon Equality
**What goes wrong:** `assert.deepStrictEqual` on ThemeIcon objects may fail because ThemeIcon instances don't have a custom equality method.
**Why it happens:** ThemeIcon is a VS Code class, not a plain object.
**How to avoid:** Assert on `vm.icon.id` (string) and `vm.icon.color?.id` (string) separately rather than comparing ThemeIcon objects.
**Warning signs:** Tests fail with "objects not equal" on icon comparisons.

## Code Examples

### Test Scaffold: runTests.ts
```typescript
// test/runTests.ts
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '../../');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');
  await runTests({ extensionDevelopmentPath, extensionTestsPath });
}

main().catch((err) => {
  console.error('Failed to run tests', err);
  process.exit(1);
});
```

### Test Scaffold: suite/index.ts
```typescript
// test/suite/index.ts
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 10000 });
  const testsRoot = path.resolve(__dirname);

  return new Promise((resolve, reject) => {
    glob('**/**.test.js', { cwd: testsRoot }).then((files) => {
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    }).catch(reject);
  });
}
```

### Builder Test: Permissions Entity Type
```typescript
// test/suite/viewmodel/builder.test.ts (excerpt)
import * as assert from 'assert';
import { TreeViewModelBuilder } from '../../../viewmodel/builder';
import { ConfigScope, ScopedConfig } from '../../../types';
import { NodeKind } from '../../../viewmodel/types';

suite('TreeViewModelBuilder', () => {
  suite('Permissions', () => {
    test('builds permission groups for deny/ask/allow', () => {
      const configs: ScopedConfig[] = [
        makeScopedConfig(ConfigScope.User, {
          permissions: {
            allow: ['Read(*)'],
            deny: ['Bash(rm *)'],
            ask: ['Write(*)'],
          },
        }),
      ];
      const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
      const vms = builder.build();
      // Navigate: ScopeVM -> SectionVM (permissions) -> PermissionGroupVM[]
      const scope = vms[0]; // User scope
      const permSection = scope.children.find(
        (c) => c.kind === NodeKind.Section && c.label === 'Permissions'
      );
      assert.ok(permSection);
      assert.strictEqual(permSection!.children.length, 3); // deny, ask, allow
      const denyGroup = permSection!.children.find(
        (c) => c.kind === NodeKind.PermissionGroup && c.label === 'Deny'
      );
      assert.ok(denyGroup);
      assert.strictEqual(denyGroup!.children.length, 1);
      assert.strictEqual(denyGroup!.children[0].label, 'Bash(rm *)');
    });
  });
});
```

### Override Resolution Test
```typescript
test('marks User setting as overridden when ProjectLocal defines same key', () => {
  const configs: ScopedConfig[] = [
    makeScopedConfig(ConfigScope.User, { model: 'claude-3' }),
    makeScopedConfig(ConfigScope.ProjectLocal, { model: 'claude-4' }),
  ];
  const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
  const vms = builder.build();

  const userScope = vms.find((v) => v.label === 'User');
  const userSetting = findVM(userScope!.children, NodeKind.Setting, 'model');
  assert.ok(userSetting);
  assert.ok(userSetting!.nodeContext.isOverridden);
  assert.strictEqual(userSetting!.nodeContext.overriddenByScope, ConfigScope.ProjectLocal);
  assert.ok(userSetting!.contextValue.includes('overridden'));
  assert.ok(userSetting!.description.includes('overridden by'));
});
```

### NodeContext Verification Test
```typescript
test('env var NodeContext has correct keyPath and scope', () => {
  const configs: ScopedConfig[] = [
    makeScopedConfig(ConfigScope.ProjectShared, {
      env: { ANTHROPIC_API_KEY: 'sk-test' },
    }),
  ];
  const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
  const vms = builder.build();

  const envVar = findVM(vms, NodeKind.EnvVar, 'ANTHROPIC_API_KEY');
  assert.ok(envVar);
  assert.deepStrictEqual(envVar!.nodeContext.keyPath, ['env', 'ANTHROPIC_API_KEY']);
  assert.strictEqual(envVar!.nodeContext.scope, ConfigScope.ProjectShared);
  assert.strictEqual(envVar!.contextValue, 'envVar.editable');
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nodes compute display from raw config | Builder pre-computes VMs, nodes are thin wrappers | Phase 16-17 (2026-03) | Tests can assert on VMs without tree node instantiation |
| baseNode had finalize(), computeId(), etc. | baseNode is 32 lines, just maps VM to TreeItem | Phase 17 (2026-03-07) | VM-12 already satisfied |
| Node files imported overrideResolver | Only builder imports overrideResolver | Phase 17 (2026-03-07) | VM-11 already satisfied |

**Key finding:** VM-11 and VM-12 are already complete. The cleanup work is verification-only (grep assertions or manual confirmation). The real work is TEST-01, TEST-02, TEST-03.

## Open Questions

1. **Test infrastructure from scratch vs minimal**
   - What we know: Zero test files exist. `test/` directory doesn't exist. `tsconfig.test.json` exists but references non-existent `test/` directory.
   - What's unclear: Whether to create the full VS Code test scaffold or a minimal one.
   - Recommendation: Create the standard scaffold (runTests.ts + suite/index.ts) since it's needed for any future tests too. This is Wave 0 infrastructure.

2. **PluginMetadataService in tests**
   - What we know: It reads from `~/.claude/plugins/` which won't exist in CI.
   - What's unclear: Whether getDescription() returning undefined causes any assertion issues.
   - Recommendation: Accept undefined descriptions in test assertions. No mock needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha ^10.2.0 + @vscode/test-electron ^2.3.8 |
| Config file | tsconfig.test.json (exists) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | Builder produces correct VMs for all 7 entity types | unit | `npm run test` | No -- Wave 0 |
| TEST-02 | Override resolution produces correct display state | unit | `npm run test` | No -- Wave 0 |
| TEST-03 | NodeContext keyPaths and contextValues are correct | unit | `npm run test` | No -- Wave 0 |
| VM-11 | No overrideResolver imports in src/tree/nodes/ | static check | `grep -r "overrideResolver" src/tree/nodes/ && exit 1 || echo "PASS"` | N/A -- grep assertion |
| VM-12 | baseNode has no ScopedConfig logic | static check | `grep -r "ScopedConfig" src/tree/nodes/baseNode.ts && exit 1 || echo "PASS"` | N/A -- grep assertion |

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/runTests.ts` -- @vscode/test-electron launcher
- [ ] `test/suite/index.ts` -- Mocha runner with glob discovery
- [ ] `test/suite/viewmodel/builder.test.ts` -- TreeViewModelBuilder unit tests (TEST-01, TEST-02, TEST-03)
- [ ] Verify `npm run test` script works with the new test files

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `src/viewmodel/builder.ts` (1041 lines), `src/viewmodel/types.ts`, `src/tree/nodes/baseNode.ts`, `src/config/overrideResolver.ts`
- Phase 17 summary (`17-01-SUMMARY.md`) confirming VM-11/VM-12 completion
- `package.json` for existing test dependencies

### Secondary (MEDIUM confidence)
- VS Code Extension Test documentation patterns (standard @vscode/test-electron scaffold)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all dependencies already in package.json, standard VS Code test patterns
- Architecture: HIGH - builder is a pure data transformer, test approach is straightforward
- Pitfalls: HIGH - identified from direct code analysis (PluginMetadataService, ThemeIcon equality, missing test scaffold)

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- no external dependencies changing)
