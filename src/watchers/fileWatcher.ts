import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigStore } from '../config/configModel';
import { MCP_CONFIG_FILE, PROJECT_CLAUDE_DIR, DEBOUNCE_RELOAD_MS, DEBOUNCE_MAX_WAIT_MS } from '../constants';
import { getUserSettingsPath, getManagedSettingsPath } from '../utils/platform';
import { isWriteInFlight } from '../config/configWriter';

export class ConfigFileWatcher implements vscode.Disposable {
  private watchers: vscode.Disposable[] = [];
  private reloadTimeout: ReturnType<typeof setTimeout> | undefined;
  private maxWaitTimeout: ReturnType<typeof setTimeout> | undefined;
  private outputChannel: vscode.OutputChannel | undefined;

  constructor(private readonly configStore: ConfigStore) {}

  setOutputChannel(channel: vscode.OutputChannel): void {
    this.outputChannel = channel;
  }

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
    if (this.maxWaitTimeout) {
      clearTimeout(this.maxWaitTimeout);
      this.maxWaitTimeout = undefined;
    }
    for (const w of this.watchers) {
      w.dispose();
    }
    this.watchers = [];
  }

  private watchPattern(pattern: string): void {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange((uri) => this.debouncedReload(uri.fsPath));
    watcher.onDidCreate((uri) => this.debouncedReload(uri.fsPath));
    watcher.onDidDelete((uri) => this.debouncedReload(uri.fsPath));
    this.watchers.push(watcher);
  }

  private watchAbsolute(filePath: string): void {
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    try {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(dir), fileName),
      );
      watcher.onDidChange((uri) => this.debouncedReload(uri.fsPath));
      watcher.onDidCreate((uri) => this.debouncedReload(uri.fsPath));
      watcher.onDidDelete((uri) => this.debouncedReload(uri.fsPath));
      this.watchers.push(watcher);
    } catch {
      // Silently fail if the directory doesn't exist
    }
  }

  private debouncedReload(filePath?: string): void {
    // Suppress reload if a write is in-flight for this path
    if (filePath && isWriteInFlight(filePath)) {
      this.logWatcher(`suppressed reload: ${filePath} (write in-flight)`);
      return;
    }

    // Clear existing regular debounce timeout
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
    }

    // Shared reload function that clears both timeouts
    const doReload = () => {
      if (this.reloadTimeout) {
        clearTimeout(this.reloadTimeout);
      }
      if (this.maxWaitTimeout) {
        clearTimeout(this.maxWaitTimeout);
      }
      this.configStore.reload();
      this.reloadTimeout = undefined;
      this.maxWaitTimeout = undefined;
    };

    // Set regular debounce timeout
    this.reloadTimeout = setTimeout(doReload, DEBOUNCE_RELOAD_MS);

    // Set maxWait ceiling if not already set
    if (!this.maxWaitTimeout) {
      this.maxWaitTimeout = setTimeout(doReload, DEBOUNCE_MAX_WAIT_MS);
    }
  }

  private logWatcher(message: string): void {
    if (!this.outputChannel) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const mmm = String(now.getMilliseconds()).padStart(3, '0');
    this.outputChannel.appendLine(`[${hh}:${mm}:${ss}.${mmm}] [watcher] ${message}`);
  }
}
