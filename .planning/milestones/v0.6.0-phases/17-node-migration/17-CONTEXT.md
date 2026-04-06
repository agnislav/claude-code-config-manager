# Phase 17: Node Migration - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate all 14 tree node constructors from raw config data (ScopedConfig/allScopes) to ViewModel descriptors. Wire TreeViewModelBuilder into ConfigTreeProvider's refresh cycle. Remove direct ConfigStore/overrideResolver dependencies from node files. No user-visible changes — pure internal refactor.

Requirements: VM-05, VM-06, VM-07, VM-08, VM-09, VM-10.

</domain>

<decisions>
## Implementation Decisions

### Migration strategy
- Single plan, all 14 nodes migrated at once — no waves or temporary compatibility shims
- Top-down conceptual order: provider wiring first, then node constructors
- Generic VM-to-node mapper function: one `vmToNode()` switch on `vm.kind` replaces all entity-specific dispatch in nodes
- `vmToNode()` mapper lives in configTreeProvider.ts alongside getChildren()

### Node constructor shape
- Each node constructor accepts a single ViewModel parameter: `new ScopeNode(vm: ScopeVM)`
- VM stored as `private readonly vm` on the node instance for getChildren() and command access
- ConfigTreeNode base class kept but simplified: stores vm, nodeContext, nodeType; constructor copies VM fields to TreeItem properties
- `finalize()` removed entirely — builder pre-computes contextValue, id, tooltip in the VM

### Provider wiring
- `builder.build()` called in refresh(), result cached as root VMs
- getChildren(undefined) maps cached root VMs via vmToNode() — no separate getSingleRootChildren()/getMultiRootChildren() methods
- parentMap pre-built from ViewModel tree during refresh() (walk VM tree after build) so reveal() works immediately
- childrenCache remains for caching created TreeItem node instances

### WorkspaceFolderNode
- Move from inline in configTreeProvider.ts to its own file: src/tree/nodes/workspaceFolderNode.ts
- Accepts WorkspaceFolderVM like all other nodes

### Claude's Discretion
- Exact vmToNode() implementation and NodeKind switch structure
- How to handle the transition of SectionNode.getChildren() (currently has 7 entity-dispatch methods)
- Whether to remove entity-specific getChildren() methods from nodes or leave as empty stubs
- Error handling strategy for malformed VMs

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TreeViewModelBuilder` (src/viewmodel/builder.ts): Already built in Phase 16 with all entity-specific build methods — this is the source of truth for VM construction
- `BaseVM` + 14 ViewModel interfaces (src/viewmodel/types.ts): All type contracts defined with NodeKind discriminator
- `ConfigTreeNode` base class (src/tree/nodes/baseNode.ts): Has finalize(), computeContextValue(), computeId(), computeTooltip() — all to be removed/simplified
- `NodeContext` interface (src/types.ts): Already embedded in VMs, commands rely on it heavily

### Established Patterns
- Every node file in src/tree/nodes/ exports a single class extending ConfigTreeNode
- SectionNode.getChildren() dispatches to 7 entity-specific methods (getSettingChildren, getPermissionChildren, etc.) — all replaced by generic VM mapper
- ScopeNode constructor (~40 lines) builds NodeContext, computes icons/descriptions — representative of what all nodes do and what gets replaced
- ConfigTreeProvider.getChildren() caches results and populates parentMap — caching stays, parentMap moves to refresh()

### Integration Points
- ConfigTreeProvider.refresh() — add builder.build() call and VM caching
- ConfigTreeProvider.getChildren() — replace delegation pattern with VM mapper
- All command handlers in src/commands/ — access nodes via nodeContext property, which is preserved in VMs
- Editor-tree sync (findNodeByKeyPath, walkForNode) — relies on parentMap and node IDs, both preserved

</code_context>

<specifics>
## Specific Ideas

- Nodes should become "trivial mappers" — constructor just copies VM fields to TreeItem properties, no business logic
- The vmToNode() function is the single bridge between ViewModel and TreeItem worlds — all node creation flows through it
- Pre-building parentMap from the VM tree is a deliberate improvement: reveal() no longer requires lazy getChildren() expansion

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-node-migration*
*Context gathered: 2026-03-07*
