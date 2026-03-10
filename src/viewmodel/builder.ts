import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import {
  resolveSettingOverlap,
  resolveEnvOverlap,
  resolvePluginOverlap,
  resolveMcpOverlap,
  resolveSandboxOverlap,
  resolvePermissionOverlap,
  getOverlapColor,
} from '../config/overlapResolver';
import { OVERLAP_URI_SCHEME } from '../tree/overlapDecorations';
import {
  DEDICATED_SECTION_KEYS,
  PERMISSION_CATEGORY_ICONS,
  PERMISSION_CATEGORY_LABELS,
  SCOPE_DESCRIPTIONS,
  SCOPE_ICONS,
  SCOPE_LABELS,
  SECTION_ICONS,
  SECTION_LABELS,
} from '../constants';
import { LOCK_URI_SCHEME } from '../tree/lockDecorations';
import { PLUGIN_URI_SCHEME } from '../tree/nodes/pluginNode';
import {
  ConfigScope,
  HookCommand,
  HookEventType,
  HookMatcher,
  McpServerConfig,
  McpServerSse,
  NodeContext,
  OverlapInfo,
  PermissionCategory,
  ScopedConfig,
  SectionType,
} from '../types';
import { PluginMetadataService } from '../utils/pluginMetadata';
import {
  BaseVM,
  EnvVarVM,
  HookEntryVM,
  HookEventVM,
  McpServerVM,
  NodeKind,
  PermissionGroupVM,
  PermissionRuleVM,
  PluginVM,
  SandboxPropertyVM,
  ScopeVM,
  SectionVM,
  SettingKeyValueVM,
  SettingVM,
  WorkspaceFolderVM,
} from './types';

// ── Helpers ──────────────────────────────────────────────────────

function computeId(ctx: NodeContext): string {
  const prefix = ctx.workspaceFolderUri ?? '';
  return `${prefix}/${ctx.scope}/${ctx.keyPath.join('/')}`;
}

function computeStandardContextValue(
  nodeType: string,
  isReadOnly: boolean,
  overlap: OverlapInfo,
): string {
  const parts = [nodeType, isReadOnly ? 'readOnly' : 'editable'];
  if (overlap.isOverriddenBy) parts.push('overridden');
  return parts.join('.');
}

function computeCommand(
  collapsibleState: vscode.TreeItemCollapsibleState,
  filePath: string | undefined,
  keyPath: string[],
): vscode.Command | undefined {
  if (
    collapsibleState !== vscode.TreeItemCollapsibleState.None ||
    !filePath ||
    keyPath.length === 0
  ) {
    return undefined;
  }
  return {
    command: 'claudeConfig.revealInFile',
    title: 'Reveal in Config File',
    arguments: [filePath, keyPath],
  };
}

function buildOverlapTooltip(
  existingTooltip: string | vscode.MarkdownString | undefined,
  overlap: OverlapInfo,
): string | vscode.MarkdownString | undefined {
  const lines: string[] = [];
  if (overlap.isOverriddenBy) {
    lines.push(
      `$(arrow-down) **Overridden by** ${SCOPE_LABELS[overlap.isOverriddenBy.scope]}: \`${formatValue(overlap.isOverriddenBy.value)}\` (effective)`,
    );
  }
  if (overlap.isDuplicatedBy) {
    lines.push(
      `$(arrow-down) **Duplicated by** ${SCOPE_LABELS[overlap.isDuplicatedBy.scope]}: \`${formatValue(overlap.isDuplicatedBy.value)}\` (effective)`,
    );
  }
  if (overlap.overrides) {
    lines.push(
      `$(arrow-up) **Overrides** ${SCOPE_LABELS[overlap.overrides.scope]}: \`${formatValue(overlap.overrides.value)}\``,
    );
  }
  if (overlap.duplicates) {
    lines.push(
      `$(arrow-up) **Duplicates** ${SCOPE_LABELS[overlap.duplicates.scope]}: \`${formatValue(overlap.duplicates.value)}\``,
    );
  }
  if (lines.length === 0) return existingTooltip;
  const overlapSection = lines.join('\n\n');
  const createMd = (text: string): vscode.MarkdownString => {
    const md = new vscode.MarkdownString(text);
    md.supportThemeIcons = true;
    return md;
  };
  if (existingTooltip instanceof vscode.MarkdownString) {
    const md = createMd(existingTooltip.value + '\n\n---\n\n' + overlapSection);
    md.supportHtml = existingTooltip.supportHtml;
    return md;
  }
  if (typeof existingTooltip === 'string') {
    return createMd(existingTooltip + '\n\n---\n\n' + overlapSection);
  }
  return createMd(overlapSection);
}

function applyOverrideSuffix(description: string, overlap: OverlapInfo): string {
  if (overlap.isOverriddenBy) {
    return `${description} (overridden by ${SCOPE_LABELS[overlap.isOverriddenBy.scope]})`.trim();
  }
  return description;
}

function buildOverlapResourceUri(
  scope: ConfigScope,
  entityType: string,
  entityKey: string,
  overlap: OverlapInfo,
): vscode.Uri | undefined {
  const color = getOverlapColor(overlap);
  if (color === 'none') return undefined;
  return vscode.Uri.from({
    scheme: OVERLAP_URI_SCHEME,
    path: `/${scope}/${entityType}/${entityKey}`,
    query: color,
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return `{${Object.keys(value).length} keys}`;
  return String(value);
}

function formatSandboxValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.length} items]`;
  return JSON.stringify(value);
}

function getShortPath(filePath: string | undefined): string {
  if (!filePath) return '';
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  if (home && filePath.startsWith(home)) {
    return '~' + filePath.substring(home.length);
  }
  return filePath;
}

function isSseConfig(config: McpServerConfig): config is McpServerSse {
  return 'type' in config && (config as McpServerSse).type === 'sse';
}

// ── Builder ──────────────────────────────────────────────────────

export class TreeViewModelBuilder {
  constructor(private readonly configStore: ConfigStore) {}

  build(sectionFilter?: ReadonlySet<SectionType>): BaseVM[] {
    if (this.configStore.isMultiRoot()) {
      return this.buildMultiRoot(sectionFilter);
    }
    return this.buildSingleRoot(sectionFilter);
  }

  // ── Root builders ────────────────────────────────────────────

  private buildSingleRoot(sectionFilter?: ReadonlySet<SectionType>): ScopeVM[] {
    const keys = this.configStore.getWorkspaceFolderKeys();
    if (keys.length === 0) return [];

    const key = keys[0];
    const allScopes = this.configStore.getAllScopes(key);

    return allScopes
      .filter((s) => s.scope !== ConfigScope.Managed)
      .map((sc) => {
        const locked = this.configStore.isScopeLocked(sc.scope);
        const effective: ScopedConfig =
          locked && !sc.isReadOnly ? { ...sc, isReadOnly: true } : sc;
        return this.buildScopeVM(effective, allScopes, key, sectionFilter);
      });
  }

  private buildMultiRoot(sectionFilter?: ReadonlySet<SectionType>): WorkspaceFolderVM[] {
    const result: WorkspaceFolderVM[] = [];

    for (const key of this.configStore.getWorkspaceFolderKeys()) {
      const allScopes = this.configStore.getAllScopes(key);
      const discovered = this.configStore.getDiscoveredPaths(key);
      const folderName = discovered?.workspaceFolder?.name ?? key;

      const ctx: NodeContext = {
        scope: ConfigScope.User, // placeholder
        keyPath: [],
        isReadOnly: false,
        overlap: {},
        workspaceFolderUri: key,
      };

      const scopeChildren = allScopes
        .filter((s) => s.scope !== ConfigScope.Managed)
        .map((sc) => {
          const locked = this.configStore.isScopeLocked(sc.scope);
          const effective: ScopedConfig =
            locked && !sc.isReadOnly ? { ...sc, isReadOnly: true } : sc;
          return this.buildScopeVM(effective, allScopes, key, sectionFilter);
        });

      result.push({
        kind: NodeKind.WorkspaceFolder,
        label: folderName,
        description: '',
        icon: new vscode.ThemeIcon('root-folder'),
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        contextValue: 'workspaceFolder',
        tooltip: undefined,
        nodeContext: ctx,
        children: scopeChildren,
        id: computeId(ctx),
      });
    }

    return result;
  }

  // ── Scope VM ─────────────────────────────────────────────────

  private buildScopeVM(
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
    workspaceFolderUri: string,
    sectionFilter?: ReadonlySet<SectionType>,
  ): ScopeVM {
    const { scope, filePath, fileExists, isReadOnly } = scopedConfig;

    const ctx: NodeContext = {
      scope,
      keyPath: [],
      isReadOnly,
      overlap: {},
      workspaceFolderUri,
      filePath,
    };

    const isProjectScope =
      scope === ConfigScope.ProjectShared || scope === ConfigScope.ProjectLocal;
    const description = fileExists
      ? isProjectScope && filePath
        ? vscode.workspace.asRelativePath(filePath, false)
        : getShortPath(filePath)
      : 'Not found';

    // Scope contextValue: scope.{scopeName}.{editable|readOnly}[.missing]
    const editability = isReadOnly ? 'readOnly' : 'editable';
    const cvParts = [`scope.${scope}`, editability];
    if (!fileExists) cvParts.push('missing');
    const contextValue = cvParts.join('.');

    // resourceUri for lock dimming (User scope only)
    let resourceUri: vscode.Uri | undefined;
    if (scope === ConfigScope.User) {
      resourceUri = vscode.Uri.from({
        scheme: LOCK_URI_SCHEME,
        path: '/user',
        query: isReadOnly ? 'locked' : 'unlocked',
      });
    }

    const children =
      fileExists || scope === ConfigScope.Managed
        ? this.buildSections(scopedConfig, allScopes, sectionFilter)
        : [];

    return {
      kind: NodeKind.Scope,
      label: SCOPE_LABELS[scope],
      description,
      icon: new vscode.ThemeIcon(SCOPE_ICONS[scope]),
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue,
      tooltip: new vscode.MarkdownString(SCOPE_DESCRIPTIONS[scope]),
      nodeContext: ctx,
      children,
      id: computeId(ctx),
      resourceUri,
    };
  }

  // ── Section builders ─────────────────────────────────────────

  private buildSections(
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
    sectionFilter?: ReadonlySet<SectionType>,
  ): SectionVM[] {
    const config = scopedConfig.config;
    const isFiltered = sectionFilter && sectionFilter.size > 0;
    const sections: SectionVM[] = [];

    if (config.permissions && (!isFiltered || sectionFilter!.has(SectionType.Permissions))) {
      sections.push(this.buildSectionVM(SectionType.Permissions, scopedConfig, allScopes));
    }
    if (config.sandbox && (!isFiltered || sectionFilter!.has(SectionType.Sandbox))) {
      sections.push(this.buildSectionVM(SectionType.Sandbox, scopedConfig, allScopes));
    }
    if (
      config.hooks &&
      Object.keys(config.hooks).length > 0 &&
      (!isFiltered || sectionFilter!.has(SectionType.Hooks))
    ) {
      sections.push(this.buildSectionVM(SectionType.Hooks, scopedConfig, allScopes));
    }
    if (
      scopedConfig.mcpConfig?.mcpServers &&
      Object.keys(scopedConfig.mcpConfig.mcpServers).length > 0 &&
      (!isFiltered || sectionFilter!.has(SectionType.McpServers))
    ) {
      sections.push(this.buildSectionVM(SectionType.McpServers, scopedConfig, allScopes));
    }
    if (
      config.env &&
      Object.keys(config.env).length > 0 &&
      (!isFiltered || sectionFilter!.has(SectionType.Environment))
    ) {
      sections.push(this.buildSectionVM(SectionType.Environment, scopedConfig, allScopes));
    }
    if (
      config.enabledPlugins &&
      Object.keys(config.enabledPlugins).length > 0 &&
      (!isFiltered || sectionFilter!.has(SectionType.Plugins))
    ) {
      sections.push(this.buildSectionVM(SectionType.Plugins, scopedConfig, allScopes));
    }
    const settingsKeys = Object.keys(config).filter((k) => !DEDICATED_SECTION_KEYS.has(k));
    if (settingsKeys.length > 0 && (!isFiltered || sectionFilter!.has(SectionType.Settings))) {
      sections.push(this.buildSectionVM(SectionType.Settings, scopedConfig, allScopes));
    }

    return sections;
  }

  private buildSectionVM(
    sectionType: SectionType,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ): SectionVM {
    const jsonKey = sectionType === SectionType.Plugins ? 'enabledPlugins' : sectionType;
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      section: sectionType,
      keyPath: [jsonKey],
      isReadOnly: scopedConfig.isReadOnly,
      overlap: {},
      filePath: scopedConfig.filePath,
    };

    const children = this.buildSectionChildren(sectionType, scopedConfig, allScopes);
    const description = this.getSectionItemCount(sectionType, scopedConfig);

    return {
      kind: NodeKind.Section,
      sectionType,
      label: SECTION_LABELS[sectionType],
      description,
      icon: new vscode.ThemeIcon(SECTION_ICONS[sectionType]),
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: computeStandardContextValue(`section.${sectionType}`, scopedConfig.isReadOnly, {}),
      tooltip: undefined,
      nodeContext: ctx,
      children,
      id: computeId(ctx),
    };
  }

  private buildSectionChildren(
    sectionType: SectionType,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ): BaseVM[] {
    switch (sectionType) {
      case SectionType.Permissions:
        return this.buildPermissionGroups(scopedConfig, allScopes);
      case SectionType.Sandbox:
        return this.buildSandboxProperties(scopedConfig, allScopes);
      case SectionType.Hooks:
        return this.buildHookEvents(scopedConfig);
      case SectionType.McpServers:
        return this.buildMcpServers(scopedConfig, allScopes);
      case SectionType.Environment:
        return this.buildEnvVars(scopedConfig, allScopes);
      case SectionType.Plugins:
        return this.buildPlugins(scopedConfig, allScopes);
      case SectionType.Settings:
        return this.buildSettings(scopedConfig, allScopes);
      default:
        return [];
    }
  }

  // ── Permissions ──────────────────────────────────────────────

  private buildPermissionGroups(
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ): PermissionGroupVM[] {
    const perms = scopedConfig.config.permissions;
    if (!perms) return [];

    return (['deny', 'ask', 'allow'] as const).map((category) => {
      const rules = perms[category] ?? [];
      const ctx: NodeContext = {
        scope: scopedConfig.scope,
        section: undefined,
        keyPath: ['permissions', category],
        isReadOnly: scopedConfig.isReadOnly,
        overlap: {},
        filePath: scopedConfig.filePath,
      };

      const seen = new Set<string>();
      const ruleChildren = rules
        .filter((rule) => {
          if (seen.has(rule)) return false;
          seen.add(rule);
          return true;
        })
        .map((rule) =>
          this.buildPermissionRule(rule, category as PermissionCategory, scopedConfig, allScopes),
        );

      const collapsibleState =
        rules.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None;

      return {
        kind: NodeKind.PermissionGroup,
        category,
        label: PERMISSION_CATEGORY_LABELS[category] ?? category,
        description: `${rules.length} rule${rules.length !== 1 ? 's' : ''}`,
        icon: new vscode.ThemeIcon(PERMISSION_CATEGORY_ICONS[category] ?? 'circle'),
        collapsibleState,
        contextValue: computeStandardContextValue('permissionGroup', scopedConfig.isReadOnly, {}),
        tooltip: undefined,
        nodeContext: ctx,
        children: ruleChildren,
        id: computeId(ctx),
      };
    });
  }

  private buildPermissionRule(
    rule: string,
    category: PermissionCategory,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ): PermissionRuleVM {
    const overlap = resolvePermissionOverlap(category, rule, scopedConfig.scope, allScopes);
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['permissions', category, rule],
      isReadOnly: scopedConfig.isReadOnly,
      overlap,
      filePath: scopedConfig.filePath,
    };

    let tooltip: string | vscode.MarkdownString | undefined;
    if (overlap.isOverriddenBy && overlap.overriddenByCategory) {
      const scopeLabel = SCOPE_LABELS[overlap.isOverriddenBy.scope];
      tooltip = new vscode.MarkdownString(
        `$(warning) This **${category}** rule is overridden by a **${overlap.overriddenByCategory}** rule in **${scopeLabel}**`,
      );
    }
    tooltip = buildOverlapTooltip(tooltip, overlap);

    const description = applyOverrideSuffix('', overlap);
    const collapsibleState = vscode.TreeItemCollapsibleState.None;
    const hasOverlap = overlap.isOverriddenBy || overlap.isDuplicatedBy;

    return {
      kind: NodeKind.PermissionRule,
      rule,
      overriddenByCategory: overlap.overriddenByCategory,
      label: rule,
      description,
      icon: new vscode.ThemeIcon(
        'symbol-event',
        new vscode.ThemeColor(hasOverlap ? 'disabledForeground' : 'icon.foreground'),
      ),
      collapsibleState,
      contextValue: computeStandardContextValue('permissionRule', scopedConfig.isReadOnly, overlap),
      tooltip,
      nodeContext: ctx,
      children: [],
      id: computeId(ctx),
      command: computeCommand(collapsibleState, ctx.filePath, ctx.keyPath),
      resourceUri: buildOverlapResourceUri(scopedConfig.scope, 'permission', `${category}/${rule}`, overlap),
    };
  }

  // ── Settings ─────────────────────────────────────────────────

  private buildSettings(scopedConfig: ScopedConfig, allScopes: ScopedConfig[]): SettingVM[] {
    const config = scopedConfig.config;
    const result: SettingVM[] = [];

    for (const [key, value] of Object.entries(config)) {
      if (DEDICATED_SECTION_KEYS.has(key)) continue;
      result.push(this.buildSettingVM(key, value, scopedConfig, allScopes));
    }
    return result;
  }

  private buildSettingVM(
    key: string,
    value: unknown,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ): SettingVM {
    const overlap = resolveSettingOverlap(key, scopedConfig.scope, allScopes);
    const isExpandableObject =
      typeof value === 'object' && value !== null && !Array.isArray(value);
    const collapsibleState = isExpandableObject
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: [key],
      isReadOnly: scopedConfig.isReadOnly,
      overlap,
      filePath: scopedConfig.filePath,
    };

    const rawDescription = isExpandableObject ? '' : formatValue(value);
    const description = applyOverrideSuffix(rawDescription, overlap);

    let tooltip: string | vscode.MarkdownString | undefined;
    if (typeof value === 'object' && value !== null) {
      tooltip = new vscode.MarkdownString('```json\n' + JSON.stringify(value, null, 2) + '\n```');
    }
    tooltip = buildOverlapTooltip(tooltip, overlap);

    const children = isExpandableObject
      ? Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) =>
          this.buildSettingKeyValueVM(key, childKey, childValue, scopedConfig, allScopes),
        )
      : [];

    return {
      kind: NodeKind.Setting,
      key,
      value,
      label: key,
      description,
      icon: overlap.isOverriddenBy
        ? new vscode.ThemeIcon('tools', new vscode.ThemeColor('disabledForeground'))
        : new vscode.ThemeIcon('tools'),
      collapsibleState,
      contextValue: computeStandardContextValue('setting', scopedConfig.isReadOnly, overlap),
      tooltip,
      nodeContext: ctx,
      children,
      id: computeId(ctx),
      command: computeCommand(collapsibleState, ctx.filePath, ctx.keyPath),
      resourceUri: buildOverlapResourceUri(scopedConfig.scope, 'setting', key, overlap),
    };
  }

  private buildSettingKeyValueVM(
    parentKey: string,
    childKey: string,
    value: unknown,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ): SettingKeyValueVM {
    const overlap = resolveSettingOverlap(parentKey, scopedConfig.scope, allScopes);
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: [parentKey, childKey],
      isReadOnly: scopedConfig.isReadOnly,
      overlap,
      filePath: scopedConfig.filePath,
    };

    const rawDescription = formatValue(value);
    const description = applyOverrideSuffix(rawDescription, overlap);

    let tooltip: string | vscode.MarkdownString | undefined;
    if (typeof value === 'object' && value !== null) {
      tooltip = new vscode.MarkdownString('```json\n' + JSON.stringify(value, null, 2) + '\n```');
    }
    tooltip = buildOverlapTooltip(tooltip, overlap);

    const collapsibleState = vscode.TreeItemCollapsibleState.None;

    return {
      kind: NodeKind.SettingKeyValue,
      parentKey,
      childKey,
      value,
      label: childKey,
      description,
      icon: new vscode.ThemeIcon(
        'symbol-field',
        new vscode.ThemeColor(overlap.isOverriddenBy ? 'disabledForeground' : 'icon.foreground'),
      ),
      collapsibleState,
      contextValue: computeStandardContextValue('settingKeyValue', scopedConfig.isReadOnly, overlap),
      tooltip,
      nodeContext: ctx,
      children: [],
      id: computeId(ctx),
      command: computeCommand(collapsibleState, ctx.filePath, ctx.keyPath),
      resourceUri: buildOverlapResourceUri(scopedConfig.scope, 'settingKeyValue', `${parentKey}.${childKey}`, overlap),
    };
  }

  // ── Environment ──────────────────────────────────────────────

  private buildEnvVars(scopedConfig: ScopedConfig, allScopes: ScopedConfig[]): EnvVarVM[] {
    const env = scopedConfig.config.env;
    if (!env) return [];

    return Object.entries(env).map(([key, value]) => {
      const overlap = resolveEnvOverlap(key, scopedConfig.scope, allScopes);
      const ctx: NodeContext = {
        scope: scopedConfig.scope,
        keyPath: ['env', key],
        isReadOnly: scopedConfig.isReadOnly,
        overlap,
        filePath: scopedConfig.filePath,
      };

      const description = applyOverrideSuffix(value, overlap);
      const collapsibleState = vscode.TreeItemCollapsibleState.None;

      return {
        kind: NodeKind.EnvVar as const,
        envKey: key,
        envValue: value,
        label: key,
        description,
        icon: overlap.isOverriddenBy
          ? new vscode.ThemeIcon('terminal', new vscode.ThemeColor('disabledForeground'))
          : new vscode.ThemeIcon('terminal'),
        collapsibleState,
        contextValue: computeStandardContextValue('envVar', scopedConfig.isReadOnly, overlap),
        tooltip: buildOverlapTooltip(undefined, overlap),
        nodeContext: ctx,
        children: [],
        id: computeId(ctx),
        command: computeCommand(collapsibleState, ctx.filePath, ctx.keyPath),
        resourceUri: buildOverlapResourceUri(scopedConfig.scope, 'env', key, overlap),
      };
    });
  }

  // ── Plugins ──────────────────────────────────────────────────

  private buildPlugins(scopedConfig: ScopedConfig, allScopes: ScopedConfig[]): PluginVM[] {
    const plugins = scopedConfig.config.enabledPlugins;
    if (!plugins) return [];

    return Object.entries(plugins).map(([pluginId, enabled]) => {
      const overlap = resolvePluginOverlap(pluginId, scopedConfig.scope, allScopes);
      const ctx: NodeContext = {
        scope: scopedConfig.scope,
        keyPath: ['enabledPlugins', pluginId],
        isReadOnly: scopedConfig.isReadOnly,
        overlap,
        filePath: scopedConfig.filePath,
      };

      // Parse display name: split at '@' (handle scoped packages)
      const splitIndex = pluginId.startsWith('@')
        ? pluginId.indexOf('@', 1)
        : pluginId.indexOf('@');
      const hasVersion = splitIndex > 0;
      const displayName = hasVersion ? pluginId.substring(0, splitIndex) : pluginId;
      const versionSuffix = hasVersion ? pluginId.substring(splitIndex) : '';

      const rawDescription = versionSuffix || '';
      const description = applyOverrideSuffix(rawDescription, overlap);

      // Plugin tooltip: description from metadata + overlap info
      const pluginDescription = PluginMetadataService.getInstance().getDescription(pluginId);
      const baseTooltip = pluginDescription
        ? new vscode.MarkdownString(pluginDescription)
        : undefined;
      const tooltip = buildOverlapTooltip(baseTooltip, overlap);

      const collapsibleState = vscode.TreeItemCollapsibleState.None;

      // Overlap resourceUri takes precedence over plugin disabled decoration
      const overlapColor = getOverlapColor(overlap);
      const resourceUri =
        overlapColor !== 'none'
          ? buildOverlapResourceUri(scopedConfig.scope, 'plugin', pluginId, overlap)
          : vscode.Uri.from({
              scheme: PLUGIN_URI_SCHEME,
              path: `/${scopedConfig.scope}/${pluginId}`,
              query: enabled ? 'enabled' : 'disabled',
            });

      return {
        kind: NodeKind.Plugin as const,
        pluginId,
        enabled,
        label: displayName,
        description,
        icon: scopedConfig.isReadOnly
          ? (enabled
              ? new vscode.ThemeIcon('check')
              : new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground')))
          : undefined,
        collapsibleState,
        contextValue: computeStandardContextValue('plugin', scopedConfig.isReadOnly, overlap),
        tooltip,
        nodeContext: ctx,
        children: [],
        id: computeId(ctx),
        ...(!scopedConfig.isReadOnly
          ? { checkboxState: enabled
              ? vscode.TreeItemCheckboxState.Checked
              : vscode.TreeItemCheckboxState.Unchecked }
          : {}),
        resourceUri,
        command: computeCommand(collapsibleState, ctx.filePath, ctx.keyPath),
      };
    });
  }

  // ── Sandbox ──────────────────────────────────────────────────

  private buildSandboxProperties(
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ): SandboxPropertyVM[] {
    const sandbox = scopedConfig.config.sandbox;
    if (!sandbox) return [];

    const result: SandboxPropertyVM[] = [];
    for (const [key, value] of Object.entries(sandbox)) {
      if (key === 'network' && typeof value === 'object' && value !== null) {
        for (const [netKey, netValue] of Object.entries(value as Record<string, unknown>)) {
          result.push(
            this.buildSandboxPropertyVM(`network.${netKey}`, netValue, scopedConfig, allScopes),
          );
        }
      } else {
        result.push(this.buildSandboxPropertyVM(key, value, scopedConfig, allScopes));
      }
    }
    return result;
  }

  private buildSandboxPropertyVM(
    key: string,
    value: unknown,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ): SandboxPropertyVM {
    const overlap = resolveSandboxOverlap(key, scopedConfig.scope, allScopes);
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['sandbox', ...key.split('.')],
      isReadOnly: scopedConfig.isReadOnly,
      overlap,
      filePath: scopedConfig.filePath,
    };

    const rawDescription = formatSandboxValue(value);
    const description = applyOverrideSuffix(rawDescription, overlap);

    let tooltip: string | vscode.MarkdownString | undefined;
    if (Array.isArray(value)) {
      tooltip = new vscode.MarkdownString(value.map((v) => `- \`${v}\``).join('\n'));
    }
    tooltip = buildOverlapTooltip(tooltip, overlap);

    const collapsibleState = vscode.TreeItemCollapsibleState.None;

    return {
      kind: NodeKind.SandboxProperty,
      propertyKey: key,
      propertyValue: value,
      label: key,
      description,
      icon: overlap.isOverriddenBy
        ? new vscode.ThemeIcon('vm', new vscode.ThemeColor('disabledForeground'))
        : new vscode.ThemeIcon('vm'),
      collapsibleState,
      contextValue: computeStandardContextValue('sandboxProperty', scopedConfig.isReadOnly, overlap),
      tooltip,
      nodeContext: ctx,
      children: [],
      id: computeId(ctx),
      command: computeCommand(collapsibleState, ctx.filePath, ctx.keyPath),
      resourceUri: buildOverlapResourceUri(scopedConfig.scope, 'sandbox', key, overlap),
    };
  }

  // ── MCP Servers ──────────────────────────────────────────────

  private buildMcpServers(
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ): McpServerVM[] {
    const servers = scopedConfig.mcpConfig?.mcpServers;
    if (!servers) return [];

    return Object.entries(servers).map(([name, config]) => {
      const overlap = resolveMcpOverlap(name, scopedConfig.scope, allScopes);
      const ctx: NodeContext = {
        scope: scopedConfig.scope,
        keyPath: ['mcpServers', name],
        isReadOnly: scopedConfig.isReadOnly,
        overlap,
        filePath: scopedConfig.mcpFilePath ?? scopedConfig.filePath,
      };

      let description: string;
      let baseTooltip: vscode.MarkdownString;
      if (isSseConfig(config)) {
        description = `sse: ${config.url}`;
        baseTooltip = new vscode.MarkdownString(`**SSE Server**\n\nURL: \`${config.url}\``);
      } else {
        const cmd = [config.command, ...(config.args ?? [])].join(' ');
        description = `stdio: ${config.command}`;
        baseTooltip = new vscode.MarkdownString(`**Stdio Server**\n\nCommand: \`${cmd}\``);
      }

      description = applyOverrideSuffix(description, overlap);
      const tooltip = buildOverlapTooltip(baseTooltip, overlap);

      const collapsibleState = vscode.TreeItemCollapsibleState.None;

      return {
        kind: NodeKind.McpServer as const,
        serverName: name,
        label: name,
        description,
        icon: overlap.isOverriddenBy
          ? new vscode.ThemeIcon('plug', new vscode.ThemeColor('disabledForeground'))
          : new vscode.ThemeIcon('plug'),
        collapsibleState,
        contextValue: computeStandardContextValue('mcpServer', scopedConfig.isReadOnly, overlap),
        tooltip,
        nodeContext: ctx,
        children: [],
        id: computeId(ctx),
        command: computeCommand(collapsibleState, ctx.filePath, ctx.keyPath),
        resourceUri: buildOverlapResourceUri(scopedConfig.scope, 'mcpServer', name, overlap),
      };
    });
  }

  // ── Hooks ────────────────────────────────────────────────────

  private buildHookEvents(scopedConfig: ScopedConfig): HookEventVM[] {
    const hooks = scopedConfig.config.hooks;
    if (!hooks) return [];

    const result: HookEventVM[] = [];
    for (const eventType of Object.values(HookEventType)) {
      const matchers = hooks[eventType];
      if (matchers && matchers.length > 0) {
        result.push(this.buildHookEventVM(eventType, matchers, scopedConfig));
      }
    }
    return result;
  }

  private buildHookEventVM(
    eventType: HookEventType,
    matchers: HookMatcher[],
    scopedConfig: ScopedConfig,
  ): HookEventVM {
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['hooks', eventType],
      isReadOnly: scopedConfig.isReadOnly,
      overlap: {},
      filePath: scopedConfig.filePath,
    };

    const hookCount = matchers.reduce((sum, m) => sum + m.hooks.length, 0);
    const entryChildren: HookEntryVM[] = [];

    for (let i = 0; i < matchers.length; i++) {
      const matcher = matchers[i];
      for (let j = 0; j < matcher.hooks.length; j++) {
        const hook = matcher.hooks[j];
        const label = matcher.matcher
          ? `[${matcher.matcher}] ${hook.command ?? hook.prompt ?? hook.type}`
          : hook.command ?? hook.prompt ?? hook.type;
        entryChildren.push(this.buildHookEntryVM(label, eventType, i, j, hook, scopedConfig));
      }
    }

    return {
      kind: NodeKind.HookEvent,
      eventType,
      label: eventType,
      description: `${hookCount} hook${hookCount !== 1 ? 's' : ''}`,
      icon: new vscode.ThemeIcon('zap'),
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: computeStandardContextValue('hookEvent', scopedConfig.isReadOnly, {}),
      tooltip: undefined,
      nodeContext: ctx,
      children: entryChildren,
      id: computeId(ctx),
    };
  }

  private buildHookEntryVM(
    label: string,
    eventType: HookEventType,
    matcherIndex: number,
    hookIndex: number,
    hook: HookCommand,
    scopedConfig: ScopedConfig,
  ): HookEntryVM {
    const ctx: NodeContext = {
      scope: scopedConfig.scope,
      keyPath: ['hooks', eventType, String(matcherIndex), 'hooks', String(hookIndex)],
      isReadOnly: scopedConfig.isReadOnly,
      overlap: {},
      filePath: scopedConfig.filePath,
    };

    const iconMap: Record<string, string> = {
      command: 'terminal',
      prompt: 'comment-discussion',
      agent: 'hubot',
    };

    const tooltip = hook.command
      ? new vscode.MarkdownString(`\`${hook.command}\``)
      : undefined;

    const collapsibleState = vscode.TreeItemCollapsibleState.None;

    return {
      kind: NodeKind.HookEntry,
      hookType: hook.type,
      matcherIndex,
      hookIndex,
      label,
      description: '',
      icon: new vscode.ThemeIcon(iconMap[hook.type] ?? 'terminal'),
      collapsibleState,
      contextValue: computeStandardContextValue('hookEntry', scopedConfig.isReadOnly, {}),
      tooltip,
      nodeContext: ctx,
      children: [],
      id: computeId(ctx),
      command: computeCommand(collapsibleState, ctx.filePath, ctx.keyPath),
    };
  }

  // ── Section item counts ──────────────────────────────────────

  private getSectionItemCount(sectionType: SectionType, scopedConfig: ScopedConfig): string {
    switch (sectionType) {
      case SectionType.Permissions: {
        const p = scopedConfig.config.permissions;
        const count = (p?.allow?.length ?? 0) + (p?.deny?.length ?? 0) + (p?.ask?.length ?? 0);
        return `${count} rule${count !== 1 ? 's' : ''}`;
      }
      case SectionType.Hooks: {
        const h = scopedConfig.config.hooks;
        if (!h) return '0 events';
        const count = Object.values(h).filter((v) => v && v.length > 0).length;
        return `${count} event${count !== 1 ? 's' : ''}`;
      }
      case SectionType.McpServers: {
        const s = scopedConfig.mcpConfig?.mcpServers;
        const count = s ? Object.keys(s).length : 0;
        return `${count} server${count !== 1 ? 's' : ''}`;
      }
      case SectionType.Environment: {
        const e = scopedConfig.config.env;
        const count = e ? Object.keys(e).length : 0;
        return `${count} var${count !== 1 ? 's' : ''}`;
      }
      case SectionType.Plugins: {
        const p = scopedConfig.config.enabledPlugins;
        const count = p ? Object.keys(p).length : 0;
        return `${count} plugin${count !== 1 ? 's' : ''}`;
      }
      case SectionType.Sandbox:
        return '';
      case SectionType.Settings: {
        const count = Object.keys(scopedConfig.config).filter(
          (k) => !DEDICATED_SECTION_KEYS.has(k),
        ).length;
        return `${count} setting${count !== 1 ? 's' : ''}`;
      }
      default:
        return '';
    }
  }
}
