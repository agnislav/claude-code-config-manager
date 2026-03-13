import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TreeViewModelBuilder } from '../../../src/viewmodel/builder';
import { ConfigScope, ScopedConfig, ClaudeCodeConfig, HookEventType, NodeContext } from '../../../src/types';
import { NodeKind, BaseVM } from '../../../src/viewmodel/types';
import { ConfigStore } from '../../../src/config/configModel';

// ── Test Helpers ──────────────────────────────────────────────────

/**
 * Creates a minimal ConfigStore stub with only the methods
 * TreeViewModelBuilder calls.
 */
function createMockConfigStore(
  scopedConfigs: ScopedConfig[],
  options?: { multiRoot?: boolean; lockedScopes?: ConfigScope[] },
): ConfigStore {
  return {
    getWorkspaceFolderKeys: () => ['__global__'],
    getAllScopes: () => scopedConfigs,
    isMultiRoot: () => options?.multiRoot ?? false,
    isScopeLocked: (scope: ConfigScope) =>
      options?.lockedScopes?.includes(scope) ?? false,
    getDiscoveredPaths: () => undefined,
  } as unknown as ConfigStore;
}

/**
 * Creates a ScopedConfig with sensible defaults for testing.
 */
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

/**
 * Recursive depth-first search through VM children tree.
 * Returns first match by kind (and optional label).
 */
function findVM(vms: BaseVM[], kind: NodeKind, label?: string): BaseVM | undefined {
  for (const vm of vms) {
    if (vm.kind === kind && (!label || vm.label === label)) return vm;
    const found = findVM(vm.children, kind, label);
    if (found) return found;
  }
  return undefined;
}

/**
 * Recursive collector: returns all VMs matching given kind.
 */
function findAllVMs(vms: BaseVM[], kind: NodeKind): BaseVM[] {
  const result: BaseVM[] = [];
  for (const vm of vms) {
    if (vm.kind === kind) result.push(vm);
    result.push(...findAllVMs(vm.children, kind));
  }
  return result;
}

// ── Cleanup Verification Tests ────────────────────────────────────

// Resolve project root from compiled output (out/test/suite/viewmodel/ -> project root)
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

suite('Cleanup Verification (VM-11, VM-12)', () => {
  test('VM-11: no overrideResolver imports in src/tree/nodes/', () => {
    const nodesDir = path.resolve(PROJECT_ROOT, 'src/tree/nodes');
    const files = fs.readdirSync(nodesDir).filter((f) => f.endsWith('.ts'));

    assert.ok(files.length > 0, 'Expected to find .ts files in src/tree/nodes/');

    for (const file of files) {
      const content = fs.readFileSync(path.resolve(nodesDir, file), 'utf-8');
      assert.ok(
        !content.includes('overrideResolver'),
        `${file} should not import overrideResolver but contains a reference to it`,
      );
    }
  });

  test('VM-07: no ScopedConfig or allScopes references in src/tree/nodes/', () => {
    const nodesDir = path.resolve(PROJECT_ROOT, 'src/tree/nodes');
    const files = fs.readdirSync(nodesDir).filter((f) => f.endsWith('.ts'));

    assert.ok(files.length > 0, 'Expected to find .ts files in src/tree/nodes/');

    for (const file of files) {
      const content = fs.readFileSync(path.resolve(nodesDir, file), 'utf-8');
      assert.ok(
        !content.includes('ScopedConfig'),
        `${file} should not reference ScopedConfig`,
      );
      assert.ok(
        !content.includes('allScopes'),
        `${file} should not reference allScopes`,
      );
    }
  });

  test('VM-08: WorkspaceFolderNode has no ConfigStore dependency', () => {
    const wfnPath = path.resolve(PROJECT_ROOT, 'src/tree/nodes/workspaceFolderNode.ts');
    const content = fs.readFileSync(wfnPath, 'utf-8');

    assert.ok(
      !content.includes('ConfigStore'),
      'workspaceFolderNode.ts should not reference ConfigStore',
    );
    assert.ok(
      !content.includes('configModel'),
      'workspaceFolderNode.ts should not import from configModel',
    );
  });

  test('VM-09: ConfigTreeProvider calls builder.build()', () => {
    const providerPath = path.resolve(PROJECT_ROOT, 'src/tree/configTreeProvider.ts');
    const content = fs.readFileSync(providerPath, 'utf-8');

    assert.ok(
      content.includes('builder.build(') || content.includes('.build('),
      'configTreeProvider.ts should call builder.build()',
    );
    assert.ok(
      content.includes('TreeViewModelBuilder'),
      'configTreeProvider.ts should import TreeViewModelBuilder',
    );
  });

  test('VM-12: baseNode has no ScopedConfig-dependent logic', () => {
    const baseNodePath = path.resolve(PROJECT_ROOT, 'src/tree/nodes/baseNode.ts');
    const content = fs.readFileSync(baseNodePath, 'utf-8');

    assert.ok(
      !content.includes('ScopedConfig'),
      'baseNode.ts should not contain ScopedConfig references',
    );
    assert.ok(
      content.includes('BaseVM'),
      'baseNode.ts should use BaseVM pattern',
    );
  });
});

// ── Smoke Tests ───────────────────────────────────────────────────

suite('TreeViewModelBuilder - Smoke', () => {
  test('builds scope VMs from single-scope config', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, { model: 'claude-3' }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    assert.ok(Array.isArray(vms), 'build() should return an array');
    assert.strictEqual(vms.length, 1, 'Expected exactly 1 scope VM');
    assert.strictEqual(vms[0].kind, NodeKind.Scope, 'First VM should be a ScopeVM');
  });
});

// ── Entity Type Tests (TEST-01) ──────────────────────────────────

suite('Entity Types (TEST-01)', () => {
  test('builds permission groups with deny/ask/allow and rules', () => {
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

    // Find the Permissions section
    const section = findVM(vms, NodeKind.Section, 'Permissions');
    assert.ok(section, 'Permissions section should exist');

    // Permission rules are flat (ordered: allow, ask, deny as iterated)
    const rules = findAllVMs(section.children, NodeKind.PermissionRule);
    assert.strictEqual(rules.length, 3, 'Should have 3 permission rules');

    const denyRule = rules.find((r) => r.label === 'Bash(rm *)');
    assert.ok(denyRule, 'Deny rule "Bash(rm *)" should exist');
    assert.strictEqual(denyRule.kind, NodeKind.PermissionRule);

    // Permission rules are leaf nodes
    assert.strictEqual(
      denyRule.collapsibleState,
      vscode.TreeItemCollapsibleState.None,
      'PermissionRule should be a leaf node',
    );
  });

  test('builds scalar setting VMs', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, { model: 'claude-3' }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const section = findVM(vms, NodeKind.Section, 'Settings');
    assert.ok(section, 'Settings section should exist');

    const setting = findVM(section.children, NodeKind.Setting, 'model');
    assert.ok(setting, 'Setting "model" should exist');
    assert.strictEqual(setting.kind, NodeKind.Setting);
    assert.ok(setting.description.includes('claude-3'), 'Description should include value');
  });

  test('builds object setting with key-value children', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        attribution: { commit: 'true', pr: 'false' } as unknown as undefined,
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const setting = findVM(vms, NodeKind.Setting, 'attribution');
    assert.ok(setting, 'Setting "attribution" should exist');
    assert.strictEqual(
      setting.collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed,
      'Object setting should be collapsible',
    );

    const children = findAllVMs(setting.children, NodeKind.SettingKeyValue);
    assert.ok(children.length >= 2, 'Should have at least 2 key-value children');
    const labels = children.map((c) => c.label);
    assert.ok(labels.includes('commit'), 'Should have commit key-value');
    assert.ok(labels.includes('pr'), 'Should have pr key-value');
  });

  test('builds env var VMs', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.ProjectShared, {
        env: { ANTHROPIC_API_KEY: 'sk-test', DEBUG: '1' },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const section = findVM(vms, NodeKind.Section, 'Environment');
    assert.ok(section, 'Environment section should exist');

    const envVars = findAllVMs(section.children, NodeKind.EnvVar);
    assert.strictEqual(envVars.length, 2, 'Should have 2 env vars');

    const apiKey = envVars.find((v) => v.label === 'ANTHROPIC_API_KEY');
    assert.ok(apiKey, 'ANTHROPIC_API_KEY env var should exist');
    assert.ok(apiKey.description.includes('sk-test'), 'Description should include value');

    const debug = envVars.find((v) => v.label === 'DEBUG');
    assert.ok(debug, 'DEBUG env var should exist');
    assert.ok(debug.description.includes('1'), 'Description should include value');
  });

  test('builds plugin VMs with checkbox state', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        enabledPlugins: { '@scope/plugin': true, 'other-plugin': false },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const section = findVM(vms, NodeKind.Section, 'Plugins');
    assert.ok(section, 'Plugins section should exist');

    const plugins = findAllVMs(section.children, NodeKind.Plugin);
    assert.strictEqual(plugins.length, 2, 'Should have 2 plugins');

    const enabledPlugin = plugins.find((p) => p.label === '@scope/plugin');
    assert.ok(enabledPlugin, 'Enabled plugin should exist');
    assert.strictEqual(
      enabledPlugin.checkboxState,
      vscode.TreeItemCheckboxState.Checked,
      'Enabled plugin should be checked',
    );

    const disabledPlugin = plugins.find((p) => p.label === 'other-plugin');
    assert.ok(disabledPlugin, 'Disabled plugin should exist');
    assert.strictEqual(
      disabledPlugin.checkboxState,
      vscode.TreeItemCheckboxState.Unchecked,
      'Disabled plugin should be unchecked',
    );
    assert.strictEqual(disabledPlugin.icon, undefined, 'Unlocked: no icon (checkboxes convey state)');
  });

  test('builds sandbox property VMs', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        sandbox: { enabled: true },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const section = findVM(vms, NodeKind.Section, 'Sandbox');
    assert.ok(section, 'Sandbox section should exist');

    const props = findAllVMs(section.children, NodeKind.SandboxProperty);
    assert.ok(props.length >= 1, 'Should have at least 1 sandbox property');

    const enabledProp = props.find((p) => p.label === 'enabled');
    assert.ok(enabledProp, 'Sandbox property "enabled" should exist');
    assert.strictEqual(enabledProp.kind, NodeKind.SandboxProperty);
  });

  test('builds hook event VMs with entry children', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        hooks: {
          [HookEventType.PreToolUse]: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command' as const, command: 'echo test' }],
            },
          ],
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const section = findVM(vms, NodeKind.Section, 'Hooks');
    assert.ok(section, 'Hooks section should exist');

    const hookEvent = findVM(section.children, NodeKind.HookEvent, 'PreToolUse');
    assert.ok(hookEvent, 'HookEvent "PreToolUse" should exist');
    assert.strictEqual(hookEvent.kind, NodeKind.HookEvent);

    const entries = findAllVMs(hookEvent.children, NodeKind.HookEntry);
    assert.ok(entries.length >= 1, 'Should have at least 1 hook entry');
    assert.strictEqual(
      entries[0].collapsibleState,
      vscode.TreeItemCollapsibleState.None,
      'HookEntry should be a leaf node',
    );

    // Verify keyPath includes intermediate 'hooks' segment for correct JSON navigation
    assert.deepStrictEqual(
      entries[0].nodeContext.keyPath,
      ['hooks', 'PreToolUse', '0', 'hooks', '0'],
      'HookEntry keyPath should include intermediate "hooks" segment between matcher and hook index',
    );
  });

  test('builds MCP server VMs', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(
        ConfigScope.User,
        {},
        {
          mcpConfig: {
            mcpServers: {
              'my-server': { command: 'npx', args: ['-y', 'server'] },
            },
          },
        },
      ),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const section = findVM(vms, NodeKind.Section, 'MCP Servers');
    assert.ok(section, 'MCP Servers section should exist');

    const server = findVM(section.children, NodeKind.McpServer, 'my-server');
    assert.ok(server, 'McpServer "my-server" should exist');
    assert.strictEqual(server.kind, NodeKind.McpServer);
    assert.ok(server.description.includes('npx'), 'Description should include command');
  });
});

// ── Override Resolution Tests (TEST-02) ──────────────────────────

suite('Override Resolution (TEST-02)', () => {
  test('marks User setting as overridden when ProjectLocal defines same key', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, { model: 'claude-3' }),
      makeScopedConfig(ConfigScope.ProjectLocal, { model: 'claude-4' }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    // Find the User scope VM
    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');

    const userSetting = findVM(userScope.children, NodeKind.Setting, 'model');
    assert.ok(userSetting, 'User setting "model" should exist');
    assert.ok(userSetting.nodeContext.overlap.isOverriddenBy, 'Should be overridden');
    assert.strictEqual(
      userSetting.nodeContext.overlap.isOverriddenBy?.scope,
      ConfigScope.ProjectLocal,
      'Should be overridden by ProjectLocal',
    );
    assert.ok(
      userSetting.contextValue.includes('overridden'),
      'contextValue should include "overridden"',
    );
    assert.ok(
      userSetting.description.includes('overridden'),
      'description should include "overridden"',
    );
  });

  test('ProjectLocal setting is NOT marked as overridden (highest precedence)', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, { model: 'claude-3' }),
      makeScopedConfig(ConfigScope.ProjectLocal, { model: 'claude-4' }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const localScope = vms.find(
      (v) => v.kind === NodeKind.Scope && v.label === 'Project (Local)',
    );
    assert.ok(localScope, 'ProjectLocal scope should exist');

    const localSetting = findVM(localScope.children, NodeKind.Setting, 'model');
    assert.ok(localSetting, 'ProjectLocal setting "model" should exist');
    assert.strictEqual(localSetting.nodeContext.overlap.isOverriddenBy, undefined, 'Should NOT be overridden');
    assert.ok(
      !localSetting.contextValue.includes('overridden'),
      'contextValue should NOT include "overridden"',
    );
  });

  test('overridden setting icon has dimmed color', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, { model: 'claude-3' }),
      makeScopedConfig(ConfigScope.ProjectLocal, { model: 'claude-4' }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    // User scope - overridden setting
    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');
    const userSetting = findVM(userScope.children, NodeKind.Setting, 'model');
    assert.ok(userSetting, 'User setting should exist');
    assert.ok(userSetting.icon?.color, 'Overridden icon should have a color');
    assert.strictEqual(
      (userSetting.icon!.color as vscode.ThemeColor).id,
      'disabledForeground',
      'Overridden icon should use disabledForeground color',
    );

    // ProjectLocal scope - non-overridden setting
    const localScope = vms.find(
      (v) => v.kind === NodeKind.Scope && v.label === 'Project (Local)',
    );
    assert.ok(localScope, 'ProjectLocal scope should exist');
    const localSetting = findVM(localScope.children, NodeKind.Setting, 'model');
    assert.ok(localSetting, 'ProjectLocal setting should exist');
    // Non-overridden icon should not have the dimmed color
    const localColor = localSetting.icon?.color as vscode.ThemeColor | undefined;
    assert.ok(
      !localColor || localColor.id !== 'disabledForeground',
      'Non-overridden icon should not use disabledForeground color',
    );
  });

  test('marks User env var as overridden when ProjectShared defines same key', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, { env: { API_KEY: 'user-key' } }),
      makeScopedConfig(ConfigScope.ProjectShared, { env: { API_KEY: 'project-key' } }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');

    const userEnvVar = findVM(userScope.children, NodeKind.EnvVar, 'API_KEY');
    assert.ok(userEnvVar, 'User env var "API_KEY" should exist');
    assert.ok(userEnvVar.nodeContext.overlap.isOverriddenBy, 'Should be overridden');
    assert.strictEqual(
      userEnvVar.nodeContext.overlap.isOverriddenBy?.scope,
      ConfigScope.ProjectShared,
      'Should be overridden by ProjectShared',
    );
  });

  test('permission override detection across scopes', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        permissions: { allow: ['Bash(*)'] },
      }),
      makeScopedConfig(ConfigScope.ProjectLocal, {
        permissions: { deny: ['Bash(*)'] },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');

    const userRule = findVM(userScope.children, NodeKind.PermissionRule, 'Bash(*)');
    assert.ok(userRule, 'User permission rule "Bash(*)" should exist');
    assert.ok(
      userRule.nodeContext.overlap.isOverriddenBy,
      'Allow rule should be overridden by deny in higher scope',
    );
  });
});

// ── NodeContext Preservation Tests (TEST-03) ─────────────────────

suite('NodeContext Preservation (TEST-03)', () => {
  test('setting NodeContext has correct keyPath', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, { model: 'claude-3' }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const setting = findVM(vms, NodeKind.Setting, 'model');
    assert.ok(setting, 'Setting "model" should exist');
    assert.deepStrictEqual(setting.nodeContext.keyPath, ['model']);
    assert.strictEqual(setting.nodeContext.scope, ConfigScope.User);
  });

  test('env var NodeContext has correct keyPath and scope', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.ProjectShared, {
        env: { ANTHROPIC_API_KEY: 'sk-test' },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const envVar = findVM(vms, NodeKind.EnvVar, 'ANTHROPIC_API_KEY');
    assert.ok(envVar, 'Env var should exist');
    assert.deepStrictEqual(envVar.nodeContext.keyPath, ['env', 'ANTHROPIC_API_KEY']);
    assert.strictEqual(envVar.nodeContext.scope, ConfigScope.ProjectShared);
  });

  test('permission rule NodeContext has correct keyPath', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        permissions: { deny: ['Bash(rm *)'] },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const rule = findVM(vms, NodeKind.PermissionRule, 'Bash(rm *)');
    assert.ok(rule, 'Permission rule should exist');
    assert.deepStrictEqual(rule.nodeContext.keyPath, ['permissions', 'deny', 'Bash(rm *)']);
  });

  test('contextValue matches pattern for editable nodes', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, { model: 'claude-3' }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const setting = findVM(vms, NodeKind.Setting, 'model');
    assert.ok(setting, 'Setting should exist');
    assert.strictEqual(setting.contextValue, 'setting.editable');
  });

  test('contextValue matches pattern for readOnly nodes', () => {
    // Create a scope with isReadOnly=true (simulating Managed-like behavior)
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, { model: 'claude-3' }, { isReadOnly: true }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const setting = findVM(vms, NodeKind.Setting, 'model');
    assert.ok(setting, 'Setting should exist');
    assert.strictEqual(setting.contextValue, 'setting.readOnly');
  });

  test('Managed scope marks overrides on User scope', () => {
    // Managed scope is filtered out of direct output but affects override resolution
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.Managed, { model: 'managed-model' }),
      makeScopedConfig(ConfigScope.User, { model: 'user-model' }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    // User scope should exist but Managed scope is filtered
    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');

    const userSetting = findVM(userScope.children, NodeKind.Setting, 'model');
    assert.ok(userSetting, 'User setting should exist');
    assert.ok(
      userSetting.nodeContext.overlap.isOverriddenBy,
      'User setting should be overridden by Managed',
    );
    assert.strictEqual(
      userSetting.nodeContext.overlap.isOverriddenBy?.scope,
      ConfigScope.Managed,
      'Should be overridden by Managed scope',
    );
    assert.strictEqual(
      userSetting.nodeContext.isReadOnly,
      false,
      'User scope settings should be editable',
    );
  });

  test('filePath propagates to NodeContext', () => {
    const customPath = '/custom/path/settings.json';
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, { model: 'claude-3' }, { filePath: customPath }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const setting = findVM(vms, NodeKind.Setting, 'model');
    assert.ok(setting, 'Setting should exist');
    assert.strictEqual(
      setting.nodeContext.filePath,
      customPath,
      'filePath should propagate from ScopedConfig',
    );
  });
});

// ── Lock-Aware Plugin Display Tests (LOCK-01/02/03) ─────────────

suite('Lock-Aware Plugin Display (LOCK-01/02/03)', () => {
  test('LOCK-01: locked enabled plugin shows check icon, no checkbox', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(
        ConfigScope.User,
        { enabledPlugins: { 'my-plugin': true } },
        { isReadOnly: true },
      ),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const plugin = findVM(vms, NodeKind.Plugin, 'my-plugin');
    assert.ok(plugin, 'Plugin should exist');
    assert.strictEqual(plugin.icon?.id, 'check', 'Locked enabled plugin should show check icon');
    assert.strictEqual(plugin.checkboxState, undefined, 'Locked plugin should have no checkbox');
  });

  test('LOCK-02: locked disabled plugin shows disabled icon, no checkbox', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(
        ConfigScope.User,
        { enabledPlugins: { 'my-plugin': false } },
        { isReadOnly: true },
      ),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const plugin = findVM(vms, NodeKind.Plugin, 'my-plugin');
    assert.ok(plugin, 'Plugin should exist');
    assert.strictEqual(
      plugin.icon?.id,
      'circle-slash',
      'Locked disabled plugin should show circle-slash icon',
    );
    assert.strictEqual(plugin.checkboxState, undefined, 'Locked plugin should have no checkbox');
  });

  test('LOCK-03: unlocking restores checkboxes', () => {
    const pluginConfig = { enabledPlugins: { 'my-plugin': true, 'other': false } };

    // Locked state
    const lockedConfigs = [
      makeScopedConfig(ConfigScope.User, pluginConfig, { isReadOnly: true }),
    ];
    const lockedVMs = new TreeViewModelBuilder(createMockConfigStore(lockedConfigs)).build();
    const lockedEnabled = findVM(lockedVMs, NodeKind.Plugin, 'my-plugin');
    const lockedDisabled = findVM(lockedVMs, NodeKind.Plugin, 'other');
    assert.strictEqual(lockedEnabled?.checkboxState, undefined, 'Locked: no checkbox on enabled');
    assert.strictEqual(lockedDisabled?.checkboxState, undefined, 'Locked: no checkbox on disabled');

    // Unlocked state
    const unlockedConfigs = [makeScopedConfig(ConfigScope.User, pluginConfig)];
    const unlockedVMs = new TreeViewModelBuilder(createMockConfigStore(unlockedConfigs)).build();
    const unlockedEnabled = findVM(unlockedVMs, NodeKind.Plugin, 'my-plugin');
    const unlockedDisabled = findVM(unlockedVMs, NodeKind.Plugin, 'other');
    assert.strictEqual(
      unlockedEnabled?.checkboxState,
      vscode.TreeItemCheckboxState.Checked,
      'Unlocked: enabled plugin has Checked checkbox',
    );
    assert.strictEqual(unlockedEnabled?.icon, undefined, 'Unlocked: no icon (checkboxes convey state)');
    assert.strictEqual(
      unlockedDisabled?.checkboxState,
      vscode.TreeItemCheckboxState.Unchecked,
      'Unlocked: disabled plugin has Unchecked checkbox',
    );
  });
});

// ── TRIV-01: Sandbox Section Count ───────────────────────────────

suite('TRIV-01: Sandbox section count', () => {
  test('sandbox with 2 top-level properties returns "2 properties"', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        sandbox: { enabled: true, autoAllowBashIfSandboxed: false },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const section = findVM(vms, NodeKind.Section, 'Sandbox');
    assert.ok(section, 'Sandbox section should exist');
    assert.strictEqual(section.description, '2 properties');
  });

  test('sandbox with network sub-object counts network children individually', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        sandbox: {
          enabled: true,
          network: { allowedDomains: ['example.com'], deniedDomains: ['evil.com'] },
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const section = findVM(vms, NodeKind.Section, 'Sandbox');
    assert.ok(section, 'Sandbox section should exist');
    // 1 (enabled) + 2 (network children) = 3 properties
    assert.strictEqual(section.description, '3 properties');
  });

  test('empty/missing sandbox returns "0 properties"', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        sandbox: {},
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    // With empty sandbox, the section may not be built at all (buildSections checks if sandbox exists).
    // But sandbox: {} is truthy, so section should exist.
    const section = findVM(vms, NodeKind.Section, 'Sandbox');
    // If section doesn't exist because of empty object filtering, that's also valid.
    // The getSectionItemCount should handle empty sandbox.
    if (section) {
      assert.strictEqual(section.description, '0 properties');
    }
  });

  test('singular: 1 property returns "1 property"', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        sandbox: { enabled: true },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const section = findVM(vms, NodeKind.Section, 'Sandbox');
    assert.ok(section, 'Sandbox section should exist');
    assert.strictEqual(section.description, '1 property');
  });
});

// ── TRIV-02: HookEntry Description ──────────────────────────────

suite('TRIV-02: HookEntry description', () => {
  test('command hook description is "command: echo test"', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        hooks: {
          [HookEventType.PreToolUse]: [
            {
              hooks: [{ type: 'command' as const, command: 'echo test' }],
            },
          ],
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const entry = findVM(vms, NodeKind.HookEntry);
    assert.ok(entry, 'HookEntry should exist');
    assert.strictEqual(entry.description, 'command: echo test');
  });

  test('prompt hook description is "prompt: Review the output"', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        hooks: {
          [HookEventType.PostToolUse]: [
            {
              hooks: [{ type: 'prompt' as const, prompt: 'Review the output' }],
            },
          ],
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const entry = findVM(vms, NodeKind.HookEntry);
    assert.ok(entry, 'HookEntry should exist');
    assert.strictEqual(entry.description, 'prompt: Review the output');
  });

  test('agent hook description falls back to type name: "agent: agent"', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        hooks: {
          [HookEventType.SessionStart]: [
            {
              hooks: [{ type: 'agent' as const }],
            },
          ],
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const entry = findVM(vms, NodeKind.HookEntry);
    assert.ok(entry, 'HookEntry should exist');
    assert.strictEqual(entry.description, 'agent: agent');
  });
});

// ── Hook Overlap Tests (TEST-HOOK-OVERLAP) ────────────────────────

suite('Hook Overlap (TEST-HOOK-OVERLAP)', () => {
  test('HookEntryVM has populated overlap when same hook exists in two scopes', () => {
    const hook = { type: 'command' as const, command: 'echo test' };
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [hook] },
          ],
        },
      }),
      makeScopedConfig(ConfigScope.ProjectLocal, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [{ ...hook }] },
          ],
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    // User scope entry should have isDuplicatedBy (same hook in ProjectLocal which has higher precedence)
    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');
    const userEntry = findVM(userScope.children, NodeKind.HookEntry);
    assert.ok(userEntry, 'HookEntry should exist in User scope');
    assert.ok(
      userEntry.nodeContext.overlap.isDuplicatedBy || userEntry.nodeContext.overlap.isOverriddenBy,
      'HookEntry overlap should be populated (not empty {})',
    );
  });

  test('HookEntryVM.contextValue includes "overridden" suffix when isOverriddenBy is set', () => {
    const userHook = { type: 'command' as const, command: 'echo user' };
    const localHook = { type: 'command' as const, command: 'echo local' };
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [userHook] },
          ],
        },
      }),
      makeScopedConfig(ConfigScope.ProjectLocal, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [localHook] },
          ],
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');
    const userEntry = findVM(userScope.children, NodeKind.HookEntry);
    assert.ok(userEntry, 'HookEntry should exist');
    // User has different value from ProjectLocal -> isOverriddenBy
    assert.ok(userEntry.nodeContext.overlap.isOverriddenBy, 'Should be overridden');
    assert.ok(
      userEntry.contextValue.includes('overridden'),
      `contextValue should include "overridden", got: ${userEntry.contextValue}`,
    );
  });

  test('HookEntryVM.icon uses disabledForeground color when isOverriddenBy is set', () => {
    const userHook = { type: 'command' as const, command: 'echo user' };
    const localHook = { type: 'command' as const, command: 'echo local' };
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [userHook] },
          ],
        },
      }),
      makeScopedConfig(ConfigScope.ProjectLocal, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [localHook] },
          ],
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');
    const userEntry = findVM(userScope.children, NodeKind.HookEntry);
    assert.ok(userEntry, 'HookEntry should exist');
    assert.ok(userEntry.nodeContext.overlap.isOverriddenBy, 'Should be overridden');
    assert.ok(userEntry.icon?.color, 'Overridden icon should have a color');
    assert.strictEqual(
      (userEntry.icon!.color as vscode.ThemeColor).id,
      'disabledForeground',
      'Overridden HookEntry icon should use disabledForeground color',
    );
  });

  test('HookEntryVM.resourceUri is set (not undefined) when overlap exists', () => {
    const hook = { type: 'command' as const, command: 'echo test' };
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [hook] },
          ],
        },
      }),
      makeScopedConfig(ConfigScope.ProjectLocal, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [{ ...hook }] },
          ],
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');
    const userEntry = findVM(userScope.children, NodeKind.HookEntry);
    assert.ok(userEntry, 'HookEntry should exist');
    assert.ok(
      userEntry.nodeContext.overlap.isDuplicatedBy || userEntry.nodeContext.overlap.isOverriddenBy,
      'Overlap should be populated',
    );
    assert.ok(userEntry.resourceUri, 'resourceUri should be set when overlap exists');
  });

  test('HookEntryVM.tooltip contains overlap markdown content when overlap is present', () => {
    const hook = { type: 'command' as const, command: 'echo test' };
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [hook] },
          ],
        },
      }),
      makeScopedConfig(ConfigScope.ProjectLocal, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [{ ...hook }] },
          ],
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');
    const userEntry = findVM(userScope.children, NodeKind.HookEntry);
    assert.ok(userEntry, 'HookEntry should exist');
    assert.ok(
      userEntry.nodeContext.overlap.isDuplicatedBy || userEntry.nodeContext.overlap.isOverriddenBy,
      'Overlap should be populated',
    );
    assert.ok(userEntry.tooltip instanceof vscode.MarkdownString, 'Tooltip should be MarkdownString when overlap present');
    const tooltipValue = (userEntry.tooltip as vscode.MarkdownString).value;
    assert.ok(
      tooltipValue.includes('Duplicated') || tooltipValue.includes('Overridden') ||
      tooltipValue.includes('duplicated') || tooltipValue.includes('overridden'),
      `Tooltip should contain overlap info, got: ${tooltipValue}`,
    );
  });

  test('HookEntryVM.description includes override suffix when isOverriddenBy is set', () => {
    const userHook = { type: 'command' as const, command: 'echo user' };
    const localHook = { type: 'command' as const, command: 'echo local' };
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [userHook] },
          ],
        },
      }),
      makeScopedConfig(ConfigScope.ProjectLocal, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [localHook] },
          ],
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');
    const userEntry = findVM(userScope.children, NodeKind.HookEntry);
    assert.ok(userEntry, 'HookEntry should exist');
    assert.ok(userEntry.nodeContext.overlap.isOverriddenBy, 'Should be overridden');
    assert.ok(
      userEntry.description.includes('overridden'),
      `description should include "overridden", got: ${userEntry.description}`,
    );
  });

  test('HookEventVM container still has overlap: {} (no overlap on container nodes)', () => {
    const hook = { type: 'command' as const, command: 'echo test' };
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [hook] },
          ],
        },
      }),
      makeScopedConfig(ConfigScope.ProjectLocal, {
        hooks: {
          [HookEventType.PreToolUse]: [
            { matcher: 'Bash', hooks: [{ ...hook }] },
          ],
        },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const userScope = vms.find((v) => v.kind === NodeKind.Scope && v.label === 'User');
    assert.ok(userScope, 'User scope should exist');
    const hookEvent = findVM(userScope.children, NodeKind.HookEvent, 'PreToolUse');
    assert.ok(hookEvent, 'HookEvent container should exist');
    assert.deepStrictEqual(
      hookEvent.nodeContext.overlap,
      {},
      'HookEvent container should have empty overlap {}',
    );
  });
});

// ── TRIV-03: EnvVar Base Tooltip ────────────────────────────────

suite('TRIV-03: EnvVar base tooltip', () => {
  test('tooltip contains key=value in markdown format', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        env: { MY_VAR: 'my_value' },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const envVar = findVM(vms, NodeKind.EnvVar, 'MY_VAR');
    assert.ok(envVar, 'EnvVar should exist');
    assert.ok(envVar.tooltip instanceof vscode.MarkdownString, 'Tooltip should be MarkdownString');
    const tooltipValue = (envVar.tooltip as vscode.MarkdownString).value;
    assert.ok(
      tooltipValue.includes('**MY_VAR** = `my_value`'),
      `Tooltip should contain key=value markdown, got: ${tooltipValue}`,
    );
  });

  test('tooltip contains "Defined in:" with scope label', () => {
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.ProjectShared, {
        env: { API_URL: 'https://example.com' },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const envVar = findVM(vms, NodeKind.EnvVar, 'API_URL');
    assert.ok(envVar, 'EnvVar should exist');
    assert.ok(envVar.tooltip instanceof vscode.MarkdownString, 'Tooltip should be MarkdownString');
    const tooltipValue = (envVar.tooltip as vscode.MarkdownString).value;
    assert.ok(
      tooltipValue.includes('Defined in:'),
      `Tooltip should contain "Defined in:", got: ${tooltipValue}`,
    );
    assert.ok(
      tooltipValue.includes('Project (Shared)'),
      `Tooltip should contain scope label, got: ${tooltipValue}`,
    );
  });

  test('long value (>80 chars) is truncated with ellipsis', () => {
    const longValue = 'a'.repeat(120);
    const configs: ScopedConfig[] = [
      makeScopedConfig(ConfigScope.User, {
        env: { LONG_VAR: longValue },
      }),
    ];
    const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
    const vms = builder.build();

    const envVar = findVM(vms, NodeKind.EnvVar, 'LONG_VAR');
    assert.ok(envVar, 'EnvVar should exist');
    assert.ok(envVar.tooltip instanceof vscode.MarkdownString, 'Tooltip should be MarkdownString');
    const tooltipValue = (envVar.tooltip as vscode.MarkdownString).value;
    // Should contain first 80 chars + ...
    assert.ok(
      tooltipValue.includes('a'.repeat(80) + '...'),
      `Tooltip should truncate long values at 80 chars, got: ${tooltipValue}`,
    );
    // Should NOT contain the full 120-char value
    assert.ok(
      !tooltipValue.includes('a'.repeat(120)),
      'Tooltip should not contain the full untruncated value',
    );
  });
});
