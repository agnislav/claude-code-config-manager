import * as vscode from 'vscode';
import {
  setEnvVar,
  setScalarSetting,
  setSettingKeyValue,
  setSandboxProperty,
  addPermissionRule,
  removePermissionRule,
} from '../config/configWriter';
import { PermissionCategory } from '../types';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { validateKeyPath } from '../utils/validation';
import { MESSAGES, PERMISSION_CATEGORY_LABELS, DEDICATED_SECTION_KEYS } from '../constants';
import { guardReadOnly, withWriteRetry } from '../utils/commandHelpers';

export function registerEditCommands(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.editValue',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { filePath, keyPath } = node.nodeContext;

        if (guardReadOnly(node, MESSAGES.readOnlySetting)) return;

        if (!validateKeyPath(keyPath, 1, 'editValue')) return;

        const rawDesc = node.description?.toString() ?? '';
        // Strip override suffix (e.g. " (overridden by Project (Shared))") for pre-fill
        const currentDesc = rawDesc.replace(/ \(overridden by .*\)$/, '');

        const newValue = await vscode.window.showInputBox({
          value: currentDesc,
          prompt: `Edit value for "${keyPath[keyPath.length - 1]}"`,
        });
        if (newValue === undefined) return;

        // Determine the type of edit based on keyPath
        const rootKey = keyPath[0];

        const doWrite = (): void => {
          if (rootKey === 'env' && keyPath.length === 2) {
            setEnvVar(filePath!, keyPath[1], newValue);
          } else if (rootKey === 'sandbox') {
            const sandboxKey = keyPath.slice(1).join('.');
            const parsed = parseInputValue(newValue);
            setSandboxProperty(filePath!, sandboxKey, parsed);
          } else if (keyPath.length === 2 && !DEDICATED_SECTION_KEYS.has(rootKey)) {
            // SettingKeyValue: child key of an object setting
            const parsed = parseInputValue(newValue);
            setSettingKeyValue(filePath!, rootKey, keyPath[1], parsed);
          } else {
            // Scalar setting
            const parsed = parseInputValue(newValue);
            setScalarSetting(filePath!, rootKey, parsed);
          }
        };

        await withWriteRetry(filePath!, doWrite);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.changePermissionType',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { filePath, keyPath } = node.nodeContext;
        if (!filePath) return;

        if (guardReadOnly(node, MESSAGES.readOnlySetting)) return;

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

        await withWriteRetry(filePath, () => {
          removePermissionRule(filePath, currentCategory, rule);
          addPermissionRule(filePath, pick.value, rule);
        });
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
