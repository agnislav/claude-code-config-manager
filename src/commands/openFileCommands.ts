import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { findKeyLine } from '../utils/jsonLocation';
import { getUserSettingsPath, getManagedSettingsPath, getUserClaudeJsonPath } from '../utils/platform';
import { PROJECT_CLAUDE_DIR, PROJECT_SHARED_FILE, PROJECT_LOCAL_FILE, MCP_CONFIG_FILE, MAX_KEYPATH_DEPTH, DOUBLE_CLICK_THRESHOLD_MS, MESSAGES } from '../constants';
import { formatTimestamp } from '../utils/timestamp';

function logRevealInFile(outputChannel: vscode.OutputChannel | undefined, message: string): void {
  if (!outputChannel) return;
  outputChannel.appendLine(`${formatTimestamp()} [revealInFile] ${message}`);
}

let lastClick: { nodeId: string; time: number } | null = null;

async function openAndPositionAtKey(
  uri: vscode.Uri,
  filePath: string,
  keyPath: string[],
): Promise<void> {
  const editor = await vscode.window.showTextDocument(uri);
  if (keyPath.length === 0) return;
  const location = findKeyLine(filePath, keyPath);
  if (!location) return;
  const pos = new vscode.Position(location.line, location.lineLength);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(
    new vscode.Range(pos, pos),
    vscode.TextEditorRevealType.InCenterIfOutsideViewport,
  );
}

export function isFileOpenInAnyTab(uri: vscode.Uri): boolean {
  const target = uri.fsPath;
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if (input instanceof vscode.TabInputText && input.uri.fsPath === target) {
        return true;
      }
    }
  }
  return false;
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

  // Hidden command used only by the integration test suite to clear the in-memory
  // double-click debounce state between test cases. Not contributed in package.json,
  // so it is invisible in the command palette.
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeConfig._test_resetDoubleClickState', () => {
      lastClick = null;
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeConfig.revealInFile',
      async (filePath: string, keyPath: string[], nodeId?: string) => {
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

        // Decide whether this invocation should open a closed file. Two paths qualify:
        //  1. The user has VS Code's `workbench.list.openMode` set to `doubleClick`, in
        //     which case `TreeItem.command` only fires on a real double-click — every
        //     fire IS the explicit-open intent.
        //  2. We received two invocations on the same nodeId within the debounce window,
        //     i.e. a synthesized double-click on top of a `singleClick` openMode.
        const now = Date.now();
        const openMode = vscode.workspace
          .getConfiguration('workbench.list')
          .get<string>('openMode');
        const isExplicitDoubleClickMode = openMode === 'doubleClick';
        const isDebounceMatch =
          nodeId !== undefined &&
          lastClick !== null &&
          lastClick.nodeId === nodeId &&
          now - lastClick.time < DOUBLE_CLICK_THRESHOLD_MS;
        const shouldOpenClosedFile = isExplicitDoubleClickMode || isDebounceMatch;

        // Update click state for the next invocation. Done before the await so we
        // never miss recording a click even if the open path throws.
        lastClick = nodeId !== undefined ? { nodeId, time: now } : null;

        const uri = vscode.Uri.file(filePath);
        if (isFileOpenInAnyTab(uri) || shouldOpenClosedFile) {
          await openAndPositionAtKey(uri, filePath, keyPath);
          return;
        }

        // Silent no-op: the tree click still selects the item; explicit opens go
        // through `claudeConfig.openFile` (context menu / toolbar) or a double-click.
        logRevealInFile(outputChannel, `skipped: ${filePath} (not open in any tab)`);
      },
    ),
  );
}
