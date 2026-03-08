import { EnvVarVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class EnvVarNode extends ConfigTreeNode {
  readonly nodeType = 'envVar';

  constructor(private readonly vm: EnvVarVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}
