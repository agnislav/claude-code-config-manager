/**
 * TDD tests for MCP multi-scope discovery (Task 1: 28-02).
 *
 * Tests:
 * - getUserClaudeJsonPath returns ~/.claude.json
 * - getAllowedWritePaths includes ~/.claude.json
 * - configWriter scope-aware MCP writers preserve non-MCP data in ~/.claude.json
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Patch getAllowedWritePaths before importing configWriter so temp paths pass validation.
const constants = require('../../../src/constants');
const _originalGetAllowedWritePaths = constants.getAllowedWritePaths;
const _tempPaths = new Set<string>();
constants.getAllowedWritePaths = function () {
  const original: Set<string> = _originalGetAllowedWritePaths();
  for (const p of _tempPaths) {
    original.add(p);
  }
  return original;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const platformModule = require('../../../src/utils/platform');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const configWriterModule = require('../../../src/config/configWriter');

const getUserClaudeJsonPath: () => string = platformModule.getUserClaudeJsonPath;
const setUserMcpServer: (claudeJsonPath: string, serverName: string, config: unknown) => void =
  configWriterModule.setUserMcpServer;
const removeUserMcpServer: (claudeJsonPath: string, serverName: string) => void =
  configWriterModule.removeUserMcpServer;
const setLocalMcpServer: (claudeJsonPath: string, projectPath: string, serverName: string, config: unknown) => void =
  configWriterModule.setLocalMcpServer;
const removeLocalMcpServer: (claudeJsonPath: string, projectPath: string, serverName: string) => void =
  configWriterModule.removeLocalMcpServer;

// ── Helpers ──────────────────────────────────────────────────────

function makeTempFile(initialContent: object = {}): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-mcp-test-'));
  const filePath = path.join(tmpDir, '.claude.json');
  fs.writeFileSync(filePath, JSON.stringify(initialContent, null, 2), 'utf-8');
  _tempPaths.add(filePath);
  return filePath;
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ── Platform tests ──────────────────────────────────────────────

suite('platform: getUserClaudeJsonPath', () => {
  test('returns path to ~/.claude.json', () => {
    const result = getUserClaudeJsonPath();
    const expected = path.join(os.homedir(), '.claude.json');
    assert.strictEqual(result, expected);
  });
});

// ── getAllowedWritePaths includes ~/.claude.json ─────────────────

suite('constants: getAllowedWritePaths includes ~/.claude.json', () => {
  test('getAllowedWritePaths includes the user claude.json path', () => {
    const paths: Set<string> = _originalGetAllowedWritePaths();
    const claudeJsonPath = path.join(os.homedir(), '.claude.json');
    assert.ok(paths.has(claudeJsonPath), `getAllowedWritePaths should include ${claudeJsonPath}`);
  });
});

// ── setUserMcpServer tests ───────────────────────────────────────

suite('configWriter: setUserMcpServer', () => {
  test('adds mcpServers key at top level without losing other data', () => {
    const filePath = makeTempFile({ oauthToken: 'abc123', projects: {} });
    setUserMcpServer(filePath, 'my-server', { command: 'node', args: ['server.js'] });
    const result = readJson(filePath);
    assert.strictEqual((result as Record<string, unknown>).oauthToken, 'abc123');
    assert.deepStrictEqual((result as Record<string, Record<string, unknown>>).projects, {});
    const mcpServers = (result as Record<string, Record<string, unknown>>).mcpServers;
    assert.ok(mcpServers, 'mcpServers should exist');
    assert.deepStrictEqual(mcpServers['my-server'], { command: 'node', args: ['server.js'] });
  });

  test('overwrites existing server without losing other servers or top-level data', () => {
    const filePath = makeTempFile({
      oauthToken: 'tok',
      mcpServers: { 'existing-server': { command: 'python', args: ['-m', 'server'] } },
    });
    setUserMcpServer(filePath, 'existing-server', { command: 'python3', args: ['-m', 'new'] });
    const result = readJson(filePath);
    assert.strictEqual((result as Record<string, unknown>).oauthToken, 'tok');
    const mcpServers = (result as Record<string, Record<string, unknown>>).mcpServers;
    assert.deepStrictEqual(mcpServers['existing-server'], { command: 'python3', args: ['-m', 'new'] });
  });

  test('creates ~/.claude.json if it does not exist and writes server', () => {
    const filePath = makeTempFile({});
    // Remove file to simulate non-existence
    fs.unlinkSync(filePath);
    setUserMcpServer(filePath, 'new-server', { command: 'npx', args: ['server'] });
    const result = readJson(filePath);
    const mcpServers = (result as Record<string, Record<string, unknown>>).mcpServers;
    assert.deepStrictEqual(mcpServers['new-server'], { command: 'npx', args: ['server'] });
  });
});

// ── removeUserMcpServer tests ────────────────────────────────────

suite('configWriter: removeUserMcpServer', () => {
  test('removes server from top-level mcpServers without losing other data', () => {
    const filePath = makeTempFile({
      oauthToken: 'tok',
      mcpServers: {
        'server-a': { command: 'a' },
        'server-b': { command: 'b' },
      },
    });
    removeUserMcpServer(filePath, 'server-a');
    const result = readJson(filePath);
    assert.strictEqual((result as Record<string, unknown>).oauthToken, 'tok');
    const mcpServers = (result as Record<string, Record<string, unknown>>).mcpServers;
    assert.ok(!mcpServers['server-a'], 'server-a should be removed');
    assert.ok(mcpServers['server-b'], 'server-b should remain');
  });

  test('is a no-op if server does not exist', () => {
    const filePath = makeTempFile({ oauthToken: 'tok' });
    assert.doesNotThrow(() => removeUserMcpServer(filePath, 'nonexistent'));
    const result = readJson(filePath);
    assert.strictEqual((result as Record<string, unknown>).oauthToken, 'tok');
  });
});

// ── setLocalMcpServer tests ──────────────────────────────────────

suite('configWriter: setLocalMcpServer', () => {
  test('writes to projects[projectPath].mcpServers without losing other data', () => {
    const projectPath = '/home/user/my-project';
    const filePath = makeTempFile({ oauthToken: 'tok', projects: {} });
    setLocalMcpServer(filePath, projectPath, 'local-server', { command: 'node', args: ['local.js'] });
    const result = readJson(filePath);
    assert.strictEqual((result as Record<string, unknown>).oauthToken, 'tok');
    const projects = (result as Record<string, Record<string, unknown>>).projects;
    const projectEntry = (projects as Record<string, Record<string, unknown>>)[projectPath];
    assert.ok(projectEntry, 'project entry should exist');
    const mcpServers = (projectEntry as Record<string, Record<string, unknown>>).mcpServers;
    assert.deepStrictEqual(mcpServers['local-server'], { command: 'node', args: ['local.js'] });
  });

  test('creates projects and project path if they do not exist', () => {
    const projectPath = '/home/user/new-project';
    const filePath = makeTempFile({ oauthToken: 'tok' });
    setLocalMcpServer(filePath, projectPath, 'server', { command: 'cmd' });
    const result = readJson(filePath);
    const projects = (result as Record<string, Record<string, unknown>>).projects;
    const mcpServers = ((projects as Record<string, Record<string, unknown>>)[projectPath] as Record<string, Record<string, unknown>>).mcpServers;
    assert.deepStrictEqual(mcpServers['server'], { command: 'cmd' });
  });
});

// ── removeLocalMcpServer tests ───────────────────────────────────

suite('configWriter: removeLocalMcpServer', () => {
  test('removes server from projects[projectPath].mcpServers without losing other data', () => {
    const projectPath = '/home/user/my-project';
    const filePath = makeTempFile({
      oauthToken: 'tok',
      projects: {
        [projectPath]: {
          mcpServers: {
            'server-a': { command: 'a' },
            'server-b': { command: 'b' },
          },
        },
      },
    });
    removeLocalMcpServer(filePath, projectPath, 'server-a');
    const result = readJson(filePath);
    assert.strictEqual((result as Record<string, unknown>).oauthToken, 'tok');
    const projects = (result as Record<string, Record<string, unknown>>).projects;
    const mcpServers = ((projects as Record<string, Record<string, unknown>>)[projectPath] as Record<string, Record<string, unknown>>).mcpServers as Record<string, unknown>;
    assert.ok(!mcpServers['server-a'], 'server-a should be removed');
    assert.ok(mcpServers['server-b'], 'server-b should remain');
  });

  test('is a no-op if server does not exist', () => {
    const projectPath = '/home/user/my-project';
    const filePath = makeTempFile({ oauthToken: 'tok' });
    assert.doesNotThrow(() => removeLocalMcpServer(filePath, projectPath, 'nonexistent'));
  });
});
