export enum ConfigScope {
  Managed = 'managed',
  User = 'user',
  ProjectShared = 'projectShared',
  ProjectLocal = 'projectLocal',
}

/** Precedence order: index 0 = highest precedence (wins). */
export const SCOPE_PRECEDENCE: ConfigScope[] = [
  ConfigScope.Managed,
  ConfigScope.ProjectLocal,
  ConfigScope.ProjectShared,
  ConfigScope.User,
];

export enum PermissionCategory {
  Allow = 'allow',
  Deny = 'deny',
  Ask = 'ask',
}

export enum HookEventType {
  SessionStart = 'SessionStart',
  UserPromptSubmit = 'UserPromptSubmit',
  PreToolUse = 'PreToolUse',
  PermissionRequest = 'PermissionRequest',
  PostToolUse = 'PostToolUse',
  PostToolUseFailure = 'PostToolUseFailure',
  Notification = 'Notification',
  SubagentStart = 'SubagentStart',
  SubagentStop = 'SubagentStop',
  Stop = 'Stop',
  TeammateIdle = 'TeammateIdle',
  TaskCompleted = 'TaskCompleted',
  PreCompact = 'PreCompact',
  SessionEnd = 'SessionEnd',
}

export enum SectionType {
  Permissions = 'permissions',
  Sandbox = 'sandbox',
  Hooks = 'hooks',
  McpServers = 'mcpServers',
  Environment = 'env',
  Plugins = 'plugins',
  Settings = 'settings',
}

// ── Config data shapes ──────────────────────────────────────────

export interface PermissionRules {
  allow?: string[];
  deny?: string[];
  ask?: string[];
  defaultMode?: string;
  disableBypassPermissionsMode?: string;
  additionalDirectories?: string[];
}

export interface HookCommand {
  type: 'command' | 'prompt' | 'agent';
  command?: string;
  prompt?: string;
  timeout?: number;
  async?: boolean;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookCommand[];
}

export type HooksConfig = Partial<Record<HookEventType, HookMatcher[]>>;

export interface SandboxNetworkConfig {
  allowedDomains?: string[];
  deniedDomains?: string[];
  allowLocalBinding?: boolean;
  allowUnixSockets?: string[];
  allowAllUnixSockets?: boolean;
  httpProxyPort?: number;
  socksProxyPort?: number;
}

export interface SandboxConfig {
  enabled?: boolean;
  autoAllowBashIfSandboxed?: boolean;
  excludedCommands?: string[];
  allowUnsandboxedCommands?: boolean;
  enableWeakerNestedSandbox?: boolean;
  network?: SandboxNetworkConfig;
}

export interface McpServerStdio {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpServerSse {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

export type McpServerConfig = McpServerStdio | McpServerSse;

export interface AttributionConfig {
  commit?: string;
  pr?: string;
}

export interface ClaudeCodeConfig {
  permissions?: PermissionRules;
  env?: Record<string, string>;
  hooks?: HooksConfig;
  sandbox?: SandboxConfig;
  enabledPlugins?: Record<string, boolean>;
  model?: string;
  outputStyle?: string;
  language?: string;
  attribution?: AttributionConfig;
  disableAllHooks?: boolean;
  allowManagedHooksOnly?: boolean;
  allowManagedPermissionRulesOnly?: boolean;
  autoUpdatesChannel?: string;
  cleanupPeriodDays?: number;
  plansDirectory?: string;
  respectGitignore?: boolean;
  alwaysThinkingEnabled?: boolean;
  showTurnDuration?: boolean;
  spinnerTipsEnabled?: boolean;
  terminalProgressBarEnabled?: boolean;
  prefersReducedMotion?: boolean;
  teammateMode?: string;
  forceLoginMethod?: string;
  includeCoAuthoredBy?: boolean;
  enableAllProjectMcpServers?: boolean;
  enabledMcpjsonServers?: string[];
  disabledMcpServers?: string[];
  [key: string]: unknown;
}

export interface McpConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

// ── Scoped config ───────────────────────────────────────────────

export interface FileInfo {
  path: string;
  exists: boolean;
}

export interface ScopedConfig {
  scope: ConfigScope;
  filePath: string | undefined;
  fileExists: boolean;
  config: ClaudeCodeConfig;
  mcpConfig?: McpConfig;
  mcpFilePath?: string;
  isReadOnly: boolean;
}

// ── Overlap types ───────────────────────────────────────────────

export interface OverlapItem {
  scope: ConfigScope;
  value: unknown;
}

export interface OverlapInfo {
  overrides?: OverlapItem;
  isOverriddenBy?: OverlapItem;
  duplicates?: OverlapItem;
  isDuplicatedBy?: OverlapItem;
}

// ── Tree node context ───────────────────────────────────────────

export interface NodeContext {
  scope: ConfigScope;
  section?: SectionType;
  keyPath: string[];
  isReadOnly: boolean;
  overlap: OverlapInfo;
  workspaceFolderUri?: string;
  filePath?: string;
}
