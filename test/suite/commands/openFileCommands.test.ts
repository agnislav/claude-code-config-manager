import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { isFileOpenInAnyTab } from '../../../src/commands/openFileCommands';
import { DOUBLE_CLICK_THRESHOLD_MS } from '../../../src/constants';

// Resolves the test workspace folder. runTests.ts launches with `test-fixtures/`
// as the workspace, so the project shared settings file lives at a path that
// `buildKnownConfigPaths()` will accept.
function getFixtureSharedSettingsPath(): string {
  const folders = vscode.workspace.workspaceFolders;
  assert.ok(folders && folders.length > 0, 'Test workspace folder must be open');
  return path.join(folders[0].uri.fsPath, '.claude', 'settings.json');
}

async function closeAllTabs(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  // Give VS Code a tick to actually drop the tabs from tabGroups.all.
  await new Promise((resolve) => setTimeout(resolve, 50));
}

function totalTabCount(): number {
  return vscode.window.tabGroups.all.reduce((sum, group) => sum + group.tabs.length, 0);
}

suite('openFileCommands.revealInFile (issue #20)', () => {
  suiteSetup(async () => {
    // Force extension activation so the test-only reset command is registered before
    // the first teardown runs. Without this, the extension activates lazily on the
    // first non-direct call, leaving the reset command unknown to teardown.
    const ext = vscode.extensions.getExtension('agnislav.claude-code-config-manager');
    assert.ok(ext, 'extension under test must be present');
    if (!ext!.isActive) {
      await ext!.activate();
    }
    await closeAllTabs();
  });

  teardown(async () => {
    await closeAllTabs();
    // The registered command lives in the bundled dist/extension.js — the same module
    // instance whose `lastClick` state needs to be cleared between cases.
    await vscode.commands.executeCommand('claudeConfig._test_resetDoubleClickState');
  });

  test('isFileOpenInAnyTab returns false when no matching tab is open', async () => {
    const target = vscode.Uri.file(getFixtureSharedSettingsPath());
    assert.strictEqual(isFileOpenInAnyTab(target), false);
  });

  test('isFileOpenInAnyTab returns true after the file is opened', async () => {
    const target = vscode.Uri.file(getFixtureSharedSettingsPath());
    const doc = await vscode.workspace.openTextDocument(target);
    await vscode.window.showTextDocument(doc, { preview: false });
    assert.strictEqual(isFileOpenInAnyTab(target), true);
  });

  test('revealInFile reveals when the file is already open', async () => {
    const filePath = getFixtureSharedSettingsPath();
    const target = vscode.Uri.file(filePath);

    // Pre-open the fixture so the gate allows the reveal.
    const doc = await vscode.workspace.openTextDocument(target);
    await vscode.window.showTextDocument(doc, { preview: false });

    await vscode.commands.executeCommand('claudeConfig.revealInFile', filePath, ['env']);

    const active = vscode.window.activeTextEditor;
    assert.ok(active, 'Expected an active editor after reveal');
    assert.strictEqual(active!.document.uri.fsPath, target.fsPath);
  });

  test('revealInFile is a silent no-op when the file is not open', async () => {
    const filePath = getFixtureSharedSettingsPath();
    const tabsBefore = totalTabCount();
    const activeBefore = vscode.window.activeTextEditor?.document.uri.fsPath;

    await vscode.commands.executeCommand('claudeConfig.revealInFile', filePath, ['env']);

    // No new tab opened, no active editor change.
    assert.strictEqual(totalTabCount(), tabsBefore, 'reveal must not open a new tab when file is closed');
    assert.strictEqual(
      vscode.window.activeTextEditor?.document.uri.fsPath,
      activeBefore,
      'active editor must be unchanged',
    );
  });

  // ── Double-click behavior (tree-double-click-opens-file) ─────────────────

  test('two invocations on same nodeId within window open the closed file and position cursor', async () => {
    const filePath = getFixtureSharedSettingsPath();
    const target = vscode.Uri.file(filePath);
    const tabsBefore = totalTabCount();

    // Two fast clicks on the same logical node — second one should trigger the open path.
    await vscode.commands.executeCommand('claudeConfig.revealInFile', filePath, ['env'], 'node-A');
    await vscode.commands.executeCommand('claudeConfig.revealInFile', filePath, ['env'], 'node-A');

    assert.strictEqual(totalTabCount(), tabsBefore + 1, 'second invocation must open the file');
    const active = vscode.window.activeTextEditor;
    assert.ok(active, 'Expected an active editor after double-click open');
    assert.strictEqual(active!.document.uri.fsPath, target.fsPath);
  });

  test('two invocations outside the debounce window stay silent', async () => {
    const filePath = getFixtureSharedSettingsPath();
    const tabsBefore = totalTabCount();

    await vscode.commands.executeCommand('claudeConfig.revealInFile', filePath, ['env'], 'node-A');
    // Wait past the debounce window so the second click no longer pairs with the first.
    await new Promise((resolve) => setTimeout(resolve, DOUBLE_CLICK_THRESHOLD_MS + 50));
    await vscode.commands.executeCommand('claudeConfig.revealInFile', filePath, ['env'], 'node-A');

    assert.strictEqual(totalTabCount(), tabsBefore, 'two slow clicks must remain a no-op');
  });

  test('two invocations on different nodeIds within window stay silent', async () => {
    const filePath = getFixtureSharedSettingsPath();
    const tabsBefore = totalTabCount();

    await vscode.commands.executeCommand('claudeConfig.revealInFile', filePath, ['env'], 'node-A');
    await vscode.commands.executeCommand('claudeConfig.revealInFile', filePath, ['env'], 'node-B');

    assert.strictEqual(totalTabCount(), tabsBefore, 'fast clicks on different nodes must not be treated as a double-click');
  });

  test('a single invocation opens the file when workbench.list.openMode is doubleClick', async () => {
    const filePath = getFixtureSharedSettingsPath();
    const target = vscode.Uri.file(filePath);
    const tabsBefore = totalTabCount();

    const config = vscode.workspace.getConfiguration('workbench.list');
    const previousOpenMode = config.get<string>('openMode');
    await config.update('openMode', 'doubleClick', vscode.ConfigurationTarget.Workspace);

    try {
      await vscode.commands.executeCommand('claudeConfig.revealInFile', filePath, ['env'], 'node-A');

      assert.strictEqual(totalTabCount(), tabsBefore + 1, 'single invocation in doubleClick openMode must open the file');
      const active = vscode.window.activeTextEditor;
      assert.ok(active, 'Expected an active editor after open');
      assert.strictEqual(active!.document.uri.fsPath, target.fsPath);
    } finally {
      // Restore — undefined clears the workspace override and falls back to the user setting.
      await config.update('openMode', previousOpenMode, vscode.ConfigurationTarget.Workspace);
    }
  });
});
