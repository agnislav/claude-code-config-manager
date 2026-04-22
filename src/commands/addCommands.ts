import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import {
  addPermissionRule,
  setEnvVar,
  setMcpServer,
  addHookEntry,
  setScalarSetting,
} from '../config/configWriter';
import { SCOPE_LABELS, ALL_HOOK_EVENT_TYPES, KNOWN_SETTING_KEYS, SETTING_TYPE_MAP, DEDICATED_SECTION_KEYS } from '../constants';
import {
  HookEventType,
  McpServerConfig,
  PermissionCategory,
} from '../types';

interface SettingQuickPickItem extends vscode.QuickPickItem {
  value?: string;
}
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { withWriteRetry } from '../utils/commandHelpers';

export function registerAddCommands(
  context: vscode.ExtensionContext,
  configStore: ConfigStore,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.addPermissionRule',
      async (node?: ConfigTreeNode) => {
        const filePath = await resolveFilePath(node, configStore);
        if (!filePath) return;

        const category = await vscode.window.showQuickPick(
          [
            { label: 'Allow', value: PermissionCategory.Allow },
            { label: 'Deny', value: PermissionCategory.Deny },
            { label: 'Ask', value: PermissionCategory.Ask },
          ],
          { placeHolder: 'Select permission category' },
        );
        if (!category) return;

        const rule = await vscode.window.showInputBox({
          placeHolder: 'e.g. Bash(npm run *), Read(.env), WebFetch(domain:example.com)',
          prompt: 'Enter permission rule (Tool or Tool(specifier))',
          validateInput: (v) => (v.trim() ? null : 'Rule cannot be empty'),
        });
        if (!rule) return;

        await withWriteRetry(filePath, () => {
          addPermissionRule(filePath, category.value, rule.trim());
        });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.addEnvVar',
      async (node?: ConfigTreeNode) => {
        const filePath = await resolveFilePath(node, configStore);
        if (!filePath) return;

        const key = await vscode.window.showInputBox({
          placeHolder: 'e.g. NODE_ENV',
          prompt: 'Enter environment variable name',
          validateInput: (v) => (v.trim() ? null : 'Key cannot be empty'),
        });
        if (!key) return;

        const value = await vscode.window.showInputBox({
          placeHolder: 'e.g. production',
          prompt: `Enter value for ${key}`,
        });
        if (value === undefined) return;

        await withWriteRetry(filePath, () => {
          setEnvVar(filePath, key.trim(), value);
        });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.addMcpServer',
      async (node?: ConfigTreeNode) => {
        // MCP servers go in .mcp.json
        const mcpFilePath = resolveMcpFilePath(node, configStore);
        if (!mcpFilePath) return;

        const serverName = await vscode.window.showInputBox({
          placeHolder: 'e.g. github, memory',
          prompt: 'Enter MCP server name',
          validateInput: (v) => (v.trim() ? null : 'Name cannot be empty'),
        });
        if (!serverName) return;

        const serverType = await vscode.window.showQuickPick(
          [
            { label: 'stdio (command-line)', value: 'stdio' },
            { label: 'SSE (HTTP endpoint)', value: 'sse' },
          ],
          { placeHolder: 'Select server type' },
        );
        if (!serverType) return;

        let config: McpServerConfig;

        if (serverType.value === 'sse') {
          const url = await vscode.window.showInputBox({
            placeHolder: 'https://mcp.example.com/sse',
            prompt: 'Enter SSE endpoint URL',
            validateInput: (v) => (v.trim() ? null : 'URL cannot be empty'),
          });
          if (!url) return;
          config = { type: 'sse', url: url.trim() };
        } else {
          const command = await vscode.window.showInputBox({
            placeHolder: 'e.g. npx',
            prompt: 'Enter command to start the server',
            validateInput: (v) => (v.trim() ? null : 'Command cannot be empty'),
          });
          if (!command) return;

          const argsStr = await vscode.window.showInputBox({
            placeHolder: 'e.g. @anthropic-ai/github-mcp (space-separated)',
            prompt: 'Enter command arguments (optional)',
          });

          const args = argsStr?.trim() ? argsStr.trim().split(/\s+/) : undefined;
          config = { command: command.trim(), args };
        }

        await withWriteRetry(mcpFilePath, () => {
          setMcpServer(mcpFilePath, serverName.trim(), config);
        });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.addHook',
      async (node?: ConfigTreeNode) => {
        const filePath = await resolveFilePath(node, configStore);
        if (!filePath) return;

        const eventType = await vscode.window.showQuickPick(
          ALL_HOOK_EVENT_TYPES.map((e) => ({ label: e, value: e })),
          { placeHolder: 'Select hook event type' },
        );
        if (!eventType) return;

        const matcher = await vscode.window.showInputBox({
          placeHolder: 'e.g. Bash, Edit|Write, * (leave empty for no matcher)',
          prompt: 'Enter matcher pattern (optional)',
        });

        const command = await vscode.window.showInputBox({
          placeHolder: 'e.g. ~/.claude/hooks/validate.sh',
          prompt: 'Enter hook command',
          validateInput: (v) => (v.trim() ? null : 'Command cannot be empty'),
        });
        if (!command) return;

        await withWriteRetry(filePath, () => {
          addHookEntry(filePath, eventType.value as HookEventType, {
            matcher: matcher?.trim() || undefined,
            hooks: [{ type: 'command', command: command.trim() }],
          });
        });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.addSetting',
      async (node?: ConfigTreeNode) => {
        const filePath = await resolveFilePath(node, configStore);
        if (!filePath) return;

        // Determine already-set setting keys for this file's scope
        const allScopes = configStore.getAllScopes();
        const scopedConfig = allScopes.find((s) => s.filePath === filePath);
        const existingConfig = scopedConfig?.config ?? {};
        const existingSettingKeys = new Set(
          Object.keys(existingConfig).filter((k) => !DEDICATED_SECTION_KEYS.has(k)),
        );

        // Build QuickPick items from KNOWN_SETTING_KEYS, filtering out already-present keys
        const knownItems: SettingQuickPickItem[] = KNOWN_SETTING_KEYS
          .filter((key) => !existingSettingKeys.has(key))
          .map((key) => ({
            label: key,
            description: SETTING_TYPE_MAP[key] ?? 'unknown',
            value: key,
          }));

        const items: SettingQuickPickItem[] = [
          ...knownItems,
          { label: '', kind: vscode.QuickPickItemKind.Separator },
          { label: '$(edit) Enter custom key...', value: '__custom__', alwaysShow: true },
        ];

        const selected = await vscode.window.showQuickPick<SettingQuickPickItem>(items, {
          placeHolder: 'Select setting to add',
        });
        if (!selected) return;

        let selectedKey: string;
        if (selected.value === '__custom__') {
          const customKey = await vscode.window.showInputBox({
            prompt: 'Enter setting key',
            validateInput: (v) => (v.trim() ? null : 'Key cannot be empty'),
          });
          if (!customKey) return;
          selectedKey = customKey.trim();
        } else {
          selectedKey = selected.value ?? selected.label;
        }

        const valueType = SETTING_TYPE_MAP[selectedKey] ?? 'string';

        let value: unknown;

        if (valueType === 'boolean') {
          const boolPick = await vscode.window.showQuickPick(
            [
              { label: 'true', value: true as boolean | undefined },
              { label: 'false', value: false as boolean | undefined },
            ],
            { placeHolder: `Set value for ${selectedKey}` },
          );
          if (!boolPick) return;
          value = boolPick.value;
        } else if (valueType === 'number') {
          const numStr = await vscode.window.showInputBox({
            prompt: `Enter value for ${selectedKey}`,
            validateInput: (v) => (isNaN(Number(v)) ? 'Must be a number' : null),
          });
          if (numStr === undefined) return;
          value = Number(numStr);
        } else if (valueType === 'string[]') {
          const arrStr = await vscode.window.showInputBox({
            prompt: `Enter comma-separated values for ${selectedKey}`,
          });
          if (arrStr === undefined) return;
          value = arrStr
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        } else if (valueType === 'object') {
          const jsonStr = await vscode.window.showInputBox({
            prompt: `Enter JSON value for ${selectedKey}`,
            validateInput: (v) => {
              try {
                JSON.parse(v);
                return null;
              } catch (e) {
                return e instanceof Error ? e.message : 'Invalid JSON';
              }
            },
          });
          if (jsonStr === undefined) return;
          value = JSON.parse(jsonStr);
        } else {
          // string (default)
          const strVal = await vscode.window.showInputBox({
            prompt: `Enter value for ${selectedKey}`,
          });
          if (strVal === undefined) return;
          value = strVal;
        }

        await withWriteRetry(filePath, () => {
          setScalarSetting(filePath, selectedKey, value);
        });
      },
    ),
  );
}

async function resolveFilePath(
  node: ConfigTreeNode | undefined,
  configStore: ConfigStore,
): Promise<string | undefined> {
  if (node?.nodeContext?.filePath) {
    return node.nodeContext.filePath;
  }

  // No node context — ask user to pick a scope
  return pickScopeFilePath(configStore);
}

function resolveMcpFilePath(
  node: ConfigTreeNode | undefined,
  configStore: ConfigStore,
): string | undefined {
  if (node?.nodeContext?.filePath) {
    return node.nodeContext.filePath;
  }

  // Default to first workspace folder's .mcp.json
  const keys = configStore.getWorkspaceFolderKeys();
  if (keys.length === 0) return undefined;

  const discovered = configStore.getDiscoveredPaths(keys[0]);
  return discovered?.mcp?.path;
}

async function pickScopeFilePath(configStore: ConfigStore): Promise<string | undefined> {
  const keys = configStore.getWorkspaceFolderKeys();
  if (keys.length === 0) return undefined;

  const key = keys[0];
  const allScopes = configStore.getAllScopes(key);

  const editableScopes = allScopes.filter(
    (s) => !s.isReadOnly && !configStore.isScopeLocked(s.scope),
  );
  if (editableScopes.length === 0) return undefined;

  const pick = await vscode.window.showQuickPick(
    editableScopes.map((s) => ({
      label: SCOPE_LABELS[s.scope],
      value: s.filePath,
    })),
    { placeHolder: 'Select target scope' },
  );

  return pick?.value;
}
