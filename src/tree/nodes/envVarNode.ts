import * as vscode from 'vscode';
import { NodeContext, ScopedConfig } from '../../types';
import { resolveEnvOverride } from '../../config/overrideResolver';
import { ConfigTreeNode } from './baseNode';

export class EnvVarNode extends ConfigTreeNode {
  readonly nodeType = 'envVar';

  constructor(
    private readonly key: string,
    private readonly value: string,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ) {
    const override = resolveEnvOverride(key, scopedConfig.scope, allScopes);

    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['env', key],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: override.isOverridden,
      overriddenByScope: override.overriddenByScope,
      filePath: scopedConfig.filePath,
    };

    super(key, vscode.TreeItemCollapsibleState.None, ctx);

    this.iconPath = new vscode.ThemeIcon(
      'symbol-variable',
      new vscode.ThemeColor(override.isOverridden ? 'disabledForeground' : 'icon.foreground'),
    );
    this.description = value;
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}
