import { SettingVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class SettingNode extends ConfigTreeNode {
  readonly nodeType = 'setting';

  constructor(private readonly vm: SettingVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return this.vm.children.map(ConfigTreeNode.mapVM);
  }
}
