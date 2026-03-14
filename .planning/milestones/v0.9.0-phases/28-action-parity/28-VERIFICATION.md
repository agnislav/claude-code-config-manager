---
phase: 28-action-parity
verified: 2026-03-13T12:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "SettingKeyValue inline edit button appears on hover for object-setting child nodes"
    expected: "Pencil icon (editValue inline@0) visible on hover over a settingKeyValue.editable node"
    why_human: "Context menu 'when' clause correctness cannot be exercised without running VS Code Extension Development Host"
  - test: "EnvVar copy-to-scope inline button appears at inline@2 position"
    expected: "Copy icon visible at the second inline action slot for envVar.editable nodes"
    why_human: "Inline button rendering order requires live VS Code UI to confirm"
  - test: "MCP Server move@1 and copy@2 inline buttons appear for mcpServer.editable nodes"
    expected: "Both move and copy icons visible for MCP server nodes from all 3 scopes (User, ProjectLocal, ProjectShared)"
    why_human: "Requires live environment with ~/.claude.json containing mcpServers entries"
  - test: "Writing to ~/.claude.json via copyMcpServerToScope preserves non-MCP top-level keys"
    expected: "Pre-existing keys in ~/.claude.json (e.g. numStartups, projects) remain unchanged after copy operation"
    why_human: "File preservation can only be confirmed by performing a real write with actual ~/.claude.json content"
---

# Phase 28: Action Parity Verification Report

**Phase Goal:** Achieve action parity — every node type that supports editing gets consistent inline edit/delete/move/copy actions
**Verified:** 2026-03-13
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SettingKeyValue child nodes can be edited via inline edit button or context menu | VERIFIED | `editCommands.ts:57` branches on `keyPath.length === 2 && !DEDICATED_SECTION_KEYS.has(rootKey)` calling `setSettingKeyValue`; package.json has `editValue inline@0` for `^settingKeyValue\.editable` and context menu via `/setting|…|settingKeyValue/` regex |
| 2 | SettingKeyValue child nodes can be deleted via inline delete button or context menu | VERIFIED | `deleteCommands.ts:64` branches on same guard calling `removeSettingKeyValue`; package.json has `deleteItem inline@3` and context menu both covering `settingKeyValue` |
| 3 | EnvVar nodes show a copy-to-scope inline button that copies the variable to another scope | VERIFIED | `copyEnvVarToScope` command implemented in `moveCommands.ts:259-340`; package.json has `copyEnvVarToScope inline@2` for `^envVar\.editable` and `2_copyMove` context menu entry |
| 4 | Editing a SettingKeyValue preserves value type (string, number, boolean) | VERIFIED | `editCommands.ts:59` calls `parseInputValue(newValue)` which converts `"true"/"false"` to booleans, numeric strings to numbers, falls back to string |
| 5 | Deleting a SettingKeyValue child key removes only that key, leaving sibling keys intact | VERIFIED | `configWriter.ts:368-382` `removeSettingKeyValue` reads full config, deletes only `[childKey]` from parent object, writes full config back |
| 6 | MCP servers defined in ~/.claude.json top-level mcpServers appear under the User scope in the tree | VERIFIED | `configDiscovery.ts:50-54` extracts `rawUserMcp` from `claudeJsonData.mcpServers`; `configModel.ts:141-143` attaches `mcpConfig: discovered.userMcpConfig` to User scope; `builder.ts:832` reads `scopedConfig.mcpConfig?.mcpServers` |
| 7 | MCP servers defined in ~/.claude.json projects[path].mcpServers appear under the Project Local scope in the tree | VERIFIED | `configDiscovery.ts:71-81` extracts `localMcpConfig` using `folder.uri.fsPath` as key; `configModel.ts:176-179` attaches to ProjectLocal scope |
| 8 | MCP servers from .mcp.json continue to appear under the Project Shared scope | VERIFIED | `configModel.ts:152-164` still calls `loadMcpFile(discovered.mcp.path)` for ProjectShared scope — unchanged path |
| 9 | MCP Server nodes show move@1, copy@2, delete@3 inline buttons | VERIFIED | package.json: `moveToScope inline@1` for `^mcpServer\.editable`; `copyMcpServerToScope inline@2` for `^mcpServer\.editable`; `deleteItem inline@3` regex covers `mcpServer` |
| 10 | MCP Server tooltip includes scope info line matching EnvVar tooltip pattern | VERIFIED | `builder.ts:856-862` appends `\n\nDefined in: ${SCOPE_LABELS[scopedConfig.scope]} (${mcpShortPath})` after base tooltip, before `buildOverlapTooltip` |
| 11 | Copying an MCP server to a different scope writes to the correct file and JSON path | VERIFIED | `moveCommands.ts:564-580` `dispatchMcpWrite` dispatches: User→`setUserMcpServer(claudeJsonPath,…)`, ProjectLocal→`setLocalMcpServer(claudeJsonPath, workspacePath,…)`, ProjectShared→`setMcpServer(targetFilePath,…)` |
| 12 | Writing to ~/.claude.json preserves all non-MCP data in the file | VERIFIED | All four `~/.claude.json` writers (`setUserMcpServer`, `removeUserMcpServer`, `setLocalMcpServer`, `removeLocalMcpServer`) use `loadOrCreate<Record<string, unknown>>` to read the full file before writing, as confirmed in `configWriter.ts:463-551` |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/config/configWriter.ts` | `setSettingKeyValue`, `removeSettingKeyValue`, `setUserMcpServer`, `removeUserMcpServer`, `setLocalMcpServer`, `removeLocalMcpServer` | VERIFIED | All 6 functions present and substantive at lines 346-551 |
| `src/commands/editCommands.ts` | editValue handler extended for settingKeyValue nodes | VERIFIED | Branch at line 57 dispatches to `setSettingKeyValue`; override suffix stripping at line 39 |
| `src/commands/deleteCommands.ts` | deleteItem handler extended for settingKeyValue child keys | VERIFIED | Branch at line 64 dispatches to `removeSettingKeyValue` |
| `src/commands/moveCommands.ts` | `copyEnvVarToScope` and `copyMcpServerToScope` command handlers | VERIFIED | Both implemented at lines 259 and 449; `dispatchMcpWrite`/`dispatchMcpRemove` helpers at lines 564-600 |
| `src/utils/platform.ts` | `getUserClaudeJsonPath()` function | VERIFIED | Exported at line 28 |
| `src/config/configDiscovery.ts` | Discovery of User and Local MCP entries from ~/.claude.json; `DiscoveredPaths` extended | VERIFIED | `claudeJsonPath`, `userMcpConfig`, `localMcpConfig` fields added to interface; extraction logic at lines 46-81 |
| `src/config/configModel.ts` | MCP data attached to User and ProjectLocal ScopedConfig entries | VERIFIED | User scope at lines 141-143; ProjectLocal scope at lines 176-179 |
| `src/viewmodel/builder.ts` | MCP tooltip with scope info line | VERIFIED | Lines 856-862 in `buildMcpServers` method |
| `src/constants.ts` | `MESSAGES.copiedEnvVar`, `copiedMcpServer`, `movedMcpServer`; `getAllowedWritePaths` includes `~/.claude.json` | VERIFIED | Lines 176-178 for messages; line 204 for path inclusion |
| `src/watchers/fileWatcher.ts` | Watches `~/.claude.json` for external changes | VERIFIED | `watchAbsolute(getUserClaudeJsonPath())` at line 32 |
| `package.json` | All command declarations and menu entries for settingKeyValue, envVar copy, MCP move/copy | VERIFIED | See Key Links table |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `editCommands.ts` | `configWriter.ts` | `setSettingKeyValue(filePath, rootKey, keyPath[1], parsed)` | WIRED | Call at line 60 with `parseInputValue` result |
| `deleteCommands.ts` | `configWriter.ts` | `removeSettingKeyValue(filePath, rootKey, keyPath[1])` | WIRED | Call at line 66 |
| `package.json` | editValue command | `when` clause includes `settingKeyValue` | WIRED | `inline@0` regex `^settingKeyValue\.editable`; context menu regex `/setting|…|settingKeyValue/` |
| `configDiscovery.ts` | `configModel.ts` | `DiscoveredPaths.userMcpConfig` and `localMcpConfig` fields | WIRED | Fields populated in `discoverConfigPaths()`; consumed in `buildScopedConfigs()` |
| `configModel.ts` | `builder.ts` | `ScopedConfig.mcpConfig` on User and ProjectLocal scopes | WIRED | `buildMcpServers()` reads `scopedConfig.mcpConfig?.mcpServers` at line 832 |
| `moveCommands.ts` | `configWriter.ts` | `setUserMcpServer`/`setLocalMcpServer`/`setMcpServer` dispatch | WIRED | `dispatchMcpWrite` helper at line 564 routes by `targetScope` |
| `constants.ts` | `configWriter.ts` | `getAllowedWritePaths` includes `~/.claude.json` | WIRED | `paths.add(getUserClaudeJsonPath())` at line 204 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ACTN-01 | 28-01 | EnvVar supports copy-to-scope (matching permissions and settings pattern) | SATISFIED | `copyEnvVarToScope` in `moveCommands.ts`; `inline@2` and `2_copyMove` context menu in package.json |
| ACTN-02 | 28-02 | MCP Server nodes show enriched inline UX (tooltip with server type/command details, consistent description) | SATISFIED | `builder.ts` MCP tooltip shows type, command/URL, and "Defined in: {scope} ({path})" line |
| ACTN-03 | 28-02 | MCP Server inline button set reviewed and corrected (move@1, copy@2, delete@3) | SATISFIED | All three inline buttons wired in package.json; `copyMcpServerToScope` and extended `moveToScope` commands implemented |
| ACTN-04 | 28-01 | SettingKeyValue nodes support edit action (edit child value) | SATISFIED | `editValue` handler dispatches to `setSettingKeyValue`; `inline@0` edit button for `settingKeyValue.editable` |
| ACTN-05 | 28-01 | SettingKeyValue nodes support delete action (remove child key) | SATISFIED | `deleteItem` handler dispatches to `removeSettingKeyValue`; `inline@3` and context menu cover `settingKeyValue` |

No orphaned requirements — REQUIREMENTS.md shows all five ACTN-01 through ACTN-05 marked Complete under Phase 28.

### Anti-Patterns Found

None. No TODO/FIXME/placeholder comments found in any phase-modified files. No empty implementations, no stub handlers. The one `return null` in `editCommands.ts:136` is intentional logic in `parseInputValue` (mapping the string `"null"` to JavaScript `null`).

### Human Verification Required

#### 1. SettingKeyValue inline edit button rendering

**Test:** Open VS Code Extension Development Host, load a workspace with a config file containing an object-valued setting (e.g. `{"customSetting": {"key": "value"}}`). Hover over the child key node under Settings.
**Expected:** A pencil/edit inline icon appears at position 0 on the right side of the node.
**Why human:** VS Code `when` clause regex matching requires the live Extension Development Host to exercise.

#### 2. EnvVar copy-to-scope inline button at inline@2 position

**Test:** With an editable envVar node visible in the tree, hover to reveal inline buttons.
**Expected:** Copy icon appears in the second inline slot (after move at @1, copy at @2).
**Why human:** Inline button ordering is determined by VS Code UI rendering, not statically verifiable.

#### 3. MCP Server inline buttons across all three scopes

**Test:** Configure MCP servers in ~/.claude.json top-level (User scope), in `projects[path].mcpServers` (Local scope), and in .mcp.json (Shared scope). Open the extension and inspect each scope's MCP Servers section.
**Expected:** All three scopes show MCP servers; each has move@1 and copy@2 inline icons; delete@3 also visible.
**Why human:** Requires actual ~/.claude.json with real content and a live workspace folder match.

#### 4. ~/.claude.json data preservation on write

**Test:** With a ~/.claude.json that contains non-MCP keys (e.g. `numStartups`, `installMethod`, `projects`), use copy-to-scope on an MCP server targeting User scope.
**Expected:** After the operation, all non-MCP keys in ~/.claude.json remain unchanged.
**Why human:** File-level side-effect verification requires a real write operation.

### Build Verification

`npm run compile` passes with no type errors (verified during this review). All 7 phase commits exist in git history and match documented hashes in SUMMARY files.

---

_Verified: 2026-03-13_
_Verifier: Claude (gsd-verifier)_
