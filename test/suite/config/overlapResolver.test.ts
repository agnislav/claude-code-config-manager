import * as assert from 'assert';
import {
  ConfigScope,
  ScopedConfig,
  ClaudeCodeConfig,
  PermissionCategory,
} from '../../../src/types';
import {
  deepEqual,
  getOverlapColor,
  resolveSettingOverlap,
  resolveEnvOverlap,
  resolvePluginOverlap,
  resolveMcpOverlap,
  resolveSandboxOverlap,
  resolvePermissionOverlap,
  OverlapInfo,
} from '../../../src/config/overlapResolver';

// ── Test Helpers ──────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────

describe('overlapResolver', () => {
  describe('deepEqual', () => {
    it('should treat objects with different key order as equal', () => {
      assert.strictEqual(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
    });

    it('should treat arrays with different order as not equal', () => {
      assert.strictEqual(deepEqual([1, 2], [2, 1]), false);
    });

    it('should compare primitives correctly', () => {
      assert.strictEqual(deepEqual('hello', 'hello'), true);
      assert.strictEqual(deepEqual(42, 42), true);
      assert.strictEqual(deepEqual(true, true), true);
      assert.strictEqual(deepEqual('a', 'b'), false);
      assert.strictEqual(deepEqual(1, 2), false);
    });

    it('should handle null and undefined', () => {
      assert.strictEqual(deepEqual(null, null), true);
      assert.strictEqual(deepEqual(undefined, undefined), true);
      assert.strictEqual(deepEqual(null, undefined), false);
    });

    it('should handle nested objects', () => {
      assert.strictEqual(
        deepEqual({ a: { b: 1, c: 2 } }, { a: { c: 2, b: 1 } }),
        true,
      );
    });
  });

  describe('getOverlapColor', () => {
    it('should return red for isOverriddenBy', () => {
      const overlap: OverlapInfo = {
        isOverriddenBy: { scope: ConfigScope.ProjectLocal, value: 'x' },
      };
      assert.strictEqual(getOverlapColor(overlap), 'red');
    });

    it('should return red for isDuplicatedBy', () => {
      const overlap: OverlapInfo = {
        isDuplicatedBy: { scope: ConfigScope.ProjectLocal, value: 'x' },
      };
      assert.strictEqual(getOverlapColor(overlap), 'red');
    });

    it('should return green for overrides', () => {
      const overlap: OverlapInfo = {
        overrides: { scope: ConfigScope.User, value: 'x' },
      };
      assert.strictEqual(getOverlapColor(overlap), 'green');
    });

    it('should return yellow for duplicates', () => {
      const overlap: OverlapInfo = {
        duplicates: { scope: ConfigScope.ProjectShared, value: 'x' },
      };
      assert.strictEqual(getOverlapColor(overlap), 'yellow');
    });

    it('should return none for empty overlap', () => {
      assert.strictEqual(getOverlapColor({}), 'none');
    });
  });

  describe('resolveSettingOverlap', () => {
    it('should detect isOverriddenBy when higher-precedence scope has different value', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, { model: 'opus' }),
        makeScopedConfig(ConfigScope.ProjectLocal, { model: 'sonnet' }),
      ];
      const result = resolveSettingOverlap('model', ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isOverriddenBy, {
        scope: ConfigScope.ProjectLocal,
        value: 'sonnet',
      });
    });

    it('should detect overrides when current scope overrides lower-precedence scope', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, { model: 'opus' }),
        makeScopedConfig(ConfigScope.ProjectLocal, { model: 'sonnet' }),
      ];
      const result = resolveSettingOverlap('model', ConfigScope.ProjectLocal, scopes);
      assert.deepStrictEqual(result.overrides, {
        scope: ConfigScope.User,
        value: 'opus',
      });
    });

    it('should return empty overlap when entity exists in only one scope', () => {
      const scopes = [makeScopedConfig(ConfigScope.User, { model: 'opus' })];
      const result = resolveSettingOverlap('model', ConfigScope.User, scopes);
      assert.strictEqual(result.overrides, undefined);
      assert.strictEqual(result.isOverriddenBy, undefined);
      assert.strictEqual(result.duplicates, undefined);
      assert.strictEqual(result.isDuplicatedBy, undefined);
    });
  });

  describe('resolveEnvOverlap', () => {
    it('should detect isDuplicatedBy when same value in higher-precedence scope', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, { env: { FOO: 'bar' } }),
        makeScopedConfig(ConfigScope.ProjectLocal, { env: { FOO: 'bar' } }),
      ];
      const result = resolveEnvOverlap('FOO', ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isDuplicatedBy, {
        scope: ConfigScope.ProjectLocal,
        value: 'bar',
      });
    });

    it('should return empty overlap when entity exists in only one scope', () => {
      const scopes = [makeScopedConfig(ConfigScope.User, { env: { FOO: 'bar' } })];
      const result = resolveEnvOverlap('FOO', ConfigScope.User, scopes);
      assert.strictEqual(result.isOverriddenBy, undefined);
      assert.strictEqual(result.isDuplicatedBy, undefined);
    });

    it('should detect isOverriddenBy when different value in higher-precedence scope', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, { env: { FOO: 'bar' } }),
        makeScopedConfig(ConfigScope.ProjectLocal, { env: { FOO: 'baz' } }),
      ];
      const result = resolveEnvOverlap('FOO', ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isOverriddenBy, {
        scope: ConfigScope.ProjectLocal,
        value: 'baz',
      });
    });
  });

  describe('resolvePluginOverlap', () => {
    it('should detect isOverriddenBy when values differ', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, { enabledPlugins: { myPlugin: true } }),
        makeScopedConfig(ConfigScope.ProjectLocal, { enabledPlugins: { myPlugin: false } }),
      ];
      const result = resolvePluginOverlap('myPlugin', ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isOverriddenBy, {
        scope: ConfigScope.ProjectLocal,
        value: false,
      });
    });

    it('should detect isDuplicatedBy when same value', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, { enabledPlugins: { myPlugin: true } }),
        makeScopedConfig(ConfigScope.ProjectLocal, { enabledPlugins: { myPlugin: true } }),
      ];
      const result = resolvePluginOverlap('myPlugin', ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isDuplicatedBy, {
        scope: ConfigScope.ProjectLocal,
        value: true,
      });
    });
  });

  describe('resolveMcpOverlap', () => {
    it('should detect duplicates for same MCP server config', () => {
      const serverConfig = { command: 'npx', args: ['-y', 'server'] };
      const scopes = [
        makeScopedConfig(ConfigScope.User, {}, {
          mcpConfig: { mcpServers: { myserver: serverConfig } },
        }),
        makeScopedConfig(ConfigScope.ProjectShared, {}, {
          mcpConfig: { mcpServers: { myserver: { ...serverConfig } } },
        }),
      ];
      // User has lower precedence than ProjectShared, so for User scope:
      // ProjectShared is higher precedence → isDuplicatedBy
      const result = resolveMcpOverlap('myserver', ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isDuplicatedBy, {
        scope: ConfigScope.ProjectShared,
        value: serverConfig,
      });
    });

    it('should detect override for different MCP server config', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {}, {
          mcpConfig: { mcpServers: { myserver: { command: 'npx', args: ['old'] } } },
        }),
        makeScopedConfig(ConfigScope.ProjectShared, {}, {
          mcpConfig: { mcpServers: { myserver: { command: 'npx', args: ['new'] } } },
        }),
      ];
      const result = resolveMcpOverlap('myserver', ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isOverriddenBy, {
        scope: ConfigScope.ProjectShared,
        value: { command: 'npx', args: ['new'] },
      });
    });
  });

  describe('resolveSandboxOverlap', () => {
    it('should detect override for sandbox enabled with different values', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, { sandbox: { enabled: true } }),
        makeScopedConfig(ConfigScope.ProjectLocal, { sandbox: { enabled: false } }),
      ];
      const result = resolveSandboxOverlap('enabled', ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isOverriddenBy, {
        scope: ConfigScope.ProjectLocal,
        value: false,
      });
    });

    it('should handle nested sandbox keys', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          sandbox: { network: { allowedDomains: ['a.com'] } },
        }),
        makeScopedConfig(ConfigScope.ProjectLocal, {
          sandbox: { network: { allowedDomains: ['b.com'] } },
        }),
      ];
      const result = resolveSandboxOverlap('network.allowedDomains', ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isOverriddenBy, {
        scope: ConfigScope.ProjectLocal,
        value: ['b.com'],
      });
    });
  });

  describe('resolvePermissionOverlap', () => {
    it('should detect override when same rule in different category across scopes', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          permissions: { allow: ['Bash(curl *)'] },
        }),
        makeScopedConfig(ConfigScope.Managed, {
          permissions: { deny: ['Bash(curl *)'] },
        }),
      ];
      const result = resolvePermissionOverlap(
        PermissionCategory.Allow,
        'Bash(curl *)',
        ConfigScope.User,
        scopes,
      );
      assert.strictEqual(result.isOverriddenBy?.scope, ConfigScope.Managed);
      assert.strictEqual(result.overriddenByCategory, PermissionCategory.Deny);
    });

    it('should not set overrides/duplicates for permissions (only isOverriddenBy direction)', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.Managed, {
          permissions: { deny: ['Bash(curl *)'] },
        }),
        makeScopedConfig(ConfigScope.User, {
          permissions: { allow: ['Bash(curl *)'] },
        }),
      ];
      const result = resolvePermissionOverlap(
        PermissionCategory.Deny,
        'Bash(curl *)',
        ConfigScope.Managed,
        scopes,
      );
      assert.strictEqual(result.overrides, undefined);
      assert.strictEqual(result.duplicates, undefined);
    });
  });

  describe('nearest-neighbor', () => {
    it('should skip intermediate scopes to find closest neighbor', () => {
      // Managed > ProjectLocal > ProjectShared > User
      // Setting "model" defined in Managed and User but NOT in ProjectLocal/ProjectShared
      const scopes = [
        makeScopedConfig(ConfigScope.Managed, { model: 'managed-model' }),
        makeScopedConfig(ConfigScope.ProjectLocal, {}),
        makeScopedConfig(ConfigScope.ProjectShared, {}),
        makeScopedConfig(ConfigScope.User, { model: 'user-model' }),
      ];
      // From User: nearest higher-precedence with model is Managed
      const result = resolveSettingOverlap('model', ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isOverriddenBy, {
        scope: ConfigScope.Managed,
        value: 'managed-model',
      });
    });
  });
});
