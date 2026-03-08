# Domain Pitfalls

**Domain:** Adding visual overlap indicators, lock enforcement for plugins, and editor navigation fixes to a VS Code TreeView extension with ViewModel architecture
**Researched:** 2026-03-08
**Scope:** Integration pitfalls specific to v0.7.0 Visual Fidelity features on the existing v0.6.0 codebase (6,247 LOC, ViewModel layer, 14 node types)

---

## Critical Pitfalls

Mistakes that cause broken tree rendering, incorrect state, or require reverting the feature.

### Pitfall 1: Overlap Detection Confusing "Override" with "Overlap"

**What goes wrong:** The overlap indicator reuses the existing `isOverridden` field in `NodeContext`, causing overlap indicators to trigger override dimming, or override dimming to trigger overlap badges. These are two distinct concepts that get conflated.

**Why it happens:** The existing override system answers "is this value shadowed by a higher-precedence scope?" (one value wins, one loses). Overlap answers "does this entity exist in multiple scopes?" (both exist, neither necessarily loses). For example, an env var `API_KEY` in both User and Project Local scopes: Project Local overrides User (User is dimmed), but from User's perspective it also overlaps with Project Local. The current `ResolvedValue` type has `isOverridden` and `overriddenByScope` -- there is no `overlapsWithScopes: ConfigScope[]` field.

If overlap detection piggybacks on the `isOverridden` boolean or mutates `overriddenByScope`, the existing override dimming (ThemeColor `disabledForeground`) and override tooltips will break for nodes that overlap but are not overridden (i.e., the winning scope's node).

**Consequences:** The winning scope's entity gets incorrectly dimmed, or overlap badges appear only on the losing scope (missing the point of overlap indicators, which should show on both sides). Worst case: the `contextValue` pattern `{nodeType}.{editability}.overridden` gets applied to overlap nodes, triggering wrong context menu items.

**Prevention:**
- Add new fields to `NodeContext` or `BaseVM` for overlap, separate from override: `overlapsWithScopes?: ConfigScope[]` or `overlapCount?: number`.
- Never reuse `isOverridden` for overlap. Override = "this value is shadowed." Overlap = "this entity exists elsewhere too."
- The builder already has access to `allScopes` in every `build*` method. Overlap detection is a scan of other scopes for the same key, which is structurally similar to override resolution but returns different data.
- Do NOT modify the 5 existing `resolve*Override()` functions to also return overlap data. Write separate overlap-detection functions or inline the logic in the builder.

**Detection:** Set up User scope with `model: "claude-3-opus"` and Project Local with `model: "claude-3-sonnet"`. Verify: User's setting is dimmed (overridden), Project Local's is NOT dimmed. Both show overlap badge/description. If Project Local is dimmed, overlap is conflated with override.

---

### Pitfall 2: Hook Entry `keyPath` Does Not Match JSON Structure for `findKeyLine`

**What goes wrong:** Clicking a hook entry leaf node opens the editor but jumps to the wrong line or fails to navigate at all. This is the existing bug being fixed, but the fix can introduce new problems.

**Why it happens:** The hook entry `keyPath` is `['hooks', eventType, matcherIndex, hookIndex]` (e.g., `['hooks', 'PreToolUse', '0', '0']`). The `findKeyLine()` function in `jsonLocation.ts` interprets numeric string segments as array indices via `findArrayElement()`. The hooks JSON structure is:

```json
{
  "hooks": {
    "PreToolUse": [        // Array of matchers
      {                    // Matcher 0
        "matcher": "Bash",
        "hooks": [         // Array of hook commands
          {                // Hook 0
            "type": "command",
            "command": "echo hello"
          }
        ]
      }
    ]
  }
}
```

The keyPath `['hooks', 'PreToolUse', '0', '0']` means: find key `hooks`, then key `PreToolUse`, then array element 0 (matcher), then array element 0 (hook command). But `findArrayElement()` looks for `[` on or after the current search line. After finding matcher 0, it needs to navigate INTO the matcher object to find the `hooks` array, then find element 0 within THAT array. The current code does not descend into `matcher.hooks` -- it looks for the next `[` at the current level, which could match the wrong bracket.

**Consequences:** Editor jumps to the matcher object's opening brace instead of the hook command's opening brace. Or it finds the wrong array entirely and jumps to a completely unrelated line.

**Prevention:**
- The keyPath needs to include the intermediate `hooks` key within the matcher: `['hooks', 'PreToolUse', '0', 'hooks', '0']`. This changes the keyPath from 4 segments to 5. This is a breaking change to the keyPath contract.
- If the keyPath changes, update ALL code that reads hook entry keyPaths: the builder (`buildHookEntryVM`), the `findNodeByKeyPath` walker, the `contextValue` generation, and any commands that parse `keyPath` for hook entries.
- Alternative: fix `findKeyLine` to handle the nested-array-within-object case without changing keyPath. This is harder but avoids contract changes.
- Test with multiple matchers and multiple hooks per matcher to verify correct line targeting.

**Detection:** Create a config with 2 matchers, each with 2 hooks. Click each of the 4 hook entry leaf nodes. Verify the editor cursor lands on the correct hook command object each time, not on the matcher or a sibling hook.

---

### Pitfall 3: Plugin Checkbox Toggle Bypasses Lock Check at the VS Code API Level

**What goes wrong:** User clicks a plugin checkbox in the locked User scope, VS Code visually toggles it (checkbox state changes in the UI), and then the handler rejects the write and calls `treeProvider.refresh()` to revert. But the user sees a flicker: checked -> unchecked -> checked again. Worse, if `refresh()` is slow or debounced, the checkbox stays in the wrong state for a noticeable duration.

**Why it happens:** VS Code's `onDidChangeCheckboxState` fires AFTER the checkbox has already changed in the UI. The extension cannot prevent the toggle -- it can only react to it. The current code (extension.ts line 128-139) checks `isReadOnly` and calls `treeProvider.refresh()` to revert, but this is a full tree rebuild. The checkbox flickers because the revert is asynchronous.

The root cause is that the ViewModel sets `checkboxState` on the PluginVM regardless of lock state. The checkbox is always interactive at the VS Code API level. There is no VS Code API to make a checkbox read-only.

**Consequences:** Users see the checkbox flicker. If they click rapidly, multiple `refresh()` calls queue up. If a write is in flight to the same file from another operation, the `isWriteInFlight` check blocks the toggle but the checkbox is already visually changed.

**Prevention:**
- VS Code TreeView API does not support read-only checkboxes. The only mitigation is to minimize flicker latency.
- Instead of full `treeProvider.refresh()` on lock rejection, fire a targeted `_onDidChangeTreeData.fire(node)` for just the affected node. This is faster than a full rebuild.
- Consider not setting `checkboxState` at all when the scope is locked. Remove the checkbox entirely for locked plugins. This is the cleanest fix: no checkbox = no toggle = no flicker. The PluginVM builder already has access to `scopedConfig.isReadOnly`.
- If removing the checkbox when locked, ensure the `contextValue` pattern updates accordingly so context menu items adjust (e.g., no "Toggle Plugin" menu item for locked plugins).

**Detection:** Lock User scope. Click a plugin checkbox rapidly 5 times. Verify no write occurs, no error appears, and the checkbox state remains stable without visible flicker.

---

## Moderate Pitfalls

### Pitfall 4: Overlap Indicators Breaking the `description` String Contract

**What goes wrong:** Commands that read `node.description` for pre-fill values (editCommands.ts line 34: `node.description?.toString()`) get overlap text mixed in. For example, a setting's description changes from `"claude-3-opus"` to `"claude-3-opus (also in Project Local)"`. The edit command pre-fills `"claude-3-opus (also in Project Local)"` and if the user saves without modifying, it writes the overlap text as the value.

**Why it happens:** The existing `applyOverrideSuffix()` function in `builder.ts` already appends ` (overridden by X)` to description strings. Adding overlap text follows the same pattern. But overlap text is even more likely to be appended to value-bearing descriptions (env vars, settings, sandbox properties) because overlap applies to the winning scope too, not just the overridden one.

**Consequences:** Config values get corrupted with descriptive text. This is a data-loss bug that is hard to notice because the extension writes valid JSON -- just with wrong values.

**Prevention:**
- This is the same problem identified in v0.6.0 Pitfall 8 (description-as-data). The proper fix is to NOT append overlap text to the `description` field. Use a separate `badge` or custom tooltip instead.
- VS Code TreeItem has a `badge` property (`TreeItemLabel` with highlights, or numeric badge). However, TreeItem badge support is limited -- only `TreeItemDescription` and `tooltip` are reliably customizable.
- Use tooltip for overlap details (which scopes overlap). Use description only for the raw value. Add a visual indicator through icon color or a badge character.
- If overlap text MUST go in description, ensure edit commands strip it before pre-filling. Use a known sentinel like ` [+N scopes]` that can be regex-stripped.

**Detection:** Set up a setting that overlaps across scopes. Click "Edit Value" on it. Verify the pre-filled value in the input box is the raw value, not the value with overlap text appended.

---

### Pitfall 5: Overlap Detection Performance with Many Scopes and Entities

**What goes wrong:** Tree rendering becomes noticeably slow when overlap detection scans all scopes for every entity in every scope. The current override resolution is O(entities * scopes) per scope -- it runs for each entity in the current scope, checking higher-precedence scopes. Overlap detection is O(entities * all_scopes) because it must check ALL scopes, not just higher-precedence ones.

**Why it happens:** For N entities across S scopes, override detection does N*S comparisons per scope build. Overlap detection does the same but for every scope (not just higher ones). With 4 scopes and ~50 entities per scope, this is 200*4 = 800 comparisons per tree build. Not a problem. But permission rules use `rulesOverlap()` which does glob pattern matching, and with many rules this can be expensive.

**Consequences:** Tree refresh takes 100ms+ instead of <10ms. File watcher triggers noticeable UI lag.

**Prevention:**
- For simple key-based overlap (settings, env vars, plugins, sandbox), overlap detection is just a Set lookup -- fast enough.
- For permissions, do NOT do cross-scope `rulesOverlap()` for overlap indicators. Just check if the same literal rule string exists in another scope. Pattern overlap ("Bash(curl *)" overlapping with "Bash(*)") is an override concern, not an overlap indicator concern.
- Build the overlap data in a single pass over all scopes before building per-scope VMs, not inside each per-scope builder method. Collect `Map<entityKey, Set<ConfigScope>>` once, then look up during VM construction.

**Detection:** Create a config with 30+ permission rules per scope across 3 scopes. Trigger a tree refresh. Measure time using `console.time()` in the builder. If >50ms, optimize the overlap scan.

---

### Pitfall 6: `findKeyPathAtLine` Reverse Mapping Incorrect for Hook Array Indices

**What goes wrong:** Editor-to-tree sync fails for hook entries. When the user clicks on a hook command line in the JSON editor, `findKeyPathAtLine()` must produce a keyPath that matches the hook entry's `nodeContext.keyPath`. If the keyPath convention changes (Pitfall 2), the reverse mapping must also change.

**Why it happens:** `findKeyPathAtLine()` walks backward from the cursor line, detecting `{` at decreasing indent levels and using `countArrayElementIndex()` to produce numeric segments. It produces keyPaths like `['hooks', 'PreToolUse', '0', 'hooks', '0', 'command']`. The tree node's keyPath is `['hooks', 'PreToolUse', '0', '0']` (current) or `['hooks', 'PreToolUse', '0', 'hooks', '0']` (if fixed). The `findNodeByKeyPath` walker uses prefix matching to handle the mismatch, but this is fragile.

**Consequences:** Clicking on a hook command in the editor does not highlight the corresponding tree node, or highlights the wrong one (e.g., the event node instead of the entry node).

**Prevention:**
- If the hook entry keyPath changes, update `findKeyPathAtLine()` and `findNodeByKeyPath()` simultaneously.
- The `findNodeByKeyPath` walker already has fallback logic (lines 130-135: tries progressively shorter prefixes). Test that this fallback correctly resolves to the hook entry node.
- Write a test: given a JSON file with hooks, call `findKeyPathAtLine()` for a line inside a hook command object, assert the returned keyPath matches the builder's hook entry keyPath.

**Detection:** Open a config with hooks in the editor. Click on the `"command": "echo hello"` line inside a hook entry. Verify the tree highlights the correct hook entry node, not the hook event node or no node.

---

### Pitfall 7: Lock Enforcement Inconsistency Between Checkbox and Context Menu

**What goes wrong:** The plugin checkbox correctly rejects toggling when the scope is locked, but the "Toggle Plugin" context menu command (extension.ts line 160-188) has a subtly different code path that may not check lock state identically.

**Why it happens:** Both the checkbox handler and the toggle command check `isReadOnly`, but they get this value differently. The checkbox handler reads from `node.nodeContext.isReadOnly`, which is set by the builder based on `configStore.isScopeLocked()` at build time. The toggle command also reads from `node.nodeContext.isReadOnly`. But if the lock state changes AFTER the tree was built (user unlocks, then clicks context menu before tree refreshes), the node's `isReadOnly` is stale.

**Consequences:** Race condition: user unlocks scope, quickly right-clicks "Toggle Plugin", gets blocked because the tree hasn't refreshed yet. Or conversely: user locks scope, tree hasn't refreshed, context menu toggle succeeds when it shouldn't.

**Prevention:**
- The lock toggle fires `_onDidChange` which triggers `refresh()` which rebuilds all VMs. The tree should be up-to-date before the user can interact. The timing window is small (milliseconds between lock toggle and refresh completion).
- For safety, the toggle command should check `configStore.isScopeLocked()` directly, not rely on `node.nodeContext.isReadOnly`. This is a runtime check, not a cached-at-build-time check.
- The checkbox handler cannot do this because it doesn't have access to `configStore` -- it reads from `node.nodeContext`. Accept this asymmetry and document it.

**Detection:** Toggle lock on/off rapidly while clicking plugin checkboxes and context menu toggle commands. Verify no write occurs while the scope is supposed to be locked.

---

### Pitfall 8: Overlap Badge Appearing on Nodes Without Visual Space

**What goes wrong:** Overlap indicators (badges, description text) visually clash with existing override indicators. A node that is both overridden AND overlapping shows double decoration: dimmed icon + override description + overlap description. The label becomes unreadable in narrow tree panels.

**Why it happens:** The description string has limited visual space. Override text is already ` (overridden by User)`. Adding overlap text ` [+2 scopes]` makes descriptions like `claude-3-opus (overridden by Project Local) [+2 scopes]` which wraps or truncates.

**Consequences:** Tree panel looks cluttered. Description text gets truncated by VS Code's TreeItem rendering, hiding useful information. Users cannot distinguish override from overlap at a glance.

**Prevention:**
- Prioritize indicators: if a node is overridden, show the override indicator (more actionable). Overlap is informational only.
- Use tooltip for overlap details (lists which scopes), not description text.
- For description, use a short prefix like a count: `+2` or a dot character to indicate overlap, not a full text label.
- Consider using `iconPath` color variation: a distinct ThemeColor for overlap (not `disabledForeground`, which is taken by override).
- Test with a narrow tree panel (300px width). Verify all information is accessible via tooltip even if description is truncated.

**Detection:** Set up a setting that exists in 3 scopes, with the lowest-precedence one overridden. Verify the tree shows clear, non-cluttered indicators. Hover for tooltip. Verify tooltip contains the full overlap information.

---

## Minor Pitfalls

### Pitfall 9: Dead HookKeyValueVM/Node Code Cleanup Interacting with Hook Navigation Fix

**What goes wrong:** The v0.7.0 active requirements include "Clean up dead HookKeyValueVM/Node/builder code from v0.6.0." If this cleanup happens in the same phase as the hook navigation fix, the cleanup removes code that the navigation fix needs to reference or modify.

**Why it happens:** `HookKeyValueVM`, `HookKeyValueNode`, and `buildHookKeyValueVM()` exist in the codebase but are unused (hook entries are leaf nodes now). The hook navigation fix may need to add keyPath segments that align with the old HookKeyValue approach (descending into hook command properties). If cleanup deletes the VM type and builder method first, the navigation fix loses reference code.

**Prevention:**
- Fix hook navigation FIRST, then clean up dead code. The cleanup should happen in a separate commit after the navigation fix is verified.
- If the navigation fix needs to re-introduce HookKeyValue-like keyPath segments, decide this before cleaning up the dead code.

**Detection:** Run the test suite after cleanup. If hook navigation tests fail, the cleanup removed something still needed.

---

### Pitfall 10: Overlap Detection for MCP Servers and Hooks Not Meaningful

**What goes wrong:** Overlap indicators are added to MCP servers and hook events, but these entity types don't have meaningful overlap semantics. Two different MCP servers with the same name in different scopes are genuinely different configurations (different commands, URLs). Showing overlap implies they are "the same thing" when they may not be.

**Why it happens:** The overlap detection is applied uniformly to all entity types because the builder handles them similarly. But unlike settings (where `model` in two scopes is clearly the same setting), MCP server `"my-server"` in User scope and `"my-server"` in Project scope could have completely different configurations.

**Consequences:** Users see overlap indicators on MCP servers and think they should reconcile them, when actually having the same server name in different scopes with different configs is intentional.

**Prevention:**
- Only add overlap indicators to entity types where overlap is semantically meaningful: settings, env vars, plugins, sandbox properties, and permission rules.
- Skip overlap detection for MCP servers and hooks. These have unique-per-scope semantics.
- If MCP server overlap is desired later, show it with a different visual treatment that indicates "same name, possibly different config."

**Detection:** Set up a MCP server with the same name in User and Project scopes but different commands. Verify no misleading overlap indicator appears.

---

### Pitfall 11: `TreeItemCheckboxState` Type Incompatibility Across VS Code Versions

**What goes wrong:** The fix that removes checkbox state for locked plugins (`checkboxState: undefined`) causes a type error or runtime issue on older VS Code versions.

**Why it happens:** `TreeItem.checkboxState` was added in VS Code 1.79.0. The extension targets minimum 1.90.0, so the API exists. However, the behavior of setting `checkboxState` to `undefined` after it was previously set (on a tree refresh) may not cleanly remove the checkbox on all VS Code versions. Some versions may show a blank checkbox instead of no checkbox.

**Prevention:**
- Test on the minimum supported VS Code version (1.90.0) to verify checkbox removal behavior.
- If `undefined` doesn't cleanly remove the checkbox, consider using `TreeItemCollapsibleState.None` as a workaround, or keeping the checkbox but making the toggle command a no-op with an immediate revert.

**Detection:** Install VS Code 1.90.0 in a test environment. Lock User scope. Verify plugin nodes show no checkbox, not a blank/broken checkbox.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Add overlap detection to builder | Pitfall 1: conflating override and overlap | New fields on BaseVM/NodeContext, never reuse `isOverridden` |
| Add overlap detection to builder | Pitfall 5: performance with many entities | Single-pass overlap map before per-scope build |
| Add overlap visual indicators | Pitfall 4: description corruption for edit commands | Use tooltip for overlap details, minimal description markers |
| Add overlap visual indicators | Pitfall 8: visual clutter with override + overlap | Prioritize override indicator; overlap in tooltip |
| Add overlap visual indicators | Pitfall 10: MCP/hooks false overlap | Skip overlap for MCP servers and hooks |
| Fix plugin lock enforcement | Pitfall 3: checkbox flicker on locked scope | Remove checkbox entirely when locked, not just block the write |
| Fix plugin lock enforcement | Pitfall 7: stale isReadOnly after lock toggle | Toggle command should check configStore directly |
| Fix plugin lock enforcement | Pitfall 11: checkbox removal across VS Code versions | Test on minimum supported version |
| Fix hook leaf navigation | Pitfall 2: keyPath does not match JSON nesting | Include intermediate `hooks` key in keyPath, or fix findKeyLine |
| Fix hook leaf navigation | Pitfall 6: reverse mapping (editor-to-tree) breaks | Update findKeyPathAtLine if keyPath changes |
| Clean up dead HookKeyValue code | Pitfall 9: cleanup before navigation fix | Fix navigation first, then clean up dead code |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Overlap fields + override fields on `NodeContext` | Reuse `isOverridden` for overlap, causing override dimming on overlap-only nodes | Add separate `overlapsWithScopes` field; keep `isOverridden` strictly for precedence-shadowed values |
| Overlap in `description` + `editCommands` pre-fill | Overlap text gets saved as config value | Never append overlap text to description; use tooltip or badge |
| Lock state + `checkboxState` on PluginVM | Checkbox exists but toggle is rejected, causing flicker | Omit `checkboxState` entirely when scope is locked |
| Lock state + `contextValue` pattern | Locked plugin gets `plugin.readOnly` contextValue, breaking context menu | Verify `contextValue` patterns in package.json handle the locked-no-checkbox case |
| Hook keyPath change + `findKeyLine` | keyPath `['hooks', 'PreToolUse', '0', '0']` doesn't navigate nested arrays | Include intermediate property keys: `['hooks', 'PreToolUse', '0', 'hooks', '0']` |
| Hook keyPath change + `findKeyPathAtLine` | Reverse mapping produces different keyPath than forward mapping | Test both directions with same JSON file and line number |
| Hook keyPath change + `findNodeByKeyPath` | Walker prefix matching fails with new keyPath length | Update walker logic if keyPath depth changes from 4 to 5 segments |
| Overlap detection + section item counts | Overlap badges on section headers (`3 settings [+5 overlaps]`) add noise | Do not show overlap on section nodes, only on leaf entities |
| Dead code cleanup + navigation fix | Removing `buildHookKeyValueVM` before deciding if navigation fix needs similar logic | Fix navigation first, verify, then clean up |

---

## "Looks Done But Isn't" Checklist

- [ ] **Overlap separate from override:** Node with overlap but no override is NOT dimmed. Node with override but no overlap shows ONLY override indicator.
- [ ] **Overlap on winning scope:** The highest-precedence scope's entity shows an overlap indicator too, not just the overridden one.
- [ ] **Edit commands clean:** Click "Edit Value" on a setting with overlap. Pre-filled value is the raw value only, no overlap text.
- [ ] **Plugin checkbox absent when locked:** Lock User scope. Plugin nodes show no checkbox at all (not a greyed-out checkbox).
- [ ] **Plugin checkbox present when unlocked:** Unlock User scope. Plugin nodes show working checkboxes. Toggle works.
- [ ] **No flicker:** Lock User scope. Click where the checkbox used to be. No flicker, no error.
- [ ] **Hook navigation accurate:** Click each hook entry leaf. Editor opens correct file and cursor lands on the correct hook command object.
- [ ] **Hook reverse navigation:** Click on a hook command line in the JSON editor. Tree highlights the correct hook entry node.
- [ ] **Multiple matchers:** Config with 2+ matchers, each with 2+ hooks. Each hook entry navigates to the correct line.
- [ ] **MCP servers no overlap:** Same server name in two scopes. No overlap indicator (or intentional different-config indicator).
- [ ] **Performance:** Config with 30+ entities per scope. Tree refresh < 50ms.
- [ ] **Dead code removed:** No unused `HookKeyValueVM`/`HookKeyValueNode`/`buildHookKeyValueVM` references after cleanup.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Overlap-override conflation (P1) | MEDIUM | Add new fields; remove any mutations to `isOverridden` for overlap; retest all override indicators |
| Hook keyPath mismatch (P2) | HIGH | Changing keyPath is a cross-cutting contract change; must update builder, walker, and location utils simultaneously |
| Checkbox flicker (P3) | LOW | Remove `checkboxState` from PluginVM when locked; test locked/unlocked transitions |
| Description corruption (P4) | LOW | Move overlap text to tooltip; strip from description; verify edit pre-fill |
| Performance regression (P5) | MEDIUM | Pre-compute overlap map in single pass; avoid per-entity all-scopes scan |
| Editor-to-tree sync broken (P6) | MEDIUM | Update `findKeyPathAtLine` to match new keyPath convention; add test coverage |
| Lock check inconsistency (P7) | LOW | Add runtime `configStore.isScopeLocked()` check in toggle command |
| Visual clutter (P8) | LOW | Simplify overlap indicator to tooltip-only; remove description text |
| Cleanup-before-fix ordering (P9) | LOW | Revert cleanup commit; fix navigation first |
| False overlap on MCP/hooks (P10) | LOW | Skip overlap detection for these entity types |

---

## Sources

- Direct codebase analysis of `src/viewmodel/builder.ts` (1041 LOC), `src/config/overrideResolver.ts` (195 LOC), `src/utils/jsonLocation.ts` (262 LOC), `src/extension.ts` (401 LOC), `src/commands/pluginCommands.ts` (169 LOC), `src/tree/configTreeProvider.ts` (197 LOC), `src/tree/nodes/pluginNode.ts`, `src/tree/nodes/baseNode.ts`, `src/tree/lockDecorations.ts`
- VS Code TreeView API: `TreeItem.checkboxState` behavior, `onDidChangeCheckboxState` post-mutation semantics, `FileDecorationProvider` for `resourceUri`-based styling
- Confidence: HIGH -- all pitfalls derived from direct code reading of this specific codebase and its existing patterns

---
*Pitfalls research for v0.7.0: Visual Fidelity (overlap indicators, lock enforcement, hook navigation)*
*Researched: 2026-03-08*
