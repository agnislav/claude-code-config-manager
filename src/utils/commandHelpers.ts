import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import { showWriteError } from '../config/configWriter';
import { MESSAGES, SCOPE_LABELS } from '../constants';
import { ConfigScope, ScopedConfig } from '../types';
import { ConfigTreeNode } from '../tree/nodes/baseNode';

/**
 * Wraps a write action in try/catch, calling showWriteError on failure.
 * Replaces the repetitive try { action() } catch (error) { await showWriteError(...) } pattern.
 */
export async function withWriteRetry(filePath: string, action: () => void): Promise<void> {
  try {
    action();
  } catch (error) {
    await showWriteError(filePath, error, action);
  }
}

/**
 * Guards against read-only nodes. Returns true if the caller should return early.
 *
 * - If isReadOnly && scope === User: shows an info message (scope is locked, non-destructive to inform).
 * - If isReadOnly otherwise: shows a warning with the provided message.
 * - If !filePath: shows the warning message.
 *
 * The `allowLockedUser` option lets copy commands pass through when scope is User
 * (locked but non-destructive), while still blocking truly read-only scopes like Managed.
 */
export function guardReadOnly(
  node: ConfigTreeNode,
  message: string,
  options?: { allowLockedUser?: boolean },
): boolean {
  if (!node.nodeContext) return true;
  const { filePath, isReadOnly, scope } = node.nodeContext;

  if (!filePath) {
    vscode.window.showWarningMessage(message);
    return true;
  }

  if (isReadOnly) {
    // When allowLockedUser is true, allow locked User scope through (copy operations are non-destructive)
    if (options?.allowLockedUser && scope === ConfigScope.User) {
      return false;
    }
    if (scope === ConfigScope.User) {
      vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
    } else {
      vscode.window.showWarningMessage(message);
    }
    return true;
  }

  return false;
}

/**
 * Shows a QuickPick of editable target scopes, excluding the source scope, read-only,
 * Managed, and locked scopes. Returns the selected ScopedConfig or undefined.
 *
 * @param labelPrefix - Prefix for item labels (e.g. 'Copy to ' or ''); default is empty.
 */
export async function pickEditableTargetScope(
  configStore: ConfigStore,
  sourceScope: ConfigScope,
  workspaceFolderUri: string | undefined,
  placeHolder: string,
  labelPrefix: string = '',
): Promise<ScopedConfig | undefined> {
  const keys = configStore.getWorkspaceFolderKeys();
  if (keys.length === 0) {
    vscode.window.showInformationMessage(MESSAGES.noWorkspaceFolders);
    return undefined;
  }

  const key = workspaceFolderUri ?? keys[0];
  const allScopes = configStore.getAllScopes(key);

  const targetScopes = allScopes.filter(
    (s) =>
      s.scope !== sourceScope &&
      !s.isReadOnly &&
      s.scope !== ConfigScope.Managed &&
      !configStore.isScopeLocked(s.scope),
  );

  if (targetScopes.length === 0) {
    vscode.window.showInformationMessage(MESSAGES.noEditableScopes);
    return undefined;
  }

  const pick = await vscode.window.showQuickPick(
    targetScopes.map((s) => ({
      label: `${labelPrefix}${SCOPE_LABELS[s.scope]}`,
      description: s.filePath ?? '',
      value: s,
    })),
    { placeHolder },
  );

  return pick?.value;
}

/**
 * Shows a modal warning asking the user to confirm overwriting an existing item.
 * Returns true if the user confirmed overwrite.
 */
export async function confirmOverwrite(itemName: string, scopeLabel: string): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(
    `Claude Config: "${itemName}" already exists in ${scopeLabel}. Overwrite?`,
    { modal: true },
    'Overwrite',
  );
  return choice === 'Overwrite';
}
