import * as assert from 'assert';
import {
  ConfigScope,
  ScopedConfig,
  ClaudeCodeConfig,
  HookEventType,
  HookCommand,
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
  resolveHookOverlap,
  computePermissionOverlapMap,
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

suite('overlapResolver', () => {
  suite('deepEqual', () => {
    test('should treat objects with different key order as equal', () => {
      assert.strictEqual(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
    });

    test('should treat arrays with different order as not equal', () => {
      assert.strictEqual(deepEqual([1, 2], [2, 1]), false);
    });

    test('should compare primitives correctly', () => {
      assert.strictEqual(deepEqual('hello', 'hello'), true);
      assert.strictEqual(deepEqual(42, 42), true);
      assert.strictEqual(deepEqual(true, true), true);
      assert.strictEqual(deepEqual('a', 'b'), false);
      assert.strictEqual(deepEqual(1, 2), false);
    });

    test('should handle null and undefined', () => {
      assert.strictEqual(deepEqual(null, null), true);
      assert.strictEqual(deepEqual(undefined, undefined), true);
      assert.strictEqual(deepEqual(null, undefined), false);
    });

    test('should handle nested objects', () => {
      assert.strictEqual(
        deepEqual({ a: { b: 1, c: 2 } }, { a: { c: 2, b: 1 } }),
        true,
      );
    });
  });

  suite('getOverlapColor', () => {
    test('should return red for isOverriddenBy', () => {
      const overlap: OverlapInfo = {
        isOverriddenBy: { scope: ConfigScope.ProjectLocal, value: 'x' },
      };
      assert.strictEqual(getOverlapColor(overlap), 'red');
    });

    test('should return orange for isDuplicatedBy', () => {
      const overlap: OverlapInfo = {
        isDuplicatedBy: { scope: ConfigScope.ProjectLocal, value: 'x' },
      };
      assert.strictEqual(getOverlapColor(overlap), 'orange');
    });

    test('should return green for overrides', () => {
      const overlap: OverlapInfo = {
        overrides: { scope: ConfigScope.User, value: 'x' },
      };
      assert.strictEqual(getOverlapColor(overlap), 'green');
    });

    test('should return yellow for duplicates', () => {
      const overlap: OverlapInfo = {
        duplicates: { scope: ConfigScope.ProjectShared, value: 'x' },
      };
      assert.strictEqual(getOverlapColor(overlap), 'yellow');
    });

    test('should return none for empty overlap', () => {
      assert.strictEqual(getOverlapColor({}), 'none');
    });
  });

  suite('resolveSettingOverlap', () => {
    test('should detect isOverriddenBy when higher-precedence scope has different value', () => {
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

    test('should detect overrides when current scope overrides lower-precedence scope', () => {
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

    test('should return empty overlap when entity exists in only one scope', () => {
      const scopes = [makeScopedConfig(ConfigScope.User, { model: 'opus' })];
      const result = resolveSettingOverlap('model', ConfigScope.User, scopes);
      assert.strictEqual(result.overrides, undefined);
      assert.strictEqual(result.isOverriddenBy, undefined);
      assert.strictEqual(result.duplicates, undefined);
      assert.strictEqual(result.isDuplicatedBy, undefined);
    });
  });

  suite('resolveEnvOverlap', () => {
    test('should detect isDuplicatedBy when same value in higher-precedence scope', () => {
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

    test('should return empty overlap when entity exists in only one scope', () => {
      const scopes = [makeScopedConfig(ConfigScope.User, { env: { FOO: 'bar' } })];
      const result = resolveEnvOverlap('FOO', ConfigScope.User, scopes);
      assert.strictEqual(result.isOverriddenBy, undefined);
      assert.strictEqual(result.isDuplicatedBy, undefined);
    });

    test('should detect isOverriddenBy when different value in higher-precedence scope', () => {
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

  suite('resolvePluginOverlap', () => {
    test('should detect isOverriddenBy when values differ', () => {
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

    test('should detect isDuplicatedBy when same value', () => {
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

  suite('resolveMcpOverlap', () => {
    test('should detect duplicates for same MCP server config', () => {
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

    test('should detect override for different MCP server config', () => {
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

  suite('resolveSandboxOverlap', () => {
    test('should detect override for sandbox enabled with different values', () => {
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

    test('should handle nested sandbox keys', () => {
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

  suite('resolvePermissionOverlap', () => {
    test('should detect override when same rule in different category across scopes', () => {
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

    test('should detect cross-category override in lower-precedence scope', () => {
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
      assert.strictEqual(result.overrides?.scope, ConfigScope.User);
      assert.strictEqual(result.overrides?.value, PermissionCategory.Allow);
    });

    test('should detect same-category duplicate across scopes', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.ProjectLocal, {
          permissions: { allow: ['Bash(find:*)'] },
        }),
        makeScopedConfig(ConfigScope.ProjectShared, {
          permissions: { allow: ['Bash(find:*)'] },
        }),
      ];
      // Lower-precedence scope sees isDuplicatedBy
      const sharedResult = resolvePermissionOverlap(
        PermissionCategory.Allow,
        'Bash(find:*)',
        ConfigScope.ProjectShared,
        scopes,
      );
      assert.strictEqual(sharedResult.isDuplicatedBy?.scope, ConfigScope.ProjectLocal);

      // Higher-precedence scope sees duplicates
      const localResult = resolvePermissionOverlap(
        PermissionCategory.Allow,
        'Bash(find:*)',
        ConfigScope.ProjectLocal,
        scopes,
      );
      assert.strictEqual(localResult.duplicates?.scope, ConfigScope.ProjectShared);
    });

    test('should not detect same-category duplicate for non-exact matches', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.ProjectLocal, {
          permissions: { allow: ['Bash(find:*)'] },
        }),
        makeScopedConfig(ConfigScope.ProjectShared, {
          permissions: { allow: ['Bash(find /tmp:*)'] },
        }),
      ];
      const result = resolvePermissionOverlap(
        PermissionCategory.Allow,
        'Bash(find /tmp:*)',
        ConfigScope.ProjectShared,
        scopes,
      );
      assert.strictEqual(result.isDuplicatedBy, undefined);
    });
  });

  suite('nearest-neighbor', () => {
    test('should skip intermediate scopes to find closest neighbor', () => {
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

  suite('resolveHookOverlap', () => {
    const bashHook: HookCommand = { type: 'command', command: 'echo hello' };
    const bashHookDiffTimeout: HookCommand = { type: 'command', command: 'echo hello', timeout: 5000 };
    const writeHook: HookCommand = { type: 'command', command: 'echo write' };

    test('identical hook in User and ProjectLocal: User has isDuplicatedBy pointing to ProjectLocal', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { matcher: 'Bash', hooks: [bashHook] },
            ],
          },
        }),
        makeScopedConfig(ConfigScope.ProjectLocal, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { matcher: 'Bash', hooks: [{ ...bashHook }] },
            ],
          },
        }),
      ];
      const result = resolveHookOverlap(HookEventType.PreToolUse, 'Bash', bashHook, 0, ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isDuplicatedBy, {
        scope: ConfigScope.ProjectLocal,
        value: bashHook,
      });
      assert.strictEqual(result.isOverriddenBy, undefined);
    });

    test('same eventType and matcher but different HookCommand fields: isOverriddenBy (different values)', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { matcher: 'Bash', hooks: [bashHook] },
            ],
          },
        }),
        makeScopedConfig(ConfigScope.ProjectLocal, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { matcher: 'Bash', hooks: [bashHookDiffTimeout] },
            ],
          },
        }),
      ];
      const result = resolveHookOverlap(HookEventType.PreToolUse, 'Bash', bashHook, 0, ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isOverriddenBy, {
        scope: ConfigScope.ProjectLocal,
        value: bashHookDiffTimeout,
      });
      assert.strictEqual(result.isDuplicatedBy, undefined);
    });

    test('same eventType but different matcher patterns: no overlap detected', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { matcher: 'Bash', hooks: [bashHook] },
            ],
          },
        }),
        makeScopedConfig(ConfigScope.ProjectLocal, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { matcher: 'Write', hooks: [writeHook] },
            ],
          },
        }),
      ];
      const result = resolveHookOverlap(HookEventType.PreToolUse, 'Bash', bashHook, 0, ConfigScope.User, scopes);
      assert.strictEqual(result.isDuplicatedBy, undefined);
      assert.strictEqual(result.isOverriddenBy, undefined);
      assert.strictEqual(result.duplicates, undefined);
      assert.strictEqual(result.overrides, undefined);
    });

    test('hook exists in only one scope: empty OverlapInfo', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { matcher: 'Bash', hooks: [bashHook] },
            ],
          },
        }),
      ];
      const result = resolveHookOverlap(HookEventType.PreToolUse, 'Bash', bashHook, 0, ConfigScope.User, scopes);
      assert.strictEqual(result.isDuplicatedBy, undefined);
      assert.strictEqual(result.isOverriddenBy, undefined);
      assert.strictEqual(result.duplicates, undefined);
      assert.strictEqual(result.overrides, undefined);
    });

    test('hook in User scope with identical hook in both ProjectShared and ProjectLocal: isDuplicatedBy points to nearest higher scope (ProjectShared)', () => {
      // SCOPE_PRECEDENCE = [Managed, ProjectLocal, ProjectShared, User] (higher index = lower precedence)
      // From User (index 3), nearest higher-precedence scope is ProjectShared (index 2)
      // ProjectLocal (index 1) is higher precedence but farther away
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { matcher: 'Bash', hooks: [bashHook] },
            ],
          },
        }),
        makeScopedConfig(ConfigScope.ProjectShared, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { matcher: 'Bash', hooks: [{ ...bashHook }] },
            ],
          },
        }),
        makeScopedConfig(ConfigScope.ProjectLocal, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { matcher: 'Bash', hooks: [{ ...bashHook }] },
            ],
          },
        }),
      ];
      const result = resolveHookOverlap(HookEventType.PreToolUse, 'Bash', bashHook, 0, ConfigScope.User, scopes);
      // Nearest higher from User is ProjectShared (closest in precedence chain)
      assert.deepStrictEqual(result.isDuplicatedBy, {
        scope: ConfigScope.ProjectShared,
        value: bashHook,
      });
    });

    test('hook with undefined matcher matches hook with undefined matcher in other scope', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          hooks: {
            [HookEventType.SessionStart]: [
              { hooks: [bashHook] }, // no matcher
            ],
          },
        }),
        makeScopedConfig(ConfigScope.ProjectLocal, {
          hooks: {
            [HookEventType.SessionStart]: [
              { hooks: [{ ...bashHook }] }, // no matcher
            ],
          },
        }),
      ];
      const result = resolveHookOverlap(HookEventType.SessionStart, undefined, bashHook, 0, ConfigScope.User, scopes);
      assert.deepStrictEqual(result.isDuplicatedBy, {
        scope: ConfigScope.ProjectLocal,
        value: bashHook,
      });
    });

    test('hook with undefined matcher does NOT match hook with explicit matcher', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { hooks: [bashHook] }, // no matcher (undefined)
            ],
          },
        }),
        makeScopedConfig(ConfigScope.ProjectLocal, {
          hooks: {
            [HookEventType.PreToolUse]: [
              { matcher: 'Bash', hooks: [{ ...bashHook }] }, // explicit matcher
            ],
          },
        }),
      ];
      const result = resolveHookOverlap(HookEventType.PreToolUse, undefined, bashHook, 0, ConfigScope.User, scopes);
      assert.strictEqual(result.isDuplicatedBy, undefined);
      assert.strictEqual(result.isOverriddenBy, undefined);
    });
  });

  suite('computePermissionOverlapMap', () => {
    test('parity: map entries match resolvePermissionOverlap for each rule', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          permissions: {
            allow: ['Bash(curl *)', 'Read(*)'],
            deny: [],
          },
        }),
        makeScopedConfig(ConfigScope.ProjectLocal, {
          permissions: {
            deny: ['Bash(curl *)'],
            allow: ['Read(*)'],
          },
        }),
      ];

      const overlapMap = computePermissionOverlapMap(scopes);

      // Verify each (scope, category, rule) triple matches resolvePermissionOverlap
      const triples: [PermissionCategory, string, ConfigScope][] = [
        [PermissionCategory.Allow, 'Bash(curl *)', ConfigScope.User],
        [PermissionCategory.Allow, 'Read(*)', ConfigScope.User],
        [PermissionCategory.Deny, 'Bash(curl *)', ConfigScope.ProjectLocal],
        [PermissionCategory.Allow, 'Read(*)', ConfigScope.ProjectLocal],
      ];

      for (const [category, rule, scope] of triples) {
        const key = `${scope}/${category}/${rule}`;
        const mapEntry = overlapMap.get(key);
        const perRuleResult = resolvePermissionOverlap(category, rule, scope, scopes);

        assert.ok(mapEntry !== undefined, `Map should have key ${key}`);
        assert.deepStrictEqual(
          mapEntry.isOverriddenBy,
          perRuleResult.isOverriddenBy,
          `isOverriddenBy mismatch for ${key}`,
        );
        assert.deepStrictEqual(
          mapEntry.isDuplicatedBy,
          perRuleResult.isDuplicatedBy,
          `isDuplicatedBy mismatch for ${key}`,
        );
        assert.deepStrictEqual(
          mapEntry.overrides,
          perRuleResult.overrides,
          `overrides mismatch for ${key}`,
        );
        assert.deepStrictEqual(
          mapEntry.duplicates,
          perRuleResult.duplicates,
          `duplicates mismatch for ${key}`,
        );
        assert.strictEqual(
          mapEntry.overriddenByCategory,
          perRuleResult.overriddenByCategory,
          `overriddenByCategory mismatch for ${key}`,
        );
      }
    });

    test('key completeness: map has entry for every (scope, category, rule) triple', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          permissions: { allow: ['Bash(*)', 'Read(*)'], deny: ['Write(*)'], ask: [] },
        }),
        makeScopedConfig(ConfigScope.ProjectShared, {
          permissions: { allow: ['Bash(*)'], deny: [], ask: ['Read(*)'] },
        }),
      ];

      const overlapMap = computePermissionOverlapMap(scopes);

      // Compute expected triples manually
      const expected = [
        `${ConfigScope.User}/${PermissionCategory.Allow}/Bash(*)`,
        `${ConfigScope.User}/${PermissionCategory.Allow}/Read(*)`,
        `${ConfigScope.User}/${PermissionCategory.Deny}/Write(*)`,
        `${ConfigScope.ProjectShared}/${PermissionCategory.Allow}/Bash(*)`,
        `${ConfigScope.ProjectShared}/${PermissionCategory.Ask}/Read(*)`,
      ];

      assert.strictEqual(overlapMap.size, expected.length, 'Map size should equal unique triple count');
      for (const key of expected) {
        assert.ok(overlapMap.has(key), `Map should contain key: ${key}`);
      }
    });

    test('scale: handles 140+ rules per scope without throwing', () => {
      const makeRules = (count: number, prefix: string): string[] =>
        Array.from({ length: count }, (_, i) => `Tool_${prefix}_${i}(*)`);

      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          permissions: { allow: makeRules(140, 'u') },
        }),
        makeScopedConfig(ConfigScope.ProjectLocal, {
          permissions: { allow: makeRules(140, 'pl') },
        }),
        makeScopedConfig(ConfigScope.ProjectShared, {
          permissions: { allow: makeRules(140, 'ps') },
        }),
        makeScopedConfig(ConfigScope.Managed, {
          permissions: { allow: makeRules(140, 'm') },
        }),
      ];

      let overlapMap: ReturnType<typeof computePermissionOverlapMap> | undefined;
      assert.doesNotThrow(() => {
        overlapMap = computePermissionOverlapMap(scopes);
      });
      // 4 scopes × 140 rules each = 560 entries
      assert.strictEqual(overlapMap!.size, 560);
    });

    test('cross-tool isolation: rules with different tool names never show overlap', () => {
      const scopes = [
        makeScopedConfig(ConfigScope.User, {
          permissions: { allow: ['Bash(*)'], deny: ['Read(*)'] },
        }),
        makeScopedConfig(ConfigScope.ProjectLocal, {
          permissions: { allow: ['Bash(*)'], deny: ['Read(*)'] },
        }),
      ];

      const overlapMap = computePermissionOverlapMap(scopes);

      // Bash(*) allow in User should only show overlap with Bash rules, not Read rules
      const bashUserAllow = overlapMap.get(`${ConfigScope.User}/${PermissionCategory.Allow}/Bash(*)`);
      assert.ok(bashUserAllow !== undefined);
      // isOverriddenBy should not reference a Read rule
      if (bashUserAllow.isOverriddenBy) {
        assert.notStrictEqual(
          String(bashUserAllow.isOverriddenBy.value).toLowerCase(),
          'read',
          'Bash allow should not show overlap caused by a Read rule',
        );
      }

      // Read(*) deny in User vs Bash(*) allow in ProjectLocal — these should NOT cross
      const readUserDeny = overlapMap.get(`${ConfigScope.User}/${PermissionCategory.Deny}/Read(*)`);
      assert.ok(readUserDeny !== undefined);
      // Read deny should only compare against Read rules in higher scopes
      // ProjectLocal has Read deny — so isDuplicatedBy should point to that
      assert.deepStrictEqual(readUserDeny.isDuplicatedBy, {
        scope: ConfigScope.ProjectLocal,
        value: PermissionCategory.Deny,
      });
    });
  });
});
