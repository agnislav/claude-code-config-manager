import { HookEventVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class HookEventNode extends ConfigTreeNode {
  readonly nodeType = 'hookEvent';

  constructor(private readonly vm: HookEventVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return this.vm.children.map(ConfigTreeNode.mapVM);
  }
}
