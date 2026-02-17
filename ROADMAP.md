# Claude Code Config Manager — Roadmap

## v1.0 — Free

Core config viewer and editor using VS Code native TreeView.

- **Scope-based tree view** — 4 top-level nodes: Managed → User → Project (Shared) → Project (Local)
- **Entity sections per scope** — Permissions, Sandbox, Hooks, MCP Servers, Environment, Settings, Plugins
- **Permissions drill-down** — Deny / Ask / Allow subgroups with tool names
- **Read-only managed scope** — Lock icon, no edit actions, detected from system paths
- **Override indicators** — Dim items overridden by higher-precedence scope; tooltip shows which scope wins
- **Move between scopes** — Right-click → "Move to Scope…" to relocate a permission rule or setting
- **Inline editing** — Edit scalar values, toggle permissions, add/remove list items
- **File watcher** — Auto-refresh on external changes to any config file
- **JSON validation** — Schema validation against official Claude Code JSON schema
- **Command palette** — Refresh, Open Config File, Add Permission Rule, Add MCP Server
- **Multi-root workspace support** — Separate project scopes per workspace folder

## v2.0 — Paid (Team / Pro)

Features targeting team leads, engineering managers, and security-conscious orgs.

### Config Drift Detection

- Compare local developer configs against project baseline
- Dashboard: which team members have overrides that weaken security rules
- CI integration: fail builds if local configs violate project policy
- Export drift report as JSON/CSV

### Config Linting & Policy Engine

- Custom rules: "sandbox must be enabled", "deny Bash(\*) at project scope", "no wildcard MCP servers"
- Pre-commit hook generation to enforce config policy
- Warning badges in tree view for policy violations
- Quick-fix actions to auto-resolve violations

### Audit Trail

- Git-aware changelog: who changed what config, when, in which commit
- Blame view per setting (like GitLens for config)
- Timeline panel showing config evolution over time

### Config Templates & Sharing

- Export a scope as a shareable template (JSON + README)
- Import templates: "Apply security-hardened baseline"
- Template marketplace / gallery (community + org-private)

### Advanced Managed Settings Support

- Visual diff: managed policy vs. effective resolved config
- Compliance dashboard: green/yellow/red per project
- Sync status indicator for server-managed settings (last poll time, errors)

### Pricing Model

Per-seat monthly, aligned with existing Claude for Teams billing. Free tier stays fully functional for individual developers. Paid features activate per-workspace when a license key is configured.
