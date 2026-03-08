import * as vscode from 'vscode';
import { PluginVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export const PLUGIN_URI_SCHEME = 'claude-config-plugin';

export class PluginNode extends ConfigTreeNode {
  readonly nodeType = 'plugin';

  constructor(private readonly vm: PluginVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}

export class PluginDecorationProvider implements vscode.FileDecorationProvider {
  readonly onDidChangeFileDecorations = undefined;

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== PLUGIN_URI_SCHEME) return undefined;

    if (uri.query === 'disabled') {
      return {
        color: new vscode.ThemeColor('disabledForeground'),
      };
    }
    return undefined;
  }
}
