import { ConfigScope, HookEventType, SectionType } from './types';

export const SCOPE_LABELS: Record<ConfigScope, string> = {
  [ConfigScope.Managed]: 'Managed (Enterprise)',
  [ConfigScope.User]: 'User',
  [ConfigScope.ProjectShared]: 'Project (Shared)',
  [ConfigScope.ProjectLocal]: 'Project (Local)',
};

export const SCOPE_DESCRIPTIONS: Record<ConfigScope, string> = {
  [ConfigScope.Managed]: 'Read-only enterprise policies set by admin',
  [ConfigScope.User]: 'Global user settings (~/.claude/settings.json)',
  [ConfigScope.ProjectShared]: 'Shared project settings (committed to git)',
  [ConfigScope.ProjectLocal]: 'Local project overrides (gitignored)',
};

export const SCOPE_ICONS: Record<ConfigScope, string> = {
  [ConfigScope.Managed]: 'lock',
  [ConfigScope.User]: 'home',
  [ConfigScope.ProjectShared]: 'git-commit',
  [ConfigScope.ProjectLocal]: 'file-code',
};

export const SECTION_LABELS: Record<SectionType, string> = {
  [SectionType.Permissions]: 'Permissions',
  [SectionType.Sandbox]: 'Sandbox',
  [SectionType.Hooks]: 'Hooks',
  [SectionType.McpServers]: 'MCP Servers',
  [SectionType.Environment]: 'Environment',
  [SectionType.Plugins]: 'Plugins',
  [SectionType.Settings]: 'Settings',
};

export const SECTION_ICONS: Record<SectionType, string> = {
  [SectionType.Permissions]: 'shield',
  [SectionType.Sandbox]: 'vm',
  [SectionType.Hooks]: 'zap',
  [SectionType.McpServers]: 'plug',
  [SectionType.Environment]: 'symbol-variable',
  [SectionType.Plugins]: 'extensions',
  [SectionType.Settings]: 'tools',
};

export const PERMISSION_CATEGORY_ICONS: Record<string, string> = {
  allow: 'check',
  deny: 'close',
  ask: 'question',
};

export const PERMISSION_CATEGORY_LABELS: Record<string, string> = {
  allow: 'Allow',
  deny: 'Deny',
  ask: 'Ask',
};

/** Keys stored in dedicated sections — everything else goes to "Settings". */
export const DEDICATED_SECTION_KEYS = new Set([
  'permissions',
  'sandbox',
  'hooks',
  'enabledPlugins',
  'env',
]);

/** Scalar/object keys that belong to the "Settings" catch-all section. */
export const KNOWN_SETTING_KEYS = [
  'model',
  'outputStyle',
  'language',
  'attribution',
  'autoUpdatesChannel',
  'cleanupPeriodDays',
  'plansDirectory',
  'respectGitignore',
  'alwaysThinkingEnabled',
  'showTurnDuration',
  'spinnerTipsEnabled',
  'terminalProgressBarEnabled',
  'prefersReducedMotion',
  'teammateMode',
  'forceLoginMethod',
  'includeCoAuthoredBy',
  'disableAllHooks',
  'allowManagedHooksOnly',
  'allowManagedPermissionRulesOnly',
  'enableAllProjectMcpServers',
  'enabledMcpjsonServers',
  'disabledMcpServers',
  'allowedMcpServers',
  'deniedMcpServers',
] as const;

export const ALL_HOOK_EVENT_TYPES = Object.values(HookEventType);

// ── File paths ──────────────────────────────────────────────────

export const MANAGED_SETTINGS_FILENAME = 'managed-settings.json';
export const MANAGED_PATH_MACOS = '/Library/Application Support/ClaudeCode';
export const MANAGED_PATH_LINUX = '/etc/claude-code';

export const USER_SETTINGS_DIR = '.claude';
export const USER_SETTINGS_FILE = 'settings.json';

export const PROJECT_CLAUDE_DIR = '.claude';
export const PROJECT_SHARED_FILE = 'settings.json';
export const PROJECT_LOCAL_FILE = 'settings.local.json';

export const MCP_CONFIG_FILE = '.mcp.json';

export const PLUGINS_DIR = 'plugins';
export const PLUGINS_REGISTRY_FILE = 'installed_plugins.json';
