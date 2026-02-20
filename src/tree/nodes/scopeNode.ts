import * as vscode from 'vscode';
import { SCOPE_DESCRIPTIONS, SCOPE_ICONS, SCOPE_LABELS } from '../../constants';
import { ConfigScope, NodeContext, ScopedConfig, SectionType } from '../../types';
import { ConfigTreeNode } from './baseNode';
import { SectionNode } from './sectionNode';
import { LOCK_URI_SCHEME } from '../lockDecorations';

export class ScopeNode extends ConfigTreeNode {
  readonly nodeType = 'scope';

  constructor(
    private readonly scopedConfig: ScopedConfig,
    private readonly allScopes: ScopedConfig[],
    workspaceFolderUri?: string,
    private readonly sectionFilter?: ReadonlySet<SectionType>,
  ) {
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: [],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: false,
      workspaceFolderUri,
      filePath: scopedConfig.filePath,
    };

    super(
      SCOPE_LABELS[scopedConfig.scope],
      vscode.TreeItemCollapsibleState.Collapsed,
      ctx,
    );

    this.iconPath = new vscode.ThemeIcon(SCOPE_ICONS[scopedConfig.scope]);
    const isProjectScope =
      scopedConfig.scope === ConfigScope.ProjectShared ||
      scopedConfig.scope === ConfigScope.ProjectLocal;
    this.description = scopedConfig.fileExists
      ? isProjectScope && scopedConfig.filePath
        ? vscode.workspace.asRelativePath(scopedConfig.filePath, false)
        : this.getShortPath(scopedConfig.filePath)
      : 'Not found';
    this.tooltip = new vscode.MarkdownString(SCOPE_DESCRIPTIONS[scopedConfig.scope]);

    // Set resourceUri for lock dimming decoration (User scope only)
    if (scopedConfig.scope === ConfigScope.User) {
      this.resourceUri = vscode.Uri.from({
        scheme: LOCK_URI_SCHEME,
        path: '/user',
        query: scopedConfig.isReadOnly ? 'locked' : 'unlocked',
      });
    }

    this.finalize();
  }

  protected computeContextValue(): string {
    const base = `scope.${this.scopedConfig.scope}`;
    const editability = this.scopedConfig.isReadOnly ? 'readOnly' : 'editable';
    const parts = [base, editability];
    if (!this.scopedConfig.fileExists) parts.push('missing');
    return parts.join('.');
  }

  getChildren(): ConfigTreeNode[] {
    if (!this.scopedConfig.fileExists && this.scopedConfig.scope !== ConfigScope.Managed) {
      // File doesn't exist — show a "Create file" placeholder
      return [];
    }

    const filter = this.sectionFilter;
    const isFiltered = filter && filter.size > 0;

    const sections: ConfigTreeNode[] = [];
    const config = this.scopedConfig.config;

    // Permissions section — always show if any permission rules exist
    if (config.permissions && (!isFiltered || filter.has(SectionType.Permissions))) {
      sections.push(
        new SectionNode(SectionType.Permissions, this.scopedConfig, this.allScopes),
      );
    }

    // Sandbox section
    if (config.sandbox && (!isFiltered || filter.has(SectionType.Sandbox))) {
      sections.push(
        new SectionNode(SectionType.Sandbox, this.scopedConfig, this.allScopes),
      );
    }

    // Hooks section
    if (
      config.hooks &&
      Object.keys(config.hooks).length > 0 &&
      (!isFiltered || filter.has(SectionType.Hooks))
    ) {
      sections.push(
        new SectionNode(SectionType.Hooks, this.scopedConfig, this.allScopes),
      );
    }

    // MCP Servers section (from .mcp.json for project scopes)
    if (
      this.scopedConfig.mcpConfig?.mcpServers &&
      Object.keys(this.scopedConfig.mcpConfig.mcpServers).length > 0 &&
      (!isFiltered || filter.has(SectionType.McpServers))
    ) {
      sections.push(
        new SectionNode(SectionType.McpServers, this.scopedConfig, this.allScopes),
      );
    }

    // Environment section
    if (
      config.env &&
      Object.keys(config.env).length > 0 &&
      (!isFiltered || filter.has(SectionType.Environment))
    ) {
      sections.push(
        new SectionNode(SectionType.Environment, this.scopedConfig, this.allScopes),
      );
    }

    // Plugins section
    if (
      config.enabledPlugins &&
      Object.keys(config.enabledPlugins).length > 0 &&
      (!isFiltered || filter.has(SectionType.Plugins))
    ) {
      sections.push(
        new SectionNode(SectionType.Plugins, this.scopedConfig, this.allScopes),
      );
    }

    // Settings section (catch-all for scalar settings)
    const settingsKeys = this.getSettingsKeys();
    if (settingsKeys.length > 0 && (!isFiltered || filter.has(SectionType.Settings))) {
      sections.push(
        new SectionNode(SectionType.Settings, this.scopedConfig, this.allScopes),
      );
    }

    return sections;
  }

  private getSettingsKeys(): string[] {
    const dedicatedKeys = new Set([
      'permissions',
      'sandbox',
      'hooks',
      'enabledPlugins',
      'env',
    ]);
    return Object.keys(this.scopedConfig.config).filter((k) => !dedicatedKeys.has(k));
  }

  private getShortPath(filePath: string | undefined): string {
    if (!filePath) return '';
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
    if (home && filePath.startsWith(home)) {
      return '~' + filePath.substring(home.length);
    }
    return filePath;
  }
}
