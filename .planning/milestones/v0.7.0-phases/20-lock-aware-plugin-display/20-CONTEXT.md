# Phase 20: Lock-Aware Plugin Display - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

When User scope is locked, plugin nodes display static icons instead of interactive checkboxes, eliminating click-flicker behavior. Requirements: LOCK-01, LOCK-02, LOCK-03.

</domain>

<decisions>
## Implementation Decisions

### Enabled plugin icon (LOCK-01)
- Use `$(check)` ThemeIcon for enabled plugins when locked
- Replaces `$(extensions)` icon entirely — checkmark is the only icon shown
- Default theme color (no explicit color override) — consistent with all other tree icons
- No checkbox state set when locked (remove `checkboxState` from VM)

### Disabled plugin appearance (LOCK-02)
- No icon at all for disabled plugins when locked — don't set `iconPath` or `ThemeIcon`
- Keep dimming via `PluginDecorationProvider` (resourceUri query=disabled still applies)
- Let VS Code handle indentation naturally (no blank icon placeholder)
- Contrast: enabled gets `$(check)`, disabled gets nothing + dimmed text

### Lock toggle transition (LOCK-03)
- Pure ViewModel approach — all changes in `buildPlugins` method of `TreeViewModelBuilder`
- Builder conditionally sets `checkboxState` and `icon` based on `scopedConfig.isReadOnly`
  - `isReadOnly: true` → no checkboxState, icon = `$(check)` or undefined based on enabled
  - `isReadOnly: false` → checkboxState as before, icon = `$(extensions)`
- No tree provider changes needed — existing lock toggle → `onDidChange` → rebuild flow handles it
- On unlock, checkboxes restore from config file value (JSON source of truth)
- No status bar messages or additional visual feedback — lock toolbar icon already communicates state

### Claude's Discretion
- Exact conditional logic placement within `buildPlugins` (early return vs inline ternary)
- Whether to extract locked plugin icon as a constant in constants.ts
- Test strategy for checkbox/icon swap behavior

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TreeViewModelBuilder.buildPlugins()` (builder.ts:661): Main modification target — currently unconditionally sets `checkboxState`
- `PluginDecorationProvider` (pluginNode.ts:19): Already handles disabled dimming via `resourceUri` query — no changes needed
- `ConfigStore.isScopeLocked()` (configModel.ts:99): Already consumed by builder at lines 165/191 to set `isReadOnly: true`

### Established Patterns
- Lock propagation: `isScopeLocked()` → `isReadOnly: true` in ScopedConfig → all child VMs inherit readOnly
- Checkbox: VS Code TreeItem `checkboxState` — setting `undefined` removes the checkbox entirely
- Icon override: `ThemeIcon` in VM `icon` field — already used by all node types

### Integration Points
- `buildPlugins()` in builder.ts — conditional icon/checkbox based on `scopedConfig.isReadOnly`
- `extension.ts:127` — plugin checkbox toggle handler already guards against locked scope (shows error)
- `lockScope()`/`unlockScope()` in configModel.ts — fires `onDidChange` which triggers full tree rebuild

</code_context>

<specifics>
## Specific Ideas

- Visual result: enabled locked plugins show a simple checkmark, disabled locked plugins show nothing but dimmed text — maximum contrast between states
- Consistent with project's "lock blocks target selection, not menu visibility" principle — plugins are still visible, just not interactive

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-lock-aware-plugin-display*
*Context gathered: 2026-03-09*
