import { WorkspaceFolderVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class WorkspaceFolderNode extends ConfigTreeNode {
  readonly nodeType = 'workspaceFolder';

  constructor(private readonly vm: WorkspaceFolderVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return this.vm.children.map(ConfigTreeNode.mapVM);
  }
}
