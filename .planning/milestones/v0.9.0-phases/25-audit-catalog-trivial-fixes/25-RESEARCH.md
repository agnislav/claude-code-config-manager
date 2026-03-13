# Phase 25: Audit Catalog + Trivial Fixes - Research

**Researched:** 2026-03-12
**Domain:** VS Code TreeView audit and display fixes in TypeScript/VS Code extension
**Confidence:** HIGH

## Summary

Phase 25 has two deliverables: (1) a comprehensive audit matrix documenting actual vs expected behavior for all 14 node types across 4 audit vectors, and (2) three trivial display fixes in `builder.ts`. The audit is a documentation task driven entirely by code analysis -- no library research needed. The three trivial fixes are localized changes to `TreeViewModelBuilder` methods in `src/viewmodel/builder.ts`.

All three fixes follow established patterns already in the codebase. Sandbox section count follows the `getSectionItemCount` pattern used by 6 other section types. HookEntry description follows the MCP Server `description` prefix pattern. EnvVar tooltip follows the MCP Server `baseTooltip` MarkdownString pattern. Risk is minimal because all changes are additive display-only modifications.

**Primary recommendation:** Start with the audit matrix (documentation-only, zero code risk), then implement the three trivial fixes in `builder.ts`, each verified against existing test patterns.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Audit matrix is a standalone file: `25-AUDIT-MATRIX.md` in the phase directory
- Hybrid structure: summary overview table + detailed finding sections per node type
- Cover all 14 node types including containers (Scope, Section, WorkspaceFolder, HookEvent)
- Audit vectors: tooltip, inline buttons, context menu, click behavior, overlap detection
- Icons and descriptions excluded from audit vectors (not selected)
- Generated via code analysis (reading builder.ts, package.json when clauses, node files) -- no manual Extension Development Host testing needed
- 3-way classification: OK / Intentional / Gap
- Gaps reference target phase via a separate tracking table in the findings section
- HookEntry description: type with detail (`command: echo hello` / `prompt: Review output` / `agent: auto-setup`)
- Allow duplication between label and description for HookEntry
- EnvVar tooltip: full context (`**KEY** = \`value\`` + `Defined in: Scope (path)` + separator + overlap)
- Long values truncated at 80 characters with ellipsis
- Only EnvVar gets base tooltip in this phase

### Claude's Discretion
- Exact wording of summary table column headers
- Section ordering within the audit matrix
- How to handle edge cases in code analysis (e.g., multi-root workspace nodes)
- Sandbox section count: match existing patterns (e.g., "3 rules", "5 vars")

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUDIT-01 | Complete audit matrix documenting actual vs expected state for all 14 node types across all audit vectors | Code analysis of builder.ts (1018 lines), package.json menus (23 context items, 0 inline items), viewmodel/types.ts (14 NodeKind values), and constants.ts |
| AUDIT-02 | Document intentional design decisions vs unintentional inconsistencies for each finding | 3-way classification (OK/Intentional/Gap) per CONTEXT.md decisions |
| TRIV-01 | Sandbox section header shows item count in description | `getSectionItemCount()` line 1006 currently returns `''` for Sandbox; needs count logic matching other sections |
| TRIV-02 | HookEntry description shows hook type (command, prompt, or agent) | `buildHookEntryVM()` line 964 currently sets `description: ''`; needs type prefix like MCP Server pattern |
| TRIV-03 | EnvVar nodes show base tooltip with key=value context | `buildEnvVars()` line 657 currently passes `undefined` as existingTooltip to `buildOverlapTooltip()`; needs MarkdownString base tooltip |
</phase_requirements>

## Architecture Patterns

### Code Locations for All Changes

```
src/viewmodel/builder.ts     # ALL three trivial fixes go here
  - getSectionItemCount()     # TRIV-01: Sandbox count (line 1006)
  - buildHookEntryVM()        # TRIV-02: HookEntry description (line 964)
  - buildEnvVars()            # TRIV-03: EnvVar base tooltip (line 657)
```

### Pattern 1: Section Item Count (model for TRIV-01)

**What:** Each section header shows a count of its children in the `description` field.
**Existing examples:**
```typescript
// Permissions: count all rules across categories
case SectionType.Permissions: {
  const p = scopedConfig.config.permissions;
  const count = (p?.allow?.length ?? 0) + (p?.deny?.length ?? 0) + (p?.ask?.length ?? 0);
  return `${count} rule${count !== 1 ? 's' : ''}`;
}

// Environment: count env var keys
case SectionType.Environment: {
  const e = scopedConfig.config.env;
  const count = e ? Object.keys(e).length : 0;
  return `${count} var${count !== 1 ? 's' : ''}`;
}
```

**For Sandbox:** Count properties, flattening `network` sub-object (matching how `buildSandboxProperties` flattens them). The word should be "property" / "properties" to match the SandboxProperty node type.

```typescript
case SectionType.Sandbox: {
  const s = scopedConfig.config.sandbox;
  if (!s) return '0 properties';
  let count = 0;
  for (const [key, value] of Object.entries(s)) {
    if (key === 'network' && typeof value === 'object' && value !== null) {
      count += Object.keys(value).length;
    } else {
      count++;
    }
  }
  return `${count} ${count !== 1 ? 'properties' : 'property'}`;
}
```

### Pattern 2: Description with Type Prefix (model for TRIV-02)

**What:** Entity nodes show a type prefix in their description.
**Existing example (MCP Server):**
```typescript
// MCP Server description: type prefix + primary identifier
if (isSseConfig(config)) {
  description = `sse: ${config.url}`;
} else {
  description = `stdio: ${config.command}`;
}
```

**For HookEntry:** Following the CONTEXT.md decision, description should show `command: {value}`, `prompt: {value}`, or `agent: {value}`.

```typescript
// In buildHookEntryVM(), replace `description: ''` with:
const hookDetail = hook.command ?? hook.prompt ?? hook.type;
const description = `${hook.type}: ${hookDetail}`;
```

Note: The `hook` object has `type` ('command' | 'prompt' | 'agent'), `command?` (string), and `prompt?` (string). For agent type, there is no `command` or `prompt`, so it falls back to just the type name.

### Pattern 3: Base Tooltip MarkdownString (model for TRIV-03)

**What:** Entity nodes build a structured MarkdownString tooltip, then pass it to `buildOverlapTooltip()` which appends overlap info after a separator.
**Existing example (MCP Server):**
```typescript
// MCP Server tooltip: structured base + overlap appended
let baseTooltip: vscode.MarkdownString;
if (isSseConfig(config)) {
  baseTooltip = new vscode.MarkdownString(`**SSE Server**\n\nURL: \`${config.url}\``);
} else {
  const cmd = [config.command, ...(config.args ?? [])].join(' ');
  baseTooltip = new vscode.MarkdownString(`**Stdio Server**\n\nCommand: \`${cmd}\``);
}
const tooltip = buildOverlapTooltip(baseTooltip, overlap);
```

**For EnvVar:** Per CONTEXT.md format: `**KEY** = \`value\`` + `Defined in: Scope (path)`.

```typescript
// In buildEnvVars(), replace `buildOverlapTooltip(undefined, overlap)` with:
const truncatedValue = value.length > 80 ? value.substring(0, 80) + '...' : value;
const scopeLabel = SCOPE_LABELS[scopedConfig.scope];
const shortPath = getShortPath(scopedConfig.filePath);
const baseTooltipMd = new vscode.MarkdownString(
  `**${key}** = \`${truncatedValue}\`\n\nDefined in: ${scopeLabel} (${shortPath})`
);
const tooltip = buildOverlapTooltip(baseTooltipMd, overlap);
```

Note: `SCOPE_LABELS` and `getShortPath()` are already available in scope within builder.ts.

### Anti-Patterns to Avoid
- **Modifying node files:** All VM construction happens in builder.ts. Node files (src/tree/nodes/) are thin TreeItem wrappers that consume VMs. Never add business logic there.
- **Breaking edit pre-fill:** The `editValue` command reads `node.description` for pre-fill (editCommands.ts line 36). HookEntry is NOT editable, so TRIV-02 is safe. EnvVar IS editable, but TRIV-03 only changes tooltip, not description. Both are safe.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Overlap tooltip formatting | Custom tooltip assembly | `buildOverlapTooltip()` | Already handles MarkdownString concatenation with separators and theme icons |
| Sandbox property counting | Ad-hoc counting logic | Mirror `buildSandboxProperties()` flattening | The same network sub-object flattening logic must be consistent |

## Common Pitfalls

### Pitfall 1: Sandbox Count Mismatch with Displayed Children
**What goes wrong:** Sandbox count shows a different number than actual child nodes rendered.
**Why it happens:** `buildSandboxProperties()` flattens `network` sub-object into individual properties (e.g., `network.allowedDomains`, `network.deniedDomains`). If count logic doesn't mirror this flattening, numbers diverge.
**How to avoid:** Copy the exact iteration logic from `buildSandboxProperties()` (lines 757-768) into the count case.
**Warning signs:** Count says "1 property" but tree shows 3 items (because `network` was flattened).

### Pitfall 2: HookEntry Description Duplicating Label Content
**What goes wrong:** Label already contains the full hook text (e.g., `[Bash] echo test`), and description repeats it.
**Why it happens:** The label is constructed at line 908-910 with matcher prefix and hook content. Description adds type prefix.
**How to avoid:** This duplication is explicitly allowed by CONTEXT.md ("Allow duplication between label and description... consistent with MCP Server pattern"). Not a pitfall to fix -- just document awareness.

### Pitfall 3: EnvVar Tooltip MarkdownString Escaping
**What goes wrong:** Values containing backticks, pipes, or markdown special characters break tooltip rendering.
**Why it happens:** Values are interpolated directly into MarkdownString template literals.
**How to avoid:** Wrap value in single backtick code span (`` \`value\` ``), which is already the planned format. Backtick code spans handle most special characters. If the value itself contains backticks, they'll be escaped by MarkdownString rendering. The MCP Server tooltip follows the same pattern without issues.

### Pitfall 4: Audit Matrix Missing Node Types
**What goes wrong:** Audit covers fewer than 14 node types.
**Why it happens:** Forgetting container nodes (WorkspaceFolder, Scope, Section, HookEvent) or child-only nodes (SettingKeyValue).
**How to avoid:** Reference `NodeKind` enum in viewmodel/types.ts which has exactly 12 members. The "14 node types" from CONTEXT.md likely includes PermissionGroup (which exists as a tree concept but maps to PermissionRule category grouping in the current flat builder). Verify: the 12 NodeKind values are WorkspaceFolder, Scope, Section, PermissionRule, Setting, SettingKeyValue, EnvVar, Plugin, McpServer, SandboxProperty, HookEvent, HookEntry. There is no PermissionGroup in NodeKind -- permissions are flat PermissionRule nodes grouped by category without a group container node.

**Important clarification:** The NodeKind enum has 12 members, not 14. The CONTEXT.md says "all 14 node types" which may be counting PermissionGroup (conceptual grouping visible in the tree hierarchy from CLAUDE.md) and possibly the tree root. The audit should document exactly what exists per NodeKind plus note any conceptual groupings that appear in the UI but lack distinct NodeKind values.

## Code Examples

### Current Sandbox Count (the gap)
```typescript
// Source: builder.ts lines 1006-1007
case SectionType.Sandbox:
  return '';  // <-- TRIV-01: needs count logic
```

### Current HookEntry Description (the gap)
```typescript
// Source: builder.ts line 964
return {
  kind: NodeKind.HookEntry,
  // ...
  description: '',  // <-- TRIV-02: needs type prefix
  // ...
};
```

### Current EnvVar Tooltip (the gap)
```typescript
// Source: builder.ts line 657
tooltip: buildOverlapTooltip(undefined, overlap),  // <-- TRIV-03: needs base tooltip
```

### HookCommand Type Structure
```typescript
// Source: types.ts lines 60-67
export interface HookCommand {
  type: 'command' | 'prompt' | 'agent';
  command?: string;   // present when type === 'command'
  prompt?: string;    // present when type === 'prompt'
  timeout?: number;
  async?: boolean;
}
```

## Audit Vector Analysis

### Audit Vector: Tooltips
| Node Type | Current Tooltip | Has Base Content? |
|-----------|----------------|-------------------|
| WorkspaceFolder | `undefined` | No |
| Scope | MarkdownString from `SCOPE_DESCRIPTIONS` | Yes |
| Section | `undefined` | No |
| PermissionRule | Overlap only (or override warning) | Conditional |
| Setting | JSON preview for objects, overlap for all | Conditional |
| SettingKeyValue | JSON preview for objects, overlap for all | Conditional |
| EnvVar | Overlap only (`undefined` base) | **No -- TRIV-03 gap** |
| Plugin | Plugin description from metadata + overlap | Yes |
| McpServer | Server type + command/URL + overlap | Yes |
| SandboxProperty | Array list for arrays, overlap for all | Conditional |
| HookEvent | `undefined` | No |
| HookEntry | Command in backticks (command type only) | Partial |

### Audit Vector: Inline Buttons
**Current state:** `view/item/inline` has 0 entries in package.json. No node type has inline buttons. This is a key finding for INLN-* requirements in Phase 26.

### Audit Vector: Context Menus
23 entries in `view/item/context`. Key patterns:
- `openFile`: scope nodes only
- `editValue`: setting, envVar, sandboxProperty (editable only)
- `deleteItem`: permissionRule, envVar, hookEntry, mcpServer, plugin, setting, sandboxProperty
- `moveToScope`: permissionRule, envVar, plugin, setting (editable only)
- `addX`: section-level (permissions, env, mcpServers, hooks)
- 5 entries with `&& false` guards: 3 plugin actions (move/copy/delete), 1 envVar+sandboxProperty edit duplicate, 1 envVar move duplicate

### Audit Vector: Click Behavior
Leaf nodes with `computeCommand()` get `revealInFile` on click. Container nodes (Scope, Section, HookEvent, WorkspaceFolder) have no click command -- they expand/collapse.

### Audit Vector: Overlap Detection
| Node Type | Has Overlap Resolution? | Overlap Function |
|-----------|------------------------|------------------|
| PermissionRule | Yes | `resolvePermissionOverlap` |
| Setting | Yes | `resolveSettingOverlap` |
| SettingKeyValue | Yes (inherits parent) | `resolveSettingOverlap` |
| EnvVar | Yes | `resolveEnvOverlap` |
| Plugin | Yes | `resolvePluginOverlap` |
| McpServer | Yes | `resolveMcpOverlap` |
| SandboxProperty | Yes | `resolveSandboxOverlap` |
| HookEvent | No (`overlap: {}`) | None |
| HookEntry | No (`overlap: {}`) | None -- **Gap for Phase 27 (OVLP-01)** |
| Scope | No (container) | N/A |
| Section | No (container) | N/A |
| WorkspaceFolder | No (container) | N/A |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha (via VS Code test runner) |
| Config file | `test/runTests.ts` + `tsconfig.test.json` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-01 | Audit matrix documentation | manual-only | N/A (documentation deliverable) | N/A |
| AUDIT-02 | Classification of findings | manual-only | N/A (documentation deliverable) | N/A |
| TRIV-01 | Sandbox section count | unit | `npm run test` (builder.test.ts) | Needs new test |
| TRIV-02 | HookEntry description shows type | unit | `npm run test` (builder.test.ts) | Needs new test |
| TRIV-03 | EnvVar base tooltip | unit | `npm run test` (builder.test.ts) | Needs new test |

### Sampling Rate
- **Per task commit:** `npm run compile && npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/suite/viewmodel/builder.test.ts` -- add TRIV-01 test: sandbox section description shows property count
- [ ] `test/suite/viewmodel/builder.test.ts` -- add TRIV-02 test: HookEntry description shows hook type prefix
- [ ] `test/suite/viewmodel/builder.test.ts` -- add TRIV-03 test: EnvVar tooltip contains key=value and scope info

*(Existing test file and infrastructure sufficient -- no new files or framework config needed)*

## Sources

### Primary (HIGH confidence)
- Direct code analysis of `src/viewmodel/builder.ts` (1018 lines) -- all VM construction patterns
- Direct code analysis of `src/viewmodel/types.ts` -- 12 NodeKind enum values
- Direct code analysis of `package.json` menus -- 23 context menu items, 0 inline items
- Direct code analysis of `src/types.ts` -- HookCommand interface, all config shapes
- Direct code analysis of `src/constants.ts` -- labels, icons, section keys
- Direct code analysis of `test/suite/viewmodel/builder.test.ts` -- existing test patterns
- Direct code analysis of `src/commands/editCommands.ts` -- edit pre-fill reads from description

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no external libraries involved, all changes in existing codebase
- Architecture: HIGH -- patterns directly observed in builder.ts with line numbers
- Pitfalls: HIGH -- derived from actual code analysis, not speculation

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable internal codebase)
