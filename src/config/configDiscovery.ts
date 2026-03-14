import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  MCP_CONFIG_FILE,
  PROJECT_CLAUDE_DIR,
  PROJECT_LOCAL_FILE,
  PROJECT_SHARED_FILE,
} from '../constants';
import { FileInfo, McpConfig } from '../types';
import { getManagedSettingsPath, getUserSettingsPath, getUserClaudeJsonPath } from '../utils/platform';
import { readJsonFile } from '../utils/json';

export interface DiscoveredPaths {
  workspaceFolder?: vscode.WorkspaceFolder;
  managed: FileInfo;
  user: FileInfo;
  projectShared?: FileInfo;
  projectLocal?: FileInfo;
  mcp?: FileInfo;
  /** Path to ~/.claude.json (User + Local MCP source) */
  claudeJsonPath?: string;
  /** Top-level mcpServers from ~/.claude.json (User scope MCP) */
  userMcpConfig?: McpConfig;
  /** projects[workspacePath].mcpServers from ~/.claude.json (Local scope MCP) */
  localMcpConfig?: McpConfig;
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
  const claudeJsonPath = getUserClaudeJsonPath();

  const managed = fileInfo(managedPath);
  const user = fileInfo(userPath);

  // Read ~/.claude.json as a generic Record to avoid narrowing to McpConfig
  // (would lose non-MCP fields on write).
  const claudeJsonResult = readJsonFile<Record<string, unknown>>(claudeJsonPath);
  const claudeJsonData = claudeJsonResult.data ?? {};

  // Extract top-level mcpServers for User scope
  const rawUserMcp = claudeJsonData.mcpServers;
  const userMcpConfig: McpConfig | undefined =
    rawUserMcp && typeof rawUserMcp === 'object' && !Array.isArray(rawUserMcp)
      ? { mcpServers: rawUserMcp as McpConfig['mcpServers'] }
      : undefined;

  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    // No workspace open — only managed and user scopes are available
    return [{ managed, user, claudeJsonPath, userMcpConfig }];
  }

  return workspaceFolders.map((folder) => {
    const root = folder.uri.fsPath;
    const sharedPath = path.join(root, PROJECT_CLAUDE_DIR, PROJECT_SHARED_FILE);
    const localPath = path.join(root, PROJECT_CLAUDE_DIR, PROJECT_LOCAL_FILE);
    const mcpPath = path.join(root, MCP_CONFIG_FILE);

    // Extract projects[root].mcpServers for ProjectLocal scope.
    // Use folder.uri.fsPath — matches how Claude Code CLI writes the project key.
    const rawProjects = claudeJsonData.projects;
    let localMcpConfig: McpConfig | undefined;
    if (rawProjects && typeof rawProjects === 'object' && !Array.isArray(rawProjects)) {
      const projectEntry = (rawProjects as Record<string, unknown>)[root];
      if (projectEntry && typeof projectEntry === 'object' && !Array.isArray(projectEntry)) {
        const rawLocalMcp = (projectEntry as Record<string, unknown>).mcpServers;
        if (rawLocalMcp && typeof rawLocalMcp === 'object' && !Array.isArray(rawLocalMcp)) {
          localMcpConfig = { mcpServers: rawLocalMcp as McpConfig['mcpServers'] };
        }
      }
    }

    return {
      workspaceFolder: folder,
      managed,
      user,
      projectShared: fileInfo(sharedPath),
      projectLocal: fileInfo(localPath),
      mcp: fileInfo(mcpPath),
      claudeJsonPath,
      userMcpConfig,
      localMcpConfig,
    };
  });
}
