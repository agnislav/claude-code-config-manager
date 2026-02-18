import * as vscode from 'vscode';
import { SCOPE_LABELS } from '../../constants';
import { NodeContext, PermissionCategory, ScopedConfig } from '../../types';
import { resolvePermissionOverride } from '../../config/overrideResolver';
import { ConfigTreeNode } from './baseNode';

export class PermissionRuleNode extends ConfigTreeNode {
  readonly nodeType = 'permissionRule';

  constructor(
    private readonly rule: string,
    private readonly category: PermissionCategory,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ) {
    const override = resolvePermissionOverride(category, rule, scopedConfig.scope, allScopes);

    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['permissions', category, rule],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: override.isOverridden,
      overriddenByScope: override.overriddenByScope,
      filePath: scopedConfig.filePath,
    };

    super(rule, vscode.TreeItemCollapsibleState.None, ctx);

    this.iconPath = new vscode.ThemeIcon(
      'symbol-event',
      new vscode.ThemeColor(override.isOverridden ? 'disabledForeground' : 'icon.foreground'),
    );

    if (override.isOverridden && override.overriddenByScope && override.overriddenByCategory) {
      const scopeLabel = SCOPE_LABELS[override.overriddenByScope];
      this.tooltip = new vscode.MarkdownString(
        `$(warning) This **${category}** rule is overridden by a **${override.overriddenByCategory}** rule in **${scopeLabel}**`,
      );
    }
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}
