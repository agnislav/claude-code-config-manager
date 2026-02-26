---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/images/tree-overview.png
  - docs/images/inline-actions.png
  - docs/images/toolbar-overview.png
  - docs/images/filter-sections.png
  - README.md
  - .vscodeignore
autonomous: true
requirements: [QUICK-2]
must_haves:
  truths:
    - "Screenshots live in docs/images/ with descriptive names"
    - "README.md displays images inline at contextually appropriate locations"
    - "Original numbered PNGs (1-4.png) are removed from project root"
    - "docs/ directory is excluded from vsix package"
  artifacts:
    - path: "docs/images/tree-overview.png"
      provides: "Main tree view screenshot"
    - path: "docs/images/inline-actions.png"
      provides: "Inline action buttons screenshot"
    - path: "docs/images/toolbar-overview.png"
      provides: "Toolbar with lock/filter/collapse buttons screenshot"
    - path: "docs/images/filter-sections.png"
      provides: "Filter Sections QuickPick dialog screenshot"
    - path: "README.md"
      provides: "Updated README with embedded images"
    - path: ".vscodeignore"
      provides: "Excludes docs/ from vsix"
  key_links:
    - from: "README.md"
      to: "docs/images/*.png"
      via: "Markdown image references"
      pattern: "!\\[.*\\]\\(docs/images/"
---

<objective>
Move screenshot PNGs from the project root into `docs/images/` with descriptive names, embed them in README.md at contextually appropriate locations, and update `.vscodeignore` to exclude `docs/` from the packaged extension.

Purpose: Make the README visually informative for marketplace/GitHub visitors while keeping the project root clean and the vsix package lean.
Output: Organized screenshots in `docs/images/`, updated README.md with inline images, clean project root.
</objective>

<execution_context>
@/Users/agnislav/.claude/get-shit-done/workflows/execute-plan.md
@/Users/agnislav/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@README.md
@.vscodeignore
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move and rename screenshot files</name>
  <files>
    docs/images/tree-overview.png
    docs/images/inline-actions.png
    docs/images/toolbar-overview.png
    docs/images/filter-sections.png
  </files>
  <action>
    Create the `docs/images/` directory. Move and rename the four screenshot PNGs:

    - `1.png` -> `docs/images/tree-overview.png` (full tree view with User scope plugins/settings, Project Shared "Not found", Project Local permissions)
    - `2.png` -> `docs/images/inline-actions.png` (close-up of Move to Scope, Copy, Delete hover buttons on a permission rule)
    - `3.png` -> `docs/images/toolbar-overview.png` (toolbar showing lock, filter, collapse/expand buttons with collapsed scope nodes)
    - `4.png` -> `docs/images/filter-sections.png` (Filter Sections QuickPick dialog listing all 7 section types)

    Use `git mv` for each file so git tracks the rename. Verify originals no longer exist in root after move.

    Do NOT move `icon.png`, `icon-v2.png`, or `icon-v3.png` -- those are extension icon variants, not screenshots.
  </action>
  <verify>
    <automated>ls docs/images/tree-overview.png docs/images/inline-actions.png docs/images/toolbar-overview.png docs/images/filter-sections.png && ! ls 1.png 2.png 3.png 4.png 2>/dev/null && echo "PASS"</automated>
  </verify>
  <done>All four screenshots exist in docs/images/ with descriptive names; no numbered PNGs remain in project root.</done>
</task>

<task type="auto">
  <name>Task 2: Update README.md with images and update .vscodeignore</name>
  <files>
    README.md
    .vscodeignore
  </files>
  <action>
    **README.md changes:**

    1. Add a hero screenshot immediately after the opening description paragraph (after "...real-time file watching.") and before "## Features":
       ```markdown
       ![Claude Code Config Manager - Tree View](docs/images/tree-overview.png)
       ```

    2. Under "### Scope-Aware Configuration", after the numbered scope list and before the final sentence about override display, add the toolbar screenshot:
       ```markdown
       ![Toolbar with scope navigation and filter controls](docs/images/toolbar-overview.png)
       ```

    3. Under "### Full Config Coverage", after the bullet list of sections, add a small subsection for inline actions with the screenshot. Add this as a new paragraph below the bullet list:
       ```markdown
       Each item supports inline actions -- hover to reveal move, copy, and delete buttons:

       ![Inline action buttons on hover](docs/images/inline-actions.png)
       ```

    4. Under "### Section Filters", after the existing text, add the filter dialog screenshot:
       ```markdown
       ![Filter Sections dialog](docs/images/filter-sections.png)
       ```

    **Important:** Keep alt text descriptive for accessibility. Use relative paths (`docs/images/...`) not absolute paths.

    **.vscodeignore changes:**

    Add `docs/**` on its own line (add it after the `.claude/**` line to keep alphabetical-ish grouping). This prevents screenshots from bloating the vsix package. The images are only needed for the marketplace/GitHub README, which VS Code marketplace fetches from the repo directly.

    Also add the remaining loose icon PNGs that are already in .vscodeignore but missing `icon-v3.png`:
    - Confirm `icon-v3.png` is listed (it is not currently). Add it next to the existing `icon.png` and `icon-v2.png` lines.
  </action>
  <verify>
    <automated>grep -c "docs/images/" README.md | grep -q "4" && grep -q "docs/\*\*" .vscodeignore && grep -q "icon-v3.png" .vscodeignore && echo "PASS"</automated>
    <manual>Open README.md preview in VS Code (Cmd+Shift+V) to confirm images render at correct locations with proper sizing.</manual>
  </verify>
  <done>README.md contains 4 image references (tree-overview as hero, toolbar-overview under Scope-Aware, inline-actions under Full Config Coverage, filter-sections under Section Filters). .vscodeignore includes docs/** and icon-v3.png.</done>
</task>

</tasks>

<verification>
- All 4 screenshots in `docs/images/` with descriptive names
- No `1.png`, `2.png`, `3.png`, `4.png` in project root
- README.md has 4 markdown image embeds pointing to `docs/images/`
- `.vscodeignore` excludes `docs/**`
- `npm run compile` still succeeds (no broken references)
- README preview shows images at contextually appropriate locations
</verification>

<success_criteria>
- Screenshots organized in docs/images/ with meaningful names
- README.md visually illustrates the extension's key features with 4 embedded screenshots
- vsix package size unaffected (docs/ excluded)
- Project root clean of numbered screenshot files
</success_criteria>

<output>
After completion, create `.planning/quick/2-add-images-for-readme-md/2-SUMMARY.md`
</output>
