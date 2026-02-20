import * as vscode from 'vscode';

export const LOCK_URI_SCHEME = 'claude-config-lock';

export class LockDecorationProvider implements vscode.FileDecorationProvider {
  // Static undefined — no dynamic change notifications needed.
  // Lock toggle triggers tree refresh → ScopeNode rebuilt with new resourceUri.query
  // → VS Code calls provideFileDecoration for the new URI automatically.
  readonly onDidChangeFileDecorations = undefined;

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== LOCK_URI_SCHEME) return undefined;

    if (uri.query === 'locked') {
      return {
        color: new vscode.ThemeColor('disabledForeground'),
      };
    }
    return undefined;
  }
}
