import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import {
  removePermissionRule,
  removeEnvVar,
  removeHookEntry,
  removeMcpServer,
  removePlugin,
  removeScalarSetting,
} from '../config/configWriter';
import { HookEventType, PermissionCategory, ConfigScope } from '../types';
import { ConfigTreeNode } from '../tree/nodes/baseNode';

export function registerDeleteCommands(
  context: vscode.ExtensionContext,
  _configStore: ConfigStore,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.deleteItem',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { filePath, keyPath, isReadOnly, scope } = node.nodeContext;

        if (isReadOnly || !filePath) {
          if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
            vscode.window.showInformationMessage(
              'User scope is currently locked. Click the lock icon in the toolbar to unlock.',
            );
          } else {
            vscode.window.showWarningMessage('Cannot delete read-only items.');
          }
          return;
        }

        const itemName = node.label?.toString() ?? keyPath[keyPath.length - 1];
        const confirmed = await vscode.window.showWarningMessage(
          `Delete "${itemName}" from ${scope} scope?`,
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
          } else {
            removeScalarSetting(filePath, rootKey);
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to delete: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },
    ),
  );
}
