---
name: claude-md-scope-viewer
description: Show CLAUDE.md and CLAUDE.local.md files across all scopes in the config tree — managed, user, project, local, and directory-scoped — with loading behavior indicators
status: backlog
created: 2026-05-03T02:00:00Z
---

# PRD: claude-md-scope-viewer

## Source Ideas

- Verified reference `vault/projects/_references/cc_config_reference.md` — Instruction files section.
- Known Bug #5: CLAUDE.md merge intuition fails for many users ([anthropics/claude-code#11626](https://github.com/anthropics/claude-code/issues/11626)).

## Executive Summary

The extension manages settings.json files but completely ignores CLAUDE.md / CLAUDE.local.md files — the other half of Claude Code's configuration. Users struggle with:

- **Which CLAUDE.md files exist** across scopes (managed, user, project, local, ancestors, subdirectories).
- **How they interact** — all concatenate into context, no override, but loading order creates soft recency bias.
- **Loading behavior** — ancestors loaded eagerly, subdirectories loaded lazily, project-root survives compaction.
- **Confusion with settings.json** — CLAUDE.md is instructions (soft, Claude tries to follow), settings.json is enforcement (hard, client-side). Users conflate them.

Adding CLAUDE.md awareness to the tree completes the config picture.

## User Stories

### Story 1: See all instruction files at a glance

**As** a developer joining a project
**I want** to expand an "Instructions" section in the config tree and see every CLAUDE.md file that Claude Code will load
**So that** I know what instructions are active without hunting through the filesystem.

**Acceptance**: Tree shows all discovered CLAUDE.md / CLAUDE.local.md files grouped by scope, with file paths and existence status.

### Story 2: Understand loading behavior

**As** a user who added a CLAUDE.md in a subdirectory
**I want** to see that it loads lazily (on demand) vs the project-root one that loads eagerly
**So that** I understand why Claude doesn't seem to follow my subdirectory instructions until I work in that directory.

**Acceptance**: Each CLAUDE.md node shows a loading indicator: "eager" (loaded at launch) or "lazy" (loaded on file access). Project-root shows "survives compaction."

### Story 3: Open and edit instruction files

**As** a user who wants to edit project instructions
**I want** to click a CLAUDE.md node in the tree and have it open in the editor
**So that** I don't need to remember file paths.

## Functional Requirements

### FR1: Instruction file discovery

Discover CLAUDE.md / CLAUDE.local.md files at:
- Managed scope: OS-level paths (macOS/Linux/Windows)
- User scope: `~/.claude/CLAUDE.md`
- Project Shared: `./CLAUDE.md` or `./.claude/CLAUDE.md`
- Project Local: `./CLAUDE.local.md`
- Ancestor directories: walk up from workspace root
- Subdirectories: scan workspace (lazy — don't block tree building)

Also discover `.claude/rules/` directory files.

### FR2: Instructions section in tree

Add an "Instructions" section to each scope in scope-first view. In entity-first view (entity-type-view PRD), "Instructions" becomes a top-level entity type.

Each node shows: filename, path, loading behavior (eager/lazy), compaction survival.

### FR3: Read-only display with open-file action

Instruction files are markdown — don't try to parse structure like JSON configs. Show them as nodes with an "Open File" action. No inline editing, no validation.

### FR4: Managed CLAUDE.md indicator

When a managed CLAUDE.md exists, show a locked indicator and note that it cannot be excluded by `claudeMdExcludes`.

## Out of Scope

- Editing CLAUDE.md content from within the tree (too complex, markdown is freeform).
- Showing resolved/concatenated instruction content (that's the "Effective Config" panel idea).
- Import resolution (`@path` syntax) — future enhancement.
- `.claude/rules/` directory detailed parsing — show files exist, don't parse frontmatter.

## Dependencies

- entity-type-view PRD (for entity-first grouping of Instructions).
- config-model-alignment (for managed scope paths).
