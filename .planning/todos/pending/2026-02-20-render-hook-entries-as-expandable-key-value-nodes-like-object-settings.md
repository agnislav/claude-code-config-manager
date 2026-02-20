---
created: 2026-02-20T11:39:51.942Z
title: Render hook entries as expandable key-value nodes like object settings
area: ui
files:
  - src/tree/nodes/hookEntryNode.ts
  - src/tree/nodes/settingNode.ts
---

## Problem

Hook entry leaf nodes (e.g. individual hook commands under PreToolUse, PostToolUse, etc.) are rendered as flat items. They should be expandable with key/value children, matching the pattern used for object-type settings introduced in Phase 8 (SettingKeyValueNode).

## Solution

Apply the same expandable key/value child pattern from SettingNode/SettingKeyValueNode to HookEntryNode. Each hook entry object property (command, timeout, etc.) would render as a child node.
