import * as vscode from 'vscode';
import * as fs from 'fs';
import { ConfigStore } from '../config/configModel';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { findKeyLine } from '../utils/jsonLocation';

export function registerOpenFileCommands(
  context: vscode.ExtensionContext,
  _configStore: ConfigStore,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.openFile',
      async (node?: ConfigTreeNode) => {
        const filePath = node?.nodeContext?.filePath;
        if (!filePath) return;

        if (!fs.existsSync(filePath)) {
          vscode.window.showWarningMessage(`File does not exist: ${filePath}`);
          return;
        }

        const uri = vscode.Uri.file(filePath);
        await vscode.window.showTextDocument(uri);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.createConfigFile',
      async (node?: ConfigTreeNode) => {
        const filePath = node?.nodeContext?.filePath;
        if (!filePath) return;

        if (fs.existsSync(filePath)) {
          const uri = vscode.Uri.file(filePath);
          await vscode.window.showTextDocument(uri);
          return;
        }

        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, '{}\n', 'utf-8');

        const uri = vscode.Uri.file(filePath);
        await vscode.window.showTextDocument(uri);
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.revealInFile',
      async (filePath: string, keyPath: string[]) => {
        if (!filePath || !fs.existsSync(filePath)) return;

        const uri = vscode.Uri.file(filePath);
        const editor = await vscode.window.showTextDocument(uri);

        const location = findKeyLine(filePath, keyPath);
        if (location) {
          const pos = new vscode.Position(location.line, location.lineLength);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(
            new vscode.Range(pos, pos),
            vscode.TextEditorRevealType.InCenterIfOutsideViewport,
          );
        }
      },
    ),
  );
}
