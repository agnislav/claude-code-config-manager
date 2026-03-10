---
created: 2026-03-10T10:22:04.368Z
title: Remove plugin icon in the user scope unlocked mode
area: ui
files:
  - src/tree/nodes/pluginNode.ts
---

## Problem

When the User scope is in unlocked (editable) mode, plugin nodes display an icon that should not be shown. The plugin icon should only appear in locked/read-only mode or be removed entirely in unlocked mode to maintain visual consistency and avoid confusion about editability state.

## Solution

Update the plugin node rendering logic to conditionally hide the icon when the User scope is in unlocked/editable mode. Check the `contextValue` pattern or scope lock state to determine icon visibility.
