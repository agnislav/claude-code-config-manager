/**
 * TDD tests for setSettingKeyValue and removeSettingKeyValue writer functions.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Patch getAllowedWritePaths before importing configWriter so temp paths pass validation.
// We monkey-patch the constants module's export at the module level.
const constants = require('../../../src/constants');
const _originalGetAllowedWritePaths = constants.getAllowedWritePaths;

const _tempPaths = new Set<string>();

constants.getAllowedWritePaths = function () {
  const original: Set<string> = _originalGetAllowedWritePaths();
  for (const p of _tempPaths) {
    original.add(p);
  }
  return original;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const configWriterModule = require('../../../src/config/configWriter');
const setSettingKeyValue: (filePath: string, parentKey: string, childKey: string, value: unknown) => void =
  configWriterModule.setSettingKeyValue;
const removeSettingKeyValue: (filePath: string, parentKey: string, childKey: string) => void =
  configWriterModule.removeSettingKeyValue;

// ── Helpers ──────────────────────────────────────────────────────

function makeTempFile(initialContent: object = {}): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-test-'));
  const filePath = path.join(tmpDir, 'settings.json');
  fs.writeFileSync(filePath, JSON.stringify(initialContent, null, 2), 'utf-8');
  _tempPaths.add(filePath);
  return filePath;
}

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ── Tests ─────────────────────────────────────────────────────────

suite('configWriter: setSettingKeyValue', () => {
  test('creates parent key and child key when parent does not exist', () => {
    const filePath = makeTempFile({});
    setSettingKeyValue(filePath, 'myGroup', 'myKey', 'hello');
    const result = readJson(filePath);
    assert.deepStrictEqual((result['myGroup'] as Record<string, unknown>)['myKey'], 'hello');
  });

  test('preserves sibling keys when setting a new child key', () => {
    const filePath = makeTempFile({ myGroup: { existingKey: 'existing' } });
    setSettingKeyValue(filePath, 'myGroup', 'newKey', 42);
    const result = readJson(filePath);
    const group = result['myGroup'] as Record<string, unknown>;
    assert.strictEqual(group['existingKey'], 'existing');
    assert.strictEqual(group['newKey'], 42);
  });

  test('overwrites an existing child key value', () => {
    const filePath = makeTempFile({ myGroup: { childKey: 'old' } });
    setSettingKeyValue(filePath, 'myGroup', 'childKey', 'new');
    const result = readJson(filePath);
    assert.strictEqual((result['myGroup'] as Record<string, unknown>)['childKey'], 'new');
  });

  test('preserves value type: boolean true', () => {
    const filePath = makeTempFile({});
    setSettingKeyValue(filePath, 'myGroup', 'flag', true);
    const result = readJson(filePath);
    assert.strictEqual((result['myGroup'] as Record<string, unknown>)['flag'], true);
  });

  test('preserves value type: number', () => {
    const filePath = makeTempFile({});
    setSettingKeyValue(filePath, 'myGroup', 'count', 99);
    const result = readJson(filePath);
    assert.strictEqual((result['myGroup'] as Record<string, unknown>)['count'], 99);
  });

  test('preserves other top-level keys in config', () => {
    const filePath = makeTempFile({ model: 'claude-opus', myGroup: { childKey: 'old' } });
    setSettingKeyValue(filePath, 'myGroup', 'childKey', 'new');
    const result = readJson(filePath);
    assert.strictEqual(result['model'], 'claude-opus');
  });
});

suite('configWriter: removeSettingKeyValue', () => {
  test('removes only the specified child key', () => {
    const filePath = makeTempFile({ myGroup: { keyA: 'a', keyB: 'b' } });
    removeSettingKeyValue(filePath, 'myGroup', 'keyA');
    const result = readJson(filePath);
    const group = result['myGroup'] as Record<string, unknown>;
    assert.strictEqual('keyA' in group, false);
    assert.strictEqual(group['keyB'], 'b');
  });

  test('leaves parent as empty object when last child key is removed', () => {
    const filePath = makeTempFile({ myGroup: { onlyKey: 'value' } });
    removeSettingKeyValue(filePath, 'myGroup', 'onlyKey');
    const result = readJson(filePath);
    assert.ok('myGroup' in result, 'parent key should remain');
    assert.deepStrictEqual(result['myGroup'], {});
  });

  test('is a no-op when parent key does not exist', () => {
    const filePath = makeTempFile({ model: 'opus' });
    // Should not throw
    removeSettingKeyValue(filePath, 'nonExistentGroup', 'someKey');
    const result = readJson(filePath);
    assert.strictEqual(result['model'], 'opus');
  });

  test('is a no-op when child key does not exist', () => {
    const filePath = makeTempFile({ myGroup: { existingKey: 'x' } });
    removeSettingKeyValue(filePath, 'myGroup', 'missingKey');
    const result = readJson(filePath);
    assert.deepStrictEqual((result['myGroup'] as Record<string, unknown>)['existingKey'], 'x');
  });

  test('preserves other top-level keys in config', () => {
    const filePath = makeTempFile({ model: 'claude-opus', myGroup: { childKey: 'val' } });
    removeSettingKeyValue(filePath, 'myGroup', 'childKey');
    const result = readJson(filePath);
    assert.strictEqual(result['model'], 'claude-opus');
  });
});
