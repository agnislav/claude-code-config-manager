import * as vscode from 'vscode';
import { NodeContext, ScopedConfig, HookEventType } from '../../types';
import { ConfigTreeNode } from './baseNode';

export class HookKeyValueNode extends ConfigTreeNode {
  readonly nodeType = 'hookKeyValue';

  constructor(
    eventType: HookEventType,
    matcherIndex: number,
    hookIndex: number,
    propertyKey: string,
    value: unknown,
    scopedConfig: ScopedConfig,
  ) {
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['hooks', eventType, String(matcherIndex), String(hookIndex), propertyKey],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: false,
      filePath: scopedConfig.filePath,
    };
    super(propertyKey, vscode.TreeItemCollapsibleState.None, ctx);
    this.iconPath = new vscode.ThemeIcon('symbol-field', new vscode.ThemeColor('icon.foreground'));
    this.description = formatHookValue(value);
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

function formatHookValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return `${value}`;
  if (typeof value === 'boolean') return String(value);
  return String(value);
}
