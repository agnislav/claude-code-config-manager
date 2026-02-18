import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import { ConfigScope, ScopedConfig, SectionType } from '../types';
import { ConfigTreeNode } from './nodes/baseNode';
import { ScopeNode } from './nodes/scopeNode';

export class ConfigTreeProvider implements vscode.TreeDataProvider<ConfigTreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    ConfigTreeNode | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly parentMap = new Map<string, ConfigTreeNode>();
  private readonly childrenCache = new Map<string, ConfigTreeNode[]>();

  private readonly _sectionFilter = new Set<SectionType>();

  constructor(private readonly configStore: ConfigStore) {
    configStore.onDidChange(() => this.refresh());
    this.syncFilterContext();
  }

  get sectionFilter(): ReadonlySet<SectionType> {
    return this._sectionFilter;
  }

  toggleSectionFilter(section: SectionType): void {
    if (this._sectionFilter.has(section)) {
      this._sectionFilter.delete(section);
    } else {
      this._sectionFilter.add(section);
    }
    this.syncFilterContext();
    this.refresh();
  }

  selectAllSections(): void {
    this._sectionFilter.clear();
    this.syncFilterContext();
    this.refresh();
  }

  /** Maps SectionType to a context key suffix safe for VS Code when-clauses. */
  private static readonly FILTER_CTX_KEYS: Record<SectionType, string> = {
    [SectionType.Permissions]: 'permissions',
    [SectionType.Sandbox]: 'sandbox',
    [SectionType.Hooks]: 'hooks',
    [SectionType.McpServers]: 'mcpServers',
    [SectionType.Environment]: 'environment',
    [SectionType.Plugins]: 'plugins',
    [SectionType.Settings]: 'settings',
  };

  private syncFilterContext(): void {
    const isAll = this._sectionFilter.size === 0;
    vscode.commands.executeCommand('setContext', 'claudeConfig_filter_all', isAll);
    for (const st of Object.values(SectionType)) {
      const ctxKey = ConfigTreeProvider.FILTER_CTX_KEYS[st];
      vscode.commands.executeCommand(
        'setContext',
        `claudeConfig_filter_${ctxKey}`,
        this._sectionFilter.has(st),
      );
    }
  }

  refresh(): void {
    this.parentMap.clear();
    this.childrenCache.clear();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ConfigTreeNode): vscode.TreeItem {
    return element;
  }

  getParent(element: ConfigTreeNode): ConfigTreeNode | undefined {
    if (!element.id) return undefined;
    return this.parentMap.get(element.id);
  }

  getChildren(element?: ConfigTreeNode): ConfigTreeNode[] {
    const cacheKey = element?.id ?? '__root__';
    const cached = this.childrenCache.get(cacheKey);
    if (cached) return cached;

    let children: ConfigTreeNode[];

    if (element) {
      children = element.getChildren();
    } else if (this.configStore.isMultiRoot()) {
      children = this.getMultiRootChildren();
    } else {
      children = this.getSingleRootChildren();
    }

    // Populate parent map for reveal support
    for (const child of children) {
      if (child.id && element) {
        this.parentMap.set(child.id, element);
      }
    }

    this.childrenCache.set(cacheKey, children);
    return children;
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
    for (let len = keyPath.length; len > 0; len--) {
      const prefix = keyPath.slice(0, len);
      const roots = this.getChildren();
      const found = this.walkForNode(roots, scope, prefix, workspaceFolderKey);
      if (found) return found;
    }
    return undefined;
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

  private getSingleRootChildren(): ConfigTreeNode[] {
    const keys = this.configStore.getWorkspaceFolderKeys();
    if (keys.length === 0) return [];

    const key = keys[0];
    const allScopes = this.configStore.getAllScopes(key);

    return allScopes
      .filter((s) => s.scope !== ConfigScope.Managed)
      .map((scopedConfig) => new ScopeNode(scopedConfig, allScopes, key, this._sectionFilter));
  }

  private getMultiRootChildren(): ConfigTreeNode[] {
    // For multi-root, we show workspace folder grouping nodes
    // that each contain 4 scope nodes
    const children: ConfigTreeNode[] = [];

    for (const key of this.configStore.getWorkspaceFolderKeys()) {
      const allScopes = this.configStore.getAllScopes(key);
      const discovered = this.configStore.getDiscoveredPaths(key);
      const folderName = discovered?.workspaceFolder?.name ?? key;

      // Create a virtual folder node
      const folderNode = new WorkspaceFolderNode(folderName, key, allScopes, this._sectionFilter);
      children.push(folderNode);
    }

    return children;
  }
}

class WorkspaceFolderNode extends ConfigTreeNode {
  readonly nodeType = 'workspaceFolder';

  constructor(
    folderName: string,
    private readonly workspaceFolderUri: string,
    private readonly allScopes: ScopedConfig[],
    private readonly sectionFilter: ReadonlySet<SectionType>,
  ) {
    super(folderName, vscode.TreeItemCollapsibleState.Expanded, {
      scope: ConfigScope.User, // placeholder — not meaningful for folder nodes
      keyPath: [],
      isReadOnly: false,
      isOverridden: false,
      workspaceFolderUri,
    });

    this.iconPath = new vscode.ThemeIcon('root-folder');
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    return this.allScopes
      .filter((s) => s.scope !== ConfigScope.Managed)
      .map(
        (scopedConfig) =>
          new ScopeNode(scopedConfig, this.allScopes, this.workspaceFolderUri, this.sectionFilter),
      );
  }
}
