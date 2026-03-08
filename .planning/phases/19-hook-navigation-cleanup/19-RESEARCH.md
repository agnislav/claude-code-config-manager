# Phase 19: Hook Navigation + Cleanup - Research

**Researched:** 2026-03-08
**Domain:** VS Code extension bug fix + dead code removal
**Confidence:** HIGH

## Summary

Phase 19 is a focused bug fix and cleanup phase with two well-defined tasks. The hook entry navigation bug is caused by an incorrect keyPath in `buildHookEntryVM` -- the intermediate `"hooks"` key inside each matcher object is missing from the path. The dead code removal targets `HookKeyValue`-related artifacts left over from v0.6.0 that are defined but never called or referenced.

Both tasks are low-risk, surgically scoped, and have clear verification criteria. The codebase investigation confirms every file and location mentioned in CONTEXT.md.

**Primary recommendation:** Fix keyPath first (1-line change), verify navigation works, then remove all HookKeyValue dead code (6 items across 5 files), then run tests.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Hook navigation fix (NAV-01):**
- Root cause: `buildHookEntryVM` builds keyPath as `['hooks', eventType, matcherIndex, hookIndex]` but the actual JSON structure has an intermediate `hooks` array inside each matcher object
- The keyPath must include the intermediate `"hooks"` segment so `findKeyLine()` can walk the JSON structure correctly
- Fix location: `src/viewmodel/builder.ts` in `buildHookEntryVM` -- adjust keyPath construction
- Same fix needed in `buildHookKeyValueVM` keyPath (though this method is dead code, fix before removal confirms the pattern)

**Dead code removal (CLEN-01):**
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-01 | Clicking a hook entry node navigates the editor to the correct JSON line (fix keyPath to include intermediate `hooks` segment) | Bug root cause confirmed in builder.ts:926 -- keyPath missing `'hooks'` segment between matcherIndex and hookIndex |
| CLEN-01 | Dead HookKeyValueVM, HookKeyValueNode, and buildHookKeyValueVM code removed | All 6 dead code items identified across 5 files, confirmed unreferenced |

</phase_requirements>

## Architecture Patterns

### The KeyPath Bug (NAV-01)

**JSON structure for hooks:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "echo test" }
        ]
      }
    ]
  }
}
```

**Current keyPath (wrong):** `['hooks', 'PreToolUse', '0', '0']`
This tells `findKeyLine()` to find: `hooks` -> `PreToolUse` -> array element 0 -> array element 0. But element 0 of the PreToolUse array is an object `{ matcher, hooks }`, and element 0 inside that is not an array index -- it would try to find a second array which doesn't exist at that level.

**Correct keyPath:** `['hooks', 'PreToolUse', '0', 'hooks', '0']`
This tells `findKeyLine()` to find: `hooks` -> `PreToolUse` -> array element 0 -> `hooks` key -> array element 0. This correctly navigates through the matcher object to the inner `hooks` array.

**Fix location:** `src/viewmodel/builder.ts` line 926

```typescript
// BEFORE (line 926):
keyPath: ['hooks', eventType, String(matcherIndex), String(hookIndex)],

// AFTER:
keyPath: ['hooks', eventType, String(matcherIndex), 'hooks', String(hookIndex)],
```

### findKeyLine() Behavior (Confirmed Working)

The `findKeyLine()` utility in `src/utils/jsonLocation.ts` already handles:
- Object keys: looks for `"keyName":` at expected indent level
- Array indices (numeric segments): finds Nth element after opening `[`, tracking brace depth for multi-line objects

No changes needed to `findKeyLine()`. The fix is purely about passing the correct path segments.

### Dead Code Inventory (CLEN-01)

All HookKeyValue-related dead code in `src/` (confirmed via grep):

| File | What to Remove | Type |
|------|---------------|------|
| `src/viewmodel/types.ts:22` | `HookKeyValue = 'hookKeyValue'` enum member | Enum value |
| `src/viewmodel/types.ts:155-165` | `HookKeyValueVM` interface | Interface |
| `src/viewmodel/builder.ts:129-135` | `formatHookValue()` helper function (only caller is dead `buildHookKeyValueVM`) | Function |
| `src/viewmodel/builder.ts:962-997` | `buildHookKeyValueVM()` method | Method |
| `src/tree/nodes/hookKeyValueNode.ts` | Entire file (14 lines) | Delete file |
| `src/tree/vmToNode.ts:5,23,63-64` | `HookKeyValueVM` import, `HookKeyValueNode` import, switch case | Import + switch case |

**No test file references:** Grep of `test/` for `HookKeyValue` returned zero matches.

**No package.json references:** Grep confirmed no `hookKeyValue` context value references in package.json `when` clauses.

**`buildHookKeyValueVM` is never called:** Only one occurrence in the codebase -- its definition at line 962.

**`formatHookValue` is only used by dead code:** Defined at line 129, only caller is `buildHookKeyValueVM` at line 987. Remove it as additional dead code (Claude's discretion area).

### Import Cleanup in builder.ts

After removing `buildHookKeyValueVM` and `formatHookValue`, the `HookKeyValueVM` type import from `./types` must also be removed. Verify with `npm run lint` that no unused imports remain.

## Common Pitfalls

### Pitfall 1: Removing enum member breaks exhaustive switch
**What goes wrong:** TypeScript exhaustive switches (with `default: throw`) will fail at compile time if enum members are removed but cases remain, or vice versa.
**How to avoid:** Remove both the enum member AND the switch case in vmToNode.ts simultaneously. Run `npm run typecheck` after.

### Pitfall 2: Forgetting the import cleanup
**What goes wrong:** Unused imports left behind cause lint errors.
**How to avoid:** After removing HookKeyValue references, clean up imports in vmToNode.ts (HookKeyValueVM, HookKeyValueNode) and builder.ts (HookKeyValueVM if imported separately).

### Pitfall 3: buildHookKeyValueVM keyPath has the same bug
**What goes wrong:** If someone looks at `buildHookKeyValueVM` for the "correct" pattern, they'll see the same bug.
**How to avoid:** Per user decision, fix `buildHookKeyValueVM` keyPath before removing it. This confirms the fix pattern is correct. Then remove.

## Don't Hand-Roll

Not applicable -- this phase is a surgical fix + deletion. No new features or libraries needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mocha + VS Code test runner |
| Config file | `.vscode-test.mjs` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | Hook entry keyPath includes intermediate 'hooks' segment | unit | `npm run test` | Partial -- existing test at builder.test.ts:329 checks hook structure but not keyPath values |
| CLEN-01 | No HookKeyValue code exists | compile + grep | `npm run typecheck` | N/A -- verified by successful compilation and grep |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green + grep confirms no HookKeyValue references in src/

### Wave 0 Gaps
- Consider adding a keyPath assertion to the existing hook test at builder.test.ts:329 to verify the fix (Claude's discretion per CONTEXT.md)

## Open Questions

None -- all questions resolved during research:
- `formatHookValue` (builder.ts:129-135) is confirmed dead code, only used by `buildHookKeyValueVM`. Should be removed as part of CLEN-01.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `src/viewmodel/builder.ts` lines 125-135, 860-997
- Direct codebase inspection of `src/viewmodel/types.ts` full file
- Direct codebase inspection of `src/tree/vmToNode.ts` full file
- Direct codebase inspection of `src/tree/nodes/hookKeyValueNode.ts` full file
- Direct codebase inspection of `src/utils/jsonLocation.ts` full file
- Direct codebase inspection of `test/suite/viewmodel/builder.test.ts` lines 329-359
- Grep searches across entire `src/` and `test/` directories for HookKeyValue and formatHookValue references

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, pure code changes
- Architecture: HIGH - bug root cause confirmed by reading actual code and JSON structure
- Pitfalls: HIGH - straightforward deletion with well-known TypeScript patterns

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- internal codebase changes only)
