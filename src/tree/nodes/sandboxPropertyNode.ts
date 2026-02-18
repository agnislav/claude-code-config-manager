import * as vscode from 'vscode';
import { NodeContext, ScopedConfig } from '../../types';
import { resolveSandboxOverride } from '../../config/overrideResolver';
import { ConfigTreeNode } from './baseNode';

export class SandboxPropertyNode extends ConfigTreeNode {
  readonly nodeType = 'sandboxProperty';

  constructor(
    private readonly key: string,
    private readonly value: unknown,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ) {
    const override = resolveSandboxOverride(key, scopedConfig.scope, allScopes);

    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['sandbox', ...key.split('.')],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: override.isOverridden,
      overriddenByScope: override.overriddenByScope,
      filePath: scopedConfig.filePath,
    };

    super(key, vscode.TreeItemCollapsibleState.None, ctx);

    this.iconPath = override.isOverridden
      ? new vscode.ThemeIcon('vm', new vscode.ThemeColor('disabledForeground'))
      : new vscode.ThemeIcon('vm');
    this.description = formatSandboxValue(value);

    if (Array.isArray(value)) {
      this.tooltip = new vscode.MarkdownString(
        value.map((v) => `- \`${v}\``).join('\n'),
      );
    }
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}

function formatSandboxValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.length} items]`;
  return JSON.stringify(value);
}
