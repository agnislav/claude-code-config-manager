import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigScope, HookEventType, SectionType } from './types';
import { getUserSettingsPath } from './utils/platform';

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
  [SectionType.Environment]: 'terminal',
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

// ── Timing ──────────────────────────────────────────────────────

/** Regular file watcher debounce delay (milliseconds) */
export const DEBOUNCE_RELOAD_MS = 300;

/** Maximum wait ceiling for debounce during continuous changes (milliseconds) */
export const DEBOUNCE_MAX_WAIT_MS = 2000;

/** Suppress editor→tree sync after tree click to prevent feedback loop. 500ms allows the selection animation to complete. */
export const EDITOR_SYNC_SUPPRESS_MS = 500;

/** Suppress tree→editor sync after programmatic tree reveal. 100ms prevents immediate re-trigger. */
export const TREE_SYNC_SUPPRESS_MS = 100;

/** Debounce delay for editor selection and active editor change events before syncing to tree. 150ms balances responsiveness with avoiding rapid-fire updates. */
export const EDITOR_TREE_SYNC_DEBOUNCE_MS = 150;

/** Polling interval during deactivation to check if in-flight writes are complete. */
export const DEACTIVATION_POLL_INTERVAL_MS = 50;

/** Maximum time to wait for in-flight writes to complete during deactivation. */
export const DEACTIVATION_MAX_WAIT_MS = 5000;

/** Maximum allowed keyPath depth for revealInFile validation. */
export const MAX_KEYPATH_DEPTH = 10;

// ── Messages ──────────────────────────────────────────────────

/** Centralized user-facing messages. All prefixed with "Claude Config:" for identification. */
export const MESSAGES = {
  // Scope lock
  userScopeLocked: 'Claude Config: User scope is currently locked. Click the lock icon in the toolbar to unlock.',

  // Read-only guards
  readOnlySetting: 'Claude Config: This setting is read-only.',
  readOnlyDelete: 'Claude Config: Cannot delete read-only items.',
  readOnlyMove: 'Claude Config: Cannot move read-only items.',
  readOnlyCopy: 'Claude Config: Cannot copy from a read-only scope.',

  // Scope picker
  noWorkspaceFolders: 'Claude Config: No workspace folders available.',
  noEditableScopes: 'Claude Config: No other editable scopes available.',
  noTargetFile: 'Claude Config: Cannot copy to this scope: no configuration file available.',
  noTargetFileMove: 'Claude Config: Cannot move to this scope: no configuration file available.',

  // Write concurrency
  writeInProgress: 'Claude Config: A write operation is already in progress for this file. Please wait.',

  // Plugin
  pluginNotInstalled: (id: string) => `Claude Config: Plugin "${id}" is not installed locally.`,
  pluginNoReadme: (id: string) => `Claude Config: No README.md found for "${id}".`,

  // File operations
  fileNotFound: (path: string) => `Claude Config: File does not exist: ${path}`,

  // Success messages
  movedItem: (itemName: string, targetScopeLabel: string) => `Claude Config: Moved "${itemName}" to ${targetScopeLabel}`,
  copiedSetting: (settingKey: string, targetScopeLabel: string) => `Claude Config: Copied "${settingKey}" to ${targetScopeLabel}`,
  copiedPermission: (rule: string, categoryLabel: string, scopeLabel: string) => `Claude Config: Copied "${rule}" to ${categoryLabel} in ${scopeLabel}`,
  copiedPlugin: (itemName: string, targetScopeLabel: string, stateLabel: string) => `Claude Config: Copied "${itemName}" to ${targetScopeLabel} as ${stateLabel}`,
  copiedEnvVar: (key: string, scopeLabel: string) => `Claude Config: Copied env var "${key}" to ${scopeLabel}`,

  // Permission-specific
  permissionAlreadyExists: (rule: string, categoryLabel: string, scopeLabel: string) => `Claude Config: "${rule}" already exists in ${categoryLabel} in ${scopeLabel}.`,
  permissionValueNotFound: (settingKey: string) => `Claude Config: Could not copy "${settingKey}": value not found in source scope.`,

  // Validation errors (revealInFile)
  revealTraversal: 'Claude Config: Cannot reveal file: path contains traversal sequences',
  revealUnknownPath: (filePath: string) => `Claude Config: Cannot reveal file: ${filePath} is not a known config path`,
  revealKeyPathNotArray: 'Claude Config: Cannot reveal file: keyPath must be an array',
  revealKeyPathTooDeep: (depth: number) => `Claude Config: Cannot reveal file: keyPath exceeds maximum depth of ${depth}`,
  revealKeyPathNonString: 'Claude Config: Cannot reveal file: all keyPath elements must be strings',
} as const;

// ── Write Path Validation ────────────────────────────────────────

/**
 * Returns the set of file paths that the extension is allowed to write to.
 * Computed at call time because workspace folders may change.
 * Excludes managed paths (read-only).
 */
export function getAllowedWritePaths(): Set<string> {
  const paths = new Set<string>();

  // User scope
  paths.add(getUserSettingsPath());

  // Project scopes (per workspace folder)
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const root = folder.uri.fsPath;
      paths.add(path.join(root, PROJECT_CLAUDE_DIR, PROJECT_SHARED_FILE));
      paths.add(path.join(root, PROJECT_CLAUDE_DIR, PROJECT_LOCAL_FILE));
      paths.add(path.join(root, MCP_CONFIG_FILE));
    }
  }

  return paths;
}
