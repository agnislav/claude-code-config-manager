import { SectionVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class SectionNode extends ConfigTreeNode {
  readonly nodeType: string;

  constructor(private readonly vm: SectionVM) {
    super(vm);
    this.nodeType = `section.${vm.sectionType}`;
  }

  getChildren(): ConfigTreeNode[] {
    return this.vm.children.map(ConfigTreeNode.mapVM);
  }
}
