import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import { removePlugin, setPluginEnabled } from '../config/configWriter';
import { SCOPE_LABELS, MESSAGES } from '../constants';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { PluginMetadataService } from '../utils/pluginMetadata';
import { validateKeyPath } from '../utils/validation';
import { guardReadOnly, pickEditableTargetScope, withWriteRetry } from '../utils/commandHelpers';

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
        const { filePath, keyPath, scope } = node.nodeContext;

        if (guardReadOnly(node, MESSAGES.readOnlyDelete)) return;

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

        await withWriteRetry(filePath!, () => {
          removePlugin(filePath!, pluginId);
        });
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
        const { keyPath, scope } = node.nodeContext;

        // Allow copy from locked User scope (non-destructive).
        // Block copy from truly read-only scopes (Managed).
        if (guardReadOnly(node, MESSAGES.readOnlyCopy, { allowLockedUser: true })) return;

        if (!validateKeyPath(keyPath, 2, 'copyPluginToScope')) return;

        if (keyPath[0] !== 'enabledPlugins' || keyPath.length !== 2) return;

        const pluginId = keyPath[1];

        const target = await pickEditableTargetScope(
          configStore,
          scope,
          node.nodeContext.workspaceFolderUri,
          'Copy plugin to which scope?',
          'Copy to ',
        );
        if (!target) return;

        const targetFilePath = target.filePath;
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

        await withWriteRetry(targetFilePath, () => {
          setPluginEnabled(targetFilePath, pluginId, statePick.value);
        });
        const itemName = node.label?.toString() ?? pluginId;
        vscode.window.showInformationMessage(
          MESSAGES.copiedPlugin(itemName, SCOPE_LABELS[target.scope], statePick.label.toLowerCase()),
        );
      },
    ),
  );
}
