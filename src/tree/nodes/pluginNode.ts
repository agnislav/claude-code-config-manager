import * as vscode from 'vscode';
import { SCOPE_LABELS } from '../../constants';
import { NodeContext, ScopedConfig } from '../../types';
import { resolvePluginOverride } from '../../config/overrideResolver';
import { PluginMetadataService } from '../../utils/pluginMetadata';
import { ConfigTreeNode } from './baseNode';

export const PLUGIN_URI_SCHEME = 'claude-config-plugin';

export class PluginNode extends ConfigTreeNode {
  readonly nodeType = 'plugin';
  private readonly _pluginDescription: string | undefined;

  constructor(
    private readonly pluginId: string,
    private readonly enabled: boolean,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ) {
    const override = resolvePluginOverride(pluginId, scopedConfig.scope, allScopes);

    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['enabledPlugins', pluginId],
      isReadOnly: scopedConfig.isReadOnly,
      isOverridden: override.isOverridden,
      overriddenByScope: override.overriddenByScope,
      filePath: scopedConfig.filePath,
    };

    // Split at '@': name part → label, @version → description prefix
    // For scoped IDs like "@scope/name@1.0", split at the second '@'
    const splitIndex = pluginId.startsWith('@')
      ? pluginId.indexOf('@', 1)
      : pluginId.indexOf('@');
    const hasVersion = splitIndex > 0;
    const displayName = hasVersion ? pluginId.substring(0, splitIndex) : pluginId;
    const versionSuffix = hasVersion ? pluginId.substring(splitIndex) : '';

    super(displayName, vscode.TreeItemCollapsibleState.None, ctx);

    // Native checkbox — click toggles without selecting the row
    this.checkboxState = enabled
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;

    this.description = versionSuffix || '';

    // Custom URI for FileDecorationProvider to dim disabled plugin labels
    this.resourceUri = vscode.Uri.from({
      scheme: PLUGIN_URI_SCHEME,
      path: `/${scopedConfig.scope}/${pluginId}`,
      query: enabled ? 'enabled' : 'disabled',
    });

    this._pluginDescription = PluginMetadataService.getInstance().getDescription(pluginId);
    this.finalize();
  }

  protected override computeTooltip(): string | vscode.MarkdownString | undefined {
    const lines: string[] = [];

    if (this._pluginDescription) {
      lines.push(this._pluginDescription);
    }

    if (this.nodeContext.isOverridden && this.nodeContext.overriddenByScope) {
      if (lines.length > 0) lines.push('');
      const scopeLabel = SCOPE_LABELS[this.nodeContext.overriddenByScope];
      lines.push(`$(warning) Overridden by **${scopeLabel}**`);
    }

    if (lines.length === 0) return undefined;
    return new vscode.MarkdownString(lines.join('\n'));
  }

  getChildren(): ConfigTreeNode[] {
    return [];
  }
}

export class PluginDecorationProvider implements vscode.FileDecorationProvider {
  readonly onDidChangeFileDecorations = undefined;

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== PLUGIN_URI_SCHEME) return undefined;

    if (uri.query === 'disabled') {
      return {
        color: new vscode.ThemeColor('disabledForeground'),
      };
    }
    return undefined;
  }
}
