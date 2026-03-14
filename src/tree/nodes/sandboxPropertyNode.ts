import { SandboxPropertyVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class SandboxPropertyNode extends ConfigTreeNode {
  readonly nodeType = 'sandboxProperty';

  constructor(private readonly vm: SandboxPropertyVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return this.vm.children.map(ConfigTreeNode.mapVM);
  }
}
