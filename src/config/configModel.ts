import * as vscode from 'vscode';
import { ConfigScope, ScopedConfig } from '../types';
import { discoverConfigPaths, DiscoveredPaths } from './configDiscovery';
import { loadConfigFile, loadMcpFile } from './configLoader';
import { PluginMetadataService } from '../utils/pluginMetadata';

const GLOBAL_KEY = '__global__';

export class ConfigStore implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<string | undefined>();
  readonly onDidChange = this._onDidChange.event;

  private configs = new Map<string, ScopedConfig[]>();
  private discoveredPaths = new Map<string, DiscoveredPaths>();
  private _lockedScopes = new Set<ConfigScope>();

  reload(workspaceFolderUri?: string): void {
    PluginMetadataService.getInstance().invalidate();

    const allDiscovered = discoverConfigPaths();

    if (workspaceFolderUri) {
      // Reload a single workspace folder
      const discovered = allDiscovered.find(
        (d) => d.workspaceFolder?.uri.toString() === workspaceFolderUri,
      );
      if (discovered) {
        const key = workspaceFolderUri;
        this.discoveredPaths.set(key, discovered);
        this.configs.set(key, this.buildScopedConfigs(discovered));
        this._onDidChange.fire(key);
      }
      return;
    }

    // Full reload
    this.configs.clear();
    this.discoveredPaths.clear();

    for (const discovered of allDiscovered) {
      const key = discovered.workspaceFolder?.uri.toString() ?? GLOBAL_KEY;
      this.discoveredPaths.set(key, discovered);
      this.configs.set(key, this.buildScopedConfigs(discovered));
    }

    this._onDidChange.fire(undefined);
  }

  getScopedConfig(scope: ConfigScope, workspaceFolderUri?: string): ScopedConfig | undefined {
    const key = workspaceFolderUri ?? this.getFirstKey();
    const scopes = this.configs.get(key);
    return scopes?.find((s) => s.scope === scope);
  }

  getAllScopes(workspaceFolderUri?: string): ScopedConfig[] {
    const key = workspaceFolderUri ?? this.getFirstKey();
    return this.configs.get(key) ?? [];
  }

  getWorkspaceFolderKeys(): string[] {
    return Array.from(this.configs.keys());
  }

  getDiscoveredPaths(workspaceFolderUri?: string): DiscoveredPaths | undefined {
    const key = workspaceFolderUri ?? this.getFirstKey();
    return this.discoveredPaths.get(key);
  }

  findScopeByFilePath(filePath: string): {
    scopedConfig: ScopedConfig;
    workspaceFolderKey: string;
  } | undefined {
    for (const key of this.getWorkspaceFolderKeys()) {
      for (const sc of this.getAllScopes(key)) {
        if (sc.filePath === filePath || sc.mcpFilePath === filePath) {
          return { scopedConfig: sc, workspaceFolderKey: key };
        }
      }
    }
    return undefined;
  }

  isMultiRoot(): boolean {
    const folders = vscode.workspace.workspaceFolders;
    return (folders?.length ?? 0) > 1;
  }

  lockScope(scope: ConfigScope): void {
    this._lockedScopes.add(scope);
    this._onDidChange.fire(undefined);
  }

  unlockScope(scope: ConfigScope): void {
    this._lockedScopes.delete(scope);
    this._onDidChange.fire(undefined);
  }

  isScopeLocked(scope: ConfigScope): boolean {
    return this._lockedScopes.has(scope);
  }

  dispose(): void {
    this._onDidChange.dispose();
    this.configs.clear();
    this.discoveredPaths.clear();
    this._lockedScopes.clear();
  }

  private getFirstKey(): string {
    const keys = Array.from(this.configs.keys());
    return keys[0] ?? GLOBAL_KEY;
  }

  private buildScopedConfigs(discovered: DiscoveredPaths): ScopedConfig[] {
    const scopes: ScopedConfig[] = [];

    // Managed
    const managedResult = loadConfigFile(discovered.managed.path);
    if (managedResult.error && discovered.managed.exists) {
      this.showParseError(discovered.managed.path, managedResult.error, 'Managed (Enterprise) settings');
    }
    scopes.push({
      scope: ConfigScope.Managed,
      filePath: discovered.managed.path,
      fileExists: discovered.managed.exists,
      config: managedResult.data,
      isReadOnly: true,
    });

    // User
    const userResult = loadConfigFile(discovered.user.path);
    if (userResult.error && discovered.user.exists) {
      this.showParseError(discovered.user.path, userResult.error, 'User settings');
    }
    scopes.push({
      scope: ConfigScope.User,
      filePath: discovered.user.path,
      fileExists: discovered.user.exists,
      config: userResult.data,
      mcpConfig: discovered.userMcpConfig,
      mcpFilePath: discovered.userMcpConfig ? discovered.claudeJsonPath : undefined,
      isReadOnly: false,
    });

    // Project Shared
    if (discovered.projectShared) {
      const sharedResult = loadConfigFile(discovered.projectShared.path);
      if (sharedResult.error && discovered.projectShared.exists) {
        this.showParseError(discovered.projectShared.path, sharedResult.error, 'Project (Shared) settings');
      }
      const mcpResult = discovered.mcp ? loadMcpFile(discovered.mcp.path) : undefined;
      if (mcpResult?.error && discovered.mcp?.exists) {
        this.showParseError(discovered.mcp.path, mcpResult.error, 'MCP config');
      }
      scopes.push({
        scope: ConfigScope.ProjectShared,
        filePath: discovered.projectShared.path,
        fileExists: discovered.projectShared.exists,
        config: sharedResult.data,
        mcpConfig: mcpResult?.data,
        mcpFilePath: discovered.mcp?.path,
        isReadOnly: false,
      });
    }

    // Project Local
    if (discovered.projectLocal) {
      const localResult = loadConfigFile(discovered.projectLocal.path);
      if (localResult.error && discovered.projectLocal.exists) {
        this.showParseError(discovered.projectLocal.path, localResult.error, 'Project (Local) settings');
      }
      scopes.push({
        scope: ConfigScope.ProjectLocal,
        filePath: discovered.projectLocal.path,
        fileExists: discovered.projectLocal.exists,
        config: localResult.data,
        mcpConfig: discovered.localMcpConfig,
        mcpFilePath: discovered.localMcpConfig ? discovered.claudeJsonPath : undefined,
        isReadOnly: false,
      });
    }

    return scopes;
  }

  private showParseError(filePath: string, error: string, label: string): void {
    // Log to Developer Tools for debugging
    console.error(`[Claude Config] Parse error in ${filePath}: ${error}`);

    // Extract line/column from JSON parse error message
    // JSON.parse errors look like: "Unexpected token } in JSON at position 42"
    // or in newer Node: "Expected ',' or '}' after property value in JSON at position 42 (line 3 column 5)"
    const posMatch = error.match(/line (\d+) column (\d+)/i);
    const line = posMatch ? parseInt(posMatch[1], 10) : 1;
    const column = posMatch ? parseInt(posMatch[2], 10) : 1;

    const message = `Failed to parse ${label} (${filePath}): ${error}`;

    vscode.window.showErrorMessage(message, 'Open File').then((action) => {
      if (action === 'Open File') {
        vscode.workspace.openTextDocument(filePath).then(
          (doc) => {
            const position = new vscode.Position(Math.max(0, line - 1), Math.max(0, column - 1));
            const selection = new vscode.Selection(position, position);
            vscode.window.showTextDocument(doc, { selection });
          },
          (err) => {
            console.error(`[Claude Config] Failed to open file ${filePath}:`, err);
          }
        );
      }
    });
  }
}
