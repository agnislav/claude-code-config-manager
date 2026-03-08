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
} from '../viewmodel/types';
import { ConfigTreeNode } from './nodes/baseNode';
import { EnvVarNode } from './nodes/envVarNode';
import { HookEntryNode } from './nodes/hookEntryNode';
import { HookEventNode } from './nodes/hookEventNode';
import { McpServerNode } from './nodes/mcpServerNode';
import { PermissionGroupNode } from './nodes/permissionGroupNode';
import { PermissionRuleNode } from './nodes/permissionRuleNode';
import { PluginNode } from './nodes/pluginNode';
import { SandboxPropertyNode } from './nodes/sandboxPropertyNode';
import { ScopeNode } from './nodes/scopeNode';
import { SectionNode } from './nodes/sectionNode';
import { SettingKeyValueNode } from './nodes/settingKeyValueNode';
import { SettingNode } from './nodes/settingNode';
import { WorkspaceFolderNode } from './nodes/workspaceFolderNode';

export function vmToNode(vm: BaseVM): ConfigTreeNode {
  switch (vm.kind) {
    case NodeKind.WorkspaceFolder:
      return new WorkspaceFolderNode(vm as WorkspaceFolderVM);
    case NodeKind.Scope:
      return new ScopeNode(vm as ScopeVM);
    case NodeKind.Section:
      return new SectionNode(vm as SectionVM);
    case NodeKind.PermissionGroup:
      return new PermissionGroupNode(vm as PermissionGroupVM);
    case NodeKind.PermissionRule:
      return new PermissionRuleNode(vm as PermissionRuleVM);
    case NodeKind.Setting:
      return new SettingNode(vm as SettingVM);
    case NodeKind.SettingKeyValue:
      return new SettingKeyValueNode(vm as SettingKeyValueVM);
    case NodeKind.EnvVar:
      return new EnvVarNode(vm as EnvVarVM);
    case NodeKind.Plugin:
      return new PluginNode(vm as PluginVM);
    case NodeKind.McpServer:
      return new McpServerNode(vm as McpServerVM);
    case NodeKind.SandboxProperty:
      return new SandboxPropertyNode(vm as SandboxPropertyVM);
    case NodeKind.HookEvent:
      return new HookEventNode(vm as HookEventVM);
    case NodeKind.HookEntry:
      return new HookEntryNode(vm as HookEntryVM);
    default:
      throw new Error(`Unknown NodeKind: ${(vm as BaseVM).kind}`);
  }
}
