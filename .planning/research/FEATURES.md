# Feature Research

**Domain:** VS Code TreeView extension — toolbar UX improvements and scope-level write protection
**Researched:** 2026-02-18
**Confidence:** HIGH (official VS Code UX guidelines + direct API documentation + codebase inspection)

---

## Context

This research covers three specific UX features being added to an existing, fully functional VS Code extension:

1. **Filter QuickPick** — replace 8 toolbar icon buttons (All + 7 section toggles) with a single icon that opens a `QuickPick` multi-select
2. **Remove Refresh button** — delete the redundant refresh toolbar button (file watcher already handles auto-sync)
3. **User Scope Lock** — add a toggle button that prevents writes to the User scope while keeping items visible

The question being answered: what do popular VS Code extensions do for multi-select filtering, scope protection, and toolbar organization — and what should this extension do or not do based on those patterns?

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that VS Code extension users take for granted. If missing, the extension feels unpolished or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single-button filter access | VS Code UX guidelines say toolbar should minimize icon count to avoid noise; 9 icons is above industry norm | LOW | The VS Code sidebar guidelines explicitly state "be careful to not add too many actions to reduce clutter and confusion" (MEDIUM confidence, official docs) |
| Filter state preserved across invocations | Users expect the filter to remember their last selection — opening a QuickPick should show current state pre-selected | LOW | `QuickPickItem.picked` property supports this natively — set `picked: this._sectionFilter.has(st)` on each item |
| Cancel-preserves-state semantics | If user opens filter and presses Escape, the current filter should be unchanged | LOW | `showQuickPick` returns `undefined` on cancel — simply early-return without updating state |
| Filter active indicator | User should be able to tell at a glance whether a filter is active (not showing all sections) | LOW | Two approaches: (a) `TreeView.description` property (shows text in the view title bar), (b) different icon when filter is active via context-key icon swap. Option (a) is simpler and doesn't need extra commands |
| Lock state visible in UI | When User scope is locked, users must be able to confirm this without opening a dialog | LOW | `$(lock)` / `$(unlock)` ThemeIcon on toolbar button; these are built-in VS Code icons requiring no custom SVGs (HIGH confidence, product icon reference) |
| Locked scope items still visible | Hiding a scope entirely when locked would destroy the "overview of all scopes" value proposition | LOW | Items remain visible; only write operations are blocked |
| Write blocked with informative error | When user tries to edit a locked scope item, they get a clear message explaining why the action failed | LOW | Existing `isReadOnly` guard in command handlers already shows an error message — just needs the message text updated to say "locked" rather than "managed/read-only" |
| Auto-refresh without manual trigger | File-watcher-backed auto-refresh is now standard expectation for config editors | LOW | File watcher already implemented; manual Refresh button is vestigial and should be removed |

---

### Differentiators (Competitive Advantage)

Features that go beyond what extensions typically offer. Not required, but add genuine value for this specific use case.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| QuickPick with QuickPickItemKind.Separator | Group filter items with a visual separator ("Sections" header above the 7 items) for better scanability | LOW | `QuickPickItemKind.Separator` is stable since VS Code 1.64 (January 2022) — well within the 1.90.0 minimum requirement (HIGH confidence, official release notes) |
| "All Sections" shortcut item in QuickPick | A "Show All Sections" item at the top of the QuickPick (or via a separator group) lets users clear filters in one click without needing to uncheck all items individually | LOW | Implement as a special item: when selected, maps to `new Set()` (empty = show all). This is not a standard QuickPick pattern but fits naturally with `canSelectMany`. |
| Filter count in view description | Showing "3 sections" in the view title bar when a partial filter is active communicates state without requiring the user to open the QuickPick | LOW | `treeView.description = filter.size === 0 ? '' : `${filter.size} sections`;` — updates on every filter change. Disappears when all sections shown. |
| Scope lock targets scope-selection dialogs, not just editing | When the User scope is locked, it appears as a `QuickPickItem` with `disabled: true` in move-to-scope and copy-to-scope pickers — visible but unselectable | MEDIUM | `QuickPickItem.disabled` property exists in the VS Code API (confirmed in API documentation). This is the standard pattern for "unavailable but acknowledged" options in QuickPick. No alternative approach gets this UX right — hiding the item entirely would be confusing. |
| Lock is ephemeral (session-only, not persisted) | Unlike the Managed scope which is permanently read-only on disk, the User scope lock is a runtime toggle that resets on window reload — making it a "working mode" toggle rather than a permanent policy | LOW | This matches the use case: lock User scope while doing project-level config work, then unlock to edit global settings. No config file changes required. |
| Consistent contextValue-based protection for locked scope | The existing `contextValue` pattern (`setting.editable` vs `setting.readOnly`) already drives all menu visibility. Propagating `effectiveReadOnly = isReadOnly || isScopeLocked` through the tree means the lock reuses 100% of the existing protection infrastructure — no special-casing in any command | MEDIUM | Confirmed by codebase inspection: `baseNode.computeContextValue()` uses `nodeContext.isReadOnly`. Lock state propagates through `ConfigStore.isScopeLocked()` → `ConfigTreeProvider` → `ScopeNode` → children. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem reasonable but would create real problems or violate the project's design intent.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Hide User scope entirely when locked | "If I can't write to it, why show it?" — users may expect hiding to mean protection | Destroying visibility breaks the "all scopes in one place" core value. Also disorienting when unlocked — scope suddenly reappears. VS Code itself does not hide read-only Managed scope; it shows it with read-only nodes. Follow that precedent. | Keep scope visible. Gray-out is not possible via the TreeItem API (the feature request was closed without implementation). Use `contextValue` to hide edit/delete/add context menu items instead. |
| Persist lock state to disk / settings | "I always want User scope locked in project contexts" | This turns a safety toggle into a policy file. If stored in `settings.json`, it creates a circular dependency (the config manager stores its own config in the files it manages). If stored in VS Code workspace settings, it adds an extension setting that needs a UI, documentation, and reset logic. | Keep lock ephemeral (session state in `ConfigStore._lockedScopes`). If the user wants permanent protection, they can use the Managed scope or OS-level file permissions. |
| Replace filter with a separate view/panel per section | "Each section could be its own collapsible view" | VS Code sidebar guideline: "3-5 views is a comfortable max for most screen sizes." Adding 7 section views would far exceed this. Section separation also breaks the cross-scope override visibility that is the extension's primary value. | Keep sections as `SectionNode` children within each `ScopeNode`. Use QuickPick to hide sections, not separate views. |
| Keep the old 16-command icon-pair system alongside QuickPick | "Some users might prefer direct icon buttons for individual sections" | Doubles surface area. The 16 commands still need context key updates to stay in sync with QuickPick-driven filter changes. The motivation for the refactor (reducing complexity and toolbar clutter) is negated. | Remove the old system entirely. The QuickPick is keyboard-accessible via Command Palette. No filtering capability is lost. |
| Gray out locked TreeItems directly | "Show User scope items as visually dimmed to indicate they're locked" | The VS Code API has no `disabled` property on `TreeItem` — this feature request was filed (issue #139557) and closed as "not enough upvotes." There is no reliable way to visually dim a TreeItem. Attempting workarounds (like setting `iconPath` to a gray icon) creates inconsistent results across themes. | Use `contextValue` switching (`setting.readOnly` vs `setting.editable`) to hide/show context menu items. A lock icon on the ScopeNode label itself communicates lock state without requiring individual item dimming. |
| Add a "Lock All Scopes" feature | "While I'm doing a dangerous refactor, I want to lock everything" | Out of scope for this milestone. Scope lock for Managed is already implicit (read-only by filesystem). Locking Project Shared or Project Local in addition to User creates more combinations to test and explain. | Scope the lock to User only as specified. The architecture (a `Set<ConfigScope>` in `ConfigStore`) already supports expanding to other scopes later if needed. |
| Toolbar refresh button kept "for manual override" | "What if the file watcher misses a change? I want a manual fallback." | The file watcher using `vscode.workspace.createFileSystemWatcher` is reliable for JSON files in the workspace and well-known paths. Keeping a manual refresh button "just in case" teaches users to distrust the watcher, creating a click habit. If a watcher bug is found, fix the watcher. | Remove the button. If a real watcher reliability issue is discovered, add it back as a response to a confirmed bug — not as preemptive UX pollution. |

---

## Feature Dependencies

```
[QuickPick Filter (Feature 1)]
    └──removes──> [16 filter command/context-key infrastructure]
    └──requires──> [vscode.window.showQuickPick with canSelectMany: true]
                       └──requires──> [VS Code >= 1.63 (already met by 1.90.0 minimum)]
    └──adds──> [TreeView.description for filter count indicator]

[Remove Refresh Button (Feature 2)]
    └──requires──> [File watcher confirmed stable] (already implemented)
    └──independent of Features 1 and 3]

[User Scope Lock (Feature 3)]
    └──requires──> [ConfigStore.isScopeLocked() method] (new)
    └──requires──> [ConfigTreeProvider reads effectiveReadOnly] (new)
    └──requires──> [ScopeNode accepts effectiveReadOnly parameter] (new)
    └──enhances──> [Existing contextValue .readOnly/.editable pattern]
    └──requires──> [QuickPickItem.disabled for scope pickers]
                       └──requires──> [VS Code >= 1.90.0 (already met)]
    └──reuses──> [$(lock)/$(unlock) built-in ThemeIcons — no custom SVGs needed]

[Feature 1] ──cleans up before──> [Feature 3]
    (Feature 1 removes 16 filter commands from package.json and extension.ts,
     making Feature 3's additions to those files easier to review)

[Feature 2] ──independent of──> [Features 1 and 3]
    (Pure deletion, no dependencies, can be done in any order)
```

### Dependency Notes

- **Feature 3 requires contextValue propagation to work correctly:** The lock only works because `contextValue` containing `.editable` vs `.readOnly` drives menu visibility via `when` clauses in `package.json`. If the `contextValue` pattern were changed, lock protection would break silently. This is a hidden coupling to watch.
- **Feature 1 does NOT depend on Feature 3:** They are independent. Feature 3 adds a new toolbar icon (lock toggle); Feature 1 replaces 8 icons with 1 (filter). Both operate in `view/title` menu but do not interfere.
- **`QuickPickItem.disabled` is the scope lock's integration point with move/copy commands:** The move-to-scope and copy-to-scope commands use `showQuickPick` to present scope targets. When User scope is locked, the User scope item must be shown with `disabled: true` so users understand why they cannot select it. This is different from filtering it out entirely (which would be confusing — "why isn't User scope an option?").

---

## MVP Definition

### Launch With (v1 — this milestone)

- [x] QuickPick multi-select filter replaces 8 toolbar icon buttons — why essential: removes toolbar clutter that is the primary user complaint; delivers immediately visible improvement
- [x] Remove Refresh toolbar button — why essential: redundant with file watcher; its presence implies the watcher is unreliable
- [x] User scope lock toggle via toolbar button — why essential: prevents accidental writes to global user config during project-specific config sessions; the stated user requirement

### Add After Validation (v1.x)

- [ ] Filter count shown in `TreeView.description` — add if user feedback indicates the active filter state is hard to notice with just the icon change
- [ ] "Show All" shortcut item in QuickPick — add if users report friction clearing filters; trivial to implement

### Future Consideration (v2+)

- [ ] Lock scope configurable per-workspace (persisted to workspace state, not settings.json) — defer until there's a concrete user story requiring cross-session persistence
- [ ] Extend lock to Project Shared or Project Local scopes — defer; only User scope is in scope for this milestone; the `Set<ConfigScope>` architecture supports it later
- [ ] Visual dimming of locked TreeItems — blocked by VS Code API limitation (no `TreeItem.disabled` property); reconsider if VS Code adds this capability in a future release

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| QuickPick filter (replaces 8 toolbar icons) | HIGH — removes primary UX pain point (overcrowded toolbar) | LOW — well-understood API, existing scope QuickPick in `moveCommands.ts` proves the pattern | P1 |
| Remove Refresh button | MEDIUM — reduces clutter; low friction for users, high friction for maintenance | LOW — pure deletion of 3 entries across 2 files | P1 |
| User scope lock toggle | HIGH — prevents accidental cross-scope pollution during project config work | MEDIUM — requires 5 file changes, new ConfigStore method, propagation through ScopeNode constructor | P1 |
| Filter count in view description | LOW — nice affordance, not critical | LOW — 1 property assignment | P2 |
| "Show All" shortcut in QuickPick | LOW — users can uncheck all items manually | LOW — 1 extra QuickPickItem | P2 |
| Lock persisted across sessions | LOW — ephemeral session lock covers the use case | HIGH — requires workspace state API, settings migration concerns | P3 |

---

## Competitor Feature Analysis

The "competitors" here are VS Code extensions that implement similar TreeView patterns. No direct competitor provides the same Claude Code config management functionality, but these extensions inform UX decisions.

| Pattern | GitLens | Docker Extension | Kubernetes Extension | Our Approach |
|---------|---------|-----------------|---------------------|--------------|
| Toolbar filter | Per-view filter toggle buttons (single filter per view, not multi-select) | Dropdown menus in activity bar | Cluster/namespace selector in status bar | QuickPick multi-select: more flexible than toggle buttons, more discoverable than status bar |
| Too many toolbar icons | Groups related actions into `...` overflow menu; primary navigation via dedicated sidebar | Uses webview panels for complex UI; toolbar limited to 3-4 icons | Context menus on tree items, minimal toolbar | Remove redundant actions (Refresh); collapse 8 filter buttons to 1 |
| Read-only / locked state | Opened files from TreeView show in read-only editor mode (lock icon on tab); context menus adjusted via contextValue | Container state (stopped/running) drives which context menu items appear | Resource types have fixed permissions (non-mutable resources show no edit actions) | contextValue `.readOnly` vs `.editable` (existing pattern, extended for lock) |
| Scope selection (move/copy) | N/A — single target (git history) | N/A | Namespace selector via QuickPick with all namespaces shown | QuickPick with `disabled: true` on locked scopes — visible but unselectable |
| Lock indicator | Lock icon on file editor tab (VS Code built-in) | Container status badge (running/stopped) on TreeItem label | Not directly applicable | `$(lock)` ThemeIcon on toolbar toggle button; `$(lock)` in ScopeNode label description |

### Key Observations

**Confirmed pattern (MEDIUM confidence, WebSearch + official docs):** Popular extensions use `contextValue` on `TreeItem` to drive `when` clause menu visibility — this is the established standard for protecting items from edit actions. No extension relies on `TreeItem` disabling (the API does not support it).

**Confirmed pattern (HIGH confidence, official UX guidelines):** VS Code UX guidelines explicitly limit toolbar icon counts and recommend overflow menus for secondary actions. 9 icons is above the implicit ceiling that the guidelines hint at.

**Confirmed pattern (MEDIUM confidence, IBM i extension example + GitLens):** Lock/read-only state is communicated via icon decoration on the relevant node label (a lock icon next to the connection name, file tab lock indicator), not by hiding the protected item. This reinforces the anti-feature of hiding the locked scope entirely.

**Confirmed capability (HIGH confidence, VS Code 1.64 release notes):** `QuickPickItemKind.Separator` is stable and available for grouping items within a QuickPick. This is well within the 1.90.0 minimum.

**Confirmed capability (HIGH confidence, official API reference):** `QuickPickItem.disabled` is a documented property that renders items as visible but unselectable — the exact behavior needed for locked scopes in move/copy dialogs.

**Known API limitation (HIGH confidence, GitHub issue #139557 closed as not-enough-upvotes):** `TreeItem` has no `disabled` property. Visual dimming of locked tree items is not achievable through the official API. The contextValue pattern is the only supported mechanism for preventing actions on tree items.

**Known API limitation (MEDIUM confidence, GitHub issue #161753):** VS Code does not expose a search/filter input that extensions can control at the TreeView level. The team explicitly declined to add a separate search input for extension trees. QuickPick is the correct approach for user-controlled filtering.

---

## Sources

- VS Code UX Guidelines — Quick Picks: https://code.visualstudio.com/api/ux-guidelines/quick-picks (HIGH confidence — official docs)
- VS Code UX Guidelines — Views: https://code.visualstudio.com/api/ux-guidelines/views (HIGH confidence — official docs)
- VS Code UX Guidelines — Sidebars: https://code.visualstudio.com/api/ux-guidelines/sidebars (HIGH confidence — official docs)
- VS Code Tree View Extension Guide: https://code.visualstudio.com/api/extension-guides/tree-view (HIGH confidence — official docs)
- VS Code UX Guidelines — Context Menus: https://code.visualstudio.com/api/ux-guidelines/context-menus (HIGH confidence — official docs)
- VS Code 1.64 Release Notes (QuickPickItemKind.Separator stable): https://code.visualstudio.com/updates/v1_64 (HIGH confidence — official changelog)
- VS Code 1.63 Release Notes (QuickPick inline buttons): https://code.visualstudio.com/updates/v1_63 (HIGH confidence — official changelog)
- VS Code GitHub issue — TreeView search/filter API: https://github.com/microsoft/vscode/issues/161753 (HIGH confidence — official issue, team response)
- VS Code GitHub issue — TreeItem gray out / disable: https://github.com/microsoft/vscode/issues/139557 (HIGH confidence — closed, confirmed not implemented)
- VS Code GitHub issue — QuickPickItem disabled: https://github.com/microsoft/vscode/issues/114422 (MEDIUM confidence — closed, current API status confirmed via API reference)
- IBM i extension read-only mode (lock icon pattern): https://www.seidengroup.com/2024/01/08/read-only-mode-in-vs-code-for-ibm-i/ (MEDIUM confidence — single source, consistent with GitLens tab lock pattern)
- GitLens side bar views and filter patterns: https://help.gitkraken.com/gitlens/side-bar/ (MEDIUM confidence — official GitLens docs)
- Direct codebase inspection: `/Users/agnislav/Projects/Dardes/claude-code-config-manager/src/` and `package.json` (HIGH confidence)

---
*Feature research for: Claude Code Config Manager — toolbar UX improvements and scope write protection*
*Researched: 2026-02-18*
