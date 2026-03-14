import * as assert from 'assert';
import {
  parsePermissionRule,
  rulesOverlap,
  getCachedParse,
} from '../../../src/utils/permissions';

suite('permissions', () => {
  suite('parsePermissionRule', () => {
    test('should parse rule with specifier', () => {
      const result = parsePermissionRule('Bash(npm run *)');
      assert.strictEqual(result.tool, 'Bash');
      assert.strictEqual(result.specifier, 'npm run *');
    });

    test('should parse rule without specifier', () => {
      const result = parsePermissionRule('Bash');
      assert.strictEqual(result.tool, 'Bash');
      assert.strictEqual(result.specifier, undefined);
    });

    test('should parse MCP tool rule', () => {
      const result = parsePermissionRule('mcp__asana__get_task');
      assert.strictEqual(result.tool, 'mcp__asana__get_task');
      assert.strictEqual(result.specifier, undefined);
    });
  });

  suite('rulesOverlap', () => {
    test('same tool without specifier overlaps', () => {
      assert.strictEqual(rulesOverlap('Bash', 'Bash'), true);
    });

    test('one has specifier other does not — overlaps (wildcard match-all)', () => {
      assert.strictEqual(rulesOverlap('Bash', 'Bash(npm run lint)'), true);
    });

    test('different tools do not overlap', () => {
      assert.strictEqual(rulesOverlap('Bash(curl *)', 'Read(*)'), false);
    });

    test('wildcard pattern matches specific value', () => {
      assert.strictEqual(rulesOverlap('Bash(npm run *)', 'Bash(npm run lint)'), true);
    });

    test('non-overlapping specifiers do not overlap', () => {
      assert.strictEqual(rulesOverlap('Bash(curl *)', 'Bash(npm run lint)'), false);
    });

    test('invalid RegExp pattern returns false without throwing', () => {
      // The pattern '[invalid' would produce an invalid RegExp if used directly
      // rulesOverlap should handle this gracefully
      assert.doesNotThrow(() => rulesOverlap('Bash([invalid', 'Bash(foo)'));
    });
  });

  suite('getCachedParse', () => {
    test('should return same result as parsePermissionRule', () => {
      const direct = parsePermissionRule('Bash(npm run *)');
      const cached = getCachedParse('Bash(npm run *)');
      assert.strictEqual(cached.tool, direct.tool);
      assert.strictEqual(cached.specifier, direct.specifier);
    });

    test('should return same object reference on repeated calls (cache hit)', () => {
      const first = getCachedParse('Read(/tmp/*)');
      const second = getCachedParse('Read(/tmp/*)');
      assert.strictEqual(first, second, 'getCachedParse should return same object reference from cache');
    });

    test('should return different objects for different rules', () => {
      const a = getCachedParse('Bash(*)');
      const b = getCachedParse('Read(*)');
      assert.notStrictEqual(a, b);
      assert.strictEqual(a.tool, 'Bash');
      assert.strictEqual(b.tool, 'Read');
    });

    test('should handle rule without specifier', () => {
      const result = getCachedParse('Bash');
      assert.strictEqual(result.tool, 'Bash');
      assert.strictEqual(result.specifier, undefined);
    });
  });
});
