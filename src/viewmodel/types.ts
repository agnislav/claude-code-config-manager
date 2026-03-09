import * as vscode from 'vscode';
import { HookEventType, NodeContext, SectionType } from '../types';

/**
 * Discriminator for runtime narrowing of ViewModel nodes.
 * One member per tree node type (14 total) plus WorkspaceFolder.
 */
export enum NodeKind {
  WorkspaceFolder = 'workspaceFolder',
  Scope = 'scope',
  Section = 'section',
  PermissionGroup = 'permissionGroup',
  PermissionRule = 'permissionRule',
  Setting = 'setting',
  SettingKeyValue = 'settingKeyValue',
  EnvVar = 'envVar',
  Plugin = 'plugin',
  McpServer = 'mcpServer',
  SandboxProperty = 'sandboxProperty',
  HookEvent = 'hookEvent',
  HookEntry = 'hookEntry',
}

/**
 * Base ViewModel interface shared by all tree node descriptors.
 * Contains every field needed to construct a VS Code TreeItem
 * without further computation.
 */
export interface BaseVM {
  /** Discriminator for runtime narrowing. */
  kind: NodeKind;
  /** Display label. */
  label: string;
  /** Description text shown after label. */
  description: string;
  /** Pre-computed icon, includes ThemeColor for override dimming. */
  icon?: vscode.ThemeIcon;
  /** Collapsed, Expanded, or None. */
  collapsibleState: vscode.TreeItemCollapsibleState;
  /** Must match package.json `when` clause patterns exactly. */
  contextValue: string;
  /** Tooltip: plain string, MarkdownString, or undefined. */
  tooltip: string | vscode.MarkdownString | undefined;
  /** Embeds scope, keyPath, filePath, override state. */
  nodeContext: NodeContext;
  /** Eagerly built children. */
  children: BaseVM[];

  // Optional fields used by specific node types
  /** Stable tree item identifier. */
  id?: string;
  /** Custom URI for FileDecorationProvider. */
  resourceUri?: vscode.Uri;
  /** Checkbox state for toggleable items. */
  checkboxState?: vscode.TreeItemCheckboxState;
  /** Click command for leaf nodes. */
  command?: vscode.Command;
}

// ── Per-type ViewModel interfaces ─────────────────────────────

export interface WorkspaceFolderVM extends BaseVM {
  kind: NodeKind.WorkspaceFolder;
}

export interface ScopeVM extends BaseVM {
  kind: NodeKind.Scope;
}

export interface SectionVM extends BaseVM {
  kind: NodeKind.Section;
  /** Needed by builder for dispatch. */
  sectionType: SectionType;
}

export interface PermissionGroupVM extends BaseVM {
  kind: NodeKind.PermissionGroup;
  /** Permission category: allow, deny, or ask. */
  category: string;
}

export interface PermissionRuleVM extends BaseVM {
  kind: NodeKind.PermissionRule;
  /** The permission rule string (e.g., "Bash(curl *)"). */
  rule: string;
  /** Category of the overriding rule, if overridden by a different category. */
  overriddenByCategory?: string;
}

export interface SettingVM extends BaseVM {
  kind: NodeKind.Setting;
  /** Top-level config key (e.g., "model", "attribution"). */
  key: string;
  /** Raw config value. */
  value: unknown;
}

export interface SettingKeyValueVM extends BaseVM {
  kind: NodeKind.SettingKeyValue;
  /** Parent setting key (e.g., "attribution"). */
  parentKey: string;
  /** Child key within the parent object (e.g., "commit"). */
  childKey: string;
  /** Raw child value. */
  value: unknown;
}

export interface EnvVarVM extends BaseVM {
  kind: NodeKind.EnvVar;
  /** Environment variable name. */
  envKey: string;
  /** Environment variable value. */
  envValue: string;
}

export interface PluginVM extends BaseVM {
  kind: NodeKind.Plugin;
  /** Full plugin identifier (e.g., "@scope/name@1.0.0"). */
  pluginId: string;
  /** Whether the plugin is enabled. */
  enabled: boolean;
}

export interface McpServerVM extends BaseVM {
  kind: NodeKind.McpServer;
  /** Server name from MCP config. */
  serverName: string;
}

export interface SandboxPropertyVM extends BaseVM {
  kind: NodeKind.SandboxProperty;
  /** Sandbox property key, dot-separated for nested (e.g., "network.allowedDomains"). */
  propertyKey: string;
  /** Raw property value. */
  propertyValue: unknown;
}

export interface HookEventVM extends BaseVM {
  kind: NodeKind.HookEvent;
  /** Hook event type (e.g., "PreToolUse"). */
  eventType: HookEventType;
}

export interface HookEntryVM extends BaseVM {
  kind: NodeKind.HookEntry;
  /** Hook command type: command, prompt, or agent. */
  hookType: 'command' | 'prompt' | 'agent';
  /** Index of the matcher in the event's matcher array. */
  matcherIndex: number;
  /** Index of the hook within the matcher's hooks array. */
  hookIndex: number;
}

