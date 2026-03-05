---
created: 2026-03-05T13:19:02.582Z
title: Add visuals to address config entity overlapping across scopes
area: ui
files:
  - src/tree/configTreeProvider.ts
  - src/config/overrideResolver.ts
  - src/tree/nodes/
---

## Problem

When the same config entity (permission rule, env var, hook, MCP server, setting, etc.) exists in multiple scopes, the tree view doesn't clearly communicate how they interact. This includes:

- **Override indicators** — which scope's value is winning for a given key, and which are being overridden
- **Duplicate entries** — same rule/entry appearing in multiple scopes without visual differentiation
- **Value conflicts** — two scopes defining the same key with different values (e.g. allow vs deny)
- Potentially other overlap scenarios to be identified during phase discussion

Users can't easily see at a glance how their multi-scope config resolves.

## Solution

TBD — scope and approach to be discussed during phase planning. Likely involves a combination of:
- Tree item decorations (icons, badges, strikethrough for overridden items)
- Description text showing effective vs overridden status
- Possibly a "resolved view" mode alongside the per-scope view
