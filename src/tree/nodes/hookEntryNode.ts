import { HookEntryVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class HookEntryNode extends ConfigTreeNode {
  readonly nodeType = 'hookEntry';

  constructor(private readonly vm: HookEntryVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}
