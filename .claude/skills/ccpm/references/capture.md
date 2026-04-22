# Capture — Lightweight Idea Parking Lot

This phase exists for thoughts that aren't ready for a PRD. Capture is append-only and nearly free; the value lives in the periodic **scope** pass where scattered quicks get clustered into PRD candidates.

Use this phase **before** Plan when:
- You have an idea but don't want to commit to a PRD yet.
- You're testing and find a small improvement worth remembering.
- You want to batch-propose work rather than scope one feature at a time.

---

## File Format

### `.claude/quicks.md` — open captures

Flat, append-only, diff-friendly. One bullet per quick:

```markdown
# Quick Captures

Lightweight idea parking lot. Each item is dated; scope them into PRDs with `/ccpm scope-quicks`.
Syntax: `- YYYY-MM-DD: free-form text`. Use `#tag` inside text for grouping hints.

- 2026-04-22: Add dark mode toggle to tree view #ui
- 2026-04-22: Configs should show last-modified timestamp #ui #metadata
- 2026-04-23: MCP server list is hard to edit when there are 20+ #mcp
```

### `.claude/quicks-archived.md` — scoped / dropped

Created on first scoping pass. Groups resolved quicks by their destination:

```markdown
# Archived Quicks

## Scoped into PRD: tree-view-ux (2026-04-25)
- 2026-04-22: Add dark mode toggle to tree view #ui
- 2026-04-22: Configs should show last-modified timestamp #ui #metadata

## Dropped (2026-04-25)
- 2026-04-20: Maybe rename project?  (reason: user decided against)
```

---

## Add a Quick

**Trigger**: "add quick X", "capture X", "quick: X", "/ccpm add quick X".

Run the script — no reasoning needed:

```bash
bash references/scripts/quick-add.sh "<text>"
```

The script handles file creation, date stamping, and count reporting. Never hand-write to `quicks.md`.

---

## List Quicks

**Trigger**: "list quicks", "show quicks", "what quicks do I have", "/ccpm list quicks".

```bash
bash references/scripts/quick-list.sh
```

Line numbers are shown so they can be referenced during scoping.

---

## Scope Quicks (LLM Reasoning)

**Trigger**: "/ccpm scope-quicks [theme]", "cluster my quicks", "turn quicks into PRDs".

This is the step where the LLM earns its keep. Clustering freeform ideas into coherent PRD seeds is the whole point of the capture phase.

### Preflight
- Verify `.claude/quicks.md` exists and has at least one `^- ` entry.
- If fewer than 3 open quicks, warn: clustering is low-value with 1–2 items; suggest waiting or writing a PRD directly.

### Process

1. **Read the file.** Load every open quick with its date.
2. **Cluster.**
   - **Unthemed** (`/ccpm scope-quicks`): propose 1–N cluster candidates, each a coherent PRD seed. Look for shared surface area (files, features, user flows), not just shared `#tags`.
   - **Themed** (`/ccpm scope-quicks <theme>`): filter to quicks matching the theme semantically (tags, text, intent), propose one PRD seed.
3. **Present proposals** in this format:

   ```
   Proposal 1 — <suggested-prd-name>
   Description: <one-liner>
   Would absorb 4 quicks:
     L5  - 2026-04-22: Add dark mode toggle to tree view
     L6  - 2026-04-22: Configs should show last-modified timestamp
     L9  - 2026-04-23: Tree node icons are hard to distinguish at small sizes
     L11 - 2026-04-24: Collapse/expand state isn't remembered

   Proposal 2 — <suggested-prd-name>
   ...

   Unclustered (stay in quicks.md):
     L7  - 2026-04-22: Maybe rename project?
     L8  - 2026-04-23: Investigate schema validation perf
   ```

4. **Ask the user** to accept, edit, or reject each proposal. Accept per-proposal, not all-or-nothing.
5. **On accept**, for each accepted proposal:
   - Create a PRD draft at `.claude/prds/<prd-name>.md` with frontmatter (`status: backlog`, `created: <now>`) and a body that lists the absorbed quicks as "Source ideas".
   - Move those quicks from `quicks.md` to `quicks-archived.md` under a `## Scoped into PRD: <name> (<date>)` section.
6. **On drop**, move to `## Dropped (<date>)` in archived with an optional reason.

### Writing the archive move

Line-based move pattern (appends to archive, deletes from source):
```bash
# Append to archive under a dated header, then delete original lines.
# Use sed -i.bak for safety; rm the .bak after verification.
```

Do this per proposal, not in bulk — if the user aborts mid-scope, open quicks should remain.

### After scoping
- Confirm: `✅ Scoped N quicks into M PRD(s); K remain open`.
- Suggest: "Ready to flesh out the <name> PRD? Say: expand the <name> PRD" (triggers Plan phase on the draft).

---

## What NOT to use capture for

- Concrete work that's ready to do right now — just create the task or start the epic.
- Bugs against shipped epics — use `/ccpm` bug reporting (Sync phase), which links to the originating issue.
- Long-form specs — if you find yourself writing more than a sentence, it's a PRD, not a quick.

---

## Lifecycle Summary

```
quick → (scoped)  → PRD seed → Plan phase → Epic → Tasks → ...
     → (dropped)  → archived
     → (stays open, revisited next scope pass)
```

Quicks never become tasks directly. The scoping step is the mandatory bridge — it forces the "is this actually coherent work?" question before anything gets scheduled.
