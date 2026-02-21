import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import { removePlugin, setPluginEnabled, showWriteError } from '../config/configWriter';
import { SCOPE_LABELS, MESSAGES } from '../constants';
import { ConfigScope } from '../types';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { PluginMetadataService } from '../utils/pluginMetadata';
import { validateKeyPath } from '../utils/validation';

export function registerPluginCommands(
  context: vscode.ExtensionContext,
  configStore: ConfigStore,
): void {
  // ── Delete plugin (inline button) ──────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.deletePlugin',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { filePath, keyPath, isReadOnly, scope } = node.nodeContext;

        if (isReadOnly || !filePath) {
          if (isReadOnly && scope === ConfigScope.User) {
            vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
          } else {
            vscode.window.showWarningMessage(MESSAGES.readOnlyDelete);
          }
          return;
        }

        if (!validateKeyPath(keyPath, 2, 'deletePlugin')) return;

        if (keyPath[0] !== 'enabledPlugins' || keyPath.length !== 2) return;

        const pluginId = keyPath[1];
        const itemName = node.label?.toString() ?? pluginId;
        const confirmed = await vscode.window.showWarningMessage(
          `Claude Config: Delete "${itemName}" from ${SCOPE_LABELS[scope]}?`,
          { modal: true },
          'Delete',
        );
        if (confirmed !== 'Delete') return;

        try {
          removePlugin(filePath, pluginId);
        } catch (error) {
          await showWriteError(filePath, error, () => {
            removePlugin(filePath, pluginId);
          });
        }
      },
    ),
  );

  // ── Open plugin README (inline button) ─────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.openPluginReadme',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { keyPath } = node.nodeContext;

        if (!validateKeyPath(keyPath, 2, 'openPluginReadme')) return;

        if (keyPath[0] !== 'enabledPlugins' || keyPath.length !== 2) return;

        const pluginId = keyPath[1];
        const installPath = PluginMetadataService.getInstance().getInstallPath(pluginId);
        if (!installPath) {
          vscode.window.showWarningMessage(MESSAGES.pluginNotInstalled(pluginId));
          return;
        }

        const readmePath = path.join(installPath, 'README.md');
        try {
          const uri = vscode.Uri.file(readmePath);
          await vscode.workspace.fs.stat(uri);
          await vscode.commands.executeCommand('markdown.showPreview', uri);
        } catch {
          vscode.window.showWarningMessage(MESSAGES.pluginNoReadme(pluginId));
        }
      },
    ),
  );

  // ── Copy plugin to scope (inline button) ───────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.copyPluginToScope',
      async (node?: ConfigTreeNode) => {
        if (!node?.nodeContext) return;
        const { keyPath, isReadOnly, scope } = node.nodeContext;

        // Allow copy from locked User scope (non-destructive).
        // Block copy from truly read-only scopes (Managed).
        if (isReadOnly && scope !== ConfigScope.User) {
          vscode.window.showWarningMessage(MESSAGES.readOnlyCopy);
          return;
        }

        if (!validateKeyPath(keyPath, 2, 'copyPluginToScope')) return;

        if (keyPath[0] !== 'enabledPlugins' || keyPath.length !== 2) return;

        const pluginId = keyPath[1];

        // Build list of writable target scopes, excluding current and Managed
        const keys = configStore.getWorkspaceFolderKeys();
        if (keys.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noWorkspaceFolders);
          return;
        }
        const key = node.nodeContext.workspaceFolderUri ?? keys[0];
        const allScopes = configStore.getAllScopes(key);

        const pluginTargetScopes = allScopes.filter(
          (s) => s.scope !== scope && !s.isReadOnly && s.scope !== ConfigScope.Managed && !configStore.isScopeLocked(s.scope),
        );

        if (pluginTargetScopes.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.noEditableScopes);
          return;
        }

        // Step 1: pick target scope
        const pluginScopePick = await vscode.window.showQuickPick(
          pluginTargetScopes.map((s) => ({
            label: `Copy to ${SCOPE_LABELS[s.scope]}`,
            description: s.filePath ?? '',
            value: s,
          })),
          { placeHolder: 'Copy plugin to which scope?' },
        );
        if (!pluginScopePick) return;

        const scopePick = pluginScopePick;

        const targetFilePath = scopePick.value.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(MESSAGES.noTargetFile);
          return;
        }

        // Step 2: pick enabled/disabled state
        const statePick = await vscode.window.showQuickPick(
          [
            { label: 'Enabled', value: true },
            { label: 'Disabled', value: false },
          ],
          { placeHolder: 'Copy as enabled or disabled?' },
        );
        if (!statePick) return;

        try {
          setPluginEnabled(targetFilePath, pluginId, statePick.value);
          const itemName = node.label?.toString() ?? pluginId;
          vscode.window.showInformationMessage(
            MESSAGES.copiedPlugin(itemName, SCOPE_LABELS[scopePick.value.scope], statePick.label.toLowerCase()),
          );
        } catch (error) {
          await showWriteError(targetFilePath, error, () => {
            setPluginEnabled(targetFilePath, pluginId, statePick.value);
          });
        }
      },
    ),
  );
}
