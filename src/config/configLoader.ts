import { ClaudeCodeConfig, McpConfig } from '../types';
import { readJsonFile, ParseResult } from '../utils/json';

export function loadConfigFile(filePath: string): ParseResult<ClaudeCodeConfig> {
  return readJsonFile<ClaudeCodeConfig>(filePath);
}

export function loadMcpFile(filePath: string): ParseResult<McpConfig> {
  return readJsonFile<McpConfig>(filePath);
}
