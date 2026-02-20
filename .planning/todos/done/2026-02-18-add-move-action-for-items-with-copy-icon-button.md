---
created: 2026-02-18T18:43:25.384Z
title: Add move action for items with copy icon button
area: ui
files:
  - src/commands/moveCommands.ts
  - src/tree/nodes/
---

## Problem

Items in the config tree that currently have a "copy" icon button (e.g., copy-to-scope) should also offer a "move" action. Currently only copy is exposed as an inline icon — users who want to move (copy + delete from source) must do it manually in two steps.

## Solution

For each tree node type that shows a copy inline icon button, add a corresponding move inline icon button. Wire it to the existing move command infrastructure in `moveCommands.ts`. Update `package.json` menu contributions to add the move icon alongside copy where applicable. Ensure `contextValue` patterns support the new menu entries.
