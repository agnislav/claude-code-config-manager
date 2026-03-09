import * as vscode from 'vscode';

export const OVERLAP_URI_SCHEME = 'claude-config-overlap';

export class OverlapDecorationProvider implements vscode.FileDecorationProvider {
  // Static undefined — no dynamic change notifications needed.
  // Tree refresh rebuilds URIs with updated query → VS Code re-queries decorations.
  readonly onDidChangeFileDecorations = undefined;

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== OVERLAP_URI_SCHEME) return undefined;

    switch (uri.query) {
      case 'red':
        return { color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground') };
      case 'orange':
        return { color: new vscode.ThemeColor('debugTokenExpression.string') };
      case 'green':
        return { color: new vscode.ThemeColor('gitDecoration.addedResourceForeground') };
      case 'yellow':
        return { color: new vscode.ThemeColor('editorWarning.foreground') };
      default:
        return undefined;
    }
  }
}
