import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { findKeyLine } from '../utils/jsonLocation';
import { getUserSettingsPath, getManagedSettingsPath, getUserClaudeJsonPath } from '../utils/platform';
import { PROJECT_CLAUDE_DIR, PROJECT_SHARED_FILE, PROJECT_LOCAL_FILE, MCP_CONFIG_FILE, MAX_KEYPATH_DEPTH, MESSAGES } from '../constants';

function logRevealInFile(outputChannel: vscode.OutputChannel | undefined, message: string): void {
  if (!outputChannel) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const mmm = String(now.getMilliseconds()).padStart(3, '0');
  outputChannel.appendLine(`[${hh}:${mm}:${ss}.${mmm}] [revealInFile] ${message}`);
}

function buildKnownConfigPaths(): Set<string> {
  const paths = new Set<string>();

  // Add user settings path
  paths.add(getUserSettingsPath());

  // Add managed settings path
  paths.add(getManagedSettingsPath());

  // Add ~/.claude.json (MCP server definitions for User and Local scopes)
  paths.add(getUserClaudeJsonPath());

  // Add project-level paths from all workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const folderPath = folder.uri.fsPath;
      paths.add(path.join(folderPath, PROJECT_CLAUDE_DIR, PROJECT_SHARED_FILE));
      paths.add(path.join(folderPath, PROJECT_CLAUDE_DIR, PROJECT_LOCAL_FILE));
      paths.add(path.join(folderPath, MCP_CONFIG_FILE));
    }
  }

  return paths;
}

export function registerOpenFileCommands(
  context: vscode.ExtensionContext,
  outputChannel?: vscode.OutputChannel,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.openFile',
      async (node?: ConfigTreeNode) => {
        const filePath = node?.nodeContext?.filePath;
        if (!filePath) return;

        if (!fs.existsSync(filePath)) {
          vscode.window.showWarningMessage(MESSAGES.fileNotFound(filePath));
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

        const dir = path.dirname(filePath);
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
        // Validation 1: Check filePath type and presence
        if (typeof filePath !== 'string' || filePath.length === 0) {
          // Return silently for internal wiring where no path is available
          return;
        }

        // Validation 2: Check for path traversal sequences
        if (filePath.includes('../') || filePath.includes('..\\')) {
          vscode.window.showErrorMessage(MESSAGES.revealTraversal);
          logRevealInFile(outputChannel, `rejected: ${filePath} (traversal sequence)`);
          return;
        }

        // Validation 3: Validate filePath is in known config paths
        const knownPaths = buildKnownConfigPaths();
        if (!knownPaths.has(filePath)) {
          vscode.window.showErrorMessage(MESSAGES.revealUnknownPath(filePath));
          logRevealInFile(outputChannel, `rejected: ${filePath} (unknown path)`);
          return;
        }

        // Validation 4: Check file exists
        if (!fs.existsSync(filePath)) {
          // Return silently if file doesn't exist (it might not be created yet)
          return;
        }

        // Validation 5: Check keyPath is a valid array
        if (!Array.isArray(keyPath)) {
          vscode.window.showErrorMessage(MESSAGES.revealKeyPathNotArray);
          logRevealInFile(outputChannel, `rejected: keyPath is not an array (type: ${typeof keyPath})`);
          return;
        }

        // Validation 6: Check keyPath length
        if (keyPath.length === 0) {
          // Empty keyPath is valid - just open the file without navigating
        } else if (keyPath.length > MAX_KEYPATH_DEPTH) {
          vscode.window.showErrorMessage(MESSAGES.revealKeyPathTooDeep(MAX_KEYPATH_DEPTH));
          logRevealInFile(outputChannel, `rejected: keyPath length ${keyPath.length} exceeds max depth ${MAX_KEYPATH_DEPTH}`);
          return;
        }

        // Validation 7: Check all keyPath elements are strings
        if (!keyPath.every((k) => typeof k === 'string')) {
          vscode.window.showErrorMessage(MESSAGES.revealKeyPathNonString);
          logRevealInFile(outputChannel, `rejected: keyPath contains non-string elements`);
          return;
        }

        // All validations passed - proceed with reveal
        const uri = vscode.Uri.file(filePath);
        const editor = await vscode.window.showTextDocument(uri);

        if (keyPath.length > 0) {
          const location = findKeyLine(filePath, keyPath);
          if (location) {
            const pos = new vscode.Position(location.line, location.lineLength);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(
              new vscode.Range(pos, pos),
              vscode.TextEditorRevealType.InCenterIfOutsideViewport,
            );
          }
        }
      },
    ),
  );
}
