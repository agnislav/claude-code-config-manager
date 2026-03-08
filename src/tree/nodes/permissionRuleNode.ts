import { PermissionRuleVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class PermissionRuleNode extends ConfigTreeNode {
  readonly nodeType = 'permissionRule';

  constructor(private readonly vm: PermissionRuleVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}
