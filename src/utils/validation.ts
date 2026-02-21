import * as vscode from 'vscode';

/**
 * Validates that keyPath has the minimum required segments for safe indexing.
 * On failure: logs to console.warn AND shows vscode.window.showErrorMessage with detail.
 * Returns true if valid, false if invalid.
 */
export function validateKeyPath(
  keyPath: string[],
  minLength: number,
  context: string,
): boolean {
  if (!Array.isArray(keyPath) || keyPath.length < minLength) {
    const detail = `Claude Config: Invalid config path in ${context}: expected at least ${minLength} segments, got [${keyPath?.join(', ') ?? 'undefined'}]`;
    console.warn(detail);
    vscode.window.showErrorMessage(detail);
    return false;
  }
  return true;
}
