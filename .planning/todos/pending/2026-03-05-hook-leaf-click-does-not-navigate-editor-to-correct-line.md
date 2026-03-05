---
created: 2026-03-05T13:12:31.523Z
title: Hook leaf click does not navigate editor to correct line
area: ui
files:
  - src/commands/openFileCommands.ts
  - src/tree/nodes/hookEntryNode.ts
---

## Problem

Clicking on any leaf node under the Hooks section opens the config file in the editor, but does not move the cursor to the correct line where that hook entry is defined. The user has to manually scroll and find the relevant hook entry in the JSON file.

## Solution

Ensure the "open file" / "reveal in editor" command for hook leaf nodes passes the correct line number (or JSON path) so the editor scrolls to and highlights the relevant hook entry. May need to track the line offset of each hook entry during config parsing, or compute it at reveal time by searching the file content for the matching key/value.
