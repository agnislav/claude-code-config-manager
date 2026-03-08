import * as vscode from 'vscode';
import { BaseVM } from '../../viewmodel/types';
import { NodeContext } from '../../types';

export abstract class ConfigTreeNode extends vscode.TreeItem {
  abstract readonly nodeType: string;

  static mapVM: (vm: BaseVM) => ConfigTreeNode;

  public readonly nodeContext: NodeContext;

  constructor(vm: BaseVM) {
    super(vm.label, vm.collapsibleState);
    this.nodeContext = vm.nodeContext;
    this.id = vm.id;
    this.iconPath = vm.icon;
    this.description = vm.description;
    this.contextValue = vm.contextValue;
    this.tooltip = vm.tooltip;
    if (vm.resourceUri !== undefined) {
      this.resourceUri = vm.resourceUri;
    }
    if (vm.checkboxState !== undefined) {
      this.checkboxState = vm.checkboxState;
    }
    if (vm.command !== undefined) {
      this.command = vm.command;
    }
  }

  abstract getChildren(): ConfigTreeNode[];
}
