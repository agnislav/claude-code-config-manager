import * as vscode from 'vscode';
import { ConfigStore } from './config/configModel';
import { ConfigTreeProvider } from './tree/configTreeProvider';
import { ConfigFileWatcher } from './watchers/fileWatcher';
import { ConfigDiagnostics } from './validation/diagnostics';
import { registerAddCommands } from './commands/addCommands';
import { registerEditCommands } from './commands/editCommands';
import { registerDeleteCommands } from './commands/deleteCommands';
import { registerMoveCommands } from './commands/moveCommands';
import { registerOpenFileCommands } from './commands/openFileCommands';
import { registerPluginCommands } from './commands/pluginCommands';
import { PluginDecorationProvider } from './tree/nodes/pluginNode';
import { setPluginEnabled } from './config/configWriter';
import { ConfigTreeNode } from './tree/nodes/baseNode';
import { SectionType } from './types';
import { findKeyPathAtLine } from './utils/jsonLocation';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Claude Code Config');
  outputChannel.appendLine('Claude Code Config Manager activating...');

  // 1. Create the config store and load all scopes
  const configStore = new ConfigStore();
  configStore.reload();

  // 2. Create the tree data provider
  const treeProvider = new ConfigTreeProvider(configStore);

  // 3. Register the tree view
  const treeView = vscode.window.createTreeView('claudeConfigTree', {
    treeDataProvider: treeProvider,
  });

  // 4. Set up validation diagnostics
  const diagnostics = new ConfigDiagnostics();
  runDiagnostics(configStore, diagnostics);

  configStore.onDidChange(() => {
    runDiagnostics(configStore, diagnostics);
  });

  // 5. Register commands
  const refreshCmd = vscode.commands.registerCommand('claudeConfig.refresh', () => {
    configStore.reload();
  });

  // Section filter toggle commands (each has an .active variant for icon swap)
  const filterAllCmd = vscode.commands.registerCommand('claudeConfig.filterAll', () => {
    treeProvider.selectAllSections();
  });
  const filterAllActiveCmd = vscode.commands.registerCommand('claudeConfig.filterAll.active', () => {
    treeProvider.selectAllSections();
  });
  for (const st of Object.values(SectionType)) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`claudeConfig.filter.${st}`, () => {
        treeProvider.toggleSectionFilter(st);
      }),
      vscode.commands.registerCommand(`claudeConfig.filter.${st}.active`, () => {
        treeProvider.toggleSectionFilter(st);
      }),
    );
  }

  registerAddCommands(context, configStore);
  registerEditCommands(context, configStore);
  registerDeleteCommands(context, configStore);
  registerMoveCommands(context, configStore);
  registerOpenFileCommands(context, configStore);
  registerPluginCommands(context, configStore);

  // 6. Set up file watcher for auto-refresh
  const fileWatcher = new ConfigFileWatcher(configStore);
  fileWatcher.setup();

  // 7. Handle plugin checkbox toggles
  treeView.onDidChangeCheckboxState((e) => {
    for (const [item, state] of e.items) {
      const node = item as ConfigTreeNode;
      if (node.nodeType !== 'plugin') continue;
      const { filePath, keyPath } = node.nodeContext;
      if (!filePath || keyPath.length < 2) continue;
      const enabled = state === vscode.TreeItemCheckboxState.Checked;
      setPluginEnabled(filePath, keyPath[1], enabled);
    }
  });

  // Context menu "Toggle Plugin" — delegates to checkbox toggle
  const togglePluginCmd = vscode.commands.registerCommand(
    'claudeConfig.togglePlugin',
    (node?: ConfigTreeNode) => {
      if (!node || node.nodeType !== 'plugin') return;
      const { filePath, keyPath, isReadOnly } = node.nodeContext;
      if (isReadOnly || !filePath || keyPath.length < 2) return;
      const currentEnabled = node.checkboxState === vscode.TreeItemCheckboxState.Checked;
      setPluginEnabled(filePath, keyPath[1], !currentEnabled);
    },
  );

  // 8. Editor ↔ Tree bidirectional sync
  let suppressEditorSync = false;
  let suppressTreeSync = false;
  let syncTimeout: ReturnType<typeof setTimeout> | undefined;

  // Tree click → editor: suppress editor→tree sync to avoid loop
  treeView.onDidChangeSelection(() => {
    if (suppressTreeSync) return;
    suppressEditorSync = true;
    setTimeout(() => { suppressEditorSync = false; }, 500);
  });

  const syncEditorToTree = (editor: vscode.TextEditor) => {
    if (suppressEditorSync) return;

    const filePath = editor.document.uri.fsPath;
    const scopeInfo = configStore.findScopeByFilePath(filePath);
    if (!scopeInfo) return;

    const cursorLine = editor.selection.active.line;
    const keyPath = findKeyPathAtLine(filePath, cursorLine);
    if (!keyPath || keyPath.length === 0) return;

    const { scopedConfig, workspaceFolderKey } = scopeInfo;
    const node = treeProvider.findNodeByKeyPath(
      scopedConfig.scope,
      keyPath,
      workspaceFolderKey,
    );
    if (!node) return;

    suppressTreeSync = true;
    treeView.reveal(node, { select: true, focus: false, expand: true }).then(
      () => setTimeout(() => { suppressTreeSync = false; }, 100),
      () => { suppressTreeSync = false; },
    );
  };

  const onSelectionChange = vscode.window.onDidChangeTextEditorSelection((e) => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      syncEditorToTree(e.textEditor);
      syncTimeout = undefined;
    }, 150);
  });

  const onEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) return;
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      syncEditorToTree(editor);
      syncTimeout = undefined;
    }, 150);
  });

  // 9. Register file decoration provider for plugin label dimming
  const pluginDecorations = new PluginDecorationProvider();

  // 10. Push disposables
  context.subscriptions.push(
    treeView, configStore, fileWatcher, diagnostics, refreshCmd, filterAllCmd, filterAllActiveCmd, togglePluginCmd, outputChannel,
    vscode.window.registerFileDecorationProvider(pluginDecorations),
    onSelectionChange, onEditorChange,
  );

  outputChannel.appendLine('Claude Code Config Manager activated');
}

export function deactivate(): void {
  // Cleanup handled by disposable subscriptions
}

function runDiagnostics(configStore: ConfigStore, diagnostics: ConfigDiagnostics): void {
  const filePaths: string[] = [];
  for (const key of configStore.getWorkspaceFolderKeys()) {
    for (const sc of configStore.getAllScopes(key)) {
      if (sc.filePath && sc.fileExists) {
        filePaths.push(sc.filePath);
      }
    }
  }
  diagnostics.validateFiles(filePaths);
}
