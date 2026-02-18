import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import {
  addPermissionRule,
  setEnvVar,
  setMcpServer,
  addHookEntry,
} from '../config/configWriter';
import { SCOPE_LABELS, ALL_HOOK_EVENT_TYPES } from '../constants';
import {
  ConfigScope,
  HookEventType,
  McpServerConfig,
  PermissionCategory,
} from '../types';
import { ConfigTreeNode } from '../tree/nodes/baseNode';

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

        addPermissionRule(filePath, category.value, rule.trim());
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

        setEnvVar(filePath, key.trim(), value);
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

        setMcpServer(mcpFilePath, serverName.trim(), config);
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

        addHookEntry(filePath, eventType.value as HookEventType, {
          matcher: matcher?.trim() || undefined,
          hooks: [{ type: 'command', command: command.trim() }],
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

  const editableScopes = allScopes.filter((s) => !s.isReadOnly);
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
