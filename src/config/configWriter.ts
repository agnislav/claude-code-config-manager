import * as fs from 'fs';
import * as path from 'path';
import {
  ClaudeCodeConfig,
  HookEventType,
  HookMatcher,
  McpConfig,
  McpServerConfig,
  PermissionCategory,
} from '../types';
import { readJsonFile, writeJsonFile } from '../utils/json';

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

  writeJsonFile(filePath, config);
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

  writeJsonFile(filePath, config);
}

// ── Environment Variables ───────────────────────────────────────

export function setEnvVar(filePath: string, key: string, value: string): void {
  ensureDir(filePath);
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);

  if (!config.env) {
    config.env = {};
  }
  config.env[key] = value;

  writeJsonFile(filePath, config);
}

export function removeEnvVar(filePath: string, key: string): void {
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  if (!config.env) return;

  delete config.env[key];

  if (Object.keys(config.env).length === 0) {
    delete config.env;
  }

  writeJsonFile(filePath, config);
}

// ── Scalar Settings ─────────────────────────────────────────────

export function setScalarSetting(filePath: string, key: string, value: unknown): void {
  ensureDir(filePath);
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  config[key] = value;
  writeJsonFile(filePath, config);
}

export function removeScalarSetting(filePath: string, key: string): void {
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  delete config[key];
  writeJsonFile(filePath, config);
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
  writeJsonFile(filePath, config);
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

  writeJsonFile(filePath, config);
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

  writeJsonFile(filePath, config);
}

export function removeMcpServer(filePath: string, serverName: string): void {
  const config = loadOrCreate<McpConfig>(filePath);
  if (!config.mcpServers) return;

  delete config.mcpServers[serverName];

  if (Object.keys(config.mcpServers).length === 0) {
    delete config.mcpServers;
  }

  writeJsonFile(filePath, config);
}

// ── Plugins ─────────────────────────────────────────────────────

export function setPluginEnabled(filePath: string, pluginId: string, enabled: boolean): void {
  ensureDir(filePath);
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);

  if (!config.enabledPlugins) {
    config.enabledPlugins = {};
  }
  config.enabledPlugins[pluginId] = enabled;

  writeJsonFile(filePath, config);
}

export function removePlugin(filePath: string, pluginId: string): void {
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  if (!config.enabledPlugins) return;

  delete config.enabledPlugins[pluginId];

  if (Object.keys(config.enabledPlugins).length === 0) {
    delete config.enabledPlugins;
  }

  writeJsonFile(filePath, config);
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

  writeJsonFile(filePath, config);
}
