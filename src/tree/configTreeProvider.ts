import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import { ConfigScope, SectionType } from '../types';
import { BaseVM } from '../viewmodel/types';
import { TreeViewModelBuilder } from '../viewmodel/builder';
import { ConfigTreeNode } from './nodes/baseNode';
import { vmToNode } from './vmToNode';

/** Debounce delay for tree refresh after config store change events (ms). */
const TREE_REFRESH_DEBOUNCE_MS = 50;

export class ConfigTreeProvider implements vscode.TreeDataProvider<ConfigTreeNode>, vscode.Disposable {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    ConfigTreeNode | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly parentMap = new Map<string, ConfigTreeNode>();
  private readonly childrenCache = new Map<string, ConfigTreeNode[]>();

  private readonly _sectionFilter = new Set<SectionType>();
  private readonly builder: TreeViewModelBuilder;
  private cachedRootVMs: BaseVM[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly configStore: ConfigStore) {
    this.builder = new TreeViewModelBuilder(configStore);
    ConfigTreeNode.mapVM = vmToNode;
    this.cachedRootVMs = this.builder.build(this._sectionFilter);
    configStore.onDidChange(() => this.debouncedRefresh());
    this.updateFilterUI();
  }

  get sectionFilter(): ReadonlySet<SectionType> {
    return this._sectionFilter;
  }

  setSectionFilter(sections: ReadonlySet<SectionType>): void {
    this._sectionFilter.clear();
    for (const s of sections) {
      this._sectionFilter.add(s);
    }
    this.updateFilterUI();
    this.refresh();
  }

  private updateFilterUI(): void {
    const isFiltered = this._sectionFilter.size > 0;
    vscode.commands.executeCommand('setContext', 'claudeConfig_filterActive', isFiltered);
  }

  /** Schedule a debounced refresh. Coalesces rapid-fire config change events. */
  private debouncedRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      this.refresh();
    }, TREE_REFRESH_DEBOUNCE_MS);
  }

  refresh(): void {
    this.parentMap.clear();
    this.childrenCache.clear();
    this.cachedRootVMs = this.builder.build(this._sectionFilter);
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this._onDidChangeTreeData.dispose();
  }

  getTreeItem(element: ConfigTreeNode): vscode.TreeItem {
    return element;
  }

  getParent(element: ConfigTreeNode): ConfigTreeNode | undefined {
    if (!element.id) return undefined;
    return this.parentMap.get(element.id);
  }

  getChildren(element?: ConfigTreeNode): ConfigTreeNode[] {
    try {
      const cacheKey = element?.id ?? '__root__';
      const cached = this.childrenCache.get(cacheKey);
      if (cached) return cached;

      let children: ConfigTreeNode[];

      if (element) {
        try {
          children = element.getChildren();
        } catch (error) {
          console.error('Tree rendering error in getChildren:', error);
          vscode.window.showWarningMessage(
            'Tree rendering error: ' + (error instanceof Error ? error.message : String(error)),
          );
          return [];
        }
      } else {
        try {
          children = this.cachedRootVMs.map(vmToNode);
        } catch (error) {
          console.error('Tree rendering error in root children:', error);
          vscode.window.showWarningMessage(
            'Tree rendering error: ' + (error instanceof Error ? error.message : String(error)),
          );
          return [];
        }
      }

      // Populate parent map for reveal support
      for (const child of children) {
        if (child.id && element) {
          this.parentMap.set(child.id, element);
        }
      }

      this.childrenCache.set(cacheKey, children);
      return children;
    } catch (error) {
      console.error('Tree rendering error in getChildren:', error);
      vscode.window.showWarningMessage(
        'Tree rendering error: ' + (error instanceof Error ? error.message : String(error)),
      );
      return [];
    }
  }

  /**
   * Finds a tree node by scope and keyPath, walking the tree from root.
   * Falls back to progressively shorter keyPath prefixes for nested properties
   * that don't have their own tree node (e.g. cursor on "command" inside an MCP server).
   *
   * Walking the tree via getChildren() populates the parentMap as a side effect,
   * so treeView.reveal() will work after this call.
   */
  findNodeByKeyPath(
    scope: ConfigScope,
    keyPath: string[],
    workspaceFolderKey?: string,
  ): ConfigTreeNode | undefined {
    try {
      for (let len = keyPath.length; len > 0; len--) {
        const prefix = keyPath.slice(0, len);
        const roots = this.getChildren();
        const found = this.walkForNode(roots, scope, prefix, workspaceFolderKey);
        if (found) return found;
      }
      return undefined;
    } catch (error) {
      console.error('Tree rendering error in findNodeByKeyPath:', error);
      return undefined;
    }
  }

  private walkForNode(
    nodes: ConfigTreeNode[],
    scope: ConfigScope,
    keyPath: string[],
    workspaceFolderKey?: string,
  ): ConfigTreeNode | undefined {
    for (const node of nodes) {
      const ctx = node.nodeContext;

      const scopeMatch =
        ctx.scope === scope &&
        (workspaceFolderKey === undefined ||
          ctx.workspaceFolderUri === undefined ||
          ctx.workspaceFolderUri === workspaceFolderKey);

      // Exact match: same scope and identical keyPath
      if (
        scopeMatch &&
        ctx.keyPath.length === keyPath.length &&
        ctx.keyPath.every((seg, i) => seg === keyPath[i])
      ) {
        return node;
      }

      // Target keyPath is a prefix of node's keyPath — the cursor is inside
      // this node's JSON content (e.g. a hook entry whose tree keyPath uses
      // array indices that don't appear as named keys in the JSON).
      if (
        scopeMatch &&
        keyPath.length < ctx.keyPath.length &&
        keyPath.every((seg, i) => seg === ctx.keyPath[i])
      ) {
        return node;
      }

      // Only descend if this node's keyPath is a prefix of the target
      if (
        ctx.keyPath.length < keyPath.length &&
        ctx.keyPath.every((seg, i) => seg === keyPath[i])
      ) {
        const children = this.getChildren(node);
        const found = this.walkForNode(children, scope, keyPath, workspaceFolderKey);
        if (found) return found;
      }

      // Also descend into scope-level and workspace-folder nodes (keyPath = [])
      if (ctx.keyPath.length === 0) {
        const children = this.getChildren(node);
        const found = this.walkForNode(children, scope, keyPath, workspaceFolderKey);
        if (found) return found;
      }
    }
    return undefined;
  }
}
