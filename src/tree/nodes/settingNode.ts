import * as vscode from 'vscode';
import { NodeContext, ScopedConfig } from '../../types';
import { resolveScalarOverride } from '../../config/overrideResolver';
import { ConfigTreeNode } from './baseNode';

export class SettingNode extends ConfigTreeNode {
  readonly nodeType = 'setting';

  constructor(
    private readonly key: string,
    private readonly value: unknown,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ) {
    const override = resolveScalarOverride(key, scopedConfig.scope, allScopes);

    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: [key],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: override.isOverridden,
      overriddenByScope: override.overriddenByScope,
      filePath: scopedConfig.filePath,
    };

    super(key, vscode.TreeItemCollapsibleState.None, ctx);

    this.iconPath = override.isOverridden
      ? new vscode.ThemeIcon('tools', new vscode.ThemeColor('disabledForeground'))
      : new vscode.ThemeIcon('tools');
    this.description = formatValue(value);

    if (typeof value === 'object' && value !== null) {
      this.tooltip = new vscode.MarkdownString(
        '```json\n' + JSON.stringify(value, null, 2) + '\n```',
      );
    }
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return `{${Object.keys(value).length} keys}`;
  return String(value);
}
