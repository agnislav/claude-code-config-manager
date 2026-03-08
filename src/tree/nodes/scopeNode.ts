import { ScopeVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class ScopeNode extends ConfigTreeNode {
  readonly nodeType = 'scope';

  constructor(private readonly vm: ScopeVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return this.vm.children.map(ConfigTreeNode.mapVM);
  }
}
