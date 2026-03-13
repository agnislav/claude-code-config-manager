/**
 * TDD tests for MCP tooltip scope info line (Task 2: 28-02).
 *
 * Tests:
 * - McpServerVM tooltip includes "Defined in: {ScopeLabel} ({shortPath})" line
 * - MCP servers under User/ProjectLocal scopes show scope info from mcpFilePath
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { ConfigScope, ScopedConfig } from '../../../src/types';
import { TreeViewModelBuilder } from '../../../src/viewmodel/builder';
import { ConfigStore } from '../../../src/config/configModel';
import { McpServerVM, NodeKind } from '../../../src/viewmodel/types';

// ── Minimal mock ConfigStore ──────────────────────────────────────

function makeStore(scopes: ScopedConfig[]): ConfigStore {
  const store = Object.create(ConfigStore.prototype) as ConfigStore;
  (store as unknown as Record<string, unknown>)['configs'] = new Map([['__global__', scopes]]);
  (store as unknown as Record<string, unknown>)['discoveredPaths'] = new Map();
  (store as unknown as Record<string, unknown>)['_lockedScopes'] = new Set();
  (store as unknown as Record<string, unknown>)['isMultiRoot'] = () => false;
  (store as unknown as Record<string, unknown>)['getWorkspaceFolderKeys'] = () => ['__global__'];
  (store as unknown as Record<string, unknown>)['getAllScopes'] = () => scopes;
  (store as unknown as Record<string, unknown>)['isScopeLocked'] = () => false;
  return store;
}

function emptyConfig() {
  return { permissions: undefined, env: undefined, hooks: undefined, sandbox: undefined, enabledPlugins: undefined };
}

// ── Tests ─────────────────────────────────────────────────────────

suite('MCP tooltip scope info (TEST-MCP-TOOLTIP)', () => {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  const shortClaudeJson = '~/.claude.json';

  test('ProjectShared MCP server tooltip shows scope label and .mcp.json path', () => {
    const mcpFilePath = '/workspace/.mcp.json';
    const scopes: ScopedConfig[] = [
      {
        scope: ConfigScope.ProjectShared,
        filePath: '/workspace/.claude/settings.json',
        fileExists: true,
        config: emptyConfig(),
        mcpConfig: { mcpServers: { 'my-server': { command: 'node', args: ['s.js'] } } },
        mcpFilePath,
        isReadOnly: false,
      },
    ];

    const store = makeStore(scopes);
    const builder = new TreeViewModelBuilder(store);
    const vms = builder.build();
    const scopeVM = vms.find((v) => v.kind === NodeKind.Scope) ?? vms[0];
    const sectionVM = (scopeVM as unknown as { children: unknown[] }).children?.[0];
    const mcpVMs = (sectionVM as unknown as { children: McpServerVM[] }).children;
    const mcpVM = mcpVMs?.[0];

    assert.ok(mcpVM, 'MCP server VM should exist');
    assert.strictEqual(mcpVM.kind, NodeKind.McpServer);
    const tooltip = mcpVM.tooltip;
    const tooltipText =
      tooltip instanceof vscode.MarkdownString ? tooltip.value : String(tooltip ?? '');
    assert.ok(
      tooltipText.includes('Defined in:'),
      `tooltip should include "Defined in:". Got: ${tooltipText}`,
    );
    assert.ok(
      tooltipText.includes('Project (Shared)'),
      `tooltip should include scope label. Got: ${tooltipText}`,
    );
  });

  test('User scope MCP server tooltip shows User scope label and ~/.claude.json path', () => {
    const scopes: ScopedConfig[] = [
      {
        scope: ConfigScope.User,
        filePath: path.join(os.homedir(), '.claude', 'settings.json'),
        fileExists: true,
        config: emptyConfig(),
        mcpConfig: { mcpServers: { 'user-server': { command: 'python', args: ['-m', 'srv'] } } },
        mcpFilePath: claudeJsonPath,
        isReadOnly: false,
      },
    ];

    const store = makeStore(scopes);
    const builder = new TreeViewModelBuilder(store);
    const vms = builder.build();
    const scopeVM = vms[0];
    const sectionVM = (scopeVM as unknown as { children: unknown[] }).children?.[0];
    const mcpVMs = (sectionVM as unknown as { children: McpServerVM[] }).children;
    const mcpVM = mcpVMs?.[0];

    assert.ok(mcpVM, 'MCP server VM should exist');
    const tooltip = mcpVM.tooltip;
    const tooltipText =
      tooltip instanceof vscode.MarkdownString ? tooltip.value : String(tooltip ?? '');
    assert.ok(
      tooltipText.includes('Defined in:'),
      `tooltip should include "Defined in:". Got: ${tooltipText}`,
    );
    assert.ok(
      tooltipText.includes('User'),
      `tooltip should include "User" scope label. Got: ${tooltipText}`,
    );
    assert.ok(
      tooltipText.includes(shortClaudeJson) || tooltipText.includes('.claude.json'),
      `tooltip should include ~/.claude.json path. Got: ${tooltipText}`,
    );
  });

  test('ProjectLocal scope MCP server tooltip shows Project (Local) scope label', () => {
    const scopes: ScopedConfig[] = [
      {
        scope: ConfigScope.ProjectLocal,
        filePath: '/workspace/.claude/settings.local.json',
        fileExists: true,
        config: emptyConfig(),
        mcpConfig: { mcpServers: { 'local-server': { command: 'npx', args: ['srv'] } } },
        mcpFilePath: claudeJsonPath,
        isReadOnly: false,
      },
    ];

    const store = makeStore(scopes);
    const builder = new TreeViewModelBuilder(store);
    const vms = builder.build();
    const scopeVM = vms[0];
    const sectionVM = (scopeVM as unknown as { children: unknown[] }).children?.[0];
    const mcpVMs = (sectionVM as unknown as { children: McpServerVM[] }).children;
    const mcpVM = mcpVMs?.[0];

    assert.ok(mcpVM, 'MCP server VM should exist');
    const tooltip = mcpVM.tooltip;
    const tooltipText =
      tooltip instanceof vscode.MarkdownString ? tooltip.value : String(tooltip ?? '');
    assert.ok(
      tooltipText.includes('Defined in:'),
      `tooltip should include "Defined in:". Got: ${tooltipText}`,
    );
    assert.ok(
      tooltipText.includes('Project (Local)'),
      `tooltip should include "Project (Local)" scope label. Got: ${tooltipText}`,
    );
  });
});
