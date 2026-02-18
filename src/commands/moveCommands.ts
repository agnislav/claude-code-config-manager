import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import {
  addPermissionRule,
  removePermissionRule,
  setEnvVar,
  removeEnvVar,
  setScalarSetting,
  removeScalarSetting,
} from '../config/configWriter';
import { PERMISSION_CATEGORY_LABELS, SCOPE_LABELS } from '../constants';
import { ClaudeCodeConfig, PermissionCategory } from '../types';
import { readJsonFile } from '../utils/json';
import { ConfigTreeNode } from '../tree/nodes/baseNode';

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
          vscode.window.showWarningMessage('Cannot move read-only items.');
          return;
        }

        // Get available target scopes (exclude current scope and Managed)
        const keys = configStore.getWorkspaceFolderKeys();
        if (keys.length === 0) {
          vscode.window.showInformationMessage('No workspace folders available.');
          return;
        }

        const key = node.nodeContext.workspaceFolderUri ?? keys[0];
        const allScopes = configStore.getAllScopes(key);

        const targetScopes = allScopes.filter(
          (s) => s.scope !== scope && !s.isReadOnly,
        );

        if (targetScopes.length === 0) {
          vscode.window.showInformationMessage('No other editable scopes available.');
          return;
        }

        const pick = await vscode.window.showQuickPick(
          targetScopes.map((s) => ({
            label: SCOPE_LABELS[s.scope],
            description: s.filePath ?? '',
            value: s,
          })),
          { placeHolder: 'Move to which scope?' },
        );
        if (!pick) return;

        const targetFilePath = pick.value.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage('Cannot move to this scope: no configuration file available.');
          return;
        }

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
          vscode.window.showErrorMessage(`Failed to move setting: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }

        vscode.window.showInformationMessage(
          `Moved "${node.label}" to ${SCOPE_LABELS[pick.value.scope]}`,
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

        if (isReadOnly || !filePath) {
          vscode.window.showWarningMessage('Cannot copy read-only items.');
          return;
        }

        const settingKey = keyPath[0];

        const keys = configStore.getWorkspaceFolderKeys();
        if (keys.length === 0) {
          vscode.window.showInformationMessage('No workspace folders available.');
          return;
        }
        const key = node.nodeContext.workspaceFolderUri ?? keys[0];
        const allScopes = configStore.getAllScopes(key);

        const targetScopes = allScopes.filter(
          (s) => s.scope !== scope && !s.isReadOnly,
        );

        if (targetScopes.length === 0) {
          vscode.window.showInformationMessage('No other editable scopes available.');
          return;
        }

        const pick = await vscode.window.showQuickPick(
          targetScopes.map((s) => ({
            label: `Copy to ${SCOPE_LABELS[s.scope]}`,
            description: s.filePath ?? '',
            value: s,
          })),
          { placeHolder: 'Copy setting to which scope?' },
        );
        if (!pick) return;

        const targetFilePath = pick.value.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(
            'Cannot copy to this scope: no configuration file available.',
          );
          return;
        }

        // Check if the setting already exists in the target
        const targetConfig = readJsonFile<ClaudeCodeConfig>(targetFilePath).data ?? {};
        if (settingKey in targetConfig) {
          const overwrite = await vscode.window.showWarningMessage(
            `"${settingKey}" already exists in ${SCOPE_LABELS[pick.value.scope]}. Overwrite?`,
            { modal: true },
            'Overwrite',
          );
          if (overwrite !== 'Overwrite') return;
        }

        const currentSc = allScopes.find((s) => s.scope === scope);
        const value = currentSc?.config[settingKey];
        if (value !== undefined) {
          setScalarSetting(targetFilePath, settingKey, value);
          vscode.window.showInformationMessage(
            `Copied "${settingKey}" to ${SCOPE_LABELS[pick.value.scope]}`,
          );
        } else {
          vscode.window.showWarningMessage(
            `Could not copy "${settingKey}": value not found in source scope.`,
          );
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

        if (isReadOnly) {
          vscode.window.showWarningMessage('Cannot copy read-only items.');
          return;
        }
        if (keyPath[0] !== 'permissions' || keyPath.length !== 3) return;

        const category = keyPath[1] as PermissionCategory;
        const rule = keyPath[2];
        const categoryLabel = PERMISSION_CATEGORY_LABELS[category] ?? category;

        const keys = configStore.getWorkspaceFolderKeys();
        if (keys.length === 0) {
          vscode.window.showInformationMessage('No workspace folders available.');
          return;
        }
        const key = node.nodeContext.workspaceFolderUri ?? keys[0];
        const allScopes = configStore.getAllScopes(key);

        const targetScopes = allScopes.filter(
          (s) => s.scope !== scope && !s.isReadOnly,
        );

        if (targetScopes.length === 0) {
          vscode.window.showInformationMessage('No other editable scopes available.');
          return;
        }

        const scopePick = await vscode.window.showQuickPick(
          targetScopes.map((s) => ({
            label: `Copy to ${SCOPE_LABELS[s.scope]}`,
            description: s.filePath ?? '',
            value: s,
          })),
          { placeHolder: 'Copy permission to which scope?' },
        );
        if (!scopePick) return;

        const targetFilePath = scopePick.value.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(
            'Cannot copy to this scope: no configuration file available.',
          );
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
              `"${rule}" already exists in ${catLabel} in ${scopeLabel}.`,
            );
            return;
          }

          // Different category — ask user
          const existingLabel = PERMISSION_CATEGORY_LABELS[cat] ?? cat;
          const choice = await vscode.window.showWarningMessage(
            `"${rule}" already exists as ${existingLabel} in ${scopeLabel}. Change to ${categoryLabel}?`,
            { modal: true },
            'Change permission',
            'Keep existing',
          );
          if (choice !== 'Change permission') return;

          removePermissionRule(targetFilePath, cat, rule);
          break;
        }

        addPermissionRule(targetFilePath, category, rule);
        vscode.window.showInformationMessage(
          `Copied "${rule}" to ${categoryLabel} in ${scopeLabel}`,
        );
      },
    ),
  );
}
