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

    this.iconPath = override.isOverridden
      ? new vscode.ThemeIcon('terminal', new vscode.ThemeColor('disabledForeground'))
      : new vscode.ThemeIcon('terminal');
    this.description = value;
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    try {
      return [];
    } catch (error) {
      console.error(`Tree rendering error in ${this.nodeType} node:`, error);
      vscode.window.showWarningMessage(
        `Tree rendering error in ${this.nodeType}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
