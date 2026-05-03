---
name: managed-scope-support
description: Full support for Claude Code's Managed (enterprise) scope — read managed-settings.json, show policy enforcement flags, display lockdown status, and surface managed-only settings in the tree
status: backlog
created: 2026-05-03T02:00:00Z
---

# PRD: managed-scope-support

## Source Ideas

- Verified reference `vault/projects/_references/cc_config_reference.md` — Enterprise Enforcement section.
- config-model-alignment research (May 2026) — 12+ managed-only flags, managed-settings.d/ drop-in directory, MDM/OS-level policies, server-managed delivery.

## Executive Summary

The extension currently reads the Managed scope from a single file path, shows it as read-only, and otherwise treats it like any other scope. But Claude Code's Managed scope is significantly more complex:

- **Multiple delivery mechanisms**: file-based (`managed-settings.json` + `managed-settings.d/` drop-ins), MDM/OS-level policies (macOS plist, Windows Group Policy), and server-managed delivery via Claude.ai admin console. Within the managed tier, these DON'T merge — first-source-wins.
- **12+ managed-only flags** that control what other scopes can do (`allowManagedHooksOnly`, `allowManagedPermissionRulesOnly`, `allowManagedMcpServersOnly`, `forceRemoteSettingsRefresh`, `disableSkillShellExecution`, `sandbox.filesystem.allowManagedReadPathsOnly`, `sandbox.network.allowManagedDomainsOnly`, `allowedChannelPlugins`, `channelsEnabled`, `blockedMarketplaces`, `strictKnownMarketplaces`, `pluginTrustMessage`).
- **Lockdown indicators** that affect what the tree shows: when `allowManagedPermissionRulesOnly` is active, permission rules in User/Project/Local scopes are effectively dead — the extension should indicate this.
- **Managed CLAUDE.md** at OS-level paths — cannot be excluded.
- **Managed MCP servers** via `managed-mcp.json`.

This is an epic-level effort. Decompose into phases.

## Phases (Proposed)

### Phase 1: Drop-in directory support
- Read `managed-settings.d/*.json` alongside `managed-settings.json`.
- Merge per the documented rule: scalars last-wins, arrays concat+dedup, objects deep-merged.
- Show each drop-in file as a sub-node under the Managed scope.

### Phase 2: Policy enforcement visualization
- Detect managed-only flags in the loaded config.
- When `allowManagedHooksOnly` is active, show a lockdown badge on Hook sections in non-Managed scopes: "Blocked by managed policy."
- Same for `allowManagedPermissionRulesOnly` → permission sections, `allowManagedMcpServersOnly` → MCP sections.
- When `sandbox.*.allowManaged*Only` is active, show lockdown on affected sandbox arrays.

### Phase 3: Managed MCP servers
- Read `managed-mcp.json` from the same OS-level paths.
- Show managed MCP servers in the tree, read-only.

### Phase 4: Policy status summary
- Add a summary node or badge on the Managed scope root showing active enforcement flags.
- "3 lockdown policies active: hooks, permissions, MCP servers."

### Phase 5: MDM/OS-level policy detection (stretch)
- Detect macOS managed preferences (`com.anthropic.claudecode` plist domain).
- Detect Windows registry policies (`HKLM\SOFTWARE\Policies\ClaudeCode`).
- Show source indicator: "Managed (MDM)" vs "Managed (file)" vs "Managed (server)".

## Out of Scope

- Writing to managed settings (always read-only).
- Server-managed settings fetching (requires authentication with Claude.ai admin — not feasible from a VS Code extension).

## Dependencies

- config-model-alignment (managed-only flags must be in the schema/types first).
