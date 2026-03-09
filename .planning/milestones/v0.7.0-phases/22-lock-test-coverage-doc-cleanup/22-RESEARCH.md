# Phase 22: Lock Test Coverage & Doc Cleanup - Research

**Researched:** 2026-03-09
**Domain:** VS Code extension testing (Mocha), ViewModel builder unit tests, documentation maintenance
**Confidence:** HIGH

## Summary

Phase 22 closes audit gaps for LOCK-01, LOCK-02, and LOCK-03 requirements. The implementation was completed in Phase 20 -- the `buildPlugins()` method in `src/viewmodel/builder.ts` already contains conditional logic that shows static icons for locked scopes and removes checkboxes. However, no automated tests for this lock-aware behavior exist in `builder.test.ts`, and the REQUIREMENTS.md checkboxes remain unchecked.

The test infrastructure is fully ready. The `createMockConfigStore` helper already accepts `lockedScopes` parameter, and `makeScopedConfig` accepts `isReadOnly` override. The existing plugin checkbox test (line 277) provides a direct template. The phase is purely additive: write tests, verify they pass, update docs.

**Important implementation detail:** The current code (lines 748-752 of builder.ts) shows `ThemeIcon('check')` for locked enabled plugins and `ThemeIcon('circle-slash', disabledForeground)` for locked disabled plugins. LOCK-02 requirement states "disabled plugins show no icon instead of checkbox" -- but the implementation shows a `circle-slash` icon. Tests should verify what the code actually does. If the requirement text needs updating to match the implementation (which provides better UX with a visual indicator), that is part of the doc cleanup.

**Primary recommendation:** Write three test cases using existing mock infrastructure, verify against actual builder output, then check LOCK-01/02/03 boxes in REQUIREMENTS.md.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOCK-01 | When User scope is locked, plugin nodes show checkmark icon for enabled plugins instead of checkbox | Builder already produces `ThemeIcon('check')` when `isReadOnly: true && enabled: true`. Test must assert `icon.id === 'check'` and `checkboxState === undefined`. |
| LOCK-02 | When User scope is locked, disabled plugins show no icon instead of checkbox | Builder produces `ThemeIcon('circle-slash', disabledForeground)` when `isReadOnly: true && enabled: false`. Test must assert icon matches implementation. REQUIREMENTS.md description may need alignment with actual behavior. |
| LOCK-03 | Lock state change refreshes plugin node display between checkbox and icon modes | Driven by `isReadOnly` flag on `ScopedConfig` which toggles on lock/unlock. Test verifies same config with `isReadOnly: true` vs `isReadOnly: false` produces different icon/checkbox states. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mocha | (devDep) | Test runner | Already configured in project via `npm run test` |
| assert | (Node built-in) | Assertions | Used throughout existing test suite |
| vscode | (test host) | VS Code API types | Extension test host provides runtime |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vscode/test-electron | (devDep) | Launches Extension Development Host for tests | Already wired in `test/runTests.js` |

No new dependencies needed. All infrastructure exists.

## Architecture Patterns

### Test File Structure (existing pattern)
```
test/suite/viewmodel/builder.test.ts
  ├── Test Helpers (createMockConfigStore, makeScopedConfig, findVM, findAllVMs)
  ├── suite('Cleanup Verification')
  ├── suite('TreeViewModelBuilder - Smoke')
  ├── suite('Entity Types (TEST-01)')
  ├── suite('Override Resolution (TEST-02)')
  ├── suite('NodeContext Preservation (TEST-03)')
  └── suite('Lock-Aware Plugin Display (LOCK-01/02/03)')  ← NEW
```

### Pattern: Lock-Aware Test Setup
```typescript
// Create locked User scope config
const configs: ScopedConfig[] = [
  makeScopedConfig(
    ConfigScope.User,
    { enabledPlugins: { 'enabled-plugin': true, 'disabled-plugin': false } },
    { isReadOnly: true },  // Simulates lock state
  ),
];
const builder = new TreeViewModelBuilder(
  createMockConfigStore(configs, { lockedScopes: [ConfigScope.User] }),
);
```

**Key insight:** The `isReadOnly: true` override on `makeScopedConfig` is what triggers the locked behavior in the builder. The `lockedScopes` on the mock ConfigStore is used by `buildSingleRoot()` to set `isReadOnly` on the effective ScopedConfig, but since we pass `isReadOnly: true` directly, both paths converge.

### Pattern: Asserting Icon State
```typescript
// Enabled locked plugin: check icon, no checkbox
assert.strictEqual(plugin.icon?.id, 'check');
assert.strictEqual(plugin.checkboxState, undefined);

// Disabled locked plugin: circle-slash icon, no checkbox
assert.strictEqual(plugin.icon?.id, 'circle-slash');
assert.strictEqual(plugin.checkboxState, undefined);

// Unlocked plugin: extensions icon, has checkbox
assert.strictEqual(plugin.icon?.id, 'extensions');
assert.notStrictEqual(plugin.checkboxState, undefined);
```

### Anti-Patterns to Avoid
- **Testing lock via ConfigStore mock only:** The `lockedScopes` mock affects `buildSingleRoot` flow, but tests that pass `isReadOnly` directly on `makeScopedConfig` are more direct and less fragile.
- **Asserting icon as undefined for LOCK-02:** The implementation uses `circle-slash` icon, not undefined. Tests must match implementation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mock ConfigStore | Full ConfigStore implementation | Existing `createMockConfigStore` helper | Already handles all methods builder calls |
| Test data factories | Complex config objects | Existing `makeScopedConfig` with overrides | Handles defaults, allows targeted override |
| VM tree search | Manual tree traversal | Existing `findVM` / `findAllVMs` helpers | Battle-tested recursive search |

## Common Pitfalls

### Pitfall 1: LOCK-02 Requirement Text vs Implementation
**What goes wrong:** Writing test that asserts `icon === undefined` for disabled locked plugins based on requirement text "show no icon"
**Why it happens:** LOCK-02 requirement says "no icon" but implementation shows `circle-slash` with `disabledForeground` color
**How to avoid:** Test against actual builder output. Update REQUIREMENTS.md text if needed to say "show disabled indicator icon instead of checkbox"
**Warning signs:** Test fails with "expected undefined but got ThemeIcon"

### Pitfall 2: checkboxState Assertion
**What goes wrong:** Asserting `checkboxState === null` or checking truthiness
**Why it happens:** The builder uses spread `...({})` to omit the key entirely
**How to avoid:** Assert `checkboxState === undefined` (property absent from object)

### Pitfall 3: Forgetting LOCK-03 Requires Two Builds
**What goes wrong:** Only testing locked state, not the transition
**Why it happens:** LOCK-03 is about lock state *change* restoring checkboxes
**How to avoid:** Build once with `isReadOnly: true`, build again with `isReadOnly: false`, assert different output

## Code Examples

### LOCK-01 Test: Locked Enabled Plugin Shows Check Icon
```typescript
// Source: builder.ts lines 748-752
test('LOCK-01: locked enabled plugin shows check icon, no checkbox', () => {
  const configs: ScopedConfig[] = [
    makeScopedConfig(
      ConfigScope.User,
      { enabledPlugins: { 'my-plugin': true } },
      { isReadOnly: true },
    ),
  ];
  const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
  const vms = builder.build();

  const plugin = findVM(vms, NodeKind.Plugin, 'my-plugin');
  assert.ok(plugin, 'Plugin should exist');
  assert.strictEqual(plugin.icon?.id, 'check', 'Locked enabled plugin should show check icon');
  assert.strictEqual(plugin.checkboxState, undefined, 'Locked plugin should have no checkbox');
});
```

### LOCK-02 Test: Locked Disabled Plugin Shows Disabled Icon
```typescript
// Source: builder.ts lines 748-752
test('LOCK-02: locked disabled plugin shows disabled icon, no checkbox', () => {
  const configs: ScopedConfig[] = [
    makeScopedConfig(
      ConfigScope.User,
      { enabledPlugins: { 'my-plugin': false } },
      { isReadOnly: true },
    ),
  ];
  const builder = new TreeViewModelBuilder(createMockConfigStore(configs));
  const vms = builder.build();

  const plugin = findVM(vms, NodeKind.Plugin, 'my-plugin');
  assert.ok(plugin, 'Plugin should exist');
  assert.strictEqual(plugin.icon?.id, 'circle-slash', 'Locked disabled plugin should show circle-slash icon');
  assert.strictEqual(plugin.checkboxState, undefined, 'Locked plugin should have no checkbox');
});
```

### LOCK-03 Test: Unlock Restores Checkboxes
```typescript
// Source: builder.ts lines 759-763
test('LOCK-03: unlocking restores checkboxes', () => {
  const pluginConfig = { enabledPlugins: { 'my-plugin': true, 'other': false } };

  // Locked state
  const lockedConfigs = [makeScopedConfig(ConfigScope.User, pluginConfig, { isReadOnly: true })];
  const lockedVMs = new TreeViewModelBuilder(createMockConfigStore(lockedConfigs)).build();
  const lockedPlugin = findVM(lockedVMs, NodeKind.Plugin, 'my-plugin');
  assert.strictEqual(lockedPlugin?.checkboxState, undefined, 'Locked: no checkbox');

  // Unlocked state
  const unlockedConfigs = [makeScopedConfig(ConfigScope.User, pluginConfig)];
  const unlockedVMs = new TreeViewModelBuilder(createMockConfigStore(unlockedConfigs)).build();
  const unlockedPlugin = findVM(unlockedVMs, NodeKind.Plugin, 'my-plugin');
  assert.strictEqual(
    unlockedPlugin?.checkboxState,
    vscode.TreeItemCheckboxState.Checked,
    'Unlocked: checkbox restored',
  );
  assert.strictEqual(unlockedPlugin?.icon?.id, 'extensions', 'Unlocked: extensions icon');
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Checkbox always present on plugins | Conditional checkbox based on `isReadOnly` | Phase 20 (v0.7.0) | Eliminates click-flicker on locked plugins |
| Single `extensions` icon for all plugins | `check` / `circle-slash` / `extensions` based on state | Phase 20 (v0.7.0) | Visual feedback for lock state |

## Open Questions

1. **LOCK-02 requirement text alignment**
   - What we know: Implementation shows `circle-slash` icon with `disabledForeground` color for locked disabled plugins
   - What's unclear: Whether REQUIREMENTS.md text "show no icon" should be updated to match implementation
   - Recommendation: Update REQUIREMENTS.md to say "show disabled indicator icon (circle-slash) instead of checkbox" as part of doc cleanup

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha (via @vscode/test-electron) |
| Config file | `.vscode-test.mjs` or `test/runTests.js` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOCK-01 | Locked enabled plugin shows check icon, no checkbox | unit | `npm run test` | Partially (file exists, test case missing) |
| LOCK-02 | Locked disabled plugin shows disabled icon, no checkbox | unit | `npm run test` | Partially (file exists, test case missing) |
| LOCK-03 | Lock toggle changes plugin display between icon and checkbox modes | unit | `npm run test` | Partially (file exists, test case missing) |

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. The test file, helpers, and mock functions all exist. Only new test cases need to be added.

## Sources

### Primary (HIGH confidence)
- `src/viewmodel/builder.ts` lines 697-768 -- actual `buildPlugins` implementation with lock-aware conditional logic
- `src/viewmodel/types.ts` lines 29-58 -- BaseVM interface with optional `icon` and `checkboxState`
- `test/suite/viewmodel/builder.test.ts` -- existing test suite with mock helpers and plugin checkbox test
- `.planning/phases/20-lock-aware-plugin-display/20-01-PLAN.md` -- Phase 20 plan specifying LOCK requirement implementation

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` -- LOCK-01/02/03 requirement definitions (LOCK-02 text may not match implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all infrastructure exists
- Architecture: HIGH - direct inspection of source code and test patterns
- Pitfalls: HIGH - identified concrete LOCK-02 text vs implementation mismatch from code review

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- internal project, no external dependencies changing)
