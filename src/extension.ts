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
import { setPluginEnabled, showWriteError, initWriteTracker, isWriteInFlight, getInFlightWriteCount } from './config/configWriter';
import { ConfigTreeNode } from './tree/nodes/baseNode';
import { findKeyPathAtLine } from './utils/jsonLocation';
import { SectionType, ConfigScope } from './types';
import { SECTION_LABELS, SECTION_ICONS, EDITOR_SYNC_SUPPRESS_MS, TREE_SYNC_SUPPRESS_MS, EDITOR_TREE_SYNC_DEBOUNCE_MS, DEACTIVATION_POLL_INTERVAL_MS, DEACTIVATION_MAX_WAIT_MS, MESSAGES } from './constants';
import { LockDecorationProvider } from './tree/lockDecorations';
import { OverlapDecorationProvider } from './tree/overlapDecorations';

// Module-scope map for tracking editor-tree sync timeouts
const syncTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Claude Code Config');
  outputChannel.appendLine('Claude Code Config Manager activating...');

  // 1. Create the config store and load all scopes
  const configStore = new ConfigStore();
  configStore.reload();

  // Lock User scope by default on activation (before first tree render)
  configStore.lockScope(ConfigScope.User);

  // Initialize User scope lock context key to true (locked by default)
  vscode.commands.executeCommand('setContext', 'claudeConfig_userScope_locked', true);

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

  const filterCmd = vscode.commands.registerCommand('claudeConfig.filterSections', () => {
    openSectionFilterPicker(treeProvider);
  });

  const filterActiveCmd = vscode.commands.registerCommand(
    'claudeConfig.filterSections.active',
    () => {
      openSectionFilterPicker(treeProvider);
    },
  );

  // Lock toggle commands
  const toggleLockCmd = vscode.commands.registerCommand(
    'claudeConfig.toggleUserLock',
    () => {
      const isLocked = configStore.isScopeLocked(ConfigScope.User);
      if (isLocked) {
        configStore.unlockScope(ConfigScope.User);
      } else {
        configStore.lockScope(ConfigScope.User);
      }
      vscode.commands.executeCommand('setContext', 'claudeConfig_userScope_locked', !isLocked);
    },
  );

  const lockCmd = vscode.commands.registerCommand(
    'claudeConfig.lockUserScope',
    () => {
      configStore.lockScope(ConfigScope.User);
      vscode.commands.executeCommand('setContext', 'claudeConfig_userScope_locked', true);
    },
  );

  const unlockCmd = vscode.commands.registerCommand(
    'claudeConfig.unlockUserScope',
    () => {
      configStore.unlockScope(ConfigScope.User);
      vscode.commands.executeCommand('setContext', 'claudeConfig_userScope_locked', false);
    },
  );

  const collapseAllCmd = vscode.commands.registerCommand('claudeConfig.collapseAll', () => {
    vscode.commands.executeCommand('workbench.actions.treeView.claudeConfigTree.collapseAll');
  });

  const expandAllCmd = vscode.commands.registerCommand('claudeConfig.expandAll', async () => {
    const expandable = collectExpandableNodes(treeProvider);
    for (const node of expandable) {
      try {
        await treeView.reveal(node, { select: false, focus: false, expand: true });
      } catch {
        // Node may not be visible (e.g., filtered out); skip silently
      }
    }
  });

  registerAddCommands(context, configStore);
  registerEditCommands(context);
  registerDeleteCommands(context);
  registerMoveCommands(context, configStore);
  registerOpenFileCommands(context, outputChannel);
  registerPluginCommands(context, configStore);

  // 6. Set up file watcher for auto-refresh
  const fileWatcher = new ConfigFileWatcher(configStore);
  initWriteTracker(outputChannel);
  fileWatcher.setOutputChannel(outputChannel);
  fileWatcher.setup();

  // 7. Handle plugin checkbox toggles
  treeView.onDidChangeCheckboxState(async (e) => {
    for (const [item, state] of e.items) {
      const node = item as ConfigTreeNode;
      if (node.nodeType !== 'plugin') continue;
      const { filePath, keyPath, isReadOnly } = node.nodeContext;
      if (isReadOnly || !filePath || keyPath.length < 2) {
        if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
          vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
        }
        treeProvider.refresh();
        continue;
      }

      // Block concurrent writes to the same file
      if (isWriteInFlight(filePath)) {
        vscode.window.showInformationMessage(MESSAGES.writeInProgress);
        continue;
      }

      const enabled = state === vscode.TreeItemCheckboxState.Checked;
      try {
        setPluginEnabled(filePath, keyPath[1], enabled);
      } catch (error) {
        await showWriteError(filePath, error, () => {
          setPluginEnabled(filePath, keyPath[1], enabled);
        });
        treeProvider.refresh();
      }
    }
  });

  // Context menu "Toggle Plugin" — delegates to checkbox toggle
  const togglePluginCmd = vscode.commands.registerCommand(
    'claudeConfig.togglePlugin',
    async (node?: ConfigTreeNode) => {
      if (!node || node.nodeType !== 'plugin') return;
      const { filePath, keyPath, isReadOnly } = node.nodeContext;
      if (isReadOnly || !filePath || keyPath.length < 2) {
        if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
          vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
        }
        return;
      }

      // Block concurrent writes to the same file
      if (isWriteInFlight(filePath)) {
        vscode.window.showInformationMessage(MESSAGES.writeInProgress);
        return;
      }

      const currentEnabled = node.checkboxState === vscode.TreeItemCheckboxState.Checked;
      try {
        setPluginEnabled(filePath, keyPath[1], !currentEnabled);
      } catch (error) {
        await showWriteError(filePath, error, () => {
          setPluginEnabled(filePath, keyPath[1], !currentEnabled);
        });
        treeProvider.refresh();
      }
    },
  );

  // 8. Editor ↔ Tree bidirectional sync
  let suppressEditorSync = false;
  let suppressTreeSync = false;

  // Tree click → editor: suppress editor→tree sync to avoid loop
  treeView.onDidChangeSelection(() => {
    if (suppressTreeSync) return;
    suppressEditorSync = true;
    setTimeout(() => { suppressEditorSync = false; }, EDITOR_SYNC_SUPPRESS_MS);
  });

  const syncEditorToTree = (editor: vscode.TextEditor) => {
    if (suppressEditorSync) return;
    if (!treeView.visible) return;

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
      () => setTimeout(() => { suppressTreeSync = false; }, TREE_SYNC_SUPPRESS_MS),
      () => { suppressTreeSync = false; },
    );
  };

  const onSelectionChange = vscode.window.onDidChangeTextEditorSelection((e) => {
    const key = 'selection';
    if (syncTimeouts.has(key)) {
      clearTimeout(syncTimeouts.get(key)!);
    }
    const timeout = setTimeout(() => {
      syncEditorToTree(e.textEditor);
      syncTimeouts.delete(key);
    }, EDITOR_TREE_SYNC_DEBOUNCE_MS);
    syncTimeouts.set(key, timeout);
  });

  const onEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) return;
    const key = 'editor';
    if (syncTimeouts.has(key)) {
      clearTimeout(syncTimeouts.get(key)!);
    }
    const timeout = setTimeout(() => {
      syncEditorToTree(editor);
      syncTimeouts.delete(key);
    }, EDITOR_TREE_SYNC_DEBOUNCE_MS);
    syncTimeouts.set(key, timeout);
  });

  // 9. Register file decoration providers
  const pluginDecorations = new PluginDecorationProvider();
  const lockDecorations = new LockDecorationProvider();
  const overlapDecorations = new OverlapDecorationProvider();

  // 10. Push disposables
  context.subscriptions.push(
    treeView, treeProvider, configStore, fileWatcher, diagnostics, refreshCmd, filterCmd, filterActiveCmd,
    toggleLockCmd, lockCmd, unlockCmd, collapseAllCmd, expandAllCmd,
    togglePluginCmd, outputChannel,
    vscode.window.registerFileDecorationProvider(pluginDecorations),
    vscode.window.registerFileDecorationProvider(lockDecorations),
    vscode.window.registerFileDecorationProvider(overlapDecorations),
    onSelectionChange, onEditorChange,
  );

  outputChannel.appendLine('Claude Code Config Manager activated');
}

export async function deactivate(): Promise<void> {
  // Clear all tracked editor-tree sync timeouts
  for (const [key, timeout] of syncTimeouts) {
    clearTimeout(timeout);
    syncTimeouts.delete(key);
  }

  // Wait for any in-flight writes to complete
  let waited = 0;
  while (getInFlightWriteCount() > 0 && waited < DEACTIVATION_MAX_WAIT_MS) {
    await new Promise(resolve => setTimeout(resolve, DEACTIVATION_POLL_INTERVAL_MS));
    waited += DEACTIVATION_POLL_INTERVAL_MS;
  }

  // Disposables handled by context.subscriptions
}

const SECTION_ORDER: SectionType[] = [
  SectionType.Permissions,
  SectionType.McpServers,
  SectionType.Plugins,
  SectionType.Hooks,
  SectionType.Settings,
  SectionType.Environment,
  SectionType.Sandbox,
];

function openSectionFilterPicker(treeProvider: ConfigTreeProvider): void {
  const qp = vscode.window.createQuickPick<vscode.QuickPickItem>();
  qp.title = 'Filter Sections';
  qp.canSelectMany = true;
  // Build items: "All" at position 0, then 7 sections in SECTION_ORDER
  const allItem: vscode.QuickPickItem = {
    label: '$(list-flat) All',
    alwaysShow: true,
  };

  const sectionItems: vscode.QuickPickItem[] = SECTION_ORDER.map((st) => ({
    label: `$(${SECTION_ICONS[st]}) ${SECTION_LABELS[st]}`,
    alwaysShow: true,
  }));

  const items = [allItem, ...sectionItems];
  qp.items = items;

  // Pre-select based on current filter state
  const currentFilter = treeProvider.sectionFilter;
  if (currentFilter.size === 0) {
    qp.selectedItems = [allItem];
  } else {
    qp.selectedItems = sectionItems.filter((_, i) => currentFilter.has(SECTION_ORDER[i]));
  }

  // Track latest selection for mutual exclusivity logic
  let latestSelection: readonly vscode.QuickPickItem[] = [...qp.selectedItems];

  qp.onDidChangeSelection((selected) => {
    // Implement mutual exclusivity between "All" and individual sections
    const hadAll = latestSelection.includes(allItem);
    const hasAll = selected.includes(allItem);
    const hadSections = latestSelection.filter((s) => s !== allItem);
    const hasSections = selected.filter((s) => s !== allItem);

    if (!hadAll && hasAll) {
      // User just selected "All" -> deselect all individual sections
      qp.selectedItems = [allItem];
    } else if (hadAll && hasSections.length > hadSections.length) {
      // User selected an individual section while "All" was active -> deselect "All"
      qp.selectedItems = hasSections;
    } else if (hadAll && !hasAll && hasSections.length === 0) {
      // User deselected "All" explicitly with no sections -> keep "All"
      qp.selectedItems = [allItem];
    } else if (!hasAll && hasSections.length === 0) {
      // User deselected the last individual section -> snap back to "All"
      qp.selectedItems = [allItem];
    }

    latestSelection = [...qp.selectedItems];

    // --- Immediate filter application (Gap 2 fix) ---
    const selectedSections = new Set<SectionType>();
    for (const item of latestSelection) {
      if (item === allItem) {
        // "All" selected -> show all sections
        treeProvider.setSectionFilter(new Set());
        return;
      }
      const idx = sectionItems.indexOf(item);
      if (idx >= 0) {
        selectedSections.add(SECTION_ORDER[idx]);
      }
    }
    treeProvider.setSectionFilter(selectedSections);
  });

  qp.onDidAccept(() => {
    qp.hide();
  });

  qp.onDidHide(() => {
    qp.dispose();
  });

  qp.show();
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

function collectExpandableNodes(treeProvider: ConfigTreeProvider): ConfigTreeNode[] {
  const result: ConfigTreeNode[] = [];
  const walk = (nodes: ConfigTreeNode[]) => {
    for (const node of nodes) {
      if (node.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
        result.push(node);
        const children = treeProvider.getChildren(node);
        walk(children);
      }
    }
  };
  walk(treeProvider.getChildren());
  return result;
}
