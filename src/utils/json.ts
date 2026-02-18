import * as fs from 'fs';
import * as path from 'path';

export interface ParseResult<T> {
  data: T;
  error?: string;
}

export function safeParseJson<T = unknown>(content: string): ParseResult<T> {
  try {
    // Strip BOM if present
    const cleaned = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
    const data = JSON.parse(cleaned) as T;
    return { data };
  } catch (e) {
    return {
      data: {} as T,
      error: e instanceof Error ? e.message : 'Unknown parse error',
    };
  }
}

export function readJsonFile<T = unknown>(filePath: string): ParseResult<T> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return safeParseJson<T>(content);
  } catch (e) {
    if (isNodeError(e) && e.code === 'ENOENT') {
      return { data: {} as T };
    }
    return {
      data: {} as T,
      error: e instanceof Error ? e.message : 'Unknown read error',
    };
  }
}

export function writeJsonFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf-8');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
