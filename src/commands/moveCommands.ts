import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import {
  addPermissionRule,
  removePermissionRule,
  setEnvVar,
  removeEnvVar,
  setMcpServer,
  removeMcpServer,
  setUserMcpServer,
  removeUserMcpServer,
  setLocalMcpServer,
  removeLocalMcpServer,
  setScalarSetting,
  removeScalarSetting,
  setPluginEnabled,
  removePlugin,
} from '../config/configWriter';
import { PERMISSION_CATEGORY_LABELS, SCOPE_LABELS, MESSAGES } from '../constants';
import { ClaudeCodeConfig, ConfigScope, McpServerConfig, PermissionCategory } from '../types';
import { readJsonFile } from '../utils/json';
import { getUserClaudeJsonPath } from '../utils/platform';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { validateKeyPath } from '../utils/validation';
import { guardReadOnly, pickEditableTargetScope, confirmOverwrite, withWriteRetry } from '../utils/commandHelpers';

export function registerMoveCommands(
  context: vscode.ExtensionContext,
  configStore: ConfigStore,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.moveToScope',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { filePath, keyPath, scope } = node.nodeContext;

        if (guardReadOnly(node, MESSAGES.readOnlyMove)) return;

        const key = node.nodeContext.workspaceFolderUri ?? configStore.getWorkspaceFolderKeys()[0];
        const allScopes = configStore.getAllScopes(key);

        const target = await pickEditableTargetScope(
          configStore,
          scope,
          node.nodeContext.workspaceFolderUri,
          'Move to which scope?',
        );
        if (!target) return;

        const targetFilePath = target.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(MESSAGES.noTargetFileMove);
          return;
        }

        if (!validateKeyPath(keyPath, 1, 'moveToScope')) return;

        const rootKey = keyPath[0];

        await withWriteRetry(targetFilePath, () => {
          // Write to target first, then remove from source
          if (rootKey === 'permissions' && keyPath.length === 3) {
            const category = keyPath[1] as PermissionCategory;
            const rule = keyPath[2];
            addPermissionRule(targetFilePath, category, rule);
            removePermissionRule(filePath!, category, rule);
          } else if (rootKey === 'env' && keyPath.length === 2) {
            const envKey = keyPath[1];
            const currentSc = allScopes.find((s) => s.scope === scope);
            const currentValue = currentSc?.config.env?.[envKey] ?? '';
            setEnvVar(targetFilePath, envKey, currentValue);
            removeEnvVar(filePath!, envKey);
          } else if (rootKey === 'enabledPlugins' && keyPath.length === 2) {
            const pluginId = keyPath[1];
            const currentSc = allScopes.find((s) => s.scope === scope);
            const enabled = currentSc?.config.enabledPlugins?.[pluginId] ?? true;
            setPluginEnabled(targetFilePath, pluginId, enabled);
            removePlugin(filePath!, pluginId);
          } else if (rootKey === 'mcpServers' && keyPath.length === 2) {
            const serverName = keyPath[1];
            const currentSc = allScopes.find((s) => s.scope === scope);
            const serverConfig = currentSc?.mcpConfig?.mcpServers?.[serverName];
            if (!serverConfig) {
              vscode.window.showWarningMessage(`Claude Config: Could not find MCP server "${serverName}" in source scope.`);
              return;
            }
            const workspacePath = node.nodeContext?.workspaceFolderUri
              ? vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(node.nodeContext.workspaceFolderUri))?.uri.fsPath
              : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const claudeJsonPath = getUserClaudeJsonPath();
            // Write to target
            dispatchMcpWrite(target.scope, targetFilePath, serverName, serverConfig, workspacePath, claudeJsonPath);
            // Remove from source
            dispatchMcpRemove(scope, filePath!, serverName, workspacePath, claudeJsonPath);
          } else {
            // Scalar setting
            const currentSc = allScopes.find((s) => s.scope === scope);
            const value = currentSc?.config[rootKey];
            if (value !== undefined) {
              setScalarSetting(targetFilePath, rootKey, value);
              removeScalarSetting(filePath!, rootKey);
            }
          }
        });

        const itemName = node.label?.toString() ?? '';
        vscode.window.showInformationMessage(
          MESSAGES.movedItem(itemName, SCOPE_LABELS[target.scope]),
        );
      },
    ),
  );

  // ── Copy setting to scope (inline button) ───────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.copySettingToScope',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { keyPath, scope } = node.nodeContext;

        if (guardReadOnly(node, MESSAGES.readOnlyCopy, { allowLockedUser: true })) return;

        if (!validateKeyPath(keyPath, 1, 'copySettingToScope')) return;

        const settingKey = keyPath[0];

        const target = await pickEditableTargetScope(
          configStore,
          scope,
          node.nodeContext.workspaceFolderUri,
          'Copy setting to which scope?',
          'Copy to ',
        );
        if (!target) return;

        const targetFilePath = target.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(MESSAGES.noTargetFile);
          return;
        }

        // Check if the setting already exists in the target
        const targetConfig = readJsonFile<ClaudeCodeConfig>(targetFilePath).data ?? {};
        if (settingKey in targetConfig) {
          const confirmed = await confirmOverwrite(settingKey, SCOPE_LABELS[target.scope]);
          if (!confirmed) return;
        }

        const key = node.nodeContext.workspaceFolderUri ?? configStore.getWorkspaceFolderKeys()[0];
        const allScopes = configStore.getAllScopes(key);
        const currentSc = allScopes.find((s) => s.scope === scope);
        const value = currentSc?.config[settingKey];
        if (value !== undefined) {
          await withWriteRetry(targetFilePath, () => {
            setScalarSetting(targetFilePath, settingKey, value);
          });
          vscode.window.showInformationMessage(
            MESSAGES.copiedSetting(settingKey, SCOPE_LABELS[target.scope]),
          );
        } else {
          vscode.window.showWarningMessage(MESSAGES.permissionValueNotFound(settingKey));
        }
      },
    ),
  );

  // ── Copy env var to scope (inline button) ───────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.copyEnvVarToScope',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { keyPath, scope } = node.nodeContext;

        if (guardReadOnly(node, MESSAGES.readOnlyCopy, { allowLockedUser: true })) return;

        if (!validateKeyPath(keyPath, 1, 'copyEnvVarToScope')) return;

        if (keyPath[0] !== 'env' || keyPath.length !== 2) return;

        const envKey = keyPath[1];

        const target = await pickEditableTargetScope(
          configStore,
          scope,
          node.nodeContext.workspaceFolderUri,
          'Copy env var to which scope?',
          'Copy to ',
        );
        if (!target) return;

        const targetFilePath = target.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(MESSAGES.noTargetFile);
          return;
        }

        // Check if the env var already exists in the target
        const targetConfig = readJsonFile<ClaudeCodeConfig>(targetFilePath).data ?? {};
        if (targetConfig.env && envKey in targetConfig.env) {
          const confirmed = await confirmOverwrite(envKey, SCOPE_LABELS[target.scope]);
          if (!confirmed) return;
        }

        const key = node.nodeContext.workspaceFolderUri ?? configStore.getWorkspaceFolderKeys()[0];
        const allScopes = configStore.getAllScopes(key);
        const currentSc = allScopes.find((s) => s.scope === scope);
        const value = currentSc?.config.env?.[envKey] ?? '';
        await withWriteRetry(targetFilePath, () => {
          setEnvVar(targetFilePath, envKey, value);
        });
        vscode.window.showInformationMessage(
          MESSAGES.copiedEnvVar(envKey, SCOPE_LABELS[target.scope]),
        );
      },
    ),
  );

  // ── Copy permission to scope (inline button) ────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.copyPermissionToScope',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { keyPath, scope } = node.nodeContext;

        // Allow copy from locked User scope (non-destructive).
        // Block copy from truly read-only scopes (Managed).
        if (guardReadOnly(node, MESSAGES.readOnlyCopy, { allowLockedUser: true })) return;

        if (!validateKeyPath(keyPath, 1, 'copyPermissionToScope')) return;

        if (keyPath[0] !== 'permissions' || keyPath.length !== 3) return;

        const category = keyPath[1] as PermissionCategory;
        const rule = keyPath[2];
        const categoryLabel = PERMISSION_CATEGORY_LABELS[category] ?? category;

        const target = await pickEditableTargetScope(
          configStore,
          scope,
          node.nodeContext.workspaceFolderUri,
          'Copy permission to which scope?',
          'Copy to ',
        );
        if (!target) return;

        const targetFilePath = target.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(MESSAGES.noTargetFile);
          return;
        }

        const scopeLabel = SCOPE_LABELS[target.scope];

        // Check if the rule already exists in any category in the target
        const targetConfig = readJsonFile<ClaudeCodeConfig>(targetFilePath).data ?? {};
        const allCategories = [PermissionCategory.Allow, PermissionCategory.Deny, PermissionCategory.Ask];

        for (const cat of allCategories) {
          const rules = targetConfig.permissions?.[cat];
          if (!rules?.includes(rule)) continue;

          if (cat === category) {
            // Same category — already exists, nothing to do
            const catLabel = PERMISSION_CATEGORY_LABELS[cat] ?? cat;
            vscode.window.showInformationMessage(
              MESSAGES.permissionAlreadyExists(rule, catLabel, scopeLabel),
            );
            return;
          }

          // Different category — ask user
          const existingLabel = PERMISSION_CATEGORY_LABELS[cat] ?? cat;
          const choice = await vscode.window.showWarningMessage(
            `Claude Config: "${rule}" already exists as ${existingLabel} in ${scopeLabel}. Change to ${categoryLabel}?`,
            { modal: true },
            'Change permission',
            'Keep existing',
          );
          if (choice !== 'Change permission') return;

          removePermissionRule(targetFilePath, cat, rule);
          break;
        }

        await withWriteRetry(targetFilePath, () => {
          addPermissionRule(targetFilePath, category, rule);
        });
        vscode.window.showInformationMessage(
          MESSAGES.copiedPermission(rule, categoryLabel, scopeLabel),
        );
      },
    ),
  );

  // ── Copy MCP server to scope (inline button) ────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.copyMcpServerToScope',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { keyPath, scope } = node.nodeContext;

        // Block copy from truly read-only scopes (Managed).
        // Allow copy from locked User scope (non-destructive).
        if (guardReadOnly(node, MESSAGES.readOnlyCopy, { allowLockedUser: true })) return;

        // Block Managed scope as source
        if (scope === ConfigScope.Managed) {
          vscode.window.showWarningMessage(MESSAGES.readOnlyCopy);
          return;
        }

        if (!validateKeyPath(keyPath, 1, 'copyMcpServerToScope')) return;

        if (keyPath[0] !== 'mcpServers' || keyPath.length !== 2) return;

        const serverName = keyPath[1];

        const key = node.nodeContext.workspaceFolderUri ?? configStore.getWorkspaceFolderKeys()[0];
        const allScopes = configStore.getAllScopes(key);

        // Get source server config from mcpConfig (not settings config)
        const currentSc = allScopes.find((s) => s.scope === scope);
        const serverConfig = currentSc?.mcpConfig?.mcpServers?.[serverName];
        if (!serverConfig) {
          vscode.window.showWarningMessage(`Claude Config: Could not find MCP server "${serverName}" in source scope.`);
          return;
        }

        const target = await pickEditableTargetScope(
          configStore,
          scope,
          node.nodeContext.workspaceFolderUri,
          'Copy MCP server to which scope?',
          'Copy to ',
        );
        if (!target) return;

        const targetScopeLabel = SCOPE_LABELS[target.scope];

        // Check if server already exists in target
        const existingServer = target.mcpConfig?.mcpServers?.[serverName];
        if (existingServer) {
          const confirmed = await confirmOverwrite(serverName, targetScopeLabel);
          if (!confirmed) return;
        }

        const workspacePath = node.nodeContext.workspaceFolderUri
          ? vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(node.nodeContext.workspaceFolderUri))?.uri.fsPath
          : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const claudeJsonPath = getUserClaudeJsonPath();

        // targetFilePath for ProjectShared is the .mcp.json file
        const targetFilePath = target.scope === ConfigScope.ProjectShared
          ? (target.mcpFilePath ?? target.filePath)
          : claudeJsonPath;

        if (!targetFilePath) {
          vscode.window.showWarningMessage(MESSAGES.noTargetFile);
          return;
        }

        await withWriteRetry(targetFilePath, () => {
          dispatchMcpWrite(target.scope, targetFilePath!, serverName, serverConfig, workspacePath, claudeJsonPath);
        });
        vscode.window.showInformationMessage(
          MESSAGES.copiedMcpServer(serverName, targetScopeLabel),
        );
      },
    ),
  );
}

// ── MCP scope-aware dispatch helpers ────────────────────────────

/**
 * Dispatch MCP write to the correct function based on target scope.
 * - ProjectShared: setMcpServer (writes to .mcp.json)
 * - User: setUserMcpServer (writes to ~/.claude.json top-level mcpServers)
 * - ProjectLocal: setLocalMcpServer (writes to ~/.claude.json projects[path].mcpServers)
 */
function dispatchMcpWrite(
  targetScope: ConfigScope,
  targetFilePath: string,
  serverName: string,
  serverConfig: McpServerConfig,
  workspacePath: string | undefined,
  claudeJsonPath: string,
): void {
  if (targetScope === ConfigScope.User) {
    setUserMcpServer(claudeJsonPath, serverName, serverConfig);
  } else if (targetScope === ConfigScope.ProjectLocal && workspacePath) {
    setLocalMcpServer(claudeJsonPath, workspacePath, serverName, serverConfig);
  } else {
    // ProjectShared — use existing setMcpServer for .mcp.json
    setMcpServer(targetFilePath, serverName, serverConfig);
  }
}

/**
 * Dispatch MCP remove from the correct function based on source scope.
 */
function dispatchMcpRemove(
  sourceScope: ConfigScope,
  _sourceFilePath: string,
  serverName: string,
  workspacePath: string | undefined,
  claudeJsonPath: string,
): void {
  if (sourceScope === ConfigScope.User) {
    removeUserMcpServer(claudeJsonPath, serverName);
  } else if (sourceScope === ConfigScope.ProjectLocal && workspacePath) {
    removeLocalMcpServer(claudeJsonPath, workspacePath, serverName);
  } else {
    // ProjectShared — use existing removeMcpServer for .mcp.json
    removeMcpServer(_sourceFilePath, serverName);
  }
}
