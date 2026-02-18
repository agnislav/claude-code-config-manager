import * as vscode from 'vscode';
import { McpServerConfig, McpServerSse, NodeContext, ScopedConfig } from '../../types';
import { ConfigTreeNode } from './baseNode';

export class McpServerNode extends ConfigTreeNode {
  readonly nodeType = 'mcpServer';

  constructor(
    private readonly serverName: string,
    private readonly serverConfig: McpServerConfig,
    scopedConfig: ScopedConfig,
  ) {
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['mcpServers', serverName],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: false,
      filePath: scopedConfig.mcpFilePath ?? scopedConfig.filePath,
    };

    super(serverName, vscode.TreeItemCollapsibleState.None, ctx);

    this.iconPath = new vscode.ThemeIcon('plug');

    if (isSseConfig(serverConfig)) {
      this.description = `sse: ${serverConfig.url}`;
      this.tooltip = new vscode.MarkdownString(`**SSE Server**\n\nURL: \`${serverConfig.url}\``);
    } else {
      const cmd = [serverConfig.command, ...(serverConfig.args ?? [])].join(' ');
      this.description = `stdio: ${serverConfig.command}`;
      this.tooltip = new vscode.MarkdownString(`**Stdio Server**\n\nCommand: \`${cmd}\``);
    }
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}

function isSseConfig(config: McpServerConfig): config is McpServerSse {
  return 'type' in config && (config as McpServerSse).type === 'sse';
}
