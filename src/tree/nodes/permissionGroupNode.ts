import * as vscode from 'vscode';
import { PERMISSION_CATEGORY_ICONS, PERMISSION_CATEGORY_LABELS } from '../../constants';
import { NodeContext, PermissionCategory, ScopedConfig } from '../../types';
import { ConfigTreeNode } from './baseNode';
import { PermissionRuleNode } from './permissionRuleNode';

export class PermissionGroupNode extends ConfigTreeNode {
  readonly nodeType = 'permissionGroup';

  constructor(
    private readonly category: string,
    private readonly rules: string[],
    private readonly scopedConfig: ScopedConfig,
    private readonly allScopes: ScopedConfig[],
  ) {
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      section: undefined,
      keyPath: ['permissions', category],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: false,
      filePath: scopedConfig.filePath,
    };

    const state =
      rules.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;

    super(PERMISSION_CATEGORY_LABELS[category] ?? category, state, ctx);

    this.iconPath = new vscode.ThemeIcon(PERMISSION_CATEGORY_ICONS[category] ?? 'circle');
    this.description = `${rules.length} rule${rules.length !== 1 ? 's' : ''}`;
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    const seen = new Set<string>();
    return this.rules
      .filter((rule) => {
        if (seen.has(rule)) return false;
        seen.add(rule);
        return true;
      })
      .map(
        (rule) =>
          new PermissionRuleNode(
            rule,
            this.category as PermissionCategory,
            this.scopedConfig,
            this.allScopes,
          ),
      );
  }
}
