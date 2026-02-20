import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import {
  setEnvVar,
  setScalarSetting,
  setSandboxProperty,
} from '../config/configWriter';
import { ConfigScope } from '../types';
import { ConfigTreeNode } from '../tree/nodes/baseNode';

export function registerEditCommands(
  context: vscode.ExtensionContext,
  _configStore: ConfigStore,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.editValue',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { filePath, keyPath, isReadOnly } = node.nodeContext;

        if (isReadOnly || !filePath) {
          if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
            vscode.window.showInformationMessage(
              'User scope is currently locked. Click the lock icon in the toolbar to unlock.',
            );
          } else {
            vscode.window.showWarningMessage('This setting is read-only.');
          }
          return;
        }

        const currentDesc = node.description?.toString() ?? '';

        const newValue = await vscode.window.showInputBox({
          value: currentDesc,
          prompt: `Edit value for "${keyPath[keyPath.length - 1]}"`,
        });
        if (newValue === undefined) return;

        // Determine the type of edit based on keyPath
        const rootKey = keyPath[0];

        try {
          if (rootKey === 'env' && keyPath.length === 2) {
            setEnvVar(filePath, keyPath[1], newValue);
          } else if (rootKey === 'sandbox') {
            const sandboxKey = keyPath.slice(1).join('.');
            const parsed = parseInputValue(newValue);
            setSandboxProperty(filePath, sandboxKey, parsed);
          } else {
            // Scalar setting
            const parsed = parseInputValue(newValue);
            setScalarSetting(filePath, rootKey, parsed);
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to edit setting: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },
    ),
  );

}

function parseInputValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
