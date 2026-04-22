# Technology Stack

**Project:** Claude Code Config Manager v0.9.0 UX Audit
**Researched:** 2026-03-11
**Focus:** VS Code TreeView API capabilities for UX consistency improvements

## Context

This is a SUBSEQUENT milestone. The core stack (TypeScript, VS Code Extension API, esbuild) is validated and shipping across 8 milestones. This research focuses exclusively on VS Code TreeView API features relevant to the UX audit -- what the extension already uses, what it could use, and what to avoid.

## Verdict: No New Dependencies Required

The UX audit is about consistency across existing patterns, not adding new API surfaces. One low-effort API addition (`accessibilityInformation`) is worth considering. Everything else uses APIs already in the codebase.

---

## Current API Usage (Already Shipping)

| API Feature | Where Used | Status |
|-------------|-----------|--------|
| `TreeDataProvider` (getChildren, getTreeItem, onDidChangeTreeData) | configTreeProvider.ts | Core, working |
| `TreeItem.label` (string) | All nodes via baseNode.ts | Working |
| `TreeItem.description` (string) | All nodes via viewmodel builder | Working |
| `TreeItem.tooltip` (MarkdownString) | Overlap tooltips | Working since v0.7.0 |
| `TreeItem.iconPath` / `ThemeIcon` | All nodes | Working |
| `TreeItem.contextValue` | All nodes, regex matching in when clauses | Working |
| `TreeItem.collapsibleState` | Scope, section, expandable nodes | Working |
| `TreeItem.command` | Click-to-reveal | Working |
| `TreeItem.resourceUri` | FileDecoration for overlap coloring | Working |
| `TreeItem.checkboxState` | Plugin toggle | Working since v0.8.0 |
| `FileDecorationProvider` | Overlap color badges | Working since v0.7.0 |
| `window.createTreeView()` | Extension activation | Working (basic options only) |

---

## Available API Features NOT Currently Used

These are stable APIs available since well before VS Code 1.90.0 (the minimum engine version).

### Recommended for UX Audit

| Feature | API | Min Version | Recommendation | Confidence |
|---------|-----|-------------|---------------|------------|
| **accessibilityInformation** | `TreeItem.accessibilityInformation = { label, role }` | 1.57+ | ADD -- low effort, high impact for accessibility | HIGH |

### Available But NOT Recommended for This Milestone

| Feature | API | Min Version | Why Not | Confidence |
|---------|-----|-------------|---------|------------|
| **TreeItemLabel highlights** | `label: { label: string, highlights: [number, number][] }` | 1.24+ | Best for search-result UIs. Description field already separates info effectively for config viewing. | HIGH |
| **TreeView.badge** | `treeView.badge = { value: number, tooltip: string }` | 1.74+ | View-level numeric badge on sidebar icon. New feature surface, not a consistency fix. Defer. | HIGH |
| **description = true** | `TreeItem.description = true` | ~1.46+ | Renders resourceUri path as description. Not useful -- string descriptions are better for this use case. | HIGH |
| **Drag and Drop** | `TreeDragAndDropController` in TreeViewOptions | 1.66+ | Config JSON has no meaningful ordering to reorder. Adds complexity for marginal value. | HIGH |
| **canSelectMany** | `TreeViewOptions.canSelectMany = true` | 1.56+ | Explicitly deferred in PROJECT.md ("Multiselect for batch copy and move -- deferred to future milestone"). | HIGH |
| **manageCheckboxStateManually** | `TreeViewOptions.manageCheckboxStateManually = true` | 1.82+ | Only relevant if checkbox hierarchy is added. Plugins are flat. | HIGH |
| **showCollapseAll** | `TreeViewOptions.showCollapseAll = true` | 1.30+ | Already implemented via custom command. Switching to built-in would lose the paired expand-all button placement. | HIGH |

---

## Feature Detail: accessibilityInformation

**What:** Provides screen reader text for tree items. The `label` property is read aloud; `role` is optional and rarely needed for standard tree items.

**Why for UX audit:** Every tree item should have meaningful accessibility text. Currently, screen readers fall back to the TreeItem label string, which may not convey full context. For example, a permission rule showing `Bash(rm *)` does not tell a screen reader user it is an "allow" rule vs "deny" rule.

```typescript
// Example: Permission rule node
this.accessibilityInformation = {
  label: `Allow rule: Bash tool with pattern rm *`
};

// Example: Env var node
this.accessibilityInformation = {
  label: `Environment variable ANTHROPIC_API_KEY with value [hidden] in User scope`
};

// Example: MCP server node
this.accessibilityInformation = {
  label: `MCP server github-mcp, stdio transport, command npx`
};
```

**Implementation path:**
1. Add `accessibilityLabel?: string` to viewmodel `TreeNodeVM` type
2. Compute it in `builder.ts` alongside label/description for each entity type
3. Apply in `baseNode.ts` constructor: `this.accessibilityInformation = { label: vm.accessibilityLabel }`

**Effort:** Low. Follows existing viewmodel pattern. No new VS Code APIs needed (property exists since 1.57).

---

## API Capabilities for the Audit (No New APIs Needed)

The UX audit is about **consistency** across 7 entity types plus scope/section nodes. The audit vectors map to APIs already in use:

| Audit Vector | Relevant API | What to Check |
|--------------|-------------|---------------|
| Icon consistency | `ThemeIcon` | Same icon semantics across all 7 entity types |
| Description consistency | `TreeItem.description` | Consistent format (type, count, value preview) |
| Tooltip consistency | `MarkdownString` tooltip | All entity types have comparable tooltip depth |
| Context menu consistency | `contextValue` + `when` clauses | Same actions available for similar entity types |
| Inline button consistency | `view/item/context` inline group | Same button order, same action set for comparable entities |
| Inline button count | `view/item/context` inline group | Max 3 inline actions per VS Code UX guidelines |
| Collapsible state consistency | `collapsibleState` | Expandable entities behave consistently |
| Click behavior consistency | `TreeItem.command` | Click-to-reveal works for all clickable items |
| Overlap visual consistency | `FileDecorationProvider` + `resourceUri` | Overlap colors applied consistently across entity types |
| Checkbox consistency | `checkboxState` | Only plugins use checkboxes (correct) |
| Empty state | Section nodes with 0 items | Consistent behavior when a section has no entries |

---

## VS Code UX Guidelines (Relevant to Audit)

From the official VS Code Extension UX Guidelines:

| Guideline | Source | Implication for Audit |
|-----------|--------|----------------------|
| Max 3 inline actions per item | [Views UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/views) | Check no entity type exceeds 3 inline buttons |
| Use product icons (ThemeIcon) | UX Guidelines | Verify all icons use codicon set, no custom SVGs on tree items |
| Avoid deep nesting | UX Guidelines | Verify tree depth stays reasonable (scope -> section -> entity -> children max) |
| Do not use tree items as buttons | UX Guidelines | Verify TreeItem.command is for navigation, not action triggers |
| Welcome content for empty views | UX Guidelines | Consider viewsWelcome for when no config files exist |
| Descriptive labels with context | UX Guidelines | Labels should be meaningful without requiring the tooltip |

---

## Important API Clarifications

### TreeView.badge is NOT TreeItem.badge

`TreeView.badge` is a **view-level** numeric badge that appears on the sidebar icon (activity bar). It does NOT appear on individual tree items. There is no per-item badge API on TreeItem. The extension already uses `FileDecorationProvider` for per-item visual indicators, which is the correct approach.

### TreeItem.checkboxState has NO disabled state

VS Code checkbox API supports `Checked`, `Unchecked`, and (on some versions) `Indeterminate`. There is no "disabled" or "greyed out" checkbox. The extension correctly handles this by setting `checkboxState: undefined` when the scope is locked, removing the checkbox entirely.

### contextValue regex matching

The extension uses sophisticated regex patterns in `when` clauses (e.g., `viewItem =~ /^permissionRule\.editable/`). This is the standard VS Code approach. The audit should verify all entity types follow the same `{nodeType}.{editable|readOnly}[.overridden]` pattern documented in CLAUDE.md.

---

## Recommended Stack (No Changes)

### Core Framework (Unchanged)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| TypeScript | ^5.3.3 | Language | No change |
| VS Code Extension API | ^1.90.0 | Extension host | No change |
| esbuild | ^0.25.0 | Bundler | No change |

### Supporting Libraries (Unchanged)

| Library | Version | Purpose |
|---------|---------|---------|
| Mocha | ^10.2.0 | Test runner |
| @vscode/test-electron | ^2.3.8 | Extension test host |
| ESLint | ^8.56.0 | Linting |

### Installation

```bash
# No new dependencies to install
# No changes to package.json dependencies
```

---

## What NOT to Add

| Feature | Why Not |
|---------|---------|
| **WebviewView** | Massively increases complexity. TreeView is the right abstraction for config display. |
| **Custom editors** | The extension views/edits JSON. Built-in JSON editor + tree sidebar is the right UX. |
| **canSelectMany** | Explicitly deferred in PROJECT.md to a future milestone. |
| **Drag and drop** | Config JSON ordering is not a user need. Adds complexity without UX value. |
| **TreeItemLabel highlights** | Better for search UIs, not config viewers. Description field handles info separation. |
| **TreeView.badge** | View-level badge is a new feature surface, not a consistency fix. Defer. |
| **showCollapseAll built-in** | Would lose the paired expand-all button placement in toolbar. Current custom impl is fine. |
| **New FileDecoration schemes** | Already have 3+ URI schemes. Adding more adds plumbing complexity for diminishing returns. |
| **Third-party test frameworks** | Mocha + @vscode/test-electron is the standard VS Code extension testing approach. Working. |

---

## Version Constraints

All APIs used or recommended are available in VS Code 1.90.0+ (engine minimum):

| API | Available Since | Status |
|-----|----------------|--------|
| `TreeItem.description` | 1.25+ | Stable |
| `TreeItem.tooltip` (MarkdownString) | 1.46+ | Stable |
| `TreeItem.checkboxState` | 1.78+ | Stable |
| `TreeItem.accessibilityInformation` | 1.57+ | Stable |
| `TreeItemLabel` (with highlights) | 1.24+ | Stable |
| `TreeView.badge` | 1.74+ | Stable |
| `FileDecorationProvider` | 1.56+ | Stable |
| `TreeDragAndDropController` | 1.66+ | Stable |
| `TreeViewOptions.canSelectMany` | 1.56+ | Stable |
| `TreeViewOptions.manageCheckboxStateManually` | 1.82+ | Stable |

All well within the 1.90.0 minimum.

---

## Summary

v0.9.0 UX Audit requires zero new dependencies and zero new VS Code API surfaces. The audit is about finding and fixing inconsistencies in how 7 entity types use the existing TreeView API, not about adding new capabilities.

The one optional addition is `accessibilityInformation` on TreeItem -- a low-effort property that improves screen reader experience and fits naturally into the existing viewmodel pattern. It should be evaluated during the audit but is not required for the consistency goal.

The audit's primary tools are the existing APIs: `description` formatting consistency, `tooltip` depth consistency, `contextValue` pattern consistency, inline button set/order consistency, and icon semantic consistency across all entity types.

---

## Sources

- [VS Code Tree View API Guide](https://code.visualstudio.com/api/extension-guides/tree-view) -- HIGH confidence
- [VS Code API Reference](https://code.visualstudio.com/api/references/vscode-api) -- HIGH confidence
- [VS Code UX Guidelines: Views](https://code.visualstudio.com/api/ux-guidelines/views) -- HIGH confidence
- [VS Code Extension API Guidelines (GitHub wiki)](https://github.com/microsoft/vscode/wiki/Extension-API-guidelines) -- HIGH confidence
- [TreeItem properties (Haxe externs)](https://vshaxe.github.io/vscode-extern/vscode/TreeItem.html) -- MEDIUM confidence (third-party mirror, verified against official)
- [TreeView badge PR #144775](https://github.com/microsoft/vscode/pull/144775) -- HIGH confidence (primary source, confirms view-level only)
- [TreeItem checkbox API tracking #186164](https://github.com/microsoft/vscode/issues/186164) -- HIGH confidence
- [TreeItemLabel highlights #61313](https://github.com/microsoft/vscode/issues/61313) -- HIGH confidence
- Codebase analysis: `builder.ts`, `baseNode.ts`, `extension.ts`, `package.json` (contributes.menus) -- HIGH confidence
