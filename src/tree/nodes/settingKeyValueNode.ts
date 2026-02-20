import * as vscode from 'vscode';
import { NodeContext, ScopedConfig } from '../../types';
import { resolveScalarOverride } from '../../config/overrideResolver';
import { ConfigTreeNode } from './baseNode';
import { formatValue } from './settingNode';

export class SettingKeyValueNode extends ConfigTreeNode {
  readonly nodeType = 'settingKeyValue';

  constructor(
    parentKey: string,
    childKey: string,
    value: unknown,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ) {
    // Inherit override status from parent setting key
    const override = resolveScalarOverride(parentKey, scopedConfig.scope, allScopes);
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: [parentKey, childKey],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: override.isOverridden,
      overriddenByScope: override.overriddenByScope,
      filePath: scopedConfig.filePath,
    };
    super(childKey, vscode.TreeItemCollapsibleState.None, ctx);
    this.iconPath = override.isOverridden
      ? new vscode.ThemeIcon('symbol-field', new vscode.ThemeColor('disabledForeground'))
      : new vscode.ThemeIcon('symbol-field');
    this.description = formatValue(value);
    if (typeof value === 'object' && value !== null) {
      this.tooltip = new vscode.MarkdownString('```json\n' + JSON.stringify(value, null, 2) + '\n```');
    }
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}
