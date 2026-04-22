#!/bin/bash
# List open quick captures

file=".claude/quicks.md"

if [ ! -f "$file" ]; then
  echo "📭 No quicks yet."
  echo "   Capture one with: /ccpm add quick <text>"
  exit 0
fi

count=$(grep -c "^- " "$file" 2>/dev/null || echo 0)

if [ "$count" -eq 0 ]; then
  echo "📭 No open quicks. The file exists but is empty."
  echo "   Capture one with: /ccpm add quick <text>"
  exit 0
fi

echo "📝 Open Quicks ($count)"
echo "==================="
echo ""
grep -n "^- " "$file" | sed 's/:- /  | /'
echo ""
echo "💡 /ccpm scope-quicks           — cluster all into PRD proposals"
echo "💡 /ccpm scope-quicks <theme>   — filter by theme and propose a single PRD"
