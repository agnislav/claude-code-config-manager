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
  showWriteError,
} from '../config/configWriter';
import { PERMISSION_CATEGORY_LABELS, SCOPE_LABELS, MESSAGES } from '../constants';
import { ClaudeCodeConfig, ConfigScope, McpServerConfig, PermissionCategory } from '../types';
import { readJsonFile } from '../utils/json';
import { getUserClaudeJsonPath } from '../utils/platform';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { validateKeyPath } from '../utils/validation';

export function registerMoveCommands(
  context: vscode.ExtensionContext,
  configStore: ConfigStore,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.moveToScope',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { filePath, keyPath, isReadOnly, scope } = node.nodeContext;

        if (isReadOnly || !filePath) {
          if (isReadOnly && scope === ConfigScope.User) {
            vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
          } else {
            vscode.window.showWarningMessage(MESSAGES.readOnlyMove);
          }
          return;
        }

        // Get available target scopes (exclude current scope and Managed)
        const keys = configStore.getWorkspaceFolderKeys();
        if (keys.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noWorkspaceFolders);
          return;
        }

        const key = node.nodeContext.workspaceFolderUri ?? keys[0];
        const allScopes = configStore.getAllScopes(key);

        const targetScopes = allScopes.filter(
          (s) => s.scope !== scope && !s.isReadOnly && s.scope !== ConfigScope.Managed && !configStore.isScopeLocked(s.scope),
        );

        if (targetScopes.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noEditableScopes);
          return;
        }

        const movePick = await vscode.window.showQuickPick(
          targetScopes.map((s) => ({
            label: SCOPE_LABELS[s.scope],
            description: s.filePath ?? '',
            value: s,
          })),
          { placeHolder: 'Move to which scope?' },
        );
        if (!movePick) return;

        const pick = movePick;
        const targetFilePath = pick.value.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(MESSAGES.noTargetFileMove);
          return;
        }

        if (!validateKeyPath(keyPath, 1, 'moveToScope')) return;

        const rootKey = keyPath[0];

        try {
          // Write to target first, then remove from source
          if (rootKey === 'permissions' && keyPath.length === 3) {
            const category = keyPath[1] as PermissionCategory;
            const rule = keyPath[2];
            addPermissionRule(targetFilePath, category, rule);
            removePermissionRule(filePath, category, rule);
          } else if (rootKey === 'env' && keyPath.length === 2) {
            const envKey = keyPath[1];
            const currentSc = allScopes.find((s) => s.scope === scope);
            const currentValue = currentSc?.config.env?.[envKey] ?? '';
            setEnvVar(targetFilePath, envKey, currentValue);
            removeEnvVar(filePath, envKey);
          } else if (rootKey === 'enabledPlugins' && keyPath.length === 2) {
            const pluginId = keyPath[1];
            const currentSc = allScopes.find((s) => s.scope === scope);
            const enabled = currentSc?.config.enabledPlugins?.[pluginId] ?? true;
            setPluginEnabled(targetFilePath, pluginId, enabled);
            removePlugin(filePath, pluginId);
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
            dispatchMcpWrite(pick.value.scope, targetFilePath, serverName, serverConfig, workspacePath, claudeJsonPath);
            // Remove from source
            dispatchMcpRemove(scope, filePath, serverName, workspacePath, claudeJsonPath);
          } else {
            // Scalar setting
            const currentSc = allScopes.find((s) => s.scope === scope);
            const value = currentSc?.config[rootKey];
            if (value !== undefined) {
              setScalarSetting(targetFilePath, rootKey, value);
              removeScalarSetting(filePath, rootKey);
            }
          }
        } catch (error) {
          await showWriteError(targetFilePath, error, () => {
            if (rootKey === 'permissions' && keyPath.length === 3) {
              const category = keyPath[1] as PermissionCategory;
              const rule = keyPath[2];
              addPermissionRule(targetFilePath, category, rule);
              removePermissionRule(filePath, category, rule);
            } else if (rootKey === 'env' && keyPath.length === 2) {
              const envKey = keyPath[1];
              const currentSc = allScopes.find((s) => s.scope === scope);
              const currentValue = currentSc?.config.env?.[envKey] ?? '';
              setEnvVar(targetFilePath, envKey, currentValue);
              removeEnvVar(filePath, envKey);
            } else if (rootKey === 'enabledPlugins' && keyPath.length === 2) {
              const pluginId = keyPath[1];
              const currentSc = allScopes.find((s) => s.scope === scope);
              const enabled = currentSc?.config.enabledPlugins?.[pluginId] ?? true;
              setPluginEnabled(targetFilePath, pluginId, enabled);
              removePlugin(filePath, pluginId);
            } else {
              const currentSc = allScopes.find((s) => s.scope === scope);
              const value = currentSc?.config[rootKey];
              if (value !== undefined) {
                setScalarSetting(targetFilePath, rootKey, value);
                removeScalarSetting(filePath, rootKey);
              }
            }
          });
          return;
        }

        const itemName = node.label?.toString() ?? '';
        vscode.window.showInformationMessage(
          MESSAGES.movedItem(itemName, SCOPE_LABELS[pick.value.scope]),
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
        const { filePath, keyPath, isReadOnly, scope } = node.nodeContext;

        if (!filePath) {
          return;
        }
        // Allow copy from locked User scope (non-destructive).
        // Block copy from truly read-only scopes (Managed).
        if (isReadOnly && scope !== ConfigScope.User) {
          vscode.window.showWarningMessage(MESSAGES.readOnlyCopy);
          return;
        }

        if (!validateKeyPath(keyPath, 1, 'copySettingToScope')) return;

        const settingKey = keyPath[0];

        const keys = configStore.getWorkspaceFolderKeys();
        if (keys.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noWorkspaceFolders);
          return;
        }
        const key = node.nodeContext.workspaceFolderUri ?? keys[0];
        const allScopes = configStore.getAllScopes(key);

        const copySettingTargetScopes = allScopes.filter(
          (s) => s.scope !== scope && !s.isReadOnly && s.scope !== ConfigScope.Managed && !configStore.isScopeLocked(s.scope),
        );

        if (copySettingTargetScopes.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noEditableScopes);
          return;
        }

        const copySettingPick = await vscode.window.showQuickPick(
          copySettingTargetScopes.map((s) => ({
            label: `Copy to ${SCOPE_LABELS[s.scope]}`,
            description: s.filePath ?? '',
            value: s,
          })),
          { placeHolder: 'Copy setting to which scope?' },
        );
        if (!copySettingPick) return;

        const pick = copySettingPick;
        const targetFilePath = pick.value.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(MESSAGES.noTargetFile);
          return;
        }

        // Check if the setting already exists in the target
        const targetConfig = readJsonFile<ClaudeCodeConfig>(targetFilePath).data ?? {};
        if (settingKey in targetConfig) {
          const overwrite = await vscode.window.showWarningMessage(
            `Claude Config: "${settingKey}" already exists in ${SCOPE_LABELS[pick.value.scope]}. Overwrite?`,
            { modal: true },
            'Overwrite',
          );
          if (overwrite !== 'Overwrite') return;
        }

        const currentSc = allScopes.find((s) => s.scope === scope);
        const value = currentSc?.config[settingKey];
        if (value !== undefined) {
          try {
            setScalarSetting(targetFilePath, settingKey, value);
            vscode.window.showInformationMessage(
              MESSAGES.copiedSetting(settingKey, SCOPE_LABELS[pick.value.scope]),
            );
          } catch (error) {
            await showWriteError(targetFilePath, error, () => {
              setScalarSetting(targetFilePath, settingKey, value);
            });
          }
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
        const { filePath, keyPath, isReadOnly, scope } = node.nodeContext;

        if (!filePath) {
          return;
        }
        // Allow copy from locked User scope (non-destructive).
        // Block copy from truly read-only scopes (Managed).
        if (isReadOnly && scope !== ConfigScope.User) {
          vscode.window.showWarningMessage(MESSAGES.readOnlyCopy);
          return;
        }

        if (!validateKeyPath(keyPath, 1, 'copyEnvVarToScope')) return;

        if (keyPath[0] !== 'env' || keyPath.length !== 2) return;

        const envKey = keyPath[1];

        const keys = configStore.getWorkspaceFolderKeys();
        if (keys.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noWorkspaceFolders);
          return;
        }
        const key = node.nodeContext.workspaceFolderUri ?? keys[0];
        const allScopes = configStore.getAllScopes(key);

        const copyEnvTargetScopes = allScopes.filter(
          (s) => s.scope !== scope && !s.isReadOnly && s.scope !== ConfigScope.Managed && !configStore.isScopeLocked(s.scope),
        );

        if (copyEnvTargetScopes.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noEditableScopes);
          return;
        }

        const copyEnvPick = await vscode.window.showQuickPick(
          copyEnvTargetScopes.map((s) => ({
            label: `Copy to ${SCOPE_LABELS[s.scope]}`,
            description: s.filePath ?? '',
            value: s,
          })),
          { placeHolder: 'Copy env var to which scope?' },
        );
        if (!copyEnvPick) return;

        const pick = copyEnvPick;
        const targetFilePath = pick.value.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(MESSAGES.noTargetFile);
          return;
        }

        // Check if the env var already exists in the target
        const targetConfig = readJsonFile<ClaudeCodeConfig>(targetFilePath).data ?? {};
        if (targetConfig.env && envKey in targetConfig.env) {
          const overwrite = await vscode.window.showWarningMessage(
            `Claude Config: "${envKey}" already exists in ${SCOPE_LABELS[pick.value.scope]}. Overwrite?`,
            { modal: true },
            'Overwrite',
          );
          if (overwrite !== 'Overwrite') return;
        }

        const currentSc = allScopes.find((s) => s.scope === scope);
        const value = currentSc?.config.env?.[envKey] ?? '';
        try {
          setEnvVar(targetFilePath, envKey, value);
          vscode.window.showInformationMessage(
            MESSAGES.copiedEnvVar(envKey, SCOPE_LABELS[pick.value.scope]),
          );
        } catch (error) {
          await showWriteError(targetFilePath, error, () => {
            setEnvVar(targetFilePath, envKey, value);
          });
        }
      },
    ),
  );

  // ── Copy permission to scope (inline button) ────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.copyPermissionToScope',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { keyPath, isReadOnly, scope } = node.nodeContext;

        // Allow copy from locked User scope (non-destructive).
        // Block copy from truly read-only scopes (Managed).
        if (isReadOnly && scope !== ConfigScope.User) {
          vscode.window.showWarningMessage(MESSAGES.readOnlyCopy);
          return;
        }

        if (!validateKeyPath(keyPath, 1, 'copyPermissionToScope')) return;

        if (keyPath[0] !== 'permissions' || keyPath.length !== 3) return;

        const category = keyPath[1] as PermissionCategory;
        const rule = keyPath[2];
        const categoryLabel = PERMISSION_CATEGORY_LABELS[category] ?? category;

        const keys = configStore.getWorkspaceFolderKeys();
        if (keys.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noWorkspaceFolders);
          return;
        }
        const key = node.nodeContext.workspaceFolderUri ?? keys[0];
        const allScopes = configStore.getAllScopes(key);

        const copyPermTargetScopes = allScopes.filter(
          (s) => s.scope !== scope && !s.isReadOnly && s.scope !== ConfigScope.Managed && !configStore.isScopeLocked(s.scope),
        );

        if (copyPermTargetScopes.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noEditableScopes);
          return;
        }

        const permScopePick = await vscode.window.showQuickPick(
          copyPermTargetScopes.map((s) => ({
            label: `Copy to ${SCOPE_LABELS[s.scope]}`,
            description: s.filePath ?? '',
            value: s,
          })),
          { placeHolder: 'Copy permission to which scope?' },
        );
        if (!permScopePick) return;

        const scopePick = permScopePick;
        const targetFilePath = scopePick.value.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(MESSAGES.noTargetFile);
          return;
        }

        const scopeLabel = SCOPE_LABELS[scopePick.value.scope];

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

        try {
          addPermissionRule(targetFilePath, category, rule);
          vscode.window.showInformationMessage(
            MESSAGES.copiedPermission(rule, categoryLabel, scopeLabel),
          );
        } catch (error) {
          await showWriteError(targetFilePath, error, () => {
            addPermissionRule(targetFilePath, category, rule);
          });
        }
      },
    ),
  );

  // ── Copy MCP server to scope (inline button) ────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.copyMcpServerToScope',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { keyPath, isReadOnly, scope } = node.nodeContext;

        // Block copy from truly read-only scopes (Managed).
        // Allow copy from locked User scope (non-destructive).
        if (isReadOnly && scope !== ConfigScope.User) {
          vscode.window.showWarningMessage(MESSAGES.readOnlyCopy);
          return;
        }

        // Block Managed scope as source
        if (scope === ConfigScope.Managed) {
          vscode.window.showWarningMessage(MESSAGES.readOnlyCopy);
          return;
        }

        if (!validateKeyPath(keyPath, 1, 'copyMcpServerToScope')) return;

        if (keyPath[0] !== 'mcpServers' || keyPath.length !== 2) return;

        const serverName = keyPath[1];

        const keys = configStore.getWorkspaceFolderKeys();
        if (keys.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noWorkspaceFolders);
          return;
        }
        const key = node.nodeContext.workspaceFolderUri ?? keys[0];
        const allScopes = configStore.getAllScopes(key);

        // Get source server config from mcpConfig (not settings config)
        const currentSc = allScopes.find((s) => s.scope === scope);
        const serverConfig = currentSc?.mcpConfig?.mcpServers?.[serverName];
        if (!serverConfig) {
          vscode.window.showWarningMessage(`Claude Config: Could not find MCP server "${serverName}" in source scope.`);
          return;
        }

        const targetScopes = allScopes.filter(
          (s) =>
            s.scope !== scope &&
            !s.isReadOnly &&
            s.scope !== ConfigScope.Managed &&
            !configStore.isScopeLocked(s.scope),
        );

        if (targetScopes.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noEditableScopes);
          return;
        }

        const copyMcpPick = await vscode.window.showQuickPick(
          targetScopes.map((s) => ({
            label: `Copy to ${SCOPE_LABELS[s.scope]}`,
            description: s.mcpFilePath ?? s.filePath ?? '',
            value: s,
          })),
          { placeHolder: 'Copy MCP server to which scope?' },
        );
        if (!copyMcpPick) return;

        const pick = copyMcpPick;
        const targetScopeLabel = SCOPE_LABELS[pick.value.scope];

        // Check if server already exists in target
        const existingServer = pick.value.mcpConfig?.mcpServers?.[serverName];
        if (existingServer) {
          const overwrite = await vscode.window.showWarningMessage(
            `Claude Config: "${serverName}" already exists in ${targetScopeLabel}. Overwrite?`,
            { modal: true },
            'Overwrite',
          );
          if (overwrite !== 'Overwrite') return;
        }

        const workspacePath = node.nodeContext.workspaceFolderUri
          ? vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(node.nodeContext.workspaceFolderUri))?.uri.fsPath
          : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const claudeJsonPath = getUserClaudeJsonPath();

        // targetFilePath for ProjectShared is the .mcp.json file
        const targetFilePath = pick.value.scope === ConfigScope.ProjectShared
          ? (pick.value.mcpFilePath ?? pick.value.filePath)
          : claudeJsonPath;

        if (!targetFilePath) {
          vscode.window.showWarningMessage(MESSAGES.noTargetFile);
          return;
        }

        try {
          dispatchMcpWrite(pick.value.scope, targetFilePath, serverName, serverConfig, workspacePath, claudeJsonPath);
          vscode.window.showInformationMessage(
            MESSAGES.copiedMcpServer(serverName, targetScopeLabel),
          );
        } catch (error) {
          await showWriteError(targetFilePath, error, () => {
            dispatchMcpWrite(pick.value.scope, targetFilePath!, serverName, serverConfig, workspacePath, claudeJsonPath);
          });
        }
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
