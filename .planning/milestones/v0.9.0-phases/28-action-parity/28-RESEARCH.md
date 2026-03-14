# Phase 28: Action Parity - Research

**Researched:** 2026-03-13
**Domain:** VS Code extension command handlers, MCP multi-scope discovery, inline button wiring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**EnvVar Copy-to-Scope (ACTN-01)**
- Add `copyEnvVarToScope` inline button at @2, matching permissions and settings copy pattern
- Follows existing `copySettingToScope` and `copyPermissionToScope` implementation in moveCommands.ts
- Straightforward pattern match — no design decisions needed

**MCP Server Multi-Scope Discovery (expanded ACTN-03)**
- Scope correction: MCP servers are NOT workspace-only. Claude Code supports 3 scopes:
  - User scope — `~/.claude.json` (top-level `mcpServers` key, global across all projects)
  - Local scope — `~/.claude.json` (per-project-path `projects[path].mcpServers` key, private per-project)
  - Project scope — `.mcp.json` at workspace root (version-controlled, team-shared)
- Precedence: Local > Project > User (same direction as settings)
- Local and User MCP servers share the same file (`~/.claude.json`) but are scoped differently
- Managed scope (`managed-mcp.json`) is out of scope for this phase
- Extension scope mapping: User → User, Local → Project Local, Project → Project Shared

**MCP Server Inline Buttons (ACTN-03)**
- Full set: move@1, copy@2, delete@3 — matching permissions, settings, envVar patterns
- No edit@0 — MCP server config is a complex object unsuitable for QuickPick editing
- Move/copy now valid because MCP servers exist across multiple scopes

**MCP Server Description (ACTN-02)**
- Keep current format: `stdio: {command}` / `sse: {url}` — already informative
- No changes needed

**MCP Server Tooltip (ACTN-02)**
- Add scope info line to existing tooltip, matching EnvVar base tooltip pattern from Phase 25
- Format: server type + command/URL details + scope line + overlap section

**SettingKeyValue Edit (ACTN-04)**
- Edit via QuickPick input box (same as editValue for settings/envVars)
- Show current value pre-filled, user types new value
- Type preserved: string stays string, number stays number, boolean stays boolean
- Inline edit button at @0, matching the edit slot convention
- Context menu entry via extending editValue when clause to include settingKeyValue

**SettingKeyValue Delete (ACTN-05)**
- Inline delete button at @3 (already present)
- Context menu delete (already works via 'setting' pattern match)
- Remove key silently from parent object — no special handling for last key (parent becomes `{}`)

### Claude's Discretion
- How to parse MCP entries from `~/.claude.json` (structure of user vs local MCP data in that file)
- ConfigStore integration for multi-scope MCP data
- Exact implementation of `copyEnvVarToScope` command handler

### Deferred Ideas (OUT OF SCOPE)
- Managed MCP scope (`managed-mcp.json`) — enterprise feature, add in future phase
- MCP server edit action (complex object editing) — would need a dedicated editor UX, not QuickPick
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACTN-01 | EnvVar supports copy-to-scope (matching permissions and settings pattern) | `copySettingToScope` / `copyPermissionToScope` in moveCommands.ts are the model; `setEnvVar` writer already exists |
| ACTN-02 | MCP Server nodes show enriched inline UX (tooltip with server type/command details) | Current tooltip already has type+command; needs scope info line added matching EnvVar IIFE pattern |
| ACTN-03 | MCP Server inline button set reviewed and corrected | Discovery must be expanded to read `~/.claude.json` User and Local MCP entries; then move/copy/delete are valid |
| ACTN-04 | SettingKeyValue nodes support edit action (edit child value) | `editValue` handler already handles `rootKey`-based dispatch; needs `keyPath[0..1]` write via nested object update |
| ACTN-05 | SettingKeyValue nodes support delete action (remove child key) | `deleteItem` handler already routes by rootKey; needs new branch for `keyPath.length === 2` and non-dedicated key |
</phase_requirements>

---

## Summary

Phase 28 adds action parity across three entity types: EnvVar (copy-to-scope), MCP Servers (multi-scope discovery + move/copy + tooltip enrichment), and SettingKeyValue (edit + delete child keys). All five requirements have clear implementation paths grounded in existing patterns.

The most substantial work is ACTN-03: expanding MCP discovery to read `~/.claude.json`. The exact JSON structure is confirmed: top-level `mcpServers` is the User scope, and `projects[absolutePath].mcpServers` is the Local scope (per-project, private). Both are `Record<string, McpServerConfig>` identical in shape to the existing `.mcp.json` format. ConfigStore.buildScopedConfigs must distribute these into the appropriate ScopedConfig entries.

ACTN-01, ACTN-04, and ACTN-05 are mechanical extensions of existing patterns. The command handlers, writer functions, contextValue logic, and package.json menu entries all have established templates to follow.

**Primary recommendation:** Implement in a single plan covering all five requirements sequentially — discovery first (ACTN-03 infrastructure), then UX additions (ACTN-02 tooltip, ACTN-03 buttons, ACTN-01 copy command), then SettingKeyValue actions (ACTN-04/05). All changes are low-risk and self-contained.

---

## Standard Stack

### Core (already in use — no new dependencies)
| Component | Version | Purpose | Notes |
|-----------|---------|---------|-------|
| VS Code API | ^1.90.0 | TreeItem, commands, QuickPick | No new API surface needed |
| TypeScript | ^5.3.3 | Strict mode | Existing project constraint |
| esbuild | ^0.25.0 | Bundle | No change |

### No new libraries required
All required functionality uses existing project infrastructure: configWriter, configDiscovery, configModel, moveCommands pattern, editCommands pattern, deleteCommands pattern.

---

## Architecture Patterns

### Pattern 1: Copy-to-Scope Command
**What:** QuickPick scope selector → write to target, optionally delete from source
**When to use:** All copy-to-scope actions (permissions, settings, envVar, now MCP)
**Reference in codebase:** `copySettingToScope` / `copyPermissionToScope` in `moveCommands.ts` (lines 148–336)

The `copyEnvVarToScope` for ACTN-01 follows this template exactly:
```typescript
// 1. Guard: allow copy from User (non-destructive), block Managed
if (isReadOnly && scope !== ConfigScope.User) { ... }
// 2. Validate keyPath: ['env', envKey]
// 3. Build targetScopes: allScopes minus current, minus Managed, minus locked
// 4. QuickPick: 'Copy to {scopeLabel}' + filePath description
// 5. Read target config — check if key already exists, ask to overwrite
// 6. setEnvVar(targetFilePath, envKey, value)
// 7. Show success toast: MESSAGES.copiedEnvVar(envKey, scopeLabel)
```

A new MESSAGES entry is needed: `copiedEnvVar: (key, scope) => ...`

### Pattern 2: editValue Extension for SettingKeyValue
**What:** `editValue` already dispatches on `keyPath[0]` (rootKey). SettingKeyValue nodes have `keyPath = [parentKey, childKey]`.
**When to use:** ACTN-04

The existing `editValue` handler covers `env` (length 2), `sandbox`, and scalar settings. SettingKeyValue writes need a new writer function `setSettingKeyValue(filePath, parentKey, childKey, value)` that does:
```typescript
// Read config, navigate to config[parentKey] (must be object), set [childKey] = value, write back
```
Or the simpler approach: re-use `setScalarSetting` after constructing the full nested object. The safest path is a dedicated `setSettingKeyValue` writer — it reads the parent object, patches the child key, and writes the parent back via `setScalarSetting`.

The type-preservation requirement (CONTEXT.md) means the `parseInputValue` helper already in `editCommands.ts` must be applied: it auto-detects boolean, number, null, JSON, string.

Pre-fill uses `node.description?.toString()` — consistent with how other editValue handlers work.

### Pattern 3: deleteItem Extension for SettingKeyValue
**What:** `deleteItem` dispatches on `rootKey`. SettingKeyValue keyPath is `[parentKey, childKey]` — rootKey is `parentKey`, which is a settings key (not in DEDICATED_SECTION_KEYS).
**When to use:** ACTN-05

The current else-branch calls `removeScalarSetting(filePath, rootKey)` — that would delete the ENTIRE parent object, which is wrong. A new writer `removeSettingKeyValue(filePath, parentKey, childKey)` reads the parent, deletes `[childKey]`, writes back (leaving `{}` if last key — correct per CONTEXT.md). The `deleteItem` handler needs a new branch:
```typescript
// Before the final else:
} else if (keyPath.length === 2 && !DEDICATED_SECTION_KEYS.has(rootKey)) {
  removeSettingKeyValue(filePath, rootKey, keyPath[1]);
}
```

### Pattern 4: MCP Multi-Scope Discovery
**What:** Read `~/.claude.json` to extract User and Local MCP entries alongside existing `.mcp.json` Project entries
**When to use:** ACTN-03

**Confirmed `~/.claude.json` JSON structure (verified against real file):**
```json
{
  "mcpServers": { "serverName": { ...McpServerConfig } },
  "projects": {
    "/absolute/workspace/path": {
      "mcpServers": { "serverName": { ...McpServerConfig } },
      ...other project metadata
    }
  }
}
```

- Top-level `mcpServers` = User scope (global across all projects)
- `projects[workspaceFolderPath].mcpServers` = Local scope (private, specific to that project path)
- Both are `Record<string, McpServerConfig>` — same shape as `.mcp.json` `mcpServers`

**Integration changes required:**

1. **`configDiscovery.ts`**: `DiscoveredPaths` needs new optional fields `userMcp` and `localMcp`. `discoverConfigPaths()` reads `~/.claude.json`, extracts `mcpServers` for User and `projects[root].mcpServers` for Local.

2. **`configModel.ts`**: `buildScopedConfigs()` currently attaches `mcpConfig` only to ProjectShared. Must also:
   - Attach User MCP data to the User ScopedConfig (`mcpConfig`, `mcpFilePath` → `~/.claude.json`)
   - Attach Local MCP data to the ProjectLocal ScopedConfig (`mcpConfig`, `mcpFilePath` → `~/.claude.json`)

3. **`configWriter.ts`**: `setMcpServer` and `removeMcpServer` currently write `McpConfig` shape (top-level `mcpServers`). For `~/.claude.json`, User scope writes to top-level `mcpServers`; Local scope writes to `projects[path].mcpServers`. This requires separate writer functions or path-aware logic:
   - `setUserMcpServer(claudeJsonPath, serverName, config)` — writes to `data.mcpServers[name]`
   - `setLocalMcpServer(claudeJsonPath, workspacePath, serverName, config)` — writes to `data.projects[workspacePath].mcpServers[name]`
   - Similarly for remove operations

4. **`constants.ts`**: Add `CLAUDE_JSON_FILE = '.claude.json'` (top-level file, not directory) and `getUserClaudeJsonPath()` in `platform.ts`.

5. **`getAllowedWritePaths()`**: Add `~/.claude.json` path to the allowed write set.

6. **`builder.ts` `buildMcpServers()`**: No change needed — it already reads `scopedConfig.mcpConfig?.mcpServers`. Once discovery distributes MCP data correctly, the builder will render correctly.

### Pattern 5: MCP Inline Buttons
**What:** Add move@1, copy@2 to mcpServer contextValue and package.json menus
**When to use:** ACTN-03

Current mcpServer contextValue: `computeStandardContextValue('mcpServer', isReadOnly, overlap)` — produces `mcpServer.editable` or `mcpServer.readOnly[.overridden]`.

Package.json changes needed:
- Add `claudeConfig.moveToScope` inline@1 entry for `^mcpServer\.editable`
- Add `claudeConfig.copyMcpServerToScope` inline@2 entry for `^mcpServer\.editable` (new command)
- `claudeConfig.deleteItem` inline@3 already covers `mcpServer` in the existing regex

New command `copyMcpServerToScope` needed in moveCommands.ts. It must use the correct writer (User vs Local vs Project target).

### Pattern 6: MCP Tooltip Scope Line
**What:** Add "Defined in: {ScopeLabel} ({shortPath})" line to MCP server tooltip
**When to use:** ACTN-02

Current `buildMcpServers()` in builder.ts creates `baseTooltip` with type+command. Add the scope line before passing to `buildOverlapTooltip()`:
```typescript
const scopeLabel = SCOPE_LABELS[scopedConfig.scope];
const shortPath = getShortPath(scopedConfig.mcpFilePath ?? scopedConfig.filePath);
baseTooltip.appendText(`\n\nDefined in: ${scopeLabel} (${shortPath})`);
// Or rebuild as one MarkdownString
```
The EnvVar tooltip (builder.ts lines 658–665) is the reference pattern:
```typescript
`**${key}** = \`${truncatedValue}\`\n\nDefined in: ${scopeLabel} (${shortPath})`
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Nested object write | Custom JSON manipulation | `readJsonFile` + mutate + `writeJsonFile` (existing pattern) | trackedWrite handles lifecycle, symlink checks, allowed paths |
| Type coercion from string input | Custom parser | `parseInputValue()` already in editCommands.ts | Handles boolean/number/null/JSON/string cases |
| Scope picker UI | Custom modal | `vscode.window.showQuickPick` with scope map (already used in all copy/move commands) | VS Code native, consistent UX |
| MCP config shape parsing | Custom schema | `McpServerConfig` type already defined in types.ts | Covers both stdio and SSE shapes |

---

## Common Pitfalls

### Pitfall 1: Writing to `~/.claude.json` corrupts non-MCP data
**What goes wrong:** `~/.claude.json` contains many unrelated fields (numStartups, projects, oauthAccount, etc.). A naive read-modify-write that only preserves `McpConfig` shape would delete all other top-level fields.
**Why it happens:** The existing `setMcpServer` / `removeMcpServer` use `loadOrCreate<McpConfig>` which only deserializes `mcpServers`. Writing this back as `{ mcpServers: ... }` loses everything else.
**How to avoid:** For `~/.claude.json`, use `loadOrCreate<Record<string, unknown>>` (read full object), mutate the `mcpServers` or `projects[path].mcpServers` key, write back the full object. Never narrow the type to `McpConfig` when the file is `~/.claude.json`.
**Warning signs:** `~/.claude.json` shrinks dramatically in size after a write; user loses Claude Code state.

### Pitfall 2: Wrong file path used for `filePath` on MCP nodes
**What goes wrong:** MCP nodes for User and Local scopes have their `filePath` set to the settings file (`~/.claude/settings.json`) rather than `~/.claude.json`. The `revealInFile` click handler opens the wrong file.
**Why it happens:** `buildMcpServers()` in builder.ts uses `scopedConfig.mcpFilePath ?? scopedConfig.filePath`. If `mcpFilePath` is not set on User/Local ScopedConfigs, it falls back to the settings file.
**How to avoid:** Ensure `buildScopedConfigs()` sets `mcpFilePath = claudeJsonPath` when attaching MCP data to User and ProjectLocal scopes.

### Pitfall 3: Local MCP project path key mismatch
**What goes wrong:** Looking up `projects[workspaceFolderPath].mcpServers` uses the wrong path string — e.g., trailing slash, symlink resolution differences, or URI vs fsPath.
**Why it happens:** `~/.claude.json` stores paths as absolute `fsPath` strings. VS Code workspace folder URIs may have different formatting.
**How to avoid:** Use `folder.uri.fsPath` (already used in `configDiscovery.ts` for `root`), which matches how Claude Code CLI writes the path. Verify exact key match before accessing.

### Pitfall 4: `setScalarSetting` for SettingKeyValue deletes sibling keys
**What goes wrong:** If `deleteItem` falls into the `removeScalarSetting(filePath, rootKey)` else-branch for a SettingKeyValue node, the entire parent object (e.g., `attribution: { commit, pr }`) is deleted instead of just one child key.
**Why it happens:** The current else-branch interprets `rootKey` as a scalar setting key, which is correct for SettingNode but wrong for SettingKeyValueNode.
**How to avoid:** Add the `keyPath.length === 2 && !DEDICATED_SECTION_KEYS.has(rootKey)` guard branch BEFORE the final else in `deleteItem`.

### Pitfall 5: editValue pre-fill shows wrong value for SettingKeyValue
**What goes wrong:** `node.description?.toString()` returns the raw description string which may include the "overridden by" suffix for overridden nodes.
**Why it happens:** `buildSettingKeyValueVM` calls `applyOverrideSuffix(rawDescription, overlap)` before storing in `description`.
**How to avoid:** When extending `editValue` for settingKeyValue, check if description has the override suffix and strip it, OR read the raw value from a separate VM field. The simplest approach: since `SettingKeyValueVM` has a `value` field, the node VM is available but only `node.description` is accessible from `ConfigTreeNode`. For clean pre-fill: strip the suffix pattern ` (overridden by .*)` before showing in the input box, or add a `rawValue` field to `SettingKeyValueVM`.

### Pitfall 6: MCP write path not in `getAllowedWritePaths()`
**What goes wrong:** `validateConfigPath` throws "outside allowed config directories" when writing User or Local MCP data to `~/.claude.json`.
**Why it happens:** `getAllowedWritePaths()` only includes `~/.claude/settings.json`, project settings files, and `.mcp.json` — not `~/.claude.json`.
**How to avoid:** Add `getUserClaudeJsonPath()` result to `getAllowedWritePaths()`.

---

## Code Examples

### EnvVar Copy Command (ACTN-01 pattern from copySettingToScope)
```typescript
// Source: src/commands/moveCommands.ts, copySettingToScope pattern
vscode.commands.registerCommand('claudeConfig.copyEnvVarToScope', async (node?: ConfigTreeNode) => {
  if (!node?.nodeContext) return;
  const { filePath, keyPath, isReadOnly, scope } = node.nodeContext;
  if (!filePath) return;
  if (isReadOnly && scope !== ConfigScope.User) {
    vscode.window.showWarningMessage(MESSAGES.readOnlyCopy);
    return;
  }
  if (!validateKeyPath(keyPath, 1, 'copyEnvVarToScope')) return;
  if (keyPath[0] !== 'env' || keyPath.length !== 2) return;
  const envKey = keyPath[1];
  // ... scope picker, duplicate check, setEnvVar(targetFilePath, envKey, value)
});
```

### SettingKeyValue Writer Functions (ACTN-04/05)
```typescript
// New in configWriter.ts
export function setSettingKeyValue(filePath: string, parentKey: string, childKey: string, value: unknown): void {
  ensureDir(filePath);
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  if (!config[parentKey] || typeof config[parentKey] !== 'object') {
    config[parentKey] = {};
  }
  (config[parentKey] as Record<string, unknown>)[childKey] = value;
  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}

export function removeSettingKeyValue(filePath: string, parentKey: string, childKey: string): void {
  const config = loadOrCreate<ClaudeCodeConfig>(filePath);
  const parent = config[parentKey];
  if (!parent || typeof parent !== 'object') return;
  delete (parent as Record<string, unknown>)[childKey];
  // Do NOT clean up empty parent — leave as {} per design decision
  trackedWrite(filePath, () => writeJsonFile(filePath, config));
}
```

### editValue Extension (ACTN-04)
```typescript
// In editCommands.ts, editValue handler, add branch after existing 'env' check:
if (rootKey === 'env' && keyPath.length === 2) {
  setEnvVar(filePath, keyPath[1], newValue);
} else if (rootKey === 'sandbox') {
  // ... existing
} else if (keyPath.length === 2 && !DEDICATED_SECTION_KEYS.has(rootKey)) {
  // SettingKeyValue: parentKey = keyPath[0], childKey = keyPath[1]
  const parsed = parseInputValue(newValue);
  setSettingKeyValue(filePath, rootKey, keyPath[1], parsed);
} else {
  // Scalar setting
  const parsed = parseInputValue(newValue);
  setScalarSetting(filePath, rootKey, parsed);
}
```

### ~/.claude.json MCP Reading (ACTN-03 discovery)
```typescript
// In configDiscovery.ts / platform.ts
export function getUserClaudeJsonPath(): string {
  return path.join(os.homedir(), '.claude.json');
}

// In configDiscovery.ts, discoverConfigPaths():
// Add to DiscoveredPaths interface:
//   userMcpConfig?: McpConfig
//   localMcpConfig?: McpConfig  // per-workspace-folder

// Reading:
import { readJsonFile } from '../utils/json';
const claudeJsonPath = getUserClaudeJsonPath();
const claudeJson = readJsonFile<Record<string, unknown>>(claudeJsonPath).data ?? {};

// User scope MCP:
const userMcp: McpConfig = { mcpServers: claudeJson['mcpServers'] as Record<string, McpServerConfig> ?? {} };

// Local scope MCP (per workspace folder):
const projects = claudeJson['projects'] as Record<string, unknown> ?? {};
const projectEntry = projects[folder.uri.fsPath] as Record<string, unknown> ?? {};
const localMcp: McpConfig = { mcpServers: projectEntry['mcpServers'] as Record<string, McpServerConfig> ?? {} };
```

### ~/.claude.json MCP Writing (ACTN-03 write)
```typescript
// New writers for ~/.claude.json
export function setUserMcpServer(claudeJsonPath: string, serverName: string, config: McpServerConfig): void {
  const data = loadOrCreate<Record<string, unknown>>(claudeJsonPath);
  if (!data['mcpServers']) data['mcpServers'] = {};
  (data['mcpServers'] as Record<string, unknown>)[serverName] = config;
  trackedWrite(claudeJsonPath, () => writeJsonFile(claudeJsonPath, data));
}

export function removeUserMcpServer(claudeJsonPath: string, serverName: string): void {
  const data = loadOrCreate<Record<string, unknown>>(claudeJsonPath);
  const servers = data['mcpServers'] as Record<string, unknown> | undefined;
  if (!servers) return;
  delete servers[serverName];
  trackedWrite(claudeJsonPath, () => writeJsonFile(claudeJsonPath, data));
}

export function setLocalMcpServer(claudeJsonPath: string, projectPath: string, serverName: string, config: McpServerConfig): void {
  const data = loadOrCreate<Record<string, unknown>>(claudeJsonPath);
  if (!data['projects']) data['projects'] = {};
  const projects = data['projects'] as Record<string, unknown>;
  if (!projects[projectPath]) projects[projectPath] = {};
  const proj = projects[projectPath] as Record<string, unknown>;
  if (!proj['mcpServers']) proj['mcpServers'] = {};
  (proj['mcpServers'] as Record<string, unknown>)[serverName] = config;
  trackedWrite(claudeJsonPath, () => writeJsonFile(claudeJsonPath, data));
}
```

### Package.json Menu Entries (ACTN-01, ACTN-03, ACTN-04, ACTN-05)
```json
// New command declaration:
{ "command": "claudeConfig.copyEnvVarToScope", "title": "Copy to Scope...", "category": "Claude Config", "icon": "$(add)" }
{ "command": "claudeConfig.copyMcpServerToScope", "title": "Copy to Scope...", "category": "Claude Config", "icon": "$(add)" }

// New inline menu entries (view/item/context):
{ "command": "claudeConfig.copyEnvVarToScope", "when": "view == claudeConfigTree && viewItem =~ /^envVar\\.editable/", "group": "inline@2" }
{ "command": "claudeConfig.moveToScope", "when": "view == claudeConfigTree && viewItem =~ /^mcpServer\\.editable/", "group": "inline@1" }
{ "command": "claudeConfig.copyMcpServerToScope", "when": "view == claudeConfigTree && viewItem =~ /^mcpServer\\.editable/", "group": "inline@2" }
// (deleteItem inline@3 already covers mcpServer via existing regex)

// editValue when clause extension (context menu):
// Change: "viewItem =~ /setting|envVar|sandboxProperty/"
// To:     "viewItem =~ /setting|envVar|sandboxProperty|settingKeyValue/"

// editValue inline@0 for settingKeyValue:
{ "command": "claudeConfig.editValue", "when": "view == claudeConfigTree && viewItem =~ /^settingKeyValue\\.editable/", "group": "inline@0" }
```

---

## State of the Art

| Old Assumption | Corrected Understanding | Impact |
|----------------|------------------------|--------|
| MCP servers are workspace-only (`.mcp.json`) | MCP servers exist in 3 scopes: User/Local (`~/.claude.json`) + Project (`.mcp.json`) | Move/copy between scopes is valid; REQUIREMENTS.md "Out of Scope" entry is wrong |
| `ScopedConfig.mcpConfig` only on ProjectShared | Must also exist on User and ProjectLocal | `buildScopedConfigs()` must be extended; `buildMcpServers()` already handles it correctly once data is present |

**REQUIREMENTS.md correction needed:**
The Out of Scope table entry "MCP Server move/copy between scopes — `.mcp.json` is workspace-scoped, not per config scope; structurally invalid" is now incorrect. This phase corrects this understanding and implements move/copy. REQUIREMENTS.md should be updated to remove this row from Out of Scope.

---

## Open Questions

1. **`copyMcpServerToScope` write routing**
   - What we know: Target scope determines which file/path to write; source scope determines which file/path to delete
   - What's unclear: The `moveToScope` / `copySettingToScope` handlers use `allScopes` to find the file path. For MCP, the target file path and write function differ per target scope (User → `~/.claude.json` `mcpServers`, Local → `~/.claude.json` `projects[path].mcpServers`, Project → `.mcp.json` `mcpServers`)
   - Recommendation: Use the scope type in addition to `filePath` to dispatch to the correct writer. The `ScopedConfig.mcpFilePath` will be `~/.claude.json` for both User and Local, so the scope discriminant is needed to pick the right write path.

2. **Move vs Copy for MCP nodes**
   - What we know: `moveToScope` is a unified command handling permissions, envVars, plugins, and scalar settings
   - What's unclear: Whether to extend `moveToScope` to handle `mcpServers` rootKey, or implement a separate `moveMcpServerToScope`
   - Recommendation: Extend `moveToScope` handler to include `mcpServers` branch (analogous to the `env` branch), using the scope-aware writers.

3. **File watcher coverage for `~/.claude.json`**
   - What we know: `fileWatcher.ts` watches known config file paths
   - What's unclear: Whether `~/.claude.json` needs to be added to the file watcher for auto-refresh when external changes occur
   - Recommendation: Add `~/.claude.json` to the watcher for full consistency, but this can be deferred if the plan runs long — manual refresh still works.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha ^10.2.0 |
| Config file | `tsconfig.test.json`, entry at `test/runTests.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACTN-01 | `copyEnvVarToScope` copies env var to target scope | unit | `npm run test` | ❌ Wave 0 |
| ACTN-02 | MCP tooltip includes scope/path line | unit | `npm run test` | ❌ Wave 0 |
| ACTN-03 | MCP servers appear in User and Local scopes when `~/.claude.json` has entries | unit | `npm run test` | ❌ Wave 0 |
| ACTN-03 | `copyMcpServerToScope` copies MCP server to target scope | unit | `npm run test` | ❌ Wave 0 |
| ACTN-04 | `editValue` on SettingKeyValue node updates child key | unit | `npm run test` | ❌ Wave 0 |
| ACTN-05 | `deleteItem` on SettingKeyValue node removes child key, leaves sibling keys | unit | `npm run test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run compile` (type-check + bundle)
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

All tests for Phase 28 are new — no existing test files cover these behaviors. Tests should be added to:

- [ ] `test/suite/viewmodel/builder.test.ts` — MCP multi-scope rendering (ACTN-02, ACTN-03 builder side)
- [ ] `test/suite/config/overlapResolver.test.ts` — MCP overlap across User/Local/Project scopes (if new scope combinations surface edge cases)
- [ ] `test/suite/commands/moveCommands.test.ts` (new file) — copyEnvVarToScope, copyMcpServerToScope, moveToScope for MCP
- [ ] `test/suite/commands/editDeleteCommands.test.ts` (new file) — editValue for settingKeyValue, deleteItem for settingKeyValue

---

## Sources

### Primary (HIGH confidence)
- Source code inspection: `src/commands/moveCommands.ts` — `copySettingToScope`, `copyPermissionToScope` patterns
- Source code inspection: `src/commands/editCommands.ts` — `editValue` dispatch logic, `parseInputValue`
- Source code inspection: `src/commands/deleteCommands.ts` — `deleteItem` dispatch logic
- Source code inspection: `src/config/configWriter.ts` — `setMcpServer`, `removeMcpServer`, `trackedWrite`, `validateConfigPath`, `getAllowedWritePaths`
- Source code inspection: `src/viewmodel/builder.ts` — `buildMcpServers`, `buildEnvVars`, `buildSettingKeyValueVM`
- Source code inspection: `src/config/configModel.ts` — `buildScopedConfigs` MCP attachment pattern
- Source code inspection: `src/config/configDiscovery.ts` — current discovery logic
- Live file inspection: `~/.claude.json` on developer machine — confirmed exact JSON structure for User scope (`mcpServers`) and Local scope (`projects[path].mcpServers`)
- Official Claude Code docs: https://code.claude.com/docs/en/mcp — confirmed 3 MCP scopes, file locations, and JSON format

### Secondary (MEDIUM confidence)
- `package.json` menus inspection — confirmed current inline button slots and contextValue when clauses
- CONTEXT.md decisions — confirmed scope mapping and all implementation choices

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new dependencies, all patterns from existing code
- Architecture: HIGH — confirmed `~/.claude.json` structure from live file; all patterns verified in source
- Pitfalls: HIGH — all pitfalls grounded in actual code paths (configWriter validation, description suffix, wrong type narrowing)
- MCP scope discovery: HIGH — confirmed against both official docs and real `~/.claude.json`

**Research date:** 2026-03-13
**Valid until:** 2026-06-13 (stable — Claude Code MCP config format is unlikely to change)
