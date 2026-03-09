# Phase 21: Visual Overlap Indicators - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can see when config entities exist in multiple scopes via tooltip information and color tinting. Overlap detection covers settings, env vars, plugins, MCP servers, and sandbox properties. This phase also migrates the existing override system (`isOverridden`/`overriddenByScope`) to the new overlap model. Requirements: OVLP-01, OVLP-02.

</domain>

<decisions>
## Implementation Decisions

### Terminology
- **Overlap** — umbrella term for any entity that exists in multiple scopes
- **Override** — overlap where values differ between scopes
- **Duplicate** — overlap where values are the same across scopes

### State model
- Each entity carries 4 optional directional fields:
  - `overrides?: item` — I win, values differ (nearest lower-precedence neighbor)
  - `isOverriddenBy?: item` — I lose, values differ (nearest higher-precedence neighbor)
  - `duplicates?: item` — I win, values same (nearest lower-precedence neighbor)
  - `isDuplicatedBy?: item` — I lose, values same (nearest higher-precedence neighbor)
- Nearest-neighbor only — each field points to at most one item (no arrays)
- An entity with no overlap has all four fields `undefined`
- This model satisfies OVLP-02: overlap detection uses separate data fields from the old override detection

### Color tinting (FileDecoration)
- Color-only approach via FileDecorationProvider — no badges, no description text changes for overlap
- Color logic (priority order):
  1. `isOverriddenBy` or `isDuplicatedBy` → **Red** (shadowed/redundant — like git deleted line)
  2. `overrides` → **Green** (winning with different value — like git added line)
  3. `duplicates` → **Yellow/amber** (winning but same value — harmless redundancy, cleanup hint)
  4. No overlap → default color (unchanged)
- Git diff metaphor: red = losing/shadowed, green = winning/changed, yellow = winning/redundant

### Tooltip format
- Overlap info appended below existing tooltip content with a separator
- Format: icon + bold relationship + scope + value + effective status
- Example: `$(arrow-down) **Overridden by** Project Local: \`false\` (effective)`
- Uses MarkdownString, consistent with existing tooltip patterns
- Entities with no overlap: tooltip unchanged (no "No overlaps" noise)

### Override system migration
- Fully migrate from old `isOverridden`/`overriddenByScope` in NodeContext to new overlap fields
- `computeOverrideTooltip()` — removed, merged into overlap tooltip
- `applyOverrideSuffix()` — migrated to derive from new overlap fields
- Single source of truth: all override/overlap information comes from the new model
- Existing consumers (contextValue patterns, description suffix) updated to read from new fields

### Entity type coverage
- All 5 entity types: settings, env vars, plugins, MCP servers, sandbox properties
- Matching key per type: setting key, var name, plugin ID, server name, sandbox property name (natural identifiers)
- Value comparison: deep equality (JSON.stringify or deep-equal) for override vs duplicate determination

### Claude's Discretion
- Exact FileDecoration theme color tokens for red/green/yellow
- Internal structure of the overlap resolver (new module or extension of overrideResolver)
- How overlap data flows through ViewModel types (new fields on BaseVM, NodeContext, or separate)
- Test strategy and mock patterns for overlap scenarios

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `computeOverrideTooltip()` (builder.ts:89): Pattern for MarkdownString tooltip generation — will be replaced by overlap tooltip
- `applyOverrideSuffix()` (builder.ts:99): Description suffix pattern — will be migrated to overlap data
- `PluginDecorationProvider` (pluginNode.ts:19): FileDecorationProvider pattern for resourceUri-based decoration — overlap decoration follows same pattern
- `LockDecorationProvider` (lockDecorations.ts:5): Second FileDecorationProvider example in the codebase
- `resolveScalarOverride`, `resolvePermissionOverride`, `resolveEnvOverride`, `resolveSandboxOverride`, `resolvePluginOverride` (overrideResolver.ts): Existing cross-scope resolution logic per entity type — overlap detection extends or parallels this

### Established Patterns
- Override resolution: compare entity across `SCOPE_PRECEDENCE` order, return `{ isOverridden, overriddenByScope }` — overlap resolver adds value comparison and directional relationships
- ViewModel tooltip: each `build*` method in builder.ts computes tooltip locally — overlap tooltip will be appended in each method
- FileDecoration: resourceUri-based with query params for state encoding — overlap decoration can use similar scheme
- NodeContext carries scope metadata through the tree — new overlap fields extend this pattern

### Integration Points
- `NodeContext` (types.ts:176): `isOverridden`/`overriddenByScope` fields to be replaced with overlap fields
- `BaseVM.tooltip` (viewmodel/types.ts:43): Overlap tooltip content appended here
- Each `build*` method in builder.ts (buildSettings, buildEnvVars, buildPlugins, buildMcpServers, buildSandbox): Overlap detection and tooltip generation added per method
- `extension.ts:254-263`: New OverlapDecorationProvider registered alongside existing PluginDecorationProvider and LockDecorationProvider
- All contextValue patterns using `.overridden` suffix: updated to derive from new overlap fields

</code_context>

<specifics>
## Specific Ideas

- Git diff color metaphor: red = deleted/shadowed, green = added/winning, yellow/amber = redundant — intuitive for developers
- "Lose" states (red) prioritized over "win" states in color logic — eye drawn to items that aren't taking effect
- Yellow/amber for duplicates signals "you could clean this up" without implying something is broken
- Gray explicitly avoided for duplicates — already used for plugin dimming (disabled state)

</specifics>

<deferred>
## Deferred Ideas

- OVLP-03: Description text showing "also in [Scope]" on tree item — future requirement, not this phase
- OVLP-04: FileDecoration badge ("2×") for entities in multiple scopes — future requirement, not this phase

</deferred>

---

*Phase: 21-visual-overlap-indicators*
*Context gathered: 2026-03-09*
