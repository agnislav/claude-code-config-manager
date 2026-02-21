import * as vscode from 'vscode';
import { HookEventType, HookMatcher, NodeContext, ScopedConfig } from '../../types';
import { ConfigTreeNode } from './baseNode';
import { HookEntryNode } from './hookEntryNode';

export class HookEventNode extends ConfigTreeNode {
  readonly nodeType = 'hookEvent';

  constructor(
    private readonly eventType: HookEventType,
    private readonly matchers: HookMatcher[],
    private readonly scopedConfig: ScopedConfig,
  ) {
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['hooks', eventType],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: false,
      filePath: scopedConfig.filePath,
    };

    super(eventType, vscode.TreeItemCollapsibleState.Collapsed, ctx);

    this.iconPath = new vscode.ThemeIcon('zap');
    const hookCount = matchers.reduce((sum, m) => sum + m.hooks.length, 0);
    this.description = `${hookCount} hook${hookCount !== 1 ? 's' : ''}`;
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    try {
      const children: ConfigTreeNode[] = [];

      for (let i = 0; i < this.matchers.length; i++) {
        const matcher = this.matchers[i];
        for (let j = 0; j < matcher.hooks.length; j++) {
          const hook = matcher.hooks[j];
          const label = matcher.matcher
            ? `[${matcher.matcher}] ${hook.command ?? hook.prompt ?? hook.type}`
            : hook.command ?? hook.prompt ?? hook.type;

          children.push(
            new HookEntryNode(label, this.eventType, i, j, hook, this.scopedConfig),
          );
        }
      }

      return children;
    } catch (error) {
      console.error(`Tree rendering error in ${this.nodeType} node:`, error);
      vscode.window.showWarningMessage(
        `Tree rendering error in ${this.nodeType}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
