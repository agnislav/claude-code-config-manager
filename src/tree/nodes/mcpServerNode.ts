import { McpServerVM } from '../../viewmodel/types';
import { ConfigTreeNode } from './baseNode';

export class McpServerNode extends ConfigTreeNode {
  readonly nodeType = 'mcpServer';

  constructor(private readonly vm: McpServerVM) {
    super(vm);
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}
