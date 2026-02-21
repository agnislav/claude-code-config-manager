import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import {
  ClaudeCodeConfig,
  HookEventType,
  HookMatcher,
  McpConfig,
  McpServerConfig,
  PermissionCategory,
} from '../types';
import { readJsonFile, writeJsonFile } from '../utils/json';
import { getAllowedWritePaths } from '../constants';

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function loadOrCreate<T>(filePath: string): T {
  const result = readJsonFile<T>(filePath);
  if (result.error) {
    throw new Error(`Cannot modify ${filePath}: ${result.error}`);
  }
  return result.data;
}

// ── Write Lifecycle Tracking ────────────────────────────────────

/** Tracks file paths currently being written to prevent redundant reloads */
const inFlightPaths = new Set<string>();

/** Output channel for write lifecycle logging */
let outputChannel: vscode.OutputChannel | undefined;

/**
 * Initialize write tracker with output channel for logging.
 * Must be called during extension activation before any writes.
 */
export function initWriteTracker(channel: vscode.OutputChannel): void {
  outputChannel = channel;
}

/**
 * Check if a write operation is currently in-flight for the given path.
 * Used by file watcher to suppress redundant reloads.
 */
export function isWriteInFlight(filePath: string): boolean {
  return inFlightPaths.has(filePath);
}

/**
 * Get the count of currently in-flight writes.
 * Used by deactivation logic to know when all writes are complete.
 */
export function getInFlightWriteCount(): number {
  return inFlightPaths.size;
}

/**
 * Log a write lifecycle event with wall-clock timestamp.
 * Format: [HH:MM:SS.mmm] [write] {message}
 */
function logWrite(message: string): void {
  if (!outputChannel) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const mmm = String(now.getMilliseconds()).padStart(3, '0');
  outputChannel.appendLine(`[${hh}:${mm}:${ss}.${mmm}] [write] ${message}`);
}

/**
 * Validates that a file path is a known, safe config path for writing.
 * Checks in order: (1) traversal, (2) symlink, (3) whitelist, (4) parent exists.
 * Throws descriptive error on validation failure.
 */
export function validateConfigPath(filePath: string): void {
  // 1. Reject traversal sequences
  if (filePath.includes('../') || filePath.includes('..\\')) {
    logWrite(`REJECTED: ${filePath} (path traversal detected)`);
    throw new Error(
      `Cannot write to ${filePath}: path contains traversal sequences (../)`
    );
  }

  // 2. Reject symlinks — check with lstatSync
  //    Only check if the file or parent directory already exists on disk
  try {
    // Check the file itself if it exists
    if (fs.existsSync(filePath)) {
      const fileStat = fs.lstatSync(filePath);
      if (fileStat.isSymbolicLink()) {
        logWrite(`REJECTED: ${filePath} (symlink detected)`);
        throw new Error(
          `Cannot write to ${filePath}: path is a symbolic link`
        );
      }
    }
    // Check parent directory
    const parentDir = path.dirname(filePath);
    if (fs.existsSync(parentDir)) {
      const dirStat = fs.lstatSync(parentDir);
      if (dirStat.isSymbolicLink()) {
        logWrite(`REJECTED: ${filePath} (parent directory is a symlink)`);
        throw new Error(
          `Cannot write to ${filePath}: parent directory is a symbolic link`
        );
      }
    }
  } catch (e) {
    // Re-throw our validation errors, ignore stat errors
    if (e instanceof Error && e.message.startsWith('Cannot write to')) {
      throw e;
    }
    // stat failures on non-existent paths are fine — ensureDir will create them
  }

  // 3. Check against exact whitelist of allowed config paths
  const allowedPaths = getAllowedWritePaths();
  if (!allowedPaths.has(filePath)) {
    const allowedList = Array.from(allowedPaths).join(', ');
    logWrite(`REJECTED: ${filePath} (not in allowed paths)`);
    throw new Error(
      `Cannot write to ${filePath}: outside allowed config directories. Allowed: ${allowedList}`
    );
  }

  // 4. Check parent directory exists (ensureDir handles creation, but validate it's possible)
  //    This is a soft check — ensureDir will create missing intermediate dirs.
  //    We log for observability but don't block.
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) {
    logWrite(`note: parent directory will be created: ${parentDir}`);
  }
}

/**
 * Wrapper that tracks write lifecycle and logs events.
 * - Validates path before write
 * - Adds path to in-flight set before write
 * - Logs start, complete/fail, and watcher resume events
 * - Always clears in-flight flag in finally block (even on error)
 * - Re-throws errors for caller to handle
 */
function trackedWrite(filePath: string, writeFn: () => void): void {
  validateConfigPath(filePath);

  inFlightPaths.add(filePath);
  logWrite(`start: ${filePath}`);
  const startTime = Date.now();

  try {
    writeFn();
    const duration = Date.now() - startTime;
    logWrite(`complete: ${filePath} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    logWrite(`FAIL: ${filePath} (${duration}ms) — ${errorMsg}`);
    throw error;
  } finally {
    inFlightPaths.delete(filePath);
    logWrite(`watcher resumed: ${filePath}`);
  }
}

// ── Error Handling ──────────────────────────────────────────────

function resolveFileLabel(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const homeDir = os.homedir().replace(/\\/g, '/');

  // Check if it's a workspace-relative project config
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const folderPath = folder.uri.fsPath.replace(/\\/g, '/');
      if (normalizedPath.startsWith(folderPath)) {
        const relativePath = normalizedPath.slice(folderPath.length + 1);
        if (normalizedPath.includes('/.claude/settings.local.json')) {
          return `Project Local (${relativePath})`;
        }
        if (normalizedPath.includes('/.claude/settings.json')) {
          return `Project Shared (${relativePath})`;
        }
      }
    }
  }

  // User settings
  if (normalizedPath.startsWith(homeDir) && normalizedPath.includes('/.claude/settings.json')) {
    return 'User';
  }

  // Managed (Enterprise)
  if (
    normalizedPath.includes('/Library/Application Support/ClaudeCode') ||
    normalizedPath.includes('/etc/claude-code')
  ) {
    return 'Managed (Enterprise)';
  }

  // MCP config
  if (normalizedPath.endsWith('.mcp.json')) {
    return 'MCP config';
  }

  // Fallback to file path
  return filePath;
}

export async function showWriteError(
  filePath: string,
  error: unknown,
  retryFn?: () => void,
): Promise<void> {
  const scopeLabel = resolveFileLabel(filePath);
  const errorMsg = error instanceof Error ? error.message : String(error);
  const message = `Failed to write ${scopeLabel} settings (${filePath}): ${errorMsg}`;

  const actions: string[] = ['Open File'];
  if (retryFn) {
    actions.push('Retry');
  }

  const choice = await vscode.window.showErrorMessage(message, ...actions);

  if (choice === 'Open File') {
    try {
      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc);
    } catch (openError) {
      vscode.window.showErrorMessage(
        `Could not open file: ${openError instanceof Error ? openError.message : String(openError)}`,
      );
    }
  } else if (choice === 'Retry' && retryFn) {
    try {
      retryFn();
    } catch (retryError) {
      // Retry failed - showWriteError will be called again by the caller's error handling
      console.error('[Claude Config] Retry failed:', retryError);
    }
  }
}

// ── Permissions ─────────────────────────────────────────────────

export function addPermissionRule(
  filePath: string,
  category: PermissionCategory,
  rule: string,
): void {
  ensureDir(filePath);
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);

  if (!config.permissions) {
    config.permissions = {};
  }
  if (!config.permissions[category]) {
    config.permissions[category] = [];
  }

  const rules = config.permissions[category]!;
  if (!rules.includes(rule)) {
    rules.push(rule);
  }

  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

export function removePermissionRule(
  filePath: string,
  category: PermissionCategory,
  rule: string,
): void {
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  const rules = config.permissions?.[category];
  if (!rules) return;

  const index = rules.indexOf(rule);
  if (index !== -1) {
    rules.splice(index, 1);
  }

  // Clean up empty arrays
  if (rules.length === 0) {
    delete config.permissions![category];
  }
  if (config.permissions && Object.keys(config.permissions).length === 0) {
    delete config.permissions;
  }

  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

// ── Environment Variables ───────────────────────────────────────

export function setEnvVar(filePath: string, key: string, value: string): void {
  ensureDir(filePath);
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);

  if (!config.env) {
    config.env = {};
  }
  config.env[key] = value;

  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

export function removeEnvVar(filePath: string, key: string): void {
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  if (!config.env) return;

  delete config.env[key];

  if (Object.keys(config.env).length === 0) {
    delete config.env;
  }

  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

// ── Scalar Settings ─────────────────────────────────────────────

export function setScalarSetting(filePath: string, key: string, value: unknown): void {
  ensureDir(filePath);
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  config[key] = value;
  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

export function removeScalarSetting(filePath: string, key: string): void {
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  delete config[key];
  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

// ── Hooks ───────────────────────────────────────────────────────

export function addHookEntry(
  filePath: string,
  eventType: HookEventType,
  matcher: HookMatcher,
): void {
  ensureDir(filePath);
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);

  if (!config.hooks) {
    config.hooks = {};
  }
  if (!config.hooks[eventType]) {
    config.hooks[eventType] = [];
  }

  config.hooks[eventType]!.push(matcher);
  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

export function removeHookEntry(
  filePath: string,
  eventType: HookEventType,
  matcherIndex: number,
): void {
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  const matchers = config.hooks?.[eventType];
  if (!matchers) return;

  matchers.splice(matcherIndex, 1);

  if (matchers.length === 0) {
    delete config.hooks![eventType];
  }
  if (config.hooks && Object.keys(config.hooks).length === 0) {
    delete config.hooks;
  }

  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

// ── MCP Servers ─────────────────────────────────────────────────

export function setMcpServer(
  filePath: string,
  serverName: string,
  serverConfig: McpServerConfig,
): void {
  ensureDir(filePath);
  const config = loadOrCreate<McpConfig>(filePath);

  if (!config.mcpServers) {
    config.mcpServers = {};
  }
  config.mcpServers[serverName] = serverConfig;

  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

export function removeMcpServer(filePath: string, serverName: string): void {
  const config = loadOrCreate<McpConfig>(filePath);
  if (!config.mcpServers) return;

  delete config.mcpServers[serverName];

  if (Object.keys(config.mcpServers).length === 0) {
    delete config.mcpServers;
  }

  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

// ── Plugins ─────────────────────────────────────────────────────

export function setPluginEnabled(filePath: string, pluginId: string, enabled: boolean): void {
  ensureDir(filePath);
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);

  if (!config.enabledPlugins) {
    config.enabledPlugins = {};
  }
  config.enabledPlugins[pluginId] = enabled;

  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

export function removePlugin(filePath: string, pluginId: string): void {
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  if (!config.enabledPlugins) return;

  delete config.enabledPlugins[pluginId];

  if (Object.keys(config.enabledPlugins).length === 0) {
    delete config.enabledPlugins;
  }

  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

// ── Sandbox ─────────────────────────────────────────────────────

export function setSandboxProperty(filePath: string, key: string, value: unknown): void {
  ensureDir(filePath);
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);

  if (!config.sandbox) {
    config.sandbox = {};
  }

  const keys = key.split('.');
  if (keys.length === 1) {
    (config.sandbox as Record<string, unknown>)[key] = value;
  } else if (keys.length === 2 && keys[0] === 'network') {
    if (!config.sandbox.network) {
      config.sandbox.network = {};
    }
    (config.sandbox.network as Record<string, unknown>)[keys[1]] = value;
  }

  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}
