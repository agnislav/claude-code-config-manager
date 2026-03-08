import { PermissionGroupVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class PermissionGroupNode extends ConfigTreeNode {
  readonly nodeType = 'permissionGroup';

  constructor(private readonly vm: PermissionGroupVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return this.vm.children.map(ConfigTreeNode.mapVM);
  }
}
