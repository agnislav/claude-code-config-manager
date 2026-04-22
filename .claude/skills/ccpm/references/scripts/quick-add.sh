#!/bin/bash
# Append a quick capture to .claude/quicks.md

if [ $# -eq 0 ]; then
  echo "Usage: quick-add.sh <text>"
  echo "Example: quick-add.sh 'Add dark mode toggle to tree view'"
  exit 1
fi

mkdir -p .claude
file=".claude/quicks.md"

if [ ! -f "$file" ]; then
  cat > "$file" <<'EOF'
# Quick Captures

Lightweight idea parking lot. Each item is dated; scope them into PRDs with `/ccpm scope-quicks`.
Syntax: `- YYYY-MM-DD: free-form text`. Use `#tag` inside text for grouping hints.

EOF
fi

date_prefix=$(date -u +"%Y-%m-%d")
text="$*"

echo "- $date_prefix: $text" >> "$file"

count=$(grep -c "^- " "$file" 2>/dev/null || echo 0)
echo "✅ Captured quick (#$count total): $text"
echo "   File: $file"
