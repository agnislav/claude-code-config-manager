# Phase 19: Hook Navigation + Cleanup - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix hook entry leaf nodes so clicking them navigates the editor to the correct JSON line. Remove dead HookKeyValue code left over from v0.6.0. Requirements: NAV-01, CLEN-01.

</domain>

<decisions>
## Implementation Decisions

### Hook navigation fix (NAV-01)
- Root cause: `buildHookEntryVM` builds keyPath as `['hooks', eventType, matcherIndex, hookIndex]` but the actual JSON structure has an intermediate `hooks` array inside each matcher object
- The keyPath must include the intermediate `"hooks"` segment so `findKeyLine()` can walk the JSON structure correctly
- Fix location: `src/viewmodel/builder.ts` in `buildHookEntryVM` — adjust keyPath construction
- Same fix needed in `buildHookKeyValueVM` keyPath (though this method is dead code, fix before removal confirms the pattern)

### Dead code removal (CLEN-01)
- Remove `HookKeyValueVM` interface from `src/viewmodel/types.ts`
- Remove `HookKeyValueNode` class from `src/tree/nodes/hookKeyValueNode.ts` (delete file)
- Remove `buildHookKeyValueVM` method from `src/viewmodel/builder.ts`
- Remove `NodeKind.HookKeyValue` enum member from types
- Remove HookKeyValue case from `vmToNode()` mapper in `src/tree/vmToNode.ts`
- Remove any HookKeyValue references in test files
- Remove any HookKeyValue imports across the codebase

### Claude's Discretion
- Order of operations (fix first then cleanup, or cleanup first)
- Whether to add a test specifically for hook entry keyPath correctness
- Any additional dead code discovered during cleanup

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `findKeyLine()` (src/utils/jsonLocation.ts): Already handles array indices in keyPath — the fix is purely about passing the correct path segments
- `computeCommand()` (src/viewmodel/builder.ts): Wires keyPath into the revealInFile command — no changes needed here
- `revealInFile` command (src/commands/openFileCommands.ts): 7-stage validation pipeline already working — just needs correct keyPath input

### Established Patterns
- Hook JSON structure: `{ "hooks": { "EventType": [{ "matcher": "...", "hooks": [{ "type": "command", "command": "..." }] }] } }`
- KeyPath convention: segments mirror JSON nesting — e.g., settings use `['settings', 'key']`, env vars use `['env', 'VAR_NAME']`
- Dead code removal pattern from Phase 15/18: delete file, remove imports, remove enum members, remove VM-to-node mappings

### Integration Points
- `buildHookEntryVM` at builder.ts:916 — keyPath fix location
- `vmToNode.ts` — HookKeyValue case removal
- `src/viewmodel/types.ts` — HookKeyValueVM interface and NodeKind enum member removal
- Test file: `test/suite/viewmodel/builder.test.ts` — may have HookKeyValue test cases to remove

</code_context>

<specifics>
## Specific Ideas

No specific requirements — this is a well-defined bug fix and cleanup with clear root cause and target list.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-hook-navigation-cleanup*
*Context gathered: 2026-03-08*
