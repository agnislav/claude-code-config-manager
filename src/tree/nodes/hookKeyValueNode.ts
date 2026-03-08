import { HookKeyValueVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class HookKeyValueNode extends ConfigTreeNode {
  readonly nodeType = 'hookKeyValue';

  constructor(private readonly vm: HookKeyValueVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}
