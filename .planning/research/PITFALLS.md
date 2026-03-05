# Domain Pitfalls

**Domain:** VS Code extension -- visual overlap indicators, plugin lock enforcement, hook leaf navigation fixes
**Researched:** 2026-03-05
**Confidence:** HIGH (verified against existing codebase, VS Code API docs, and prior milestone learnings)

---

## Critical Pitfalls

### Pitfall 1: Hook Leaf keyPath Contains Array Indices That Don't Match JSON Structure

**What goes wrong:**
HookKeyValueNode builds its keyPath as `['hooks', eventType, matcherIndex, hookIndex, propertyKey]` -- five segments with two numeric indices. The `findKeyLine()` utility in `jsonLocation.ts` treats numeric segments as array element indices and counts the Nth element after an opening bracket. However, the Claude Code hooks JSON structure nests matchers as an array of objects, each containing a `hooks` array of objects. The `findKeyLine` function walks segments sequentially: it finds the `hooks` key at indent 2, then looks for a `[` to resolve the matcherIndex, then needs to find the `hooks` key *inside* the matcher object, then another `[` for the hookIndex, then the property key. The problem is that after resolving the matcherIndex (which lands on the opening `{` of the matcher object), `findKeyLine` sets `searchFromLine` to that line and proceeds to find the next segment -- but it treats `hookIndex` as another array element lookup and searches for a `[` bracket starting from the matcher object line. It finds the `hooks: [` inside the matcher, resolves the hookIndex correctly, but then the final `propertyKey` segment expects an indent of `(depth+1)*2 = 12` spaces. The actual indent of properties inside a hook entry object (like `type`, `command`, `timeout`) is 12 spaces in standard JSON.stringify output -- so this *should* work in principle.

**Why it actually breaks:**
The real issue is that `findKeyLine` uses `searchFromLine` to advance linearly through the file. When the matcherIndex is resolved, `searchFromLine` points to the opening `{` of that matcher. But `findObjectKey` for the next segment (`hookIndex` as a string -- wait, it IS numeric, so `findArrayElement` is used) searches for a `[` starting from that line. The `[` it finds could be the wrong one if the matcher object has other array-valued properties before `hooks` (it doesn't in practice, but the matcher has a `matcher` string property and then `hooks`). The more likely failure: after resolving `hookIndex` to a specific hook entry `{`, the next segment is the property key (e.g., `command`). `findObjectKey` searches for `"command"` at indent `(4+1)*2 = 10`. But the actual indent is 10 spaces (5 levels: root object -> hooks -> matchers array element -> hooks array element -> property). Wait -- standard JSON.stringify uses 2-space indent: level 0 = `{`, level 1 = `"hooks"`, level 2 = array element `[`, level 3 = matcher object `{`, level 4 = `"hooks"` inside matcher, level 5 = hook array element, level 6 = property. That's 12 spaces of indent for the property, but `findObjectKey` computes `(depth+1)*2` where depth is the keyPath index (0-4), so for the 5th segment (index 4) it expects `(4+1)*2 = 10` spaces. **The expected indent (10) does not match the actual indent (12)**, because the keyPath skips the implicit `hooks` key inside the matcher object -- the tree keyPath is `['hooks', 'PreToolUse', '0', '0', 'command']` but the JSON nesting is `hooks > PreToolUse > [0] > hooks > [0] > command` which is 6 levels deep, not 5.

**Consequences:**
Clicking a hook leaf node (like `type: command` or `timeout: 10000`) opens the file but navigates to the wrong line or fails to navigate at all (returns undefined). The cursor stays at the top of the file or jumps to an unrelated line.

**Prevention:**
The `findKeyLine` indent calculation assumes each keyPath segment maps to exactly one JSON nesting level. For hooks, the tree keyPath omits the inner `hooks` key (the array property name inside a HookMatcher). Either:
1. **Fix `findKeyLine` to not assume `indent = (depth+1)*2`** -- instead, search for the key at any indent below the current position, or
2. **Adjust the hook node keyPath to include the inner `hooks` segment** -- making it `['hooks', eventType, matcherIndex, 'hooks', hookIndex, propertyKey]` which matches the actual JSON nesting.

Option 2 is cleaner because it keeps `findKeyLine` generic and correct for all node types, but requires updating `HookEntryNode` and `HookKeyValueNode` keyPaths and verifying that `findNodeByKeyPath` in the tree provider still matches correctly for editor-to-tree sync.

**Detection:**
Click any hook leaf node (type, command, timeout, async) and observe whether the editor cursor lands on the correct line. Compare the node's keyPath with the actual JSON structure.

---

### Pitfall 2: `onDidChangeCheckboxState` Fires Before isReadOnly Can Block the Write

**What goes wrong:**
The VS Code TreeView checkbox toggle fires `onDidChangeCheckboxState` as a *notification* after the checkbox visual state has already changed in the UI. The handler in `extension.ts` checks `isReadOnly` and shows an info message ("User scope is locked"), but the checkbox has already flipped visually. The handler does `continue` (skips the write), but it never reverts the checkbox state. The tree shows the plugin as enabled/disabled contrary to the actual file on disk.

**Why it happens:**
VS Code's `onDidChangeCheckboxState` is a post-change event, not a pre-change guard. There is no `onWillChangeCheckboxState` or way to cancel the state change. The current handler at line 128-156 of `extension.ts` checks `isReadOnly` and exits early, but the visual checkbox state has already toggled. Only `treeProvider.refresh()` (which rebuilds nodes from disk state) can revert it, but `refresh()` is only called in the `catch` block for write errors -- not in the `isReadOnly` early-return path.

**Consequences:**
When User scope is locked and the user clicks a plugin checkbox:
1. Checkbox visually toggles (checked -> unchecked or vice versa).
2. Handler detects `isReadOnly`, shows "User scope is locked" message.
3. No write happens. No refresh happens.
4. Plugin checkbox is now visually out of sync with disk state.
5. Only a manual config file edit (triggering file watcher) or extension reload will correct it.

**Prevention:**
Call `treeProvider.refresh()` in the `isReadOnly` early-return path, not just in the error catch block:
```typescript
if (isReadOnly || !filePath || keyPath.length < 2) {
  if (isReadOnly && node.nodeContext.scope === ConfigScope.User) {
    vscode.window.showInformationMessage(MESSAGES.userScopeLocked);
  }
  treeProvider.refresh(); // <-- revert checkbox visual state
  continue;
}
```
The same fix is needed in the `togglePlugin` command handler (line 159-187), though that path is less likely to trigger since context menu items are already hidden for readOnly nodes.

**Detection:**
Lock User scope, click a plugin checkbox under User scope, observe the checkbox state vs. the actual file content.

---

### Pitfall 3: Overlap Detection Conflates "Same Entity in Multiple Scopes" with "Override"

**What goes wrong:**
The existing `overrideResolver.ts` functions (`resolvePluginOverride`, `resolveEnvOverride`, `resolvePermissionOverride`, etc.) only check whether a *higher-precedence* scope defines the same entity. They return `isOverridden: true` only when the current scope is "losing" to a higher scope. Visual overlap indicators need to show that an entity *exists in multiple scopes* regardless of which scope wins. If the overlap indicator reuses the existing override resolver, it will only mark entities in lower-precedence scopes -- the winning scope's entity will show no indicator, even though it overlaps with definitions in other scopes.

**Why it happens:**
The existing override model answers "is this value being overridden?" (a property of the losing side). Overlap indicators answer "does this entity appear in other scopes?" (a property of any side, including the winner). These are different questions. Using `isOverridden` for overlap means the highest-precedence scope's entity never shows an overlap indicator, which is misleading -- users won't realize the same permission rule or env var exists in a lower scope that they might want to clean up.

**Consequences:**
- A permission rule in Project Local (highest precedence for project scopes) will show no overlap indicator even though the same rule exists in User scope.
- Users see overlap markers only on the "losing" side, leading them to believe the winning side is unique when it isn't.
- Inconsistent mental model: "Why does User scope show an overlap badge but Project Local doesn't?"

**Prevention:**
Create a separate overlap detection function (or extend the existing ones) that checks *all* scopes bidirectionally:
```typescript
export function detectOverlap(
  entityKey: string,
  currentScope: ConfigScope,
  allScopes: ScopedConfig[],
): { hasOverlap: boolean; overlappingScopes: ConfigScope[] } {
  const overlapping = allScopes
    .filter(sc => sc.scope !== currentScope && entityExistsInScope(entityKey, sc))
    .map(sc => sc.scope);
  return { hasOverlap: overlapping.length > 0, overlappingScopes: overlapping };
}
```
Keep the existing `isOverridden` system intact for override styling (strikethrough, dimming). Add overlap as a *separate* visual treatment (badge, icon decoration, description suffix).

**Detection:**
Define the same setting in two scopes. Check whether *both* sides show an overlap indicator.

---

## Moderate Pitfalls

### Pitfall 4: Overlap Indicator on PermissionRuleNode Requires Fuzzy Matching, Not Exact Key Comparison

**What goes wrong:**
For most entity types (env vars, plugins, settings, sandbox properties), overlap detection is straightforward: same key name in multiple scopes means overlap. For permission rules, the comparison is more complex. A rule `Bash(npm *)` in User scope and `Bash(npm install)` in Project scope are overlapping (the User rule is a superset), but they have different string values. Simple string equality will miss this overlap entirely.

**Why it happens:**
Permission rules use glob-like patterns. The existing `rulesOverlap()` utility in `utils/permissions.ts` already handles this fuzzy matching for override detection. But if the overlap indicator implementation does a naive "does this exact string exist in another scope?" check, it will miss partial overlaps.

**Prevention:**
Reuse the existing `rulesOverlap()` function for permission overlap detection. For each permission rule in a given scope, check all rules in all other scopes (across all categories: allow, deny, ask) using `rulesOverlap()`. This is the same approach the existing `resolvePermissionOverride` uses, just extended bidirectionally.

**Detection:**
Add `Bash(npm *)` to User allow list and `Bash(npm install)` to Project allow list. Verify both show overlap indicators.

---

### Pitfall 5: Tree Node ID Collisions When Adding Overlap Metadata to Existing Nodes

**What goes wrong:**
The `baseNode.ts` `computeId()` method generates IDs as `${workspaceFolderUri}/${scope}/${keyPath.join('/')}`. If overlap indicators are implemented by adding new child nodes (e.g., "Also defined in: User scope") or by duplicating nodes across scopes, the IDs may collide. The `parentMap` in `ConfigTreeProvider` stores one parent per ID -- colliding IDs cause `getParent()` to return the wrong parent, breaking `treeView.reveal()` and editor-to-tree sync.

**Why it happens:**
Tree node IDs must be globally unique across the entire tree. The current ID scheme ensures uniqueness because each scope+keyPath combination is unique. But if the overlap feature introduces cross-scope reference nodes (nodes that visually appear under one scope but reference another scope's entity), the ID scheme must be extended to avoid collisions.

**Prevention:**
Do NOT add cross-scope child nodes. Instead, use in-place visual treatments on existing nodes:
- Add a description suffix like `"(also in User, Project Local)"`.
- Use a distinct icon or icon overlay (e.g., `$(layers)` or `$(copy)` codicon) for overlapping entities.
- Add tooltip details showing which scopes define the same entity.

This approach requires no new nodes, no ID changes, and no parent map complications. The overlap information is computed during node construction and baked into the existing node's presentation.

**Detection:**
After implementing overlap indicators, run the Expand All command and verify no duplicate IDs in the console. Test editor-to-tree sync with overlapping entities.

---

### Pitfall 6: Overlap Indicator Performance -- N*M Scope Comparisons Per Entity

**What goes wrong:**
Naive overlap detection checks every entity against every scope. For N entities across M scopes, this is O(N*M) per tree render. With 4 scopes and a typical config (10-30 entities per section), this is manageable. But permission rules with glob matching (`rulesOverlap()`) are more expensive -- comparing every rule against every rule in every other scope is O(R^2 * M) where R is the total number of rules.

**Why it happens:**
The current override resolver already performs similar O(R*M) work per entity, so the overlap detector adds roughly 2x overhead (checking in both directions instead of just higher-precedence). For typical configs this is under 1ms. The risk emerges with large permission lists (50+ rules across 4 scopes = 200+ rules * 200 comparisons = 40,000 `rulesOverlap()` calls).

**Prevention:**
This is unlikely to be a problem at realistic config sizes. But as a safeguard:
- Compute overlap data once per `ConfigStore.reload()` and cache it (similar to how `PluginMetadataService` caches metadata).
- Invalidate the cache on any config change (already happens via `onDidChange` event).
- Do not recompute overlaps during tree node rendering -- precompute and look up.

**Detection:**
Profile tree rendering time with a config containing 50+ permission rules across 4 scopes. If rendering takes >100ms, implement caching.

---

### Pitfall 7: `findKeyLine` Indent Assumption Breaks for Non-Standard JSON Formatting

**What goes wrong:**
`findKeyLine` assumes 2-space indentation per level (produced by `JSON.stringify(data, null, 2)`). If a user manually edits a config file with tabs, 4-space indentation, or no consistent formatting, `findKeyLine` will fail to find the correct line. This is an existing limitation that affects all `revealInFile` navigation, not just hook leaves.

**Why it happens:**
The `findObjectKey` function builds a `needle` string with `' '.repeat(expectedIndent)` and checks `lines[i].startsWith(needle)`. Any file not formatted with exactly 2-space indentation will fail this check.

**Prevention:**
For the hook leaf fix specifically, if Option 2 from Pitfall 1 is chosen (adjusting keyPath to include the inner `hooks` segment), the indent calculation still assumes 2-space. This is acceptable because:
1. `configWriter.ts` always writes files with `JSON.stringify(data, null, 2)`, so files written by the extension are guaranteed 2-space.
2. Externally edited files may break, but this is a pre-existing issue, not a regression.

Document this limitation. A more robust `findKeyLine` that searches by key name regardless of indent would be a future improvement but is out of scope for this milestone.

**Detection:**
Open a config file, reformat it with 4-space tabs, and try clicking a tree node -- `revealInFile` will fail to navigate.

---

### Pitfall 8: Overlap Indicator Must Not Interfere with Existing Override Styling

**What goes wrong:**
Existing override styling uses `applyOverrideStyle()` in `baseNode.ts` to append `(overridden by {Scope})` to the description. If overlap indicators also modify the description (e.g., `(also in User)`), the two decorations must be combined, not one replacing the other. An entity can be both overridden AND overlapping (e.g., same env var in User scope is overridden by Project Local, and also exists in Project Shared).

**Why it happens:**
Both `applyOverrideStyle()` and a hypothetical `applyOverlapStyle()` would modify `this.description`. If they run independently and both assign to `this.description`, the second one overwrites the first.

**Prevention:**
Apply overlap styling before or after override styling in the `finalize()` call chain, building on the existing description string rather than replacing it. Or combine both into a single styling step that considers both override and overlap state:
```typescript
protected applyStyles(): void {
  const parts: string[] = [];
  if (this.nodeContext.isOverridden) {
    parts.push(`overridden by ${SCOPE_LABELS[this.nodeContext.overriddenByScope!]}`);
  }
  if (this.nodeContext.overlappingScopes?.length) {
    parts.push(`also in ${this.nodeContext.overlappingScopes.map(s => SCOPE_LABELS[s]).join(', ')}`);
  }
  if (parts.length > 0) {
    this.description = `${this.description ?? ''} (${parts.join('; ')})`.trim();
  }
}
```

**Detection:**
Create the same env var in all 4 scopes. Check that the User scope entry shows both override and overlap information, not just one.

---

## Minor Pitfalls

### Pitfall 9: Checkbox Rollback via `refresh()` Causes Tree Scroll Position Reset

**What goes wrong:**
When `treeProvider.refresh()` is called to revert a locked-scope checkbox toggle (Pitfall 2 fix), the entire tree is rebuilt. If the tree has been scrolled down, the refresh may reset the scroll position to the top, disorienting the user.

**Prevention:**
This is a known VS Code TreeView limitation. Mitigation: fire a targeted refresh (`_onDidChangeTreeData.fire(node)`) instead of a full refresh (`_onDidChangeTreeData.fire(undefined)`). However, targeted refresh of a TreeItem whose checkbox state changed may not be sufficient -- VS Code might not re-read the checkbox state from the provider for an existing node instance. Test both approaches. If targeted refresh doesn't work, accept the full refresh and document the minor UX regression.

**Detection:**
Scroll the tree to the bottom, lock User scope, click a plugin checkbox under User scope, observe scroll position after the info message.

---

### Pitfall 10: `findKeyPathAtLine` Reverse Mapping Incomplete for Hook Entries

**What goes wrong:**
The editor-to-tree sync uses `findKeyPathAtLine` to map cursor position to a keyPath, then `findNodeByKeyPath` to locate the tree node. If the hook leaf keyPath is changed (Pitfall 1 fix), `findKeyPathAtLine` must produce the *same* keyPath format. Currently, `findKeyPathAtLine` walks backward through indent levels and emits numeric array indices when it encounters an opening `{` inside an array. If the tree keyPath is changed to include the inner `hooks` segment, `findKeyPathAtLine` already produces this naturally because it walks up through `hooks > [index] > hooks > [index] > propertyKey`, emitting each key it encounters.

**Prevention:**
After fixing the hook leaf keyPath (Pitfall 1), verify that `findKeyPathAtLine` produces a matching keyPath when the cursor is on a property inside a hook entry. The reverse mapping should work correctly because `findKeyPathAtLine` follows the actual JSON structure, and the fixed keyPath now matches that structure.

Test: Place cursor on `"command": "npm test"` inside a hook entry. Log the keyPath from `findKeyPathAtLine`. Verify it matches the tree node's `nodeContext.keyPath`.

**Detection:**
Edit a hook entry's property in the editor, move cursor to it, check whether the tree highlights the correct node.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Hook leaf navigation fix | keyPath-to-JSON-indent mismatch (P1) | Align tree keyPath with actual JSON nesting; include inner `hooks` segment |
| Hook leaf navigation fix | Reverse mapping must match new keyPath (P10) | Verify `findKeyPathAtLine` produces same format as new keyPath |
| Plugin lock enforcement | Checkbox already toggled before handler runs (P2) | Call `treeProvider.refresh()` in the isReadOnly early-return path |
| Plugin lock enforcement | Scroll position reset on refresh (P9) | Try targeted refresh first; accept full refresh if needed |
| Visual overlap indicators | Conflating overlap with override (P3) | Separate overlap detection from existing override system |
| Visual overlap indicators | Permission rule fuzzy matching needed (P4) | Reuse existing `rulesOverlap()` for permission overlap |
| Visual overlap indicators | Node ID collisions with cross-scope references (P5) | Use in-place visual treatments, not new cross-scope nodes |
| Visual overlap indicators | Must compose with existing override styling (P8) | Build combined description string, not separate overwriting assignments |
| All phases | Non-2-space JSON formatting breaks navigation (P7) | Accept as pre-existing limitation; configWriter guarantees 2-space |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `onDidChangeCheckboxState` + locked scope | Skip write but don't refresh tree, leaving checkbox desynchronized | Call `treeProvider.refresh()` in the early-return path to revert visual state |
| Overlap detection + override detection | Reuse `isOverridden` flag for overlap, showing indicators only on "losing" side | Create separate `hasOverlap` / `overlappingScopes` fields; overlap is bidirectional, override is unidirectional |
| Hook keyPath + `findKeyLine` | Omit inner `hooks` key from keyPath, causing indent mismatch | Include all JSON nesting segments in the keyPath, matching actual JSON structure |
| Overlap description + override description | Assign to `this.description` separately, second write overwrites first | Build combined description with all applicable status information |
| `NodeContext` extension + existing node constructors | Add `overlappingScopes` field and forget to populate it in some node types | Add field as optional with a default of `undefined`; only populate in entity-level nodes (not section/scope nodes) |

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse `isOverridden` for overlap | No new fields or resolver functions | Overlap only shown on "losing" side; confusing UX | Never -- fundamentally different concepts |
| Skip `refresh()` on locked checkbox toggle | Fewer tree rebuilds | Checkbox permanently desynchronized until external file change | Never -- user-visible state corruption |
| Hardcode 2-space indent in `findKeyLine` | Simple, matches configWriter output | Breaks for any externally-formatted file | Acceptable -- configWriter guarantees format; document limitation |
| Compute overlap in tree node constructors | No caching layer needed | Recalculated on every tree expansion, not just on config change | Acceptable for <50 entities; add caching if configs grow large |

---

## "Looks Done But Isn't" Checklist

- [ ] **Hook leaf click:** Click every type of hook leaf node (type, command, prompt, timeout, async, matcher) and verify the editor cursor lands on the correct line. Test with multiple matchers and multiple hooks per matcher.
- [ ] **Plugin checkbox lock:** Lock User scope, click a plugin checkbox under User scope, verify the checkbox reverts to its pre-click state and the info message appears. Then unlock, verify checkbox toggle works normally.
- [ ] **Overlap both directions:** Define the same entity in two scopes. Verify BOTH scope nodes show an overlap indicator, not just the lower-precedence one.
- [ ] **Overlap + override combined:** Define the same entity in User and Project Local. Verify User scope entry shows both "overridden by Project Local" AND overlap information.
- [ ] **Permission overlap with globs:** Add `Bash(npm *)` to User allow and `Bash(npm install)` to Project allow. Verify both show overlap indicators despite different string values.
- [ ] **Editor-to-tree sync for hooks:** Place cursor on a hook property in the editor. Verify the tree highlights the correct HookKeyValueNode. This tests that `findKeyPathAtLine` and `findNodeByKeyPath` agree on the keyPath format.
- [ ] **No ID collisions:** After implementing overlap, run Expand All and check console for duplicate ID warnings.
- [ ] **Override styling preserved:** After implementing overlap, verify that overridden entities still show the `(overridden by {Scope})` description and are not visually broken.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hook keyPath mismatch (P1) | LOW | Add inner `hooks` segment to HookEntryNode and HookKeyValueNode keyPaths; update `findNodeByKeyPath` walk if needed |
| Checkbox desync on locked scope (P2) | LOW | Add `treeProvider.refresh()` call in the early-return path of both `onDidChangeCheckboxState` and `togglePlugin` handlers |
| Overlap confused with override (P3) | MEDIUM | Create separate overlap resolver functions; add `overlappingScopes` to NodeContext; update node constructors |
| Permission overlap misses fuzzy matches (P4) | LOW | Switch from string equality to `rulesOverlap()` in the overlap detector for permission rules |
| Node ID collisions (P5) | HIGH if cross-scope nodes were added | Remove cross-scope nodes; redesign as in-place visual treatments; cascading fix through parent map and reveal logic |
| Description overwrite (P8) | LOW | Combine override and overlap description logic into single method |

---

## Sources

- Project codebase: `src/utils/jsonLocation.ts` -- `findKeyLine` indent calculation logic (line 46-47)
- Project codebase: `src/tree/nodes/hookKeyValueNode.ts` -- HookKeyValueNode keyPath construction (line 18)
- Project codebase: `src/tree/nodes/hookEntryNode.ts` -- HookEntryNode keyPath construction (line 18)
- Project codebase: `src/extension.ts` -- `onDidChangeCheckboxState` handler (lines 128-156)
- Project codebase: `src/tree/nodes/baseNode.ts` -- `applyOverrideStyle()` and `computeId()` methods
- Project codebase: `src/config/overrideResolver.ts` -- unidirectional override detection
- VS Code API: [TreeView.onDidChangeCheckboxState](https://code.visualstudio.com/api/references/vscode-api#TreeView) -- post-change event, no cancellation
- VS Code API: [TreeDataProvider.onDidChangeTreeData](https://code.visualstudio.com/api/references/vscode-api#TreeDataProvider) -- required to refresh contextValue-dependent menus
- Prior milestone: `.planning/milestones/v0.3-phases/03-user-scope-lock-toggle/03-02-PLAN.md` -- lock implementation details
- Prior milestone: `.planning/milestones/v0.5.0-phases/11-tree-error-resilience/` -- checkbox rollback pattern

---
*Pitfalls research for: VS Code extension v0.6.0 -- visual overlap indicators, plugin lock enforcement, hook leaf navigation*
*Researched: 2026-03-05*
