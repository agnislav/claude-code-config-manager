# Codebase Documentation Index

Last updated: February 18, 2026

Three primary documents have been created to document the Claude Code Config Manager codebase:

## Primary Documents (Created as Requested)

### 1. ARCHITECTURE.md (534 lines)
High-level architectural design and data flow documentation.

**Covers**:
- 7-layer architecture model (Discovery → Loading → Model → Override Resolution → Tree View → Persistence → Commands)
- Detailed explanation of each layer with key functions and responsibilities
- Data flow diagrams for reads, writes, editor-tree sync, and validation
- Key abstractions (ConfigStore, ConfigTreeProvider, NodeContext, ResolvedValue, contextValue pattern)
- Extension entry point flow
- Design decision rationale
- Dependency graph

**Best for**: Understanding system-wide design, tracing data flow, making architectural decisions

---

### 2. STRUCTURE.md (406 lines)
Directory layout, file organization, and naming conventions.

**Covers**:
- Complete directory tree with descriptions
- File organization by layer (config/, tree/, commands/, validation/, utils/, etc.)
- Table of each module with exports and responsibilities
- Naming conventions (PascalCase, camelCase, UPPER_SNAKE)
- Tree node hierarchy and node type descriptions
- Build and packaging setup
- Import organization patterns
- Constants and types organization

**Best for**: Finding files, understanding module responsibilities, adding new code, onboarding

---

### 3. README.md (354 lines)
Quick reference and development guide.

**Covers**:
- Project overview and key features
- Quick navigation table (find answers by question)
- Key concepts summary (scopes, core classes, hierarchy, data flow)
- Common development tasks with steps
- Development workflow and debugging
- File organization philosophy
- Key design patterns
- Conventions summary
- Performance considerations
- Testing strategy
- Future extensibility guide
- Troubleshooting tips

**Best for**: Quick reference, onboarding, common tasks, troubleshooting

---

## Supporting Documents (Already Existed)

The following documents were already in the codebase:

- **CONVENTIONS.md** — Code style and naming conventions
- **CONCERNS.md** — Cross-cutting concerns and integration points
- **INTEGRATIONS.md** — VS Code API integration details
- **STACK.md** — Technology stack and dependencies
- **TESTING.md** — Testing strategy and guidelines

---

## How to Use These Documents

### For New Developers
1. Start with **README.md** for overview and concepts
2. Read **STRUCTURE.md** to understand file organization
3. Explore actual code files referenced in both documents
4. Refer back to **ARCHITECTURE.md** for deep dives

### For Specific Tasks
1. **Adding a feature**: STRUCTURE.md → layer description → file organization
2. **Understanding a bug**: ARCHITECTURE.md → data flow diagram
3. **Finding a file**: STRUCTURE.md → directory layout or search by layer
4. **Making a change**: README.md → common tasks → step-by-step guide
5. **Integration questions**: Supported documents (INTEGRATIONS.md, STACK.md)

### For Code Review
1. **Design questions**: ARCHITECTURE.md → design decisions
2. **Convention violations**: STRUCTURE.md → naming conventions or CONVENTIONS.md
3. **Integration issues**: Supported documents (INTEGRATIONS.md, CONCERNS.md)

---

## Document Cross-References

**ARCHITECTURE.md** ↔ **STRUCTURE.md**:
- Architecture layers map to src/ directories
- ConfigStore (Layer 3) described in ARCHITECTURE and located in STRUCTURE
- Tree nodes (Layer 5) explained in both documents
- Commands (Layer 7) covered in both with different angles

**ARCHITECTURE.md** ↔ **README.md**:
- Concepts introduced in ARCHITECTURE are summarized in README
- Design patterns in README link to ARCHITECTURE sections
- Data flow in ARCHITECTURE visualized simply in README

**STRUCTURE.md** ↔ **README.md**:
- File locations in STRUCTURE are cross-referenced from README
- Common tasks in README show which STRUCTURE sections to consult
- Naming conventions referenced from both directions

---

## Statistics

| Document | Lines | Word Count | Focus |
|----------|-------|-----------|-------|
| ARCHITECTURE.md | 534 | ~4,200 | Design & flow |
| STRUCTURE.md | 406 | ~3,100 | Organization & navigation |
| README.md | 354 | ~2,800 | Quick reference & workflow |
| **Total** | **1,294** | **~10,100** | Complete coverage |

---

## Topics Covered

### System Design
- Layered architecture pattern
- Data flow (read, write, sync, validation)
- Module dependencies
- Design patterns and rationale

### Code Organization
- Directory structure
- File grouping by responsibility
- Naming conventions
- Import patterns

### Key Abstractions
- ConfigStore (in-memory model)
- ConfigTreeProvider (presentation)
- ConfigTreeNode hierarchy
- NodeContext (node identity)
- ResolvedValue (override metadata)
- Scope precedence system

### Development
- Build and test workflows
- Common tasks with steps
- Debugging tips
- Extension points
- Performance considerations

### Maintenance
- Troubleshooting guide
- Future extensibility
- Testing strategy
- Code style conventions

---

## Quick Links by Purpose

### Understanding the System
→ ARCHITECTURE.md sections: Overview, Architectural Layers, Data Flow Diagrams

### Finding Code
→ STRUCTURE.md section: Directory Layout or File Organization Patterns

### Adding Features
→ README.md section: Common Tasks (specific task type)

### Onboarding
→ README.md, then STRUCTURE.md, then ARCHITECTURE.md

### Debugging Issues
→ README.md section: Troubleshooting or ARCHITECTURE.md data flow

### Code Review
→ ARCHITECTURE.md section: Design Decisions or STRUCTURE.md section: Naming Conventions

### Performance Tuning
→ README.md section: Performance Considerations or ARCHITECTURE.md Layer sections

---

## Key File Locations

Core entry point: `src/extension.ts`

Config layer: `src/config/` (configDiscovery, configLoader, configModel, configWriter, overrideResolver)

Tree layer: `src/tree/` (configTreeProvider, nodes/)

Commands: `src/commands/` (addCommands, editCommands, deleteCommands, moveCommands, openFileCommands, pluginCommands)

Types and constants: `src/types.ts`, `src/constants.ts`

---

## Maintenance Notes

These documents were generated by analyzing the codebase on February 18, 2026. They should be kept in sync with code changes:

- When adding new files/layers: Update STRUCTURE.md directory layout
- When changing architecture: Update ARCHITECTURE.md layers and data flow
- When adding new patterns: Update README.md patterns section
- When changing conventions: Update STRUCTURE.md and CONVENTIONS.md

All three documents reference the current codebase (34 TypeScript files across 8 directories).
