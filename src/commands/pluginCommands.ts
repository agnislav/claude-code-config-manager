import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import { removePlugin, setPluginEnabled } from '../config/configWriter';
import { SCOPE_LABELS } from '../constants';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { PluginMetadataService } from '../utils/pluginMetadata';

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
          vscode.window.showWarningMessage('Cannot delete read-only items.');
          return;
        }
        if (keyPath[0] !== 'enabledPlugins' || keyPath.length !== 2) return;

        const pluginId = keyPath[1];
        const itemName = node.label?.toString() ?? pluginId;
        const confirmed = await vscode.window.showWarningMessage(
          `Delete "${itemName}" from ${SCOPE_LABELS[scope]} scope?`,
          { modal: true },
          'Delete',
        );
        if (confirmed !== 'Delete') return;

        removePlugin(filePath, pluginId);
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
        if (keyPath[0] !== 'enabledPlugins' || keyPath.length !== 2) return;

        const pluginId = keyPath[1];
        const installPath = PluginMetadataService.getInstance().getInstallPath(pluginId);
        if (!installPath) {
          vscode.window.showWarningMessage(`Plugin "${pluginId}" is not installed locally.`);
          return;
        }

        const readmePath = path.join(installPath, 'README.md');
        try {
          const uri = vscode.Uri.file(readmePath);
          await vscode.workspace.fs.stat(uri);
          await vscode.commands.executeCommand('markdown.showPreview', uri);
        } catch {
          vscode.window.showWarningMessage(`No README.md found for "${pluginId}".`);
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

        if (isReadOnly) {
          vscode.window.showWarningMessage('Cannot copy from a read-only scope.');
          return;
        }
        if (keyPath[0] !== 'enabledPlugins' || keyPath.length !== 2) return;

        const pluginId = keyPath[1];

        // Build list of writable target scopes, excluding current and Managed
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

        // Step 1: pick target scope
        const scopePick = await vscode.window.showQuickPick(
          targetScopes.map((s) => ({
            label: `Copy to ${SCOPE_LABELS[s.scope]}`,
            description: s.filePath ?? '',
            value: s,
          })),
          { placeHolder: 'Copy plugin to which scope?' },
        );
        if (!scopePick) return;

        const targetFilePath = scopePick.value.filePath;
        if (!targetFilePath) {
          vscode.window.showWarningMessage(
            'Cannot copy to this scope: no configuration file path available.',
          );
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

        setPluginEnabled(targetFilePath, pluginId, statePick.value);

        const itemName = node.label?.toString() ?? pluginId;
        vscode.window.showInformationMessage(
          `Copied "${itemName}" to ${SCOPE_LABELS[scopePick.value.scope]} as ${statePick.label.toLowerCase()}`,
        );
      },
    ),
  );
}
