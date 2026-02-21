import * as vscode from 'vscode';
import { NodeContext, ScopedConfig } from '../../types';
import { resolveScalarOverride } from '../../config/overrideResolver';
import { ConfigTreeNode } from './baseNode';
import { SettingKeyValueNode } from './settingKeyValueNode';

export class SettingNode extends ConfigTreeNode {
  readonly nodeType = 'setting';

  constructor(
    private readonly key: string,
    private readonly value: unknown,
    private readonly scopedConfig: ScopedConfig,
    private readonly allScopes: ScopedConfig[],
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

    // Determine collapsibility: object types (non-null, non-array) are expandable
    const isExpandableObject =
      typeof value === 'object' && value !== null && !Array.isArray(value);
    const collapsibleState = isExpandableObject
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    super(key, collapsibleState, ctx);

    this.iconPath = override.isOverridden
      ? new vscode.ThemeIcon('tools', new vscode.ThemeColor('disabledForeground'))
      : new vscode.ThemeIcon('tools');

    // Object settings: empty description (children show the detail)
    // Scalar/array settings: show value inline
    this.description = isExpandableObject ? '' : formatValue(value);

    if (typeof value === 'object' && value !== null) {
      this.tooltip = new vscode.MarkdownString(
        '```json\n' + JSON.stringify(value, null, 2) + '\n```',
      );
    }
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    try {
      // Only object types (non-null, non-array) have children
      if (
        typeof this.value !== 'object' ||
        this.value === null ||
        Array.isArray(this.value)
      ) {
        return [];
      }

      // Create a SettingKeyValueNode for each key/value pair
      return Object.entries(this.value).map(
        ([childKey, childValue]) =>
          new SettingKeyValueNode(
            this.key,
            childKey,
            childValue,
            this.scopedConfig,
            this.allScopes,
          ),
      );
    } catch (error) {
      console.error(`Tree rendering error in ${this.nodeType} node:`, error);
      vscode.window.showWarningMessage(
        `Tree rendering error in ${this.nodeType}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return `{${Object.keys(value).length} keys}`;
  return String(value);
}
