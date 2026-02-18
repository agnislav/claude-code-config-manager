import * as vscode from 'vscode';
import { HookCommand, HookEventType, NodeContext, ScopedConfig } from '../../types';
import { ConfigTreeNode } from './baseNode';

export class HookEntryNode extends ConfigTreeNode {
  readonly nodeType = 'hookEntry';

  constructor(
    label: string,
    eventType: HookEventType,
    matcherIndex: number,
    hookIndex: number,
    hook: HookCommand,
    scopedConfig: ScopedConfig,
  ) {
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['hooks', eventType, String(matcherIndex), String(hookIndex)],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: false,
      filePath: scopedConfig.filePath,
    };

    super(label, vscode.TreeItemCollapsibleState.None, ctx);

    const iconMap: Record<string, string> = {
      command: 'terminal',
      prompt: 'comment-discussion',
      agent: 'hubot',
    };
    this.iconPath = new vscode.ThemeIcon(iconMap[hook.type] ?? 'terminal');

    if (hook.command) {
      this.tooltip = new vscode.MarkdownString(`\`${hook.command}\``);
    }
    if (hook.timeout) {
      this.description = `timeout: ${hook.timeout}s`;
    }
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}
