---
phase: 28-action-parity
plan: 02
subsystem: config-discovery, config-writer, move-commands, viewmodel-builder
tags: [mcp-servers, multi-scope, move-copy, tooltip, claude-json]
dependency_graph:
  requires: [28-01]
  provides: [user-mcp-discovery, local-mcp-discovery, mcp-scope-writers, mcp-move-copy, mcp-tooltip]
  affects: [configDiscovery, configModel, configWriter, moveCommands, builder, fileWatcher, constants, package.json]
tech_stack:
  added: []
  patterns: [scope-aware-dispatch, record-unknown-preserve-pattern, tdd-red-green]
key_files:
  created:
    - test/suite/config/mcpDiscovery.test.ts
    - test/suite/viewmodel/mcpTooltip.test.ts
  modified:
    - src/utils/platform.ts
    - src/constants.ts
    - src/config/configDiscovery.ts
    - src/config/configModel.ts
    - src/config/configWriter.ts
    - src/commands/moveCommands.ts
    - src/viewmodel/builder.ts
    - src/watchers/fileWatcher.ts
    - package.json
    - .planning/REQUIREMENTS.md
decisions:
  - "Use Record<string,unknown> for ~/.claude.json reads to preserve non-MCP fields on write"
  - "claudeJsonPath stored in DiscoveredPaths so model can set mcpFilePath correctly"
  - "dispatchMcpWrite/dispatchMcpRemove helpers centralize scope-based writer dispatch"
  - "MCP tooltip scope line appended before buildOverlapTooltip (overlap section appended after)"
  - "targetFilePath for copyMcpServerToScope is claudeJsonPath for User/ProjectLocal, mcpFilePath for ProjectShared"
metrics:
  duration: "9 minutes"
  completed: "2026-03-13"
  tasks_completed: 2
  files_changed: 10
---

# Phase 28 Plan 02: MCP Multi-Scope Discovery and Action Parity Summary

Multi-scope MCP server support: User and Local MCP servers from `~/.claude.json` appear in the tree, have enriched tooltips with scope info, and support move/copy/delete inline buttons matching the action parity of permissions, env vars, and settings.

## What Was Built

### Task 1: MCP multi-scope discovery and model wiring

- `getUserClaudeJsonPath()` added to `platform.ts` returning `~/.claude.json`
- `getAllowedWritePaths()` in `constants.ts` now includes `~/.claude.json`
- `DiscoveredPaths` interface extended with `claudeJsonPath`, `userMcpConfig`, `localMcpConfig`
- `discoverConfigPaths()` reads `~/.claude.json` as `Record<string,unknown>` and extracts:
  - Top-level `mcpServers` → User scope MCP
  - `projects[folder.uri.fsPath].mcpServers` → ProjectLocal scope MCP
- `buildScopedConfigs()` attaches `mcpConfig` and `mcpFilePath` to User and ProjectLocal scopes
- Four new scope-aware writers in `configWriter.ts`:
  - `setUserMcpServer` / `removeUserMcpServer` — top-level mcpServers in `~/.claude.json`
  - `setLocalMcpServer` / `removeLocalMcpServer` — `projects[path].mcpServers` in `~/.claude.json`
  - All use `loadOrCreate<Record<string,unknown>>` to preserve non-MCP data
- `fileWatcher.ts` now watches `~/.claude.json` for external changes

### Task 2: MCP scope-aware writers, move/copy commands, tooltip, and package.json wiring

- `buildMcpServers()` in `builder.ts` appends scope info line to MCP tooltip:
  `Defined in: {ScopeLabel} ({shortPath})`
  Uses `scopedConfig.mcpFilePath ?? scopedConfig.filePath` for the path
- New `copiedMcpServer` and `movedMcpServer` MESSAGES entries in `constants.ts`
- `copyMcpServerToScope` command added to `moveCommands.ts`:
  - Guards: blocks Managed scope, validates `keyPath[0] === 'mcpServers' && keyPath.length === 2`
  - Reads server config from `currentSc.mcpConfig.mcpServers[serverName]`
  - Shows QuickPick with target scope options
  - Checks for duplicate server name (asks overwrite if exists)
  - Dispatches write using `dispatchMcpWrite` helper
- `moveToScope` extended with `mcpServers` rootKey branch using `dispatchMcpWrite` / `dispatchMcpRemove`
- `dispatchMcpWrite` / `dispatchMcpRemove` helper functions centralize scope-based dispatch:
  - User → `setUserMcpServer` / `removeUserMcpServer`
  - ProjectLocal → `setLocalMcpServer` / `removeLocalMcpServer`
  - ProjectShared → `setMcpServer` / `removeMcpServer` (existing .mcp.json writer)
- `package.json` additions:
  - `claudeConfig.copyMcpServerToScope` command declaration
  - `mcpServer.editable` inline@1 (moveToScope) and inline@2 (copyMcpServerToScope) menu entries
  - `mcpServer` added to `moveToScope` context menu when clause
  - `copyMcpServerToScope` context menu and commandPalette suppression entries
- `REQUIREMENTS.md` updated:
  - "MCP Server move/copy between scopes" removed from Out of Scope table
  - ACTN-02 and ACTN-03 marked as Complete

## Verification

- `npm run compile` passes with no type errors
- `npm run lint` passes (1 pre-existing warning in builder.ts, 0 errors)
- 103 tests pass (up from 89 before this plan); 2 pre-existing failures unrelated to this plan
- 11 new TDD tests added:
  - `mcpDiscovery.test.ts`: 11 tests for getUserClaudeJsonPath, getAllowedWritePaths, and 4 new writer functions
  - `mcpTooltip.test.ts`: 3 tests for MCP tooltip scope info line

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Description |
|------|-------------|
| 091e133 | test(28-02): add failing tests for MCP discovery and scope-aware writers |
| 1e25ad8 | feat(28-02): MCP multi-scope discovery and scope-aware writers |
| bd3bacc | test(28-02): add failing tests for MCP tooltip scope info line |
| 050cedb | feat(28-02): MCP scope-aware move/copy commands, tooltip, and package.json wiring |

## Self-Check: PASSED

- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/utils/platform.ts` — getUserClaudeJsonPath confirmed
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/config/configDiscovery.ts` — DiscoveredPaths extended
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/config/configWriter.ts` — 4 new MCP writers confirmed
- `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/commands/moveCommands.ts` — copyMcpServerToScope registered
- All 4 task commits exist: 091e133, 1e25ad8, bd3bacc, 050cedb
