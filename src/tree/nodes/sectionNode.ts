import * as vscode from 'vscode';
import { SECTION_ICONS, SECTION_LABELS, DEDICATED_SECTION_KEYS } from '../../constants';
import { HookEventType, NodeContext, ScopedConfig, SectionType } from '../../types';
import { ConfigTreeNode } from './baseNode';
import { EnvVarNode } from './envVarNode';
import { HookEventNode } from './hookEventNode';
import { McpServerNode } from './mcpServerNode';
import { PermissionGroupNode } from './permissionGroupNode';
import { PluginNode } from './pluginNode';
import { SandboxPropertyNode } from './sandboxPropertyNode';
import { SettingNode } from './settingNode';

export class SectionNode extends ConfigTreeNode {
  readonly nodeType: string;

  constructor(
    private readonly sectionType: SectionType,
    private readonly scopedConfig: ScopedConfig,
    private readonly allScopes: ScopedConfig[],
  ) {
    // Plugins section: the JSON key is "enabledPlugins" but SectionType is "plugins".
    // Use the actual JSON key so tree-walk keyPath matching works correctly.
    const jsonKey = sectionType === SectionType.Plugins ? 'enabledPlugins' : sectionType;

    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      section: sectionType,
      keyPath: [jsonKey],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: false,
      filePath: scopedConfig.filePath,
    };

    super(SECTION_LABELS[sectionType], vscode.TreeItemCollapsibleState.Collapsed, ctx);

    this.nodeType = `section.${sectionType}`;
    this.iconPath = new vscode.ThemeIcon(
      SECTION_ICONS[sectionType],
      sectionType === SectionType.Environment
        ? new vscode.ThemeColor('icon.foreground')
        : undefined,
    );
    this.description = this.getItemCount();
    this.finalize();
  }

  getChildren(): ConfigTreeNode[] {
    switch (this.sectionType) {
      case SectionType.Permissions:
        return this.getPermissionChildren();
      case SectionType.Sandbox:
        return this.getSandboxChildren();
      case SectionType.Hooks:
        return this.getHookChildren();
      case SectionType.McpServers:
        return this.getMcpChildren();
      case SectionType.Environment:
        return this.getEnvChildren();
      case SectionType.Plugins:
        return this.getPluginChildren();
      case SectionType.Settings:
        return this.getSettingChildren();
      default:
        return [];
    }
  }

  private getPermissionChildren(): ConfigTreeNode[] {
    const perms = this.scopedConfig.config.permissions;
    if (!perms) return [];

    return [
      new PermissionGroupNode('deny', perms.deny ?? [], this.scopedConfig, this.allScopes),
      new PermissionGroupNode('ask', perms.ask ?? [], this.scopedConfig, this.allScopes),
      new PermissionGroupNode('allow', perms.allow ?? [], this.scopedConfig, this.allScopes),
    ];
  }

  private getSandboxChildren(): ConfigTreeNode[] {
    const sandbox = this.scopedConfig.config.sandbox;
    if (!sandbox) return [];

    const children: ConfigTreeNode[] = [];
    for (const [key, value] of Object.entries(sandbox)) {
      if (key === 'network' && typeof value === 'object' && value !== null) {
        // Flatten network properties
        for (const [netKey, netValue] of Object.entries(value as Record<string, unknown>)) {
          children.push(
            new SandboxPropertyNode(
              `network.${netKey}`,
              netValue,
              this.scopedConfig,
              this.allScopes,
            ),
          );
        }
      } else {
        children.push(
          new SandboxPropertyNode(key, value, this.scopedConfig, this.allScopes),
        );
      }
    }
    return children;
  }

  private getHookChildren(): ConfigTreeNode[] {
    const hooks = this.scopedConfig.config.hooks;
    if (!hooks) return [];

    const children: ConfigTreeNode[] = [];
    for (const eventType of Object.values(HookEventType)) {
      const matchers = hooks[eventType];
      if (matchers && matchers.length > 0) {
        children.push(
          new HookEventNode(eventType, matchers, this.scopedConfig),
        );
      }
    }
    return children;
  }

  private getMcpChildren(): ConfigTreeNode[] {
    const servers = this.scopedConfig.mcpConfig?.mcpServers;
    if (!servers) return [];

    return Object.entries(servers).map(
      ([name, config]) => new McpServerNode(name, config, this.scopedConfig),
    );
  }

  private getEnvChildren(): ConfigTreeNode[] {
    const env = this.scopedConfig.config.env;
    if (!env) return [];

    return Object.entries(env).map(
      ([key, value]) => new EnvVarNode(key, value, this.scopedConfig, this.allScopes),
    );
  }

  private getPluginChildren(): ConfigTreeNode[] {
    const plugins = this.scopedConfig.config.enabledPlugins;
    if (!plugins) return [];

    return Object.entries(plugins).map(
      ([id, enabled]) => new PluginNode(id, enabled, this.scopedConfig, this.allScopes),
    );
  }

  private getSettingChildren(): ConfigTreeNode[] {
    const config = this.scopedConfig.config;
    const children: ConfigTreeNode[] = [];

    for (const [key, value] of Object.entries(config)) {
      if (DEDICATED_SECTION_KEYS.has(key)) continue;
      children.push(
        new SettingNode(key, value, this.scopedConfig, this.allScopes),
      );
    }
    return children;
  }

  private getItemCount(): string {
    switch (this.sectionType) {
      case SectionType.Permissions: {
        const p = this.scopedConfig.config.permissions;
        const count = (p?.allow?.length ?? 0) + (p?.deny?.length ?? 0) + (p?.ask?.length ?? 0);
        return `${count} rule${count !== 1 ? 's' : ''}`;
      }
      case SectionType.Hooks: {
        const h = this.scopedConfig.config.hooks;
        if (!h) return '0 events';
        const count = Object.values(h).filter((v) => v && v.length > 0).length;
        return `${count} event${count !== 1 ? 's' : ''}`;
      }
      case SectionType.McpServers: {
        const s = this.scopedConfig.mcpConfig?.mcpServers;
        const count = s ? Object.keys(s).length : 0;
        return `${count} server${count !== 1 ? 's' : ''}`;
      }
      case SectionType.Environment: {
        const e = this.scopedConfig.config.env;
        const count = e ? Object.keys(e).length : 0;
        return `${count} var${count !== 1 ? 's' : ''}`;
      }
      case SectionType.Plugins: {
        const p = this.scopedConfig.config.enabledPlugins;
        const count = p ? Object.keys(p).length : 0;
        return `${count} plugin${count !== 1 ? 's' : ''}`;
      }
      case SectionType.Sandbox:
        return '';
      case SectionType.Settings: {
        const count = Object.keys(this.scopedConfig.config).filter(
          (k) => !DEDICATED_SECTION_KEYS.has(k),
        ).length;
        return `${count} setting${count !== 1 ? 's' : ''}`;
      }
      default:
        return '';
    }
  }
}
