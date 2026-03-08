import { SettingKeyValueVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class SettingKeyValueNode extends ConfigTreeNode {
  readonly nodeType = 'settingKeyValue';

  constructor(private readonly vm: SettingKeyValueVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}
