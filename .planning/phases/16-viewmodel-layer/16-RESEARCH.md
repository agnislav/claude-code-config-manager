# Phase 16: ViewModel Layer - Research

**Researched:** 2026-03-06
**Domain:** TypeScript ViewModel pattern for VS Code TreeView decoupling
**Confidence:** HIGH

## Summary

Phase 16 introduces a ViewModel layer between ConfigStore data and TreeView rendering. The codebase currently has 14 tree node classes (plus one inline WorkspaceFolderNode) that each construct `vscode.TreeItem` instances directly in their constructors, mixing data transformation with VS Code API calls. The ViewModel layer extracts this transformation into pure data objects (ViewModels) that carry pre-computed display properties.

The existing code is well-structured and consistent. Every node follows the same pattern: constructor receives data, calls override resolver (where applicable), builds NodeContext, sets icon/description/tooltip, calls `finalize()`. The builder simply replicates this dispatch logic from ScopeNode.getChildren() and SectionNode.getChildren() but outputs plain ViewModel objects instead of TreeItem subclasses.

**Primary recommendation:** Create `src/viewmodel/types.ts` with BaseVM + 14 per-type interfaces (plus WorkspaceFolderVM), and `src/viewmodel/builder.ts` with a class-based TreeViewModelBuilder that mirrors the existing SectionNode dispatch pattern. All override resolution and display formatting happens in the builder. No existing files are modified.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Shared base interface (BaseVM) with per-type extensions (ScopeVM extends BaseVM, etc.)
- BaseVM includes a `kind` discriminator field (NodeKind enum/union) for runtime type narrowing in switch statements
- Children typed as `BaseVM[]` -- generic array, builder enforces correct nesting at construction time
- ViewModels carry pre-computed VS Code API objects (ThemeIcon, TreeItemCollapsibleState) -- nodes become trivial mappers that copy fields to TreeItem
- BaseVM shape: kind, label, description, icon (ThemeIcon), collapsibleState, contextValue, tooltip, nodeContext, children
- New `src/viewmodel/` directory -- parallel to `src/config/` and `src/tree/`
- Single `types.ts` file containing BaseVM, NodeKind, and all 14 ViewModel interfaces
- Single `builder.ts` file containing TreeViewModelBuilder class with all entity-specific build methods as private methods
- Class-based TreeViewModelBuilder with constructor taking ConfigStore reference
- Single `build()` entry point returning nested tree structure: ScopeVM[] (single-root) or WorkspaceFolderVM[] (multi-root)
- Children fully nested: ScopeVM -> SectionVM -> entity VMs
- Builder accepts sectionFilter parameter to skip building filtered-out sections
- Builder handles multi-root workspace logic internally
- All entity-specific logic as private methods in one file (~250-350 lines)

### Claude's Discretion
- Exact private method signatures and intermediate data structures within the builder
- How override resolution results map to icon/description choices in ViewModels
- Whether to add a WorkspaceFolderVM type (15th VM) or reuse ScopeVM with a flag
- Error handling within builder (malformed config data)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VM-01 | ViewModel interfaces defined with per-node-type data shapes covering all 14 node types | All 14 node types catalogued with exact field requirements extracted from existing constructors |
| VM-02 | NodeContext preserved in ViewModel so command handlers require zero changes | NodeContext interface already exists in types.ts; BaseVM embeds it directly as `nodeContext` field |
| VM-03 | TreeViewModelBuilder pre-computes override resolution for all entity types | All 5 override resolver functions identified with exact call signatures and which nodes use them |
| VM-04 | TreeViewModelBuilder computes display state (labels, descriptions, icons, contextValues) from raw config data | Complete catalog of display computation logic extracted from all 14 node constructors |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vscode | ^1.85.0 | ThemeIcon, TreeItemCollapsibleState, MarkdownString, ThemeColor types | Already the project's sole runtime dependency |
| TypeScript | 5.x (strict mode) | Type system for ViewModel interfaces | Project convention |

### Supporting
No new libraries needed. This phase uses only existing project dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Class-based VMs | Plain object literals with type assertions | Classes would add OOP ceremony; plain interfaces + builder functions are simpler. User locked class-based builder but interface-based VMs. |
| Pre-computed ThemeIcon in VM | Icon name strings resolved at render time | Pre-computing is locked decision; eliminates node logic entirely |

## Architecture Patterns

### Recommended Project Structure
```
src/viewmodel/
  types.ts       # BaseVM, NodeKind, all 14+ ViewModel interfaces
  builder.ts     # TreeViewModelBuilder class
```

### Pattern 1: Discriminated Union with BaseVM
**What:** Every ViewModel extends BaseVM which carries a `kind: NodeKind` discriminator. This enables exhaustive switch/case in consumers.
**When to use:** Always -- this is the locked decision.
**Example:**
```typescript
// Source: Extracted from CONTEXT.md decisions + existing codebase patterns

export enum NodeKind {
  WorkspaceFolder = 'workspaceFolder',
  Scope = 'scope',
  Section = 'section',
  PermissionGroup = 'permissionGroup',
  PermissionRule = 'permissionRule',
  Setting = 'setting',
  SettingKeyValue = 'settingKeyValue',
  EnvVar = 'envVar',
  Plugin = 'plugin',
  McpServer = 'mcpServer',
  SandboxProperty = 'sandboxProperty',
  HookEvent = 'hookEvent',
  HookEntry = 'hookEntry',
  HookKeyValue = 'hookKeyValue',
}

export interface BaseVM {
  kind: NodeKind;
  label: string;
  description: string;
  icon: vscode.ThemeIcon;
  collapsibleState: vscode.TreeItemCollapsibleState;
  contextValue: string;
  tooltip: string | vscode.MarkdownString | undefined;
  nodeContext: NodeContext;
  children: BaseVM[];
  // Optional fields used by specific node types
  id?: string;
  resourceUri?: vscode.Uri;
  checkboxState?: vscode.TreeItemCheckboxState;
  command?: vscode.Command;
}
```

### Pattern 2: Builder Mirrors SectionNode Dispatch
**What:** TreeViewModelBuilder.build() mirrors the existing ScopeNode.getChildren() -> SectionNode.getChildren() dispatch chain, but returns ViewModels instead of tree nodes.
**When to use:** This is the builder's core architecture.
**Example:**
```typescript
// Source: Extracted from existing SectionNode.getChildren() pattern

export class TreeViewModelBuilder {
  constructor(private readonly configStore: ConfigStore) {}

  build(sectionFilter?: ReadonlySet<SectionType>): BaseVM[] {
    if (this.configStore.isMultiRoot()) {
      return this.buildMultiRoot(sectionFilter);
    }
    return this.buildSingleRoot(sectionFilter);
  }

  private buildScopeVM(
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
    workspaceFolderUri: string | undefined,
    sectionFilter?: ReadonlySet<SectionType>,
  ): ScopeVM { /* ... */ }

  private buildSectionChildren(
    sectionType: SectionType,
    scopedConfig: ScopedConfig,
    allScopes: ScopedConfig[],
  ): BaseVM[] {
    switch (sectionType) {
      case SectionType.Permissions: return this.buildPermissions(scopedConfig, allScopes);
      case SectionType.Settings: return this.buildSettings(scopedConfig, allScopes);
      // ... etc
    }
  }
}
```

### Pattern 3: Pre-computed Display State
**What:** Override resolution, icon selection, description formatting, contextValue computation all happen in the builder. ViewModels are fully resolved -- consumers just copy fields.
**When to use:** Always -- this is the core value of the ViewModel layer.
**Example:**
```typescript
// Source: Extracted from existing SettingNode constructor

private buildSettingVM(
  key: string, value: unknown,
  scopedConfig: ScopedConfig, allScopes: ScopedConfig[],
): SettingVM {
  const override = resolveScalarOverride(key, scopedConfig.scope, allScopes);
  const isExpandable = typeof value === 'object' && value !== null && !Array.isArray(value);

  return {
    kind: NodeKind.Setting,
    label: key,
    description: isExpandable ? '' : formatValue(value),
    icon: override.isOverridden
      ? new ThemeIcon('tools', new ThemeColor('disabledForeground'))
      : new ThemeIcon('tools'),
    collapsibleState: isExpandable
      ? TreeItemCollapsibleState.Collapsed
      : TreeItemCollapsibleState.None,
    contextValue: computeContextValue('setting', scopedConfig.isReadOnly, override.isOverridden),
    tooltip: /* ... */,
    nodeContext: { scope: scopedConfig.scope, keyPath: [key], /* ... */ },
    children: isExpandable ? this.buildSettingKeyValueChildren(key, value, scopedConfig, allScopes) : [],
  };
}
```

### Anti-Patterns to Avoid
- **Lazy children resolution:** Do NOT defer child building. The builder produces the full tree eagerly. Lazy loading would defeat the purpose of pre-computation.
- **Importing vscode.TreeItem in viewmodel/:** ViewModels use vscode types (ThemeIcon, etc.) but NEVER extend TreeItem. They are plain data objects.
- **Duplicating formatting logic:** Extract `formatValue()` and `formatSandboxValue()` as shared utilities. Don't duplicate between builder and existing nodes (existing nodes still use them until Phase 17 migration).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Override resolution | Custom override logic in builder | Existing `overrideResolver.ts` functions | Already tested, handles all edge cases (precedence, permission conflicts, nested sandbox keys) |
| contextValue strings | Ad-hoc string concatenation | Shared `computeContextValue()` helper | Pattern must match package.json `when` clause regexes exactly |
| Value formatting | New formatting functions | Existing `formatValue()` from settingNode.ts, `formatSandboxValue()` from sandboxPropertyNode.ts | Already handles all type cases correctly |
| Scope labels/icons | Hardcoded strings in builder | Existing constants from `constants.ts` (SCOPE_LABELS, SCOPE_ICONS, SECTION_LABELS, etc.) | Single source of truth |

**Key insight:** The builder's job is to ORCHESTRATE existing logic into ViewModel objects, not to REWRITE that logic. Override resolvers, formatting functions, and constant maps are all reused as-is.

## Common Pitfalls

### Pitfall 1: Missing Special Behaviors per Node Type
**What goes wrong:** Builder produces generic VMs that miss node-specific behavior: plugin checkbox state, plugin/lock resourceUri for FileDecorationProvider, click-to-reveal commands on leaf nodes, scope lock dimming.
**Why it happens:** Each node type has 1-3 special behaviors beyond the standard label/icon/description pattern.
**How to avoid:** Catalog of special behaviors per node type (see Code Examples section below). Each ViewModel interface MUST have fields for its node's special behavior.
**Warning signs:** Any ViewModel interface that has the same fields as BaseVM (no extensions) is suspect.

### Pitfall 2: contextValue String Mismatch
**What goes wrong:** package.json `when` clauses use regex patterns against contextValue. If builder produces different strings than current nodes, context menus break silently.
**Why it happens:** contextValue is computed differently per node type (see scopeNode overrides computeContextValue).
**How to avoid:** Extract current contextValue patterns from ALL node types. ScopeNode has a custom override: `scope.{scopeName}.{editable|readOnly}[.missing]`. Other nodes use base pattern: `{nodeType}.{editable|readOnly}[.overridden]`.
**Warning signs:** Any contextValue that doesn't match the pattern in baseNode.computeContextValue() or scopeNode's override.

### Pitfall 3: Override Description Appending
**What goes wrong:** baseNode.applyOverrideStyle() appends "(overridden by X)" to description. If builder pre-computes this but nodes also apply it, descriptions get doubled.
**Why it happens:** Phase 16 is additive -- nodes still apply their own logic until Phase 17.
**How to avoid:** Builder should include the override suffix in the description field. Document clearly that Phase 17 nodes will NOT call applyOverrideStyle() -- they copy description verbatim.

### Pitfall 4: Forgetting the Managed Scope Filter
**What goes wrong:** Builder includes Managed scope nodes in output.
**Why it happens:** ConfigStore.getAllScopes() returns all 4 scopes including Managed.
**How to avoid:** Builder must filter out Managed scope (or include it conditionally). Current code in getSingleRootChildren() and getMultiRootChildren() both filter: `.filter((s) => s.scope !== ConfigScope.Managed)`.

### Pitfall 5: Plugin Display Name Parsing
**What goes wrong:** Plugin label shows full ID instead of parsed name.
**Why it happens:** PluginNode has special logic to split scoped npm IDs at the second `@` for `@scope/name@version` format.
**How to avoid:** Builder must replicate this parsing logic for plugin label/description split.

## Code Examples

### Complete Catalog: Node-Specific Behaviors

Every node's constructor was analyzed. Here is the exhaustive list of special behaviors beyond standard BaseVM fields:

```
Node Type           | Special Behaviors
--------------------|--------------------------------------------------
workspaceFolder     | icon: 'root-folder', collapsibleState: Expanded (not Collapsed)
scope               | Custom contextValue (scope.{name}.{edit}[.missing])
                    | description: relative path or short path or "Not found"
                    | resourceUri for lock dimming (User scope only)
                    | Tooltip: scope description from constants
                    | Filters out Managed scope children
                    | Scope lock: applies isReadOnly override
section             | description: item count string (e.g., "3 rules")
                    | keyPath uses 'enabledPlugins' for Plugins section (not 'plugins')
permissionGroup     | description: rule count, no override resolution
permissionRule      | Override: resolvePermissionOverride (cross-category conflict)
                    | Custom tooltip with category-specific override message
                    | Icon color: disabledForeground when overridden
setting             | Override: resolveScalarOverride
                    | Expandable if value is non-null, non-array object
                    | description: formatted value or empty for objects
                    | tooltip: JSON pretty-print for objects
                    | Icon: 'tools' with disabled color when overridden
settingKeyValue     | Override: inherits from parent setting key
                    | Icon: 'symbol-field' with disabled color when overridden
                    | description: formatted value
                    | tooltip: JSON pretty-print for objects
envVar              | Override: resolveEnvOverride
                    | description: the value string
                    | Icon: 'terminal' with disabled color when overridden
plugin              | Override: resolvePluginOverride
                    | checkboxState: Checked/Unchecked based on enabled boolean
                    | resourceUri: custom scheme for FileDecorationProvider dimming
                    | label: parsed from pluginId (split at second @ for scoped)
                    | description: version suffix
                    | Custom tooltip: plugin description + override warning
sandboxProperty     | Override: resolveSandboxOverride (supports nested keys)
                    | description: formatted sandbox value
                    | keyPath: ['sandbox', ...key.split('.')]
                    | tooltip: bullet list for arrays
                    | Icon: 'vm' with disabled color when overridden
hookEvent           | No override resolution
                    | description: hook count across all matchers
                    | Icon: 'zap'
hookEntry           | No override resolution
                    | Icon: type-based (command->terminal, prompt->comment-discussion, agent->hubot)
                    | label: [matcher] command/prompt/type
                    | tooltip: command string in code formatting
                    | keyPath: ['hooks', eventType, matcherIdx, hookIdx]
hookKeyValue        | No override resolution
                    | Icon: 'symbol-field'
                    | description: formatted value
                    | keyPath: ['hooks', eventType, matcherIdx, hookIdx, propertyKey]
```

### BaseVM id Computation
```typescript
// Source: baseNode.ts computeId()
// Builder should replicate this exactly for tree identity/reveal support
function computeId(nodeContext: NodeContext): string {
  const { scope, keyPath, workspaceFolderUri } = nodeContext;
  const prefix = workspaceFolderUri ?? '';
  return `${prefix}/${scope}/${keyPath.join('/')}`;
}
```

### contextValue Computation
```typescript
// Source: baseNode.ts computeContextValue() + scopeNode.ts override

// Standard pattern (most nodes):
function computeContextValue(nodeType: string, isReadOnly: boolean, isOverridden: boolean): string {
  const parts = [nodeType];
  parts.push(isReadOnly ? 'readOnly' : 'editable');
  if (isOverridden) parts.push('overridden');
  return parts.join('.');
}

// ScopeNode override pattern:
function computeScopeContextValue(scope: ConfigScope, isReadOnly: boolean, fileExists: boolean): string {
  const base = `scope.${scope}`;
  const editability = isReadOnly ? 'readOnly' : 'editable';
  const parts = [base, editability];
  if (!fileExists) parts.push('missing');
  return parts.join('.');
}
```

### Click Command for Leaf Nodes
```typescript
// Source: baseNode.ts applyClickCommand()
// Leaf nodes (collapsibleState === None) with filePath and keyPath get a reveal command
function computeCommand(
  collapsibleState: TreeItemCollapsibleState,
  filePath: string | undefined,
  keyPath: string[],
): vscode.Command | undefined {
  if (collapsibleState !== TreeItemCollapsibleState.None || !filePath || keyPath.length === 0) {
    return undefined;
  }
  return {
    command: 'claudeConfig.revealInFile',
    title: 'Reveal in Config File',
    arguments: [filePath, keyPath],
  };
}
```

### Override-Aware Tooltip
```typescript
// Source: baseNode.ts computeTooltip()
function computeOverrideTooltip(isOverridden: boolean, overriddenByScope?: ConfigScope): string | vscode.MarkdownString | undefined {
  if (isOverridden && overriddenByScope) {
    const scopeLabel = SCOPE_LABELS[overriddenByScope];
    return new vscode.MarkdownString(`$(warning) Overridden by **${scopeLabel}**`);
  }
  return undefined;
}
```

### Override Description Suffix
```typescript
// Source: baseNode.ts applyOverrideStyle()
function applyOverrideSuffix(description: string, isOverridden: boolean, overriddenByScope?: ConfigScope): string {
  if (isOverridden && overriddenByScope) {
    const scopeLabel = SCOPE_LABELS[overriddenByScope];
    return `${description} (overridden by ${scopeLabel})`.trim();
  }
  return description;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nodes compute own display state | Builder pre-computes, nodes copy | Phase 16 (now) | Nodes become trivial mappers; all logic centralized |
| Override resolution in node constructors | Override resolution in builder | Phase 16 (now) | Single point of override logic; testable without VS Code |
| WorkspaceFolderNode inline in provider | WorkspaceFolderVM in viewmodel types | Phase 16 (now) | Clean separation; builder handles multi-root |

## Open Questions

1. **WorkspaceFolderVM: 15th type or ScopeVM with flag?**
   - What we know: WorkspaceFolderNode is currently an inline class in configTreeProvider.ts with distinct behavior (icon: root-folder, collapsibleState: Expanded, placeholder scope)
   - What's unclear: Whether adding a 15th ViewModel type is cleaner than reusing ScopeVM
   - Recommendation: Add WorkspaceFolderVM as the 15th type. It has genuinely different semantics (no real scope, no section, no filePath). A flag on ScopeVM would be confusing. This is within Claude's discretion per CONTEXT.md.

2. **formatValue and formatSandboxValue reuse strategy**
   - What we know: These functions live in settingNode.ts and sandboxPropertyNode.ts respectively
   - What's unclear: Whether to import from node files (creates viewmodel->tree dependency) or duplicate
   - Recommendation: Move to `src/utils/formatting.ts` shared utility. But since Phase 16 is additive with no modifications to existing files, the builder should define its own copies initially. Phase 17 can consolidate.

3. **PluginMetadataService in builder**
   - What we know: PluginNode calls `PluginMetadataService.getInstance().getDescription(pluginId)` for tooltip
   - What's unclear: Whether builder should call this service or leave plugin description out of VM
   - Recommendation: Builder should call it. The service is already a singleton with caching. Pre-computing plugin descriptions in the ViewModel is consistent with the "all display state pre-computed" principle.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of all 14 node files in `src/tree/nodes/`
- Direct code analysis of `src/config/overrideResolver.ts` (5 resolver functions)
- Direct code analysis of `src/config/configModel.ts` (ConfigStore API)
- Direct code analysis of `src/tree/configTreeProvider.ts` (multi-root logic, WorkspaceFolderNode)
- Direct code analysis of `src/types.ts` (NodeContext, ScopedConfig, all enums)
- Direct code analysis of `src/constants.ts` (labels, icons, known keys)

### Secondary (MEDIUM confidence)
- CONTEXT.md locked decisions (user-provided constraints)
- REQUIREMENTS.md (VM-01 through VM-04 specifications)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, existing codebase fully analyzed
- Architecture: HIGH - builder mirrors existing dispatch pattern verbatim; all node behaviors catalogued
- Pitfalls: HIGH - derived from direct code analysis of every node constructor

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable internal codebase, no external dependency churn)
