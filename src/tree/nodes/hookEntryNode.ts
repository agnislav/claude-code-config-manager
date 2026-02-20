import * as vscode from 'vscode';
import { HookCommand, HookEventType, NodeContext, ScopedConfig } from '../../types';
import { ConfigTreeNode } from './baseNode';
import { HookKeyValueNode } from './hookKeyValueNode';

export class HookEntryNode extends ConfigTreeNode {
  readonly nodeType = 'hookEntry';

  constructor(
    label: string,
    private readonly eventType: HookEventType,
    private readonly matcherIndex: number,
    private readonly hookIndex: number,
    private readonly hook: HookCommand,
    private readonly scopedConfig: ScopedConfig,
  ) {
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['hooks', eventType, String(matcherIndex), String(hookIndex)],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: false,
      filePath: scopedConfig.filePath,
    };

    super(label, vscode.TreeItemCollapsibleState.Collapsed, ctx);

    const iconMap: Record<string, string> = {
      command: 'terminal',
      prompt: 'comment-discussion',
      agent: 'hubot',
    };
    this.iconPath = new vscode.ThemeIcon(iconMap[hook.type] ?? 'terminal');

    if (hook.command) {
      this.tooltip = new vscode.MarkdownString(`\`${hook.command}\``);
    }
    this.description = '';
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    const entries: ConfigTreeNode[] = [];
    // Show all defined properties of the hook command
    for (const [key, val] of Object.entries(this.hook)) {
      if (val !== undefined) {
        entries.push(
          new HookKeyValueNode(
            this.eventType,
            this.matcherIndex,
            this.hookIndex,
            key,
            val,
            this.scopedConfig,
          ),
        );
      }
    }
    return entries;
  }
}
