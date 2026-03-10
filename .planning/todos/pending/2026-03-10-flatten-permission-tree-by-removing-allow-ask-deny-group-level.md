---
created: 2026-03-10T10:25:21.066Z
title: Flatten permission tree by removing Allow/Ask/Deny group level
area: ui
files:
  - src/tree/configTreeProvider.ts
  - src/tree/nodes/permissionGroupNode.ts
  - src/tree/nodes/permissionRuleNode.ts
---

## Problem

The current permission tree has an extra nesting level: Permissions → Allow/Ask/Deny groups → individual rules. This adds unnecessary depth and makes scanning permissions slower. Users must expand two levels to see actual rules.

Current structure:
```
Permissions
  └── Allow
  │     └── rule1
  │     └── rule2
  └── Ask
  │     └── rule3
  └── Deny
        └── rule4
```

## Solution

Flatten to a single level under Permissions. Show all permission rules directly, sorted by group: all Allow first, then all Ask, then all Deny. Use the current group icons (✓ for Allow, ? for Ask, ✕ for Deny) on each individual rule instead of a common "permission" icon. This preserves visual grouping through icons while reducing tree depth.

Target structure:
```
Permissions
  ├── ✓ rule1
  ├── ✓ rule2
  ├── ? rule3
  └── ✕ rule4
```
