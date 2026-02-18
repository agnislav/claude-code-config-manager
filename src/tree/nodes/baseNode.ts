import * as vscode from 'vscode';
import { SCOPE_LABELS } from '../../constants';
import { NodeContext } from '../../types';

export abstract class ConfigTreeNode extends vscode.TreeItem {
  abstract readonly nodeType: string;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly nodeContext: NodeContext,
  ) {
    super(label, collapsibleState);
  }

  /**
   * Must be called at the end of every leaf-class constructor,
   * after all subclass fields have been assigned.
   */
  protected finalize(): void {
    this.id = this.computeId();
    this.contextValue = this.computeContextValue();
    this.tooltip = this.computeTooltip();
    this.applyOverrideStyle();
    this.applyClickCommand();
  }

  protected computeId(): string {
    const { scope, keyPath, workspaceFolderUri } = this.nodeContext;
    const prefix = workspaceFolderUri ?? '';
    return `${prefix}/${scope}/${keyPath.join('/')}`;
  }

  protected computeContextValue(): string {
    const parts = [this.nodeType];
    parts.push(this.nodeContext.isReadOnly ? 'readOnly' : 'editable');
    if (this.nodeContext.isOverridden) parts.push('overridden');
    return parts.join('.');
  }

  protected computeTooltip(): string | vscode.MarkdownString | undefined {
    if (this.nodeContext.isOverridden && this.nodeContext.overriddenByScope) {
      const scopeLabel = SCOPE_LABELS[this.nodeContext.overriddenByScope];
      return new vscode.MarkdownString(
        `$(warning) Overridden by **${scopeLabel}**`,
      );
    }
    return undefined;
  }

  protected applyOverrideStyle(): void {
    if (this.nodeContext.isOverridden && this.nodeContext.overriddenByScope) {
      const scopeLabel = SCOPE_LABELS[this.nodeContext.overriddenByScope];
      this.description = `${this.description ?? ''} (overridden by ${scopeLabel})`.trim();
    }
  }

  protected applyClickCommand(): void {
    if (
      this.collapsibleState !== vscode.TreeItemCollapsibleState.None ||
      !this.nodeContext.filePath ||
      this.nodeContext.keyPath.length === 0
    ) {
      return;
    }

    this.command = {
      command: 'claudeConfig.revealInFile',
      title: 'Reveal in Config File',
      arguments: [this.nodeContext.filePath, this.nodeContext.keyPath],
    };
  }

  abstract getChildren(): ConfigTreeNode[];
}
