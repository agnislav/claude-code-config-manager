import * as vscode from 'vscode';
import {
  removePermissionRule,
  removeEnvVar,
  removeHookEntry,
  removeMcpServer,
  removePlugin,
  removeScalarSetting,
  removeSettingKeyValue,
  showWriteError,
} from '../config/configWriter';
import { HookEventType, PermissionCategory, ConfigScope } from '../types';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { validateKeyPath } from '../utils/validation';
import { MESSAGES, SCOPE_LABELS, DEDICATED_SECTION_KEYS } from '../constants';

export function registerDeleteCommands(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.deleteItem',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { filePath, keyPath, isReadOnly, scope } = node.nodeContext;

        if (isReadOnly || !filePath) {
          if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
            vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
          } else {
            vscode.window.showWarningMessage(MESSAGES.readOnlyDelete);
          }
          return;
        }

        if (!validateKeyPath(keyPath, 1, 'deleteItem')) return;

        const itemName = node.label?.toString() ?? keyPath[keyPath.length - 1];
        const confirmed = await vscode.window.showWarningMessage(
          `Claude Config: Delete "${itemName}" from ${SCOPE_LABELS[scope]}?`,
          { modal: true },
          'Delete',
        );
        if (confirmed !== 'Delete') return;

        const rootKey = keyPath[0];

        try {
          if (rootKey === 'permissions' && keyPath.length === 3) {
            const category = keyPath[1] as PermissionCategory;
            const rule = keyPath[2];
            removePermissionRule(filePath, category, rule);
          } else if (rootKey === 'env' && keyPath.length === 2) {
            removeEnvVar(filePath, keyPath[1]);
          } else if (rootKey === 'hooks' && keyPath.length >= 3) {
            const eventType = keyPath[1] as HookEventType;
            const matcherIndex = parseInt(keyPath[2], 10);
            if (isNaN(matcherIndex)) return;
            removeHookEntry(filePath, eventType, matcherIndex);
          } else if (rootKey === 'mcpServers' && keyPath.length === 2) {
            removeMcpServer(filePath, keyPath[1]);
          } else if (rootKey === 'enabledPlugins' && keyPath.length === 2) {
            removePlugin(filePath, keyPath[1]);
          } else if (keyPath.length === 2 && !DEDICATED_SECTION_KEYS.has(rootKey)) {
            // SettingKeyValue: child key of an object setting
            removeSettingKeyValue(filePath, rootKey, keyPath[1]);
          } else {
            removeScalarSetting(filePath, rootKey);
          }
        } catch (error) {
          await showWriteError(filePath, error, () => {
            if (rootKey === 'permissions' && keyPath.length === 3) {
              const category = keyPath[1] as PermissionCategory;
              const rule = keyPath[2];
              removePermissionRule(filePath, category, rule);
            } else if (rootKey === 'env' && keyPath.length === 2) {
              removeEnvVar(filePath, keyPath[1]);
            } else if (rootKey === 'hooks' && keyPath.length >= 3) {
              const eventType = keyPath[1] as HookEventType;
              const matcherIndex = parseInt(keyPath[2], 10);
              if (isNaN(matcherIndex)) return;
              removeHookEntry(filePath, eventType, matcherIndex);
            } else if (rootKey === 'mcpServers' && keyPath.length === 2) {
              removeMcpServer(filePath, keyPath[1]);
            } else if (rootKey === 'enabledPlugins' && keyPath.length === 2) {
              removePlugin(filePath, keyPath[1]);
            } else if (keyPath.length === 2 && !DEDICATED_SECTION_KEYS.has(rootKey)) {
              removeSettingKeyValue(filePath, rootKey, keyPath[1]);
            } else {
              removeScalarSetting(filePath, rootKey);
            }
          });
        }
      },
    ),
  );
}
