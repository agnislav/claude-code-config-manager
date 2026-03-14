import * as assert from 'assert';
import {
  ConfigScope,
  ScopedConfig,
  ClaudeCodeConfig,
} from '../../../src/types';
import {
  computePermissionOverlapMap,
  resolveSettingOverlap,
  resolveEnvOverlap,
} from '../../../src/config/overlapResolver';

// ── Helpers ──────────────────────────────────────────────────────

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

// ── Fixture generators ───────────────────────────────────────────

/** Shared tool names (Bash, Read, Write, …) with many specifiers — realistic overlap pressure. */
function sharedToolRules(count: number): string[] {
  const tools = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];
  return Array.from({ length: count }, (_, i) => `${tools[i % tools.length]}(spec_${i}*)`);
}

/** All rules share ONE tool — worst-case single bucket. */
function singleToolRules(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Bash(cmd_${i} *)`);
}

/** MCP-style unique tool names — no overlap between scopes. */
function mcpRules(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_, i) => `mcp__${prefix}__tool_${i}`);
}

// ── Dataset type ─────────────────────────────────────────────────

interface PermDataset {
  label: string;
  scopes: ScopedConfig[];
}

function buildPermDatasets(): PermDataset[] {
  // --- Shared tools, 140 rules, 4 scopes ---
  const shared = sharedToolRules(140);
  const sharedScopes = [
    makeScopedConfig(ConfigScope.Managed, { permissions: { deny: shared.slice(0, 50) } }),
    makeScopedConfig(ConfigScope.User, {
      permissions: { allow: shared.slice(0, 70), deny: shared.slice(70, 100), ask: shared.slice(100, 140) },
    }),
    makeScopedConfig(ConfigScope.ProjectShared, {
      permissions: { allow: shared.slice(0, 80), deny: shared.slice(80, 140) },
    }),
    makeScopedConfig(ConfigScope.ProjectLocal, {
      permissions: { allow: shared.slice(0, 60), deny: shared.slice(60, 120) },
    }),
  ];

  // --- Single tool, 200 rules, 4 scopes (worst-case bucket) ---
  const single = singleToolRules(200);
  const singleScopes = [
    makeScopedConfig(ConfigScope.Managed, { permissions: { deny: single.slice(0, 50) } }),
    makeScopedConfig(ConfigScope.User, { permissions: { allow: single.slice(0, 100) } }),
    makeScopedConfig(ConfigScope.ProjectShared, { permissions: { allow: single.slice(50, 150) } }),
    makeScopedConfig(ConfigScope.ProjectLocal, { permissions: { deny: single.slice(100, 200) } }),
  ];

  // --- Mixed shared + MCP, 300 total ---
  const mix = sharedToolRules(150);
  const mixScopes = [
    makeScopedConfig(ConfigScope.Managed, { permissions: { deny: mix.slice(0, 30) } }),
    makeScopedConfig(ConfigScope.User, {
      permissions: { allow: [...mix.slice(0, 80), ...mcpRules(50, 'a')], deny: mix.slice(80, 120) },
    }),
    makeScopedConfig(ConfigScope.ProjectShared, {
      permissions: { allow: [...mix.slice(0, 60), ...mcpRules(50, 'b')], ask: mix.slice(100, 150) },
    }),
    makeScopedConfig(ConfigScope.ProjectLocal, {
      permissions: { allow: [...mix.slice(0, 40), ...mcpRules(50, 'c')], deny: mix.slice(40, 100) },
    }),
  ];

  // --- Unique tools only (no overlaps expected) ---
  const uniqueScopes = [
    makeScopedConfig(ConfigScope.User, { permissions: { allow: mcpRules(140, 'u') } }),
    makeScopedConfig(ConfigScope.ProjectLocal, { permissions: { allow: mcpRules(140, 'pl') } }),
    makeScopedConfig(ConfigScope.ProjectShared, { permissions: { allow: mcpRules(140, 'ps') } }),
    makeScopedConfig(ConfigScope.Managed, { permissions: { allow: mcpRules(140, 'm') } }),
  ];

  // --- Extreme: 500 Bash rules, 4 scopes, heavy overlap ---
  const extreme = singleToolRules(500);
  const extremeScopes = [
    makeScopedConfig(ConfigScope.Managed, { permissions: { deny: extreme.slice(0, 200) } }),
    makeScopedConfig(ConfigScope.User, { permissions: { allow: extreme.slice(0, 300) } }),
    makeScopedConfig(ConfigScope.ProjectShared, {
      permissions: { allow: extreme.slice(100, 400), deny: extreme.slice(400, 500) },
    }),
    makeScopedConfig(ConfigScope.ProjectLocal, { permissions: { deny: extreme.slice(200, 500) } }),
  ];

  return [
    { label: 'shared-tools (140 rules, 4 scopes)', scopes: sharedScopes },
    { label: 'single-tool bucket (200 rules, 4 scopes)', scopes: singleScopes },
    { label: 'mixed shared+mcp (300 rules, 4 scopes)', scopes: mixScopes },
    { label: 'unique tools only (560 rules, 4 scopes)', scopes: uniqueScopes },
    { label: 'extreme single-tool (500 rules, 4 scopes)', scopes: extremeScopes },
  ];
}

// ── Tests ────────────────────────────────────────────────────────

suite('Overlap Performance', () => {
  const TIMEOUT_MS = 10_000;

  suite('computePermissionOverlapMap', () => {
    for (const dataset of buildPermDatasets()) {
      test(`${dataset.label} — completes in <10s`, function () {
        this.timeout(TIMEOUT_MS);

        const start = performance.now();
        const overlapMap = computePermissionOverlapMap(dataset.scopes);
        const elapsed = performance.now() - start;

        console.log(`[perf] permOverlapMap [${dataset.label}]: ${elapsed.toFixed(1)}ms, ${overlapMap.size} entries`);

        assert.ok(overlapMap.size > 0, 'Map should not be empty');
        assert.ok(elapsed < TIMEOUT_MS, `Took ${elapsed.toFixed(0)}ms, exceeds ${TIMEOUT_MS}ms`);
      });
    }
  });

  suite('resolveSettingOverlap — repeated calls', () => {
    const settingCounts = [50, 100, 200];

    for (const count of settingCounts) {
      test(`${count} settings x 4 scopes — completes in <10s`, function () {
        this.timeout(TIMEOUT_MS);

        const settings: Record<string, unknown> = {};
        for (let i = 0; i < count; i++) settings[`setting_${i}`] = `value_${i}`;

        const scopes = [
          makeScopedConfig(ConfigScope.Managed, settings),
          makeScopedConfig(ConfigScope.User, settings),
          makeScopedConfig(ConfigScope.ProjectShared, settings),
          makeScopedConfig(ConfigScope.ProjectLocal, settings),
        ];

        const start = performance.now();
        for (const key of Object.keys(settings)) {
          for (const sc of scopes) {
            resolveSettingOverlap(key, sc.scope, scopes);
          }
        }
        const elapsed = performance.now() - start;

        console.log(`[perf] settingOverlap [${count} x 4]: ${elapsed.toFixed(1)}ms`);
        assert.ok(elapsed < TIMEOUT_MS, `Took ${elapsed.toFixed(0)}ms, exceeds ${TIMEOUT_MS}ms`);
      });
    }
  });

  suite('resolveEnvOverlap — repeated calls', () => {
    const envCounts = [50, 100];

    for (const count of envCounts) {
      test(`${count} env vars x 4 scopes — completes in <10s`, function () {
        this.timeout(TIMEOUT_MS);

        const env: Record<string, string> = {};
        for (let i = 0; i < count; i++) env[`VAR_${i}`] = `val_${i}`;

        const scopes = [
          makeScopedConfig(ConfigScope.Managed, { env }),
          makeScopedConfig(ConfigScope.User, { env }),
          makeScopedConfig(ConfigScope.ProjectShared, { env }),
          makeScopedConfig(ConfigScope.ProjectLocal, { env }),
        ];

        const start = performance.now();
        for (const key of Object.keys(env)) {
          for (const sc of scopes) {
            resolveEnvOverlap(key, sc.scope, scopes);
          }
        }
        const elapsed = performance.now() - start;

        console.log(`[perf] envOverlap [${count} x 4]: ${elapsed.toFixed(1)}ms`);
        assert.ok(elapsed < TIMEOUT_MS, `Took ${elapsed.toFixed(0)}ms, exceeds ${TIMEOUT_MS}ms`);
      });
    }
  });
});
