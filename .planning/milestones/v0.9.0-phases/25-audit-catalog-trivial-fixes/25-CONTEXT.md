# Phase 25: Audit Catalog + Trivial Fixes - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Document actual-vs-expected behavior for all 14 node types across audit vectors; ship zero-risk display fixes (sandbox count, hook type description, envvar base tooltip). The audit matrix is the primary deliverable — it feeds Phases 26-28 with classified findings.

</domain>

<decisions>
## Implementation Decisions

### Audit Matrix Format
- Standalone file: `25-AUDIT-MATRIX.md` in the phase directory
- Hybrid structure: summary overview table + detailed finding sections per node type
- Cover all 14 node types including containers (Scope, Section, WorkspaceFolder, HookEvent)
- Audit vectors: tooltip, inline buttons, context menu, click behavior, overlap detection
- Icons and descriptions excluded from audit vectors (not selected)
- Generated via code analysis (reading builder.ts, package.json when clauses, node files) — no manual Extension Development Host testing needed

### Audit Classification
- 3-way status: OK / Intentional / Gap
  - **OK** = actual matches expected
  - **Intentional** = differs from expected but by design — one-line rationale inline in status cell
  - **Gap** = unintentional inconsistency needing fix
- Gaps reference target phase via a separate tracking table in the findings section (not inline in status cells)
- Requirement IDs (TRIV-xx, INLN-xx, OVLP-xx, ACTN-xx) included in tracking table

### HookEntry Type Display (TRIV-02)
- Description shows type with detail: `command: echo hello` / `prompt: Review output` / `agent: auto-setup`
- Allow duplication between label and description (label has full text, description repeats with type prefix) — consistent with MCP Server pattern
- Matcher stays in label only — not repeated in description

### EnvVar Base Tooltip (TRIV-03)
- Full context tooltip: key=value + scope path + overlap info (when relevant)
- Format: `**KEY** = \`value\`` + `Defined in: Scope (path)` + separator + overlap section
- Long values truncated at 80 characters with ellipsis
- Only EnvVar gets base tooltip in this phase — other entity tooltips deferred to audit findings

### Sandbox Section Count (TRIV-01)
- Claude's Discretion: match existing section header count patterns (e.g., "3 rules", "5 vars")

### Claude's Discretion
- Exact wording of summary table column headers
- Section ordering within the audit matrix
- How to handle edge cases in code analysis (e.g., multi-root workspace nodes)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TreeViewModelBuilder` (src/viewmodel/builder.ts): Central place where all node descriptions, tooltips, and icons are constructed — primary audit source
- `buildOverlapTooltip()` in builder.ts: Existing pattern for MarkdownString tooltips with overlap info — extend for EnvVar base tooltip
- `computeStandardContextValue()`: Builds contextValue strings that package.json when clauses match against
- `SCOPE_LABELS`, `SECTION_LABELS`, `SECTION_ICONS` in constants.ts: Reference data for expected values

### Established Patterns
- MCP Server tooltip: MarkdownString with config details + overlap appended — model for EnvVar tooltip
- MCP Server description: `stdio: {command}` / `sse: {url}` prefix pattern — model for HookEntry description
- Section description: item count format varies (`3 rules`, `5 vars`, `2 servers`) — model for sandbox count
- HookEntry icon mapping: terminal (command), comment-discussion (prompt), hubot (agent) — already exists

### Integration Points
- `buildHookEntryVM()` in builder.ts: Where HookEntry description needs to be set (currently empty)
- `buildEnvVars()` in builder.ts: Where EnvVar tooltip needs base content added
- `buildSectionVM()` in builder.ts: Where sandbox section count needs to be added
- package.json `menus.view/item/context` and `menus.view/item/inline`: Source of truth for button/menu configuration

</code_context>

<specifics>
## Specific Ideas

- Hybrid matrix format: overview table gives quick scan of OK/gap counts per node, then detailed sections only for nodes with findings — avoids noise from all-OK nodes
- Tracking table at end of findings section maps each gap to target phase + requirement ID for traceability
- EnvVar tooltip should feel like MCP Server tooltip: structured MarkdownString with bold key, code-formatted value, scope line, then separator before overlap

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-audit-catalog-trivial-fixes*
*Context gathered: 2026-03-12*
