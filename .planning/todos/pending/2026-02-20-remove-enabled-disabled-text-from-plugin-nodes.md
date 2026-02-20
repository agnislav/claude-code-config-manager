---
created: 2026-02-20T11:39:51.942Z
title: Remove enabled/disabled text from plugin nodes
area: ui
files:
  - src/tree/nodes/pluginNode.ts
---

## Problem

Plugin tree items show "enabled" or "disabled" text in their description. The visual state (icon, checkbox, or styling) already makes the enabled/disabled status clear, making the text redundant and noisy.

## Solution

Remove the enabled/disabled description text from plugin nodes. Rely on the existing visual indicators alone.
