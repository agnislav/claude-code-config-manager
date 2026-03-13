# Phase 28: Action Parity - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add missing actions where structurally valid — EnvVar copy-to-scope, MCP Server multi-scope discovery + move/copy + UX enrichment, SettingKeyValue edit/delete. The MCP scope was expanded from the original ACTN-03 after discovering that MCP servers exist across User, Local, and Project scopes (not workspace-only as originally assumed).

</domain>

<decisions>
## Implementation Decisions

### EnvVar Copy-to-Scope (ACTN-01)
- Add `copyEnvVarToScope` inline button at @2, matching permissions and settings copy pattern
- Follows existing `copySettingToScope` and `copyPermissionToScope` implementation in moveCommands.ts
- Straightforward pattern match — no design decisions needed

### MCP Server Multi-Scope Discovery (expanded ACTN-03)
- **Scope correction:** MCP servers are NOT workspace-only. Claude Code supports 3 scopes:
  - **User scope** — `~/.claude.json` (global MCP entries, all projects)
  - **Local scope** — `~/.claude.json` (per-project-path MCP entries, private)
  - **Project scope** — `.mcp.json` at workspace root (version-controlled, team-shared)
- Precedence: Local > Project > User (same direction as settings)
- Local and User MCP servers share the same file (`~/.claude.json`) but are scoped differently
- Managed scope (`managed-mcp.json`) is out of scope for this phase
- Our extension scope mapping: User → User, Local → Project Local, Project → Project Shared

### MCP Server Inline Buttons (ACTN-03)
- Full set: move@1, copy@2, delete@3 — matching permissions, settings, envVar patterns
- No edit@0 — MCP server config is a complex object (command, args, env) unsuitable for QuickPick editing
- Move/copy now valid because MCP servers exist across multiple scopes

### MCP Server Description (ACTN-02)
- Keep current format: `stdio: {command}` / `sse: {url}` — already informative and consistent with HookEntry pattern
- No changes needed

### MCP Server Tooltip (ACTN-02)
- Add scope info line to existing tooltip, matching EnvVar base tooltip pattern from Phase 25
- Format: server type + command/URL details + scope line + overlap section

### SettingKeyValue Edit (ACTN-04)
- Edit via QuickPick input box (same as editValue for settings/envVars)
- Show current value pre-filled, user types new value
- Type preserved: string stays string, number stays number, boolean stays boolean
- Inline edit button at @0, matching the edit slot convention
- Context menu entry via extending editValue when clause to include settingKeyValue

### SettingKeyValue Delete (ACTN-05)
- Inline delete button at @3 (already present)
- Context menu delete (already works via 'setting' pattern match)
- Remove key silently from parent object — no special handling for last key (parent becomes `{}`)

### Claude's Discretion
- How to parse MCP entries from `~/.claude.json` (structure of user vs local MCP data in that file)
- ConfigStore integration for multi-scope MCP data
- Exact implementation of `copyEnvVarToScope` command handler

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `copySettingToScope` / `copyPermissionToScope` in moveCommands.ts: Pattern for EnvVar copy implementation
- `buildOverlapTooltip()` in builder.ts: Append overlap info to base tooltip (reuse for MCP scope line)
- `computeStandardContextValue()`: Builds contextValue strings — extend for MCP with move/copy support
- `resolveMcpOverlap` in overrideResolver: Already exists — will work across new scopes once discovery feeds multi-scope data
- `buildMcpServers()` in builder.ts: Currently reads from `scopedConfig.mcpConfig` — needs to handle multi-scope MCP data

### Established Patterns
- EnvVar base tooltip (Phase 25): `**KEY** = \`value\`` + scope line + overlap — model for MCP scope info addition
- Inline button slot convention (Phase 26): edit@0, move@1, copy@2, delete@3
- Copy command pattern: QuickPick scope selector → write to target scope → reload

### Integration Points
- `configDiscovery.ts`: Currently discovers `.mcp.json` only at workspace root — needs to also read `~/.claude.json` for User and Local MCP entries
- `configModel.ts`: Attaches mcpConfig only to Project Shared scope — needs to distribute across User and Project Local scopes
- `package.json` menus: Add inline entries for MCP move/copy, extend editValue when clause for settingKeyValue
- `moveCommands.ts`: Add `copyEnvVarToScope` handler
- `editCommands.ts`: Extend editValue to handle settingKeyValue nodes

</code_context>

<specifics>
## Specific Ideas

- MCP User and Local scopes both live in `~/.claude.json` — researcher should investigate the exact JSON structure (how per-project entries are keyed by path vs global entries)
- The `.mcp.json` project file "is intended to be version-controlled" per Claude docs — maps cleanly to Project Shared scope
- REQUIREMENTS.md out-of-scope entry "MCP Server move/copy between scopes" needs to be corrected — it was based on the wrong assumption that `.mcp.json` is workspace-only

</specifics>

<deferred>
## Deferred Ideas

- Managed MCP scope (`managed-mcp.json`) — enterprise feature, add in future phase
- MCP server edit action (complex object editing) — would need a dedicated editor UX, not QuickPick

</deferred>

---

*Phase: 28-action-parity*
*Context gathered: 2026-03-13*
