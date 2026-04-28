import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { isFileOpenInAnyTab } from '../../../src/commands/openFileCommands';

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
    await closeAllTabs();
  });

  teardown(async () => {
    await closeAllTabs();
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
});
