import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  MCP_CONFIG_FILE,
  PROJECT_CLAUDE_DIR,
  PROJECT_LOCAL_FILE,
  PROJECT_SHARED_FILE,
} from '../constants';
import { FileInfo } from '../types';
import { getManagedSettingsPath, getUserSettingsPath } from '../utils/platform';

export interface DiscoveredPaths {
  workspaceFolder?: vscode.WorkspaceFolder;
  managed: FileInfo;
  user: FileInfo;
  projectShared?: FileInfo;
  projectLocal?: FileInfo;
  mcp?: FileInfo;
}

function fileInfo(filePath: string): FileInfo {
  return {
    path: filePath,
    exists: fs.existsSync(filePath),
  };
}

export function discoverConfigPaths(): DiscoveredPaths[] {
  const managedPath = getManagedSettingsPath();
  const userPath = getUserSettingsPath();

  const managed = fileInfo(managedPath);
  const user = fileInfo(userPath);

  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    // No workspace open — only managed and user scopes are available
    return [{ managed, user }];
  }

  return workspaceFolders.map((folder) => {
    const root = folder.uri.fsPath;
    const sharedPath = path.join(root, PROJECT_CLAUDE_DIR, PROJECT_SHARED_FILE);
    const localPath = path.join(root, PROJECT_CLAUDE_DIR, PROJECT_LOCAL_FILE);
    const mcpPath = path.join(root, MCP_CONFIG_FILE);

    return {
      workspaceFolder: folder,
      managed,
      user,
      projectShared: fileInfo(sharedPath),
      projectLocal: fileInfo(localPath),
      mcp: fileInfo(mcpPath),
    };
  });
}

/**
 * Returns all unique config file paths that should be watched.
 */
export function getAllWatchPaths(discovered: DiscoveredPaths[]): string[] {
  const paths = new Set<string>();

  for (const d of discovered) {
    paths.add(d.managed.path);
    paths.add(d.user.path);
    if (d.projectShared) paths.add(d.projectShared.path);
    if (d.projectLocal) paths.add(d.projectLocal.path);
    if (d.mcp) paths.add(d.mcp.path);
  }

  return Array.from(paths);
}
