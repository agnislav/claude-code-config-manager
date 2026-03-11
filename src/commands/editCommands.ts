import * as vscode from 'vscode';
import {
  setEnvVar,
  setScalarSetting,
  setSandboxProperty,
  addPermissionRule,
  removePermissionRule,
  showWriteError,
} from '../config/configWriter';
import { ConfigScope, PermissionCategory } from '../types';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { validateKeyPath } from '../utils/validation';
import { MESSAGES, PERMISSION_CATEGORY_LABELS } from '../constants';

export function registerEditCommands(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.editValue',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { filePath, keyPath, isReadOnly } = node.nodeContext;

        if (isReadOnly || !filePath) {
          if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
            vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
          } else {
            vscode.window.showWarningMessage(MESSAGES.readOnlySetting);
          }
          return;
        }

        if (!validateKeyPath(keyPath, 1, 'editValue')) return;

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
          await showWriteError(filePath, error, () => {
            if (rootKey === 'env' && keyPath.length === 2) {
              setEnvVar(filePath, keyPath[1], newValue);
            } else if (rootKey === 'sandbox') {
              const sandboxKey = keyPath.slice(1).join('.');
              const parsed = parseInputValue(newValue);
              setSandboxProperty(filePath, sandboxKey, parsed);
            } else {
              const parsed = parseInputValue(newValue);
              setScalarSetting(filePath, rootKey, parsed);
            }
          });
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.changePermissionType',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { filePath, keyPath, isReadOnly, scope } = node.nodeContext;
        if (!filePath) return;
        if (isReadOnly) {
          if (scope === ConfigScope.User) {
            vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
          } else {
            vscode.window.showWarningMessage(MESSAGES.readOnlySetting);
          }
          return;
        }
        if (keyPath[0] !== 'permissions' || keyPath.length !== 3) return;

        const currentCategory = keyPath[1] as PermissionCategory;
        const rule = keyPath[2];

        const items = Object.values(PermissionCategory).map((cat) => ({
          label: PERMISSION_CATEGORY_LABELS[cat] ?? cat,
          value: cat,
          description: cat === currentCategory ? '(current)' : '',
        }));

        const pick = await vscode.window.showQuickPick(items, {
          placeHolder: 'Change permission type',
        });
        if (!pick || pick.value === currentCategory) return;

        try {
          removePermissionRule(filePath, currentCategory, rule);
          addPermissionRule(filePath, pick.value, rule);
        } catch (error) {
          await showWriteError(filePath, error, () => {
            removePermissionRule(filePath, currentCategory, rule);
            addPermissionRule(filePath, pick.value, rule);
          });
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
