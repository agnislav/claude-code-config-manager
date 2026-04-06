# Phase 16: ViewModel Layer - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Define ViewModel interfaces for all 14 tree node types and build TreeViewModelBuilder that transforms ConfigStore data into display-ready descriptors. Purely additive — no existing files modified. Requirements: VM-01, VM-02, VM-03, VM-04.

</domain>

<decisions>
## Implementation Decisions

### ViewModel type structure
- Shared base interface (BaseVM) with per-type extensions (ScopeVM extends BaseVM, SettingVM extends BaseVM, etc.)
- BaseVM includes a `kind` discriminator field (NodeKind enum/union) for runtime type narrowing in switch statements
- Children typed as `BaseVM[]` — generic array, builder enforces correct nesting at construction time
- ViewModels carry pre-computed VS Code API objects (ThemeIcon, TreeItemCollapsibleState) — nodes become trivial mappers that copy fields to TreeItem
- BaseVM shape: kind, label, description, icon (ThemeIcon), collapsibleState, contextValue, tooltip, nodeContext, children

### File organization
- New `src/viewmodel/` directory — parallel to `src/config/` and `src/tree/`, representing the transform layer between data and rendering
- Single `types.ts` file containing BaseVM, NodeKind, and all 14 ViewModel interfaces
- Single `builder.ts` file containing TreeViewModelBuilder class with all entity-specific build methods as private methods

### Builder design
- Class-based TreeViewModelBuilder with constructor taking ConfigStore reference
- Single `build()` entry point returning nested tree structure: ScopeVM[] (single-root) or WorkspaceFolderVM[] (multi-root)
- Children fully nested: ScopeVM → SectionVM → entity VMs (SettingVM, PermissionGroupVM, etc.)
- Builder accepts sectionFilter parameter to skip building filtered-out sections (avoids wasted computation)
- Builder handles multi-root workspace logic internally — provider just returns build() result for root children
- All entity-specific logic (settings, permissions, env vars, plugins, hooks, sandbox, MCP servers) as private methods in one file (~250-350 lines)

### Claude's Discretion
- Exact private method signatures and intermediate data structures within the builder
- How override resolution results map to icon/description choices in ViewModels
- Whether to add a WorkspaceFolderVM type (15th VM) or reuse ScopeVM with a flag
- Error handling within builder (malformed config data)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NodeContext` interface (src/types.ts): Already captures scope, keyPath, filePath, isOverridden, isReadOnly — embeds directly into BaseVM
- `overrideResolver` functions (src/config/overrideResolver.ts): resolveScalarOverride, resolvePermissionOverride, resolvePluginOverride, resolveEnvOverride, resolveSandboxOverride — builder calls these to pre-compute override state
- `ConfigStore` (src/config/configModel.ts): getAllScopes() provides ScopedConfig[] — builder's primary data source
- `SectionType` enum (src/types.ts): Existing enum for filter parameter typing
- `SCOPE_PRECEDENCE` constant (src/types.ts): Used by override resolution

### Established Patterns
- OOP class-based pattern: ConfigStore, ConfigTreeProvider, all tree nodes are classes — builder follows same pattern
- Node type naming: 14 existing node files in src/tree/nodes/ map 1:1 to ViewModel interfaces
- SectionNode.getChildren() already dispatches per entity type (getSettingChildren, getPermissionChildren, etc.) — builder mirrors this dispatch pattern
- ConfigTreeNode.finalize() pattern: base class method that computes contextValue, id, tooltip — similar logic moves to builder

### Integration Points
- ConfigTreeProvider.refresh() — will call builder.build() in Phase 17
- ConfigTreeProvider.getChildren() — will return ViewModel children instead of constructing nodes
- WorkspaceFolderNode (inline in configTreeProvider.ts) — builder absorbs its multi-root branching logic
- sectionFilter (ConfigTreeProvider._sectionFilter) — passed to builder.build() as parameter

</code_context>

<specifics>
## Specific Ideas

- User is new to VS Code extension development — code should be clear and well-structured for learning
- Pre-computed VS Code objects in ViewModels is an intentional coupling choice: this is a VS Code extension, not a portable library
- The `kind` discriminator on BaseVM gives "best of both worlds" — inheritance for familiarity, narrowing for safety

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-viewmodel-layer*
*Context gathered: 2026-03-06*
