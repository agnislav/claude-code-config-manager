# Domain Pitfalls

**Domain:** UX consistency audit and fixes across 14 node types in a VS Code TreeView extension
**Researched:** 2026-03-11
**Scope:** Integration pitfalls specific to v0.9.0 UX Audit -- auditing and fixing inline buttons, context menus, tooltips, descriptions, click behavior, and visual indicators across all 7 entity types, scope nodes, and section headers in the existing v0.8.0 codebase (5,672 LOC, ViewModel layer, 14 node types)

---

## Critical Pitfalls

Mistakes that cause regressions, data loss, or require reverting shipped changes.

### Pitfall 1: contextValue Regex Breakage in package.json `when` Clauses

**What goes wrong:** Changing a node's `contextValue` string to "fix consistency" silently breaks inline buttons or context menu items because the regex in `package.json` `when` clauses no longer matches. The extension compiles fine, tests pass, but the button disappears in the UI with no error.

**Why it happens:** The `contextValue` is the only bridge between tree node types and menu visibility. The current codebase uses regex patterns like `viewItem =~ /^permissionRule\.editable/` and compound patterns like `viewItem =~ /\.editable/ && viewItem =~ /permissionRule|envVar|hookEntry|mcpServer|plugin|setting|sandboxProperty/`. Any rename or restructuring of the `contextValue` format silently severs this connection. VS Code does not log `when` clause evaluation failures.

**Consequences:** Users lose the ability to edit, delete, move, or copy specific node types. No error message appears -- the button just vanishes. The 56-test suite validates viewmodel output, not `when` clause matching, so tests pass while the UI is broken.

**Prevention:**
1. Create a reference table mapping every `contextValue` pattern to every `when` clause regex it must match BEFORE making changes. The current package.json has 24 `view/item/context` entries and 17 `commandPalette` entries.
2. After any `contextValue` change, manually verify in the Extension Development Host that all expected inline buttons and context menu items appear for EVERY node type.
3. Consider adding a test helper that extracts all `when` clause regexes from `package.json` and asserts that each node type's `contextValue` matches its expected set of command regexes.
4. Never change `contextValue` and `when` clause in separate commits -- always change them atomically.

**Detection:** Missing inline buttons or context menu items on specific node types. The only reliable detection is manual visual testing of every node type after every `contextValue` change.

---

### Pitfall 2: Inline Button Order Regression via `group` Index Collision

**What goes wrong:** Adding a new inline button to a node type that already has inline buttons, or reordering existing ones, causes buttons to swap positions or disappear. VS Code resolves `inline@N` conflicts unpredictably when multiple menu entries match the same node.

**Why it happens:** The current codebase has MULTIPLE `view/item/context` entries for the same command targeting different node types. For example, `claudeConfig.moveToScope` appears 4 times in the menu configuration:
- `inline@0` for `envVar.editable`
- `inline@1` for `permissionRule.editable`
- `inline@0` for `setting.editable`
- `group: "2_move"` (context menu, not inline) for the general `.editable` pattern

When adding a new inline action to a node type, the developer must find ALL existing entries whose `when` clause could match and ensure `@N` indices don't collide.

**Consequences:** Buttons appear in wrong order (destructive delete button ends up in position 0), or two buttons occupy the same slot. Users develop muscle memory for button positions -- unexpected reordering leads to accidental deletes. The established convention (edit@0, move@1, copy@2, delete@3) gets broken for specific node types.

**Prevention:**
1. Build a per-node-type inline button matrix before making any changes. Map which buttons appear at which positions for every node type.
2. When adding any inline button, audit ALL `view/item/context` entries whose `when` clause could match the same `contextValue`.
3. Ensure the `@N` ordering is consistent across all node types where possible: edit@0, move@1, copy@2, delete@3.
4. Test in Extension Development Host by hovering over each node type and verifying button order matches the matrix.

**Detection:** Visual inspection of inline buttons per node type in Extension Development Host. Compare against the documented order.

---

### Pitfall 3: Breaking the `&& false` Disabled-Button Pattern

**What goes wrong:** The codebase uses `&& false` appended to `when` clauses to intentionally disable certain inline buttons. During a consistency audit, a developer removes `&& false` to "fix" what appears to be a bug, re-enabling buttons that were deliberately disabled because the underlying feature is deferred.

**Why it happens:** The current package.json has 5 entries with `&& false`:
- Plugin move (`inline@1`), copy (`inline@2`), delete (`inline@3`) -- all disabled
- EnvVar/SandboxProperty editValue (`inline@1`) -- disabled
These look like dead code or debugging artifacts. PROJECT.md notes "EditValue inline improvements -- deferred to separate phase" but this intent is not obvious from package.json alone.

**Consequences:** Buttons appear that trigger commands which silently fail or produce incorrect behavior. For example, the disabled `editValue` inline button for envVar at `inline@1` would collide with `moveToScope` at `inline@0` if enabled, and the edit pre-fill reads `node.description` which may contain override suffix text.

**Prevention:**
1. Before removing any `&& false` clause, check PROJECT.md "Out of Scope" and "Key Decisions" sections.
2. Treat `&& false` entries as "reserved slots" and never modify them during a consistency audit.
3. If auditing identifies that these buttons SHOULD be enabled, that is a separate feature task, not a consistency fix.

**Detection:** New inline buttons appearing on node types where they were previously absent.

---

### Pitfall 4: Tooltip Homogenization Destroying Intentional Variation

**What goes wrong:** When "fixing" tooltips for consistency, applying the same tooltip format across all node types creates misleading information or loses valuable context-specific content.

**Why it happens:** The current tooltip strategy is intentionally heterogeneous by design:
- **Permissions:** Override warnings with category-aware text ("This allow rule is overridden by a deny rule in User")
- **Settings:** JSON code block for object values, nothing for scalars
- **MCP servers:** Full command string with type label ("Stdio Server, Command: `npx ...`")
- **Env vars:** Nothing (value already fully visible in description)
- **Plugins:** Metadata description from PluginMetadataService
- **Sandbox:** Markdown list for array values
- **Hooks:** Command string in inline code
- **ALL node types:** Overlap tooltip suffix via `buildOverlapTooltip()`

A naive "make all tooltips look the same" approach destroys this intentional variation. The overlap tooltip appended by `buildOverlapTooltip()` is the shared consistency layer -- the base tooltip is intentionally per-type.

**Consequences:** Users see redundant information (description already shows the value, tooltip repeats it), or useful context-specific tooltips get replaced with a generic format that loses information. The permission override warning in tooltips is particularly important and must not be displaced.

**Prevention:**
1. Audit tooltips by asking "what information does this tooltip add that isn't already visible?" rather than "do all tooltips look the same?"
2. Preserve the `buildOverlapTooltip()` append pattern -- it is the shared consistency layer.
3. Document the tooltip strategy: "Base tooltip = type-specific context. Overlap suffix = shared format. Never homogenize the base."

**Detection:** Side-by-side comparison of tooltip content vs. visible label+description for every node type. Any tooltip that merely repeats visible information is a regression.

---

## Moderate Pitfalls

### Pitfall 5: Click Command (revealInFile) Regression on Collapsibility Changes

**What goes wrong:** Making a previously-leaf node collapsible (or vice versa) breaks the click-to-reveal behavior. The `computeCommand()` helper in `builder.ts` returns `undefined` for any node with `collapsibleState !== None`.

**Why it happens:** VS Code TreeView has a fundamental constraint: clicking a collapsible node toggles expansion, and setting a `command` on a collapsible node creates a double-action (expand + navigate). The builder correctly guards this, but the guard is implicit. If a consistency fix changes a node from leaf to expandable (e.g., making MCP servers expandable to show their properties), clicking the node no longer reveals in file.

**Consequences:** Users lose the ability to click-to-navigate on nodes that were previously clickable. This is a silent regression with no error.

**Prevention:**
1. Never change `collapsibleState` without checking whether `computeCommand()` will still produce the expected behavior.
2. If making a leaf node collapsible, ensure "Reveal in Config File" is available via right-click context menu.
3. Document the invariant: "Leaf nodes click to reveal. Collapsible nodes click to expand. This is by design."

---

### Pitfall 6: Lock-Aware State Not Propagated to New Inline Buttons

**What goes wrong:** Adding a new inline action (e.g., edit button on MCP servers, move button on hooks) that doesn't respect the User scope lock. The button appears on locked User scope nodes and either silently fails or shows an error.

**Why it happens:** Lock state flows through `isReadOnly` on `ScopedConfig` -- the builder sets `isReadOnly: true` when locked. The `contextValue` then gets `readOnly` instead of `editable`, and `when` clauses filter on `\.editable`. But if a new command is registered with a `when` clause that matches on node type alone (e.g., `viewItem =~ /mcpServer/`) without requiring `.editable`, it will show on locked nodes.

**Consequences:** Buttons appear on locked nodes that shouldn't be editable. Users click them and get confusing error messages, or worse, the operation succeeds on the wrong file.

**Prevention:**
1. Every new `when` clause for an inline action MUST include `.editable` check.
2. Every new command handler MUST include the standard `isReadOnly` guard with the `MESSAGES.userScopeLocked` branch (see editCommands.ts lines 25-32 for the pattern).
3. Test every new inline button with User scope locked AND unlocked.

---

### Pitfall 7: MCP Server File Path vs Config File Path Confusion

**What goes wrong:** MCP servers store their config in a separate `.mcp.json` file, not the main settings file. Commands that assume `nodeContext.filePath` points to `settings.json` will read/write the wrong file structure for MCP server operations.

**Why it happens:** The builder sets `filePath: scopedConfig.mcpFilePath ?? scopedConfig.filePath` for MCP server nodes. This means `filePath` on an MCP server node already points to the MCP config file. But if a new move/copy command reads the source config via `readJsonFile(filePath)` expecting a `ClaudeCodeConfig` shape, it will get the MCP config shape instead (which has `mcpServers` at the root, not nested under a section).

**Consequences:** Move/copy operations silently corrupt the target file by writing MCP config structure into a settings file, or fail to find the expected data in the source file.

**Prevention:**
1. When adding commands for MCP server nodes, always check whether the file is `.mcp.json` or `settings.json`.
2. The delete command already handles MCP servers correctly via `removeMcpServer` -- copy the pattern.
3. Test MCP server operations separately from other node types.

---

### Pitfall 8: Overlap ResourceUri Conflicts with Node-Specific ResourceUri

**What goes wrong:** Plugins use `resourceUri` for both disabled-state dimming AND overlap coloring, with a priority system. Adding `resourceUri`-based visual features to other node types will conflict with the existing overlap decoration system.

**Why it happens:** VS Code allows only ONE `resourceUri` per TreeItem. The plugin builder already has a priority chain (overlap > disabled decoration > undefined). The overlap decoration system uses its own URI scheme (`OVERLAP_URI_SCHEME`) and the plugin disabled state uses `PLUGIN_URI_SCHEME`. Adding any new `resourceUri`-based feature requires extending this priority logic for every affected node type.

**Consequences:** New decorations override overlap coloring, making overlap indicators invisible on decorated nodes. Or overlap coloring overrides the new decoration, defeating its purpose.

**Prevention:**
1. Before adding any `resourceUri` to a node type, check whether `buildOverlapResourceUri()` already produces a URI for that node type.
2. If both are needed, implement a priority chain with clear documentation.
3. Consider whether the visual effect can be achieved through `iconPath` ThemeColor instead of `resourceUri`.

---

### Pitfall 9: Section-Level "Add" Button Asymmetry Is Intentional

**What goes wrong:** An audit identifies that Permissions section has an inline "Add" button (`addPermissionRule` at `inline@0`) while Environment, Hooks, and MCP Servers only have context menu "Add" entries (`group: "3_add"`). The "fix" adds inline add buttons to all sections, cluttering the UI.

**Why it happens:** The current design is intentional -- Permissions is the most frequently edited section. Other sections use context menu for add operations. But this intentional asymmetry looks like a "bug" during an audit.

**Consequences:** Every section header gets an add button, making the tree visually busier. Sections where items are rarely added (MCP Servers, Sandbox) have permanent clutter.

**Prevention:**
1. Distinguish between "inconsistency that is a bug" and "inconsistency that is a design choice."
2. Before adding inline buttons to sections that don't have them, ask: "How often do users add items to this section?"
3. The audit should DOCUMENT the asymmetry with rationale, not blindly fix it.

---

### Pitfall 10: Description Suffix Pollution from applyOverrideSuffix

**What goes wrong:** When modifying description formatting for consistency, the override suffix gets double-applied or displaced.

**Why it happens:** `applyOverrideSuffix()` appends "(overridden by [Scope])" to the description. This is called AFTER the description is built. If a consistency fix reformats descriptions (e.g., adding type hints, truncating long values), and the formatting is applied AFTER `applyOverrideSuffix()`, the suffix ends up in the middle of the description instead of at the end.

**Consequences:** Descriptions show malformed text like `"value (overridden by User) [string]"` instead of `"value [string] (overridden by User)"`.

**Prevention:**
1. Always apply `applyOverrideSuffix()` as the LAST step in description construction.
2. Never modify the description string after the suffix is applied.
3. Test descriptions with overlap scenarios, not just clean single-scope scenarios.

---

### Pitfall 11: Edit Command Pre-fill Reads from Description (Includes Override Text)

**What goes wrong:** The `editValue` command reads `node.description?.toString()` (editCommands.ts line 36) for the pre-fill value. If the description contains override suffix text, the input box pre-fills with `"value (overridden by User)"` and if the user saves without noticing, the override text gets written as the value.

**Why it happens:** This is an existing design weakness that becomes more dangerous during a UX audit. If the audit adds MORE information to descriptions (type hints, truncation markers, overlap text), the pre-fill becomes even more polluted.

**Consequences:** Config values get corrupted with descriptive text. This is a data-corruption bug that is hard to notice because the extension writes valid JSON -- just with wrong string values.

**Prevention:**
1. Any description formatting change must be tested with the edit-value flow.
2. The long-term fix is to read the pre-fill value from `nodeContext` or the original config data, not from the rendered `description` string. But this is noted as out of scope ("EditValue inline improvements -- deferred").
3. For the audit, do NOT add any new text to descriptions that could contaminate edit pre-fill.

---

## Minor Pitfalls

### Pitfall 12: SettingKeyValue Nodes Should Not Get Entity-Level Inline Buttons

**What goes wrong:** `settingKeyValue` nodes (children of expandable object settings) are not in the `when` clause regex for most inline actions (move, copy). Adding consistency by including them would allow users to move/delete individual keys of an object setting, which doesn't make semantic sense.

**Prevention:** Leave `settingKeyValue` nodes without inline move/copy actions. This is correct behavior, not an inconsistency. The audit should document it as intentional.

---

### Pitfall 13: HookEvent vs HookEntry Command Handler Confusion

**What goes wrong:** `hookEvent` nodes ("PreToolUse") and `hookEntry` nodes (specific commands) have different `keyPath` structures. Adding an edit or add command that targets "hookEntry" but uses a `when` clause that also matches "hookEvent" causes the wrong handler path to execute.

**Prevention:** When adding commands for hook nodes, always use precise `when` clause patterns (`^hookEntry\.` vs `^hookEvent\.`). The existing `addHook` command correctly uses `viewItem =~ /^section\.hooks\.editable|^hookEvent/` to target both section and event nodes.

---

### Pitfall 14: Test Suite Validates Builder Output, Not Visual Rendering

**What goes wrong:** The 56-test suite validates `contextValue`, `description`, and overlap resolution at the viewmodel level. But no tests verify that the correct inline buttons appear in the UI. A change can pass all tests while breaking the visual experience.

**Prevention:**
1. Accept that manual Extension Development Host testing is required for every UX change.
2. Consider adding a cross-reference test that parses `package.json` `when` clauses and verifies that builder-generated `contextValue` strings match the expected patterns.
3. After the audit, add snapshot-style tests for the complete set of `contextValue` values generated by the builder.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Auditing inline button consistency | Pitfall 2 (index collision), Pitfall 3 (`&& false` removal) | Build a per-node-type button matrix before making changes |
| Standardizing tooltips | Pitfall 4 (destroying intentional variation) | Document what each tooltip adds beyond visible text |
| Adding move/copy to new node types | Pitfall 6 (lock state), Pitfall 7 (MCP file path) | Copy guard patterns from existing commands; test MCP separately |
| Changing node collapsibility | Pitfall 5 (revealInFile breakage) | Verify click behavior after every collapsibility change |
| Adding new inline buttons to sections | Pitfall 9 (section-level asymmetry is intentional) | Confirm asymmetry is a bug before "fixing" it |
| Modifying contextValue format | Pitfall 1 (regex breakage) | Build contextValue-to-regex mapping table first |
| Adding resourceUri decorations | Pitfall 8 (overlap URI conflict) | Check existing overlap decoration before adding new ones |
| Touching description formatting | Pitfall 10 (suffix displacement), Pitfall 11 (edit pre-fill corruption) | Apply override suffix last; test edit pre-fill after every change |
| Adding commands to hook nodes | Pitfall 13 (event vs entry confusion) | Use precise `^hookEntry\.` patterns in `when` clauses |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| New `when` clause + existing `contextValue` | Regex too broad, matches node types it shouldn't | Use `^nodeType\.` prefix anchor; test with all node types |
| New inline button + existing `inline@N` | Index collision causes button reorder or disappearance | Check ALL existing entries for overlapping `when` matches |
| New command handler + lock state | Missing `isReadOnly` guard; button works on locked scope | Copy guard pattern from editCommands.ts lines 25-32 |
| Description change + edit pre-fill | New text in description corrupts edit input box | Test edit flow after every description format change |
| `&& false` removal + deferred feature | Re-enables unfinished feature, causing silent failures | Check PROJECT.md "Out of Scope" before removing `&& false` |
| MCP server command + filePath | Assumes settings.json structure for `.mcp.json` file | Check file extension or use MCP-specific writer functions |
| Tooltip change + overlap suffix | Base tooltip replaces or disconnects from `buildOverlapTooltip()` | Always call `buildOverlapTooltip()` as the last tooltip step |
| Collapsibility change + click command | `computeCommand()` returns undefined for collapsible nodes | Verify click behavior; add context menu "Reveal" as fallback |

---

## "Looks Done But Isn't" Checklist

- [ ] **All node types tested:** Every one of the 14 node types has been verified in Extension Development Host with both locked and unlocked User scope
- [ ] **Inline button order matches convention:** edit@0, move@1, copy@2, delete@3 (where applicable) for every node type
- [ ] **No `&& false` entries accidentally enabled:** Package.json still has all 5 `&& false` entries intact
- [ ] **contextValue patterns match:** Every builder-generated `contextValue` matches at least one `when` clause regex for each expected command
- [ ] **Edit pre-fill clean:** Click "Edit Value" on every editable node type with override suffix. Pre-filled value is clean.
- [ ] **Lock enforcement universal:** Lock User scope. Verify NO inline action buttons appear on User scope nodes for any entity type.
- [ ] **Tooltips not redundant:** Every tooltip adds information beyond what label+description already show.
- [ ] **Click-to-reveal works:** Every leaf node click navigates to the correct JSON line. Every collapsible node click expands without navigation.
- [ ] **MCP operations use correct file:** Delete/edit an MCP server. Verify `.mcp.json` was modified, not `settings.json`.
- [ ] **Context menus complete:** Right-click every node type. Verify expected context menu items appear (even when inline buttons are absent).
- [ ] **Managed scope read-only:** Verify no edit/delete/move buttons appear on Managed scope nodes.

---

## Sources

- Direct codebase analysis: `package.json` menu contributions (24 `view/item/context` entries, 5 with `&& false`, 17 `commandPalette` entries)
- Direct codebase analysis: `src/viewmodel/builder.ts` (1018 lines, `computeStandardContextValue()`, `computeCommand()`, `buildOverlapTooltip()`, `applyOverrideSuffix()`)
- Direct codebase analysis: `src/commands/editCommands.ts` (line 36: `node.description?.toString()` pre-fill pattern)
- Direct codebase analysis: `src/commands/moveCommands.ts` (lock-aware guard patterns, MCP file path handling)
- VS Code TreeView API constraints: collapsible node click behavior, single `resourceUri` per TreeItem, `contextValue` regex matching in `when` clauses
- PROJECT.md: Key decisions table (147 entries), out-of-scope items, deferred features including "EditValue inline improvements"
- Confidence: HIGH -- all pitfalls derived from direct code reading of this specific codebase and its established patterns

---
*Pitfalls research for v0.9.0: UX Audit (inline buttons, context menus, tooltips, click behavior, visual indicators)*
*Researched: 2026-03-11*
