import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import { MCP_CONFIG_FILE, PROJECT_CLAUDE_DIR } from '../constants';
import { getUserSettingsPath, getManagedSettingsPath } from '../utils/platform';

export class ConfigFileWatcher implements vscode.Disposable {
  private watchers: vscode.Disposable[] = [];
  private reloadTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly configStore: ConfigStore) {}

  setup(): void {
    this.dispose();

    // Watch project-level config files in all workspace folders
    this.watchPattern(`**/${PROJECT_CLAUDE_DIR}/settings.json`);
    this.watchPattern(`**/${PROJECT_CLAUDE_DIR}/settings.local.json`);
    this.watchPattern(`**/${MCP_CONFIG_FILE}`);

    // Watch user settings (absolute path)
    this.watchAbsolute(getUserSettingsPath());

    // Watch managed settings (absolute path)
    this.watchAbsolute(getManagedSettingsPath());

    // Watch for workspace folder changes
    this.watchers.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.debouncedReload();
      }),
    );
  }

  dispose(): void {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
      this.reloadTimeout = undefined;
    }
    for (const w of this.watchers) {
      w.dispose();
    }
    this.watchers = [];
  }

  private watchPattern(pattern: string): void {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(() => this.debouncedReload());
    watcher.onDidCreate(() => this.debouncedReload());
    watcher.onDidDelete(() => this.debouncedReload());
    this.watchers.push(watcher);
  }

  private watchAbsolute(filePath: string): void {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);

    try {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(dir), fileName),
      );
      watcher.onDidChange(() => this.debouncedReload());
      watcher.onDidCreate(() => this.debouncedReload());
      watcher.onDidDelete(() => this.debouncedReload());
      this.watchers.push(watcher);
    } catch {
      // Silently fail if the directory doesn't exist
    }
  }

  private debouncedReload(): void {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
    }
    this.reloadTimeout = setTimeout(() => {
      this.configStore.reload();
      this.reloadTimeout = undefined;
    }, 300);
  }
}
