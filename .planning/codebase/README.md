# Codebase Documentation

Comprehensive architecture and structure documentation for Claude Code Config Manager.

## Documents

### 1. ARCHITECTURE.md
**Scope**: High-level design patterns, data flow, and system interactions.

**Key sections**:
- **Architectural Layers** — 7-layer model from discovery → presentation → persistence
- **Data Flow Diagrams** — Read path, write path, editor-tree sync, validation
- **Key Abstractions** — NodeContext, ResolvedValue, Scope Precedence, ScopedConfig, contextValue pattern
- **Entry Point** — Extension activation flow and component orchestration
- **Design Decisions** — Why ConfigStore, why separate override resolver, why tree nodes in separate files
- **Dependency Graph** — Visual map of module dependencies

**Best for**: Understanding how the system works end-to-end, making architectural decisions, tracing data flow.

---

### 2. STRUCTURE.md
**Scope**: Directory layout, file organization, naming conventions, and module responsibilities.

**Key sections**:
- **Directory Layout** — Tree of all source files with descriptions
- **File Organization Patterns** — Table of each module with exports and responsibilities
- **Naming Conventions** — PascalCase/camelCase rules, file naming, import organization
- **Build & Packaging** — npm scripts, esbuild config, VS Code manifest structure
- **File Dependencies** — Import chains and circular dependency notes
- **Constants & Types Organization** — Where UI strings, icons, and type definitions live

**Best for**: Finding files quickly, understanding what each file does, adding new files in the right place.

---

## Quick Navigation

### Want to understand...

| Question | Document | Section |
|----------|----------|---------|
| How data flows through the system? | ARCHITECTURE | Data Flow Diagrams |
| Why is the code organized this way? | ARCHITECTURE | Architectural Layers + Design Decisions |
| Where is the ConfigStore and what does it do? | ARCHITECTURE + STRUCTURE | Layer 3: In-Memory Model |
| How is the tree view built? | ARCHITECTURE + STRUCTURE | Layer 5: Tree View Presentation |
| How are commands connected to the tree? | ARCHITECTURE + STRUCTURE | Layer 7: Commands + File Organization |
| How do overrides work? | ARCHITECTURE | Layer 4: Override Resolution |
| What files are in the project? | STRUCTURE | Directory Layout |
| How are tree nodes organized? | STRUCTURE | Tree Layer (src/tree/) |
| What are the naming conventions? | STRUCTURE | Naming Conventions |
| Where do I add a new command? | STRUCTURE | Command Layer (src/commands/) |
| How is the file watcher set up? | ARCHITECTURE | Layer 6: Persistence + Data Flow |
| Where are UI strings defined? | STRUCTURE | Constants Organization |

---

## Project at a Glance

**Purpose**: VS Code extension providing visual viewer and editor for Claude Code configuration files.

**Key Features**:
- Scope-aware TreeView (4 levels: Managed, User, Project Shared, Project Local)
- Override detection and visualization
- Inline editing with dialogs
- File watching for auto-refresh
- Editor ↔ Tree synchronization
- Multi-root workspace support
- JSON schema validation with diagnostics

**Tech Stack**:
- **Framework**: VS Code Extension API
- **Language**: TypeScript (strict mode)
- **Bundler**: esbuild
- **Linter**: ESLint (@typescript-eslint)
- **Formatter**: Prettier

**Entry Point**: `src/extension.ts`

**Build**: `npm run compile` (type-check + bundle), `npm run watch` (watch mode)

---

## Key Concepts

### Config Scopes (Precedence Order)
1. **Managed** (highest) — `/Library/Application Support/ClaudeCode/` (macOS) or `/etc/claude-code/` (Linux)
2. **Project Local** — `.claude/settings.local.json` (workspace root, gitignored)
3. **Project Shared** — `.claude/settings.json` (workspace root, committed)
4. **User** (lowest) — `~/.claude/settings.json` (home directory)

Higher-precedence scopes override lower ones.

### Core Classes
- **ConfigStore** — In-memory model of all loaded configs; fires change events
- **ConfigTreeProvider** — Implements TreeDataProvider; builds tree from model
- **ConfigTreeNode** — Abstract base for all tree items
- **overrideResolver** — Computes effective values considering precedence

### Tree Node Hierarchy
```
ScopeNode
  └── SectionNode
      ├── PermissionGroupNode → PermissionRuleNode
      ├── HookEventNode → HookEntryNode
      ├── EnvVarNode
      ├── McpServerNode
      ├── PluginNode
      ├── SandboxPropertyNode
      └── SettingNode
```

### Data Flow
```
Disk → Discovery → Loading → Model (ConfigStore) → Override Resolver → Tree Provider → UI
                    ↑                                                      ↑
                    └──── Write Path ──── Commands ←── User Interaction ──┘
```

---

## Common Tasks

### Add a new config property to the tree
1. **Define type** in `src/types.ts` (e.g., extend `ClaudeCodeConfig`)
2. **Add to SectionNode** logic in `src/tree/nodes/sectionNode.ts`
3. **Create node class** `src/tree/nodes/{name}Node.ts` (extends `ConfigTreeNode`)
4. **Add constant labels/icons** in `src/constants.ts`
5. **Create writer function** in `src/config/configWriter.ts`
6. **Register command** in `src/commands/addCommands.ts` or similar

### Add a new command
1. **Create handler** in appropriate `src/commands/{type}Commands.ts`
2. **Register in extension.ts** with `context.subscriptions.push()`
3. **Add to package.json** `contributes.commands`
4. **Add menu item** in `package.json` `contributes.menus` with `when` clause
5. **Add keybinding** (optional) in `package.json` `contributes.keybindings`

### Add a new tree node type
1. **Create file** `src/tree/nodes/{name}Node.ts`
2. **Extend ConfigTreeNode** with `abstract nodeType: string`
3. **Implement getChildren()** method
4. **Call finalize()** at end of constructor
5. **Instantiate in parent node** (usually SectionNode or specific group node)

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Type-check and bundle
npm run compile

# Watch mode (rebuilds on file change)
npm run watch

# Open in Extension Development Host
# Press F5 in VS Code with this folder open
```

### Debugging
- F5 to launch Extension Development Host
- Set breakpoints in TypeScript source
- Reload window with `Ctrl+R` (Cmd+R on Mac) to reload extension

### Testing
```bash
npm run test  # Compile + run Mocha tests
```

### Linting
```bash
npm run lint   # ESLint
npm run build  # Production minified bundle
npm run package  # Create .vsix package
```

---

## File Organization Philosophy

**Principle**: One file per concept, clear module boundaries, minimal coupling.

- **Config layer** (`src/config/`) — Isolated from UI; testable
- **Tree layer** (`src/tree/`) — One file per node type; easy to locate and modify
- **Commands** (`src/commands/`) — Grouped by operation type; cohesive
- **Utils** (`src/utils/`) — Reusable helpers with single responsibility
- **Types** (`src/types.ts`) — Centralized; single source of truth
- **Constants** (`src/constants.ts`) — All UI strings and icons

This structure scales well and makes onboarding straightforward.

---

## Key Design Patterns

### 1. EventEmitter for Change Notification
ConfigStore emits change events when reloaded. Tree provider listens and refreshes.

### 2. NodeContext for Node Identity
Every tree node carries context (scope, section, keyPath, isReadOnly, isOverridden). Commands use this to locate and modify files.

### 3. Pure Functions for Mutation
All config writes in `configWriter.ts` are pure functions — no side effects, easy to test.

### 4. Lazy Tree Building
Tree children computed on-demand via `getChildren()`. No pre-computed full tree.

### 5. Caching in TreeProvider
Parent/children relationships cached to support efficient tree walking and reveal operations.

### 6. Override Resolver Pattern
Override resolution separate from tree building. Computed fresh on each tree build to ensure consistency.

### 7. contextValue for Menu Visibility
Tree items have `contextValue` strings. VS Code's `when` clauses match regex patterns to show/hide menus.

---

## Conventions

### Code Style
- **TypeScript**: Strict mode, no implicit any
- **Naming**: PascalCase for types/classes, camelCase for functions/variables, UPPER_SNAKE for constants
- **Imports**: External first, then relative, then utils
- **Unused params**: Prefix with `_` (e.g., `_unused`)
- **Line length**: 100 chars (Prettier)

### File Naming
- Node files: `{name}Node.ts` (e.g., `scopeNode.ts`)
- Command files: `{type}Commands.ts` (e.g., `addCommands.ts`)
- Utility files: `{function}.ts` (e.g., `json.ts`, `platform.ts`)

### Tree Node Conventions
- Each node type in separate file
- All nodes finalize at end of constructor
- contextValue computed automatically
- getChildren() should never throw
- Leaf nodes (no children) use `collapsibleState.None`

---

## Performance Considerations

### ConfigStore
- Loads all scopes on activation and reload
- No lazy loading of scopes (all loaded upfront)
- Multi-root: one load per workspace folder

### ConfigTreeProvider
- Caches parent/children relationships
- Cache cleared on tree refresh
- getChildren() called on-demand as tree expands
- No pre-computed full tree

### Override Resolution
- Resolved on-demand during tree building
- Not cached; recomputed each tree build
- Stateless functions; no side effects

### File Watching
- Uses VS Code's FileSystemWatcher API
- Debounces rapid changes
- Reloads only affected workspace folder (if possible)

---

## Testing Strategy

Tests are written in Mocha and run with `npm run test`.

**Areas with tests**:
- ConfigStore reload and queries
- Override resolver logic
- ConfigWriter mutations (mocked file I/O)
- Validation logic
- Utility functions (JSON parsing, permission overlap)

**Areas without unit tests** (mostly UI):
- Tree view rendering (requires VS Code API mocking)
- Commands (require interactive input)
- File watcher (requires OS integration)

---

## Future Extensibility

### Adding new config scopes
1. Extend `ConfigScope` enum in `types.ts`
2. Update `SCOPE_PRECEDENCE` array
3. Update `configDiscovery.ts` to find paths
4. Update scope labels/icons in `constants.ts`
5. Update `ConfigStore.buildScopedConfigs()` to load it

### Adding new config sections
1. Extend `SectionType` enum in `types.ts`
2. Update `ClaudeCodeConfig` interface to include section
3. Create node class in `src/tree/nodes/`
4. Add logic to `SectionNode.getChildren()`
5. Create writer functions in `configWriter.ts`
6. Create add/edit/delete commands

### Adding new tree node types
1. Create `src/tree/nodes/{name}Node.ts`
2. Extend `ConfigTreeNode`
3. Implement `getChildren()` and `nodeType`
4. Register parent-child relationship in appropriate parent node

---

## Troubleshooting

### Changes to config file not reflecting in UI
- File watcher might not have triggered
- Run `claudeConfig.refresh` command to force reload
- Check output channel for watcher logs

### Tree items not appearing
- Check `SectionNode.getChildren()` for the section
- Verify config file is properly loaded
- Check validation diagnostics for parse errors
- Ensure `finalize()` was called in node constructor

### Override detection not working
- Check `overrideResolver.ts` function for the item type
- Verify scope precedence is correct
- Check that `NodeContext.isOverridden` is being set
- Verify `computeContextValue()` includes override flag

### Menu items not showing
- Check `when` clause in `package.json` matches `contextValue`
- Verify command is registered in `extension.ts`
- Check `computeContextValue()` generates expected string
- Ensure node is not in read-only scope (unless command allows it)

---

## Resources

- VS Code Extension API: https://code.visualstudio.com/api
- TypeScript Handbook: https://www.typescriptlang.org/docs/
- esbuild: https://esbuild.github.io/
- ESLint Rules: https://eslint.org/docs/rules/
- Prettier Options: https://prettier.io/docs/en/options.html

---

## Summary

This codebase exemplifies **clean architecture** with clear layer separation, **single responsibility principle** throughout, and **practical patterns** that scale. The documentation in ARCHITECTURE.md and STRUCTURE.md provides both strategic and tactical guidance for understanding, navigating, and extending the system.
