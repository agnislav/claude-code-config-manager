import * as fs from 'fs';

export interface KeyLocation {
  /** 0-based line number */
  line: number;
  /** Length of the line (excluding newline) */
  lineLength: number;
}

/**
 * Finds the line number of a JSON key in a file given a key path.
 *
 * Walks through the key path segments, matching each key at the expected
 * indentation depth (2-space indent per level, as produced by JSON.stringify).
 *
 * For array elements (numeric key path segments), matches the Nth value
 * following the parent key's opening bracket.
 */
export function findKeyLine(
  filePath: string,
  keyPath: string[],
): KeyLocation | undefined {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }

  const lines = content.split('\n');
  if (keyPath.length === 0 || lines.length === 0) return undefined;

  let searchFromLine = 0;

  for (let depth = 0; depth < keyPath.length; depth++) {
    const segment = keyPath[depth];
    const arrayIndex = /^\d+$/.test(segment) ? Number(segment) : -1;

    if (arrayIndex >= 0) {
      // Array element: find the Nth element after current position
      const loc = findArrayElement(lines, searchFromLine, arrayIndex);
      if (!loc) return undefined;
      searchFromLine = loc.line;
    } else {
      // Object key: find the key at the expected indent depth
      const indent = (depth + 1) * 2;
      const loc = findObjectKey(lines, searchFromLine, segment, indent);
      if (!loc) return undefined;
      searchFromLine = loc.line;
    }
  }

  return {
    line: searchFromLine,
    lineLength: lines[searchFromLine].length,
  };
}

/**
 * Reverse of findKeyLine — given a line number, determines the key path.
 *
 * Reads the line at the cursor, extracts the key name (or array element value),
 * then walks backward through decreasing indentation levels to build the full
 * key path from root to the target line.
 *
 * Returns undefined for structural-only lines ({, }, [, ]) or empty lines.
 */
export function findKeyPathAtLine(
  filePath: string,
  targetLine: number,
): string[] | undefined {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }

  const lines = content.split('\n');
  if (targetLine < 0 || targetLine >= lines.length) return undefined;

  const targetInfo = parseLineInfo(lines[targetLine]);
  if (!targetInfo) return undefined;

  const keyPath: string[] = [];

  // Add the target line's own key/value to the path
  if (targetInfo.type === 'key') {
    keyPath.unshift(targetInfo.key);
  } else {
    // Array string element — use the value directly (matches PermissionRuleNode convention)
    keyPath.unshift(targetInfo.key);
  }

  // Walk backward to find parent keys at decreasing indent levels.
  // For lines inside array-of-objects (e.g. hooks), detect opening `{`
  // and emit a numeric array index so the keyPath matches tree node conventions.
  let parentIndent = targetInfo.indent - 2;
  let searchFrom = targetLine - 1;

  while (parentIndent >= 2 && searchFrom >= 0) {
    for (let i = searchFrom; i >= 0; i--) {
      const info = parseLineInfo(lines[i]);

      if (info) {
        if (info.type === 'key' && info.indent === parentIndent) {
          keyPath.unshift(info.key);
          searchFrom = i - 1;
          break;
        }
        if (info.indent < parentIndent) break;
      } else {
        // Structural line ({, }, [, ]) — check for array element opening brace
        const lineIndent = lines[i].length - lines[i].trimStart().length;
        const trimmed = lines[i].trim();

        if (lineIndent === parentIndent && trimmed.startsWith('{')) {
          const arrayIndex = countArrayElementIndex(lines, i, lineIndent);
          if (arrayIndex >= 0) {
            keyPath.unshift(String(arrayIndex));
            searchFrom = i - 1;
            break;
          }
        }

        if (lineIndent < parentIndent) break;
      }
    }
    parentIndent -= 2;
  }

  return keyPath.length > 0 ? keyPath : undefined;
}

interface LineInfo {
  indent: number;
  type: 'key' | 'arrayElement';
  key: string;
}

function parseLineInfo(line: string): LineInfo | undefined {
  const trimmed = line.trim();
  if (trimmed === '' || /^[[\]{},]*$/.test(trimmed)) return undefined;

  const indent = line.length - line.trimStart().length;

  // Object key: "keyName": ...
  const keyMatch = trimmed.match(/^"([^"]+)"\s*:/);
  if (keyMatch) {
    return { indent, type: 'key', key: keyMatch[1] };
  }

  // String array element: "value" or "value",
  const strMatch = trimmed.match(/^"([^"]*)"[,]?$/);
  if (strMatch) {
    return { indent, type: 'arrayElement', key: strMatch[1] };
  }

  return undefined;
}

/**
 * Counts the 0-based index of an opening `{` that is an element of a JSON array.
 * Walks backward from the brace to the opening `[`, counting sibling `{` at the same indent.
 * Returns -1 if the brace is not inside an array.
 */
function countArrayElementIndex(
  lines: string[],
  braceLine: number,
  braceIndent: number,
): number {
  let count = 0;
  for (let i = braceLine - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    const lineIndent = lines[i].length - lines[i].trimStart().length;

    if (lineIndent === braceIndent && trimmed.startsWith('{')) {
      count++;
    }

    if (lineIndent < braceIndent) {
      // Parent line — check if it ends with '[' (array opening)
      if (trimmed.endsWith('[')) {
        return count;
      }
      return -1;
    }
  }
  return -1;
}

function findObjectKey(
  lines: string[],
  fromLine: number,
  key: string,
  expectedIndent: number,
): KeyLocation | undefined {
  const needle = `${' '.repeat(expectedIndent)}"${key}"`;

  for (let i = fromLine; i < lines.length; i++) {
    if (lines[i].startsWith(needle)) {
      return { line: i, lineLength: lines[i].length };
    }
  }
  return undefined;
}

function findArrayElement(
  lines: string[],
  fromLine: number,
  index: number,
): KeyLocation | undefined {
  // Find the opening bracket '[' on or after fromLine
  let bracketLine = -1;
  for (let i = fromLine; i < lines.length; i++) {
    if (lines[i].includes('[')) {
      bracketLine = i;
      break;
    }
  }
  if (bracketLine < 0) return undefined;

  // Walk through array elements, tracking brace/bracket depth so that
  // multi-line objects/arrays count as a single element.
  let count = 0;
  let depth = 0;
  let elementStartLine = -1;

  for (let i = bracketLine + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;

    // Closing bracket of the array itself (at depth 0)
    if (depth === 0 && (trimmed === ']' || trimmed === '],')) break;

    // Mark the start of a new top-level element
    if (depth === 0 && elementStartLine < 0) {
      elementStartLine = i;
    }

    // Track depth changes from braces and brackets on this line
    for (const ch of trimmed) {
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') depth--;
    }

    // When depth returns to 0, we've finished one element
    if (depth === 0) {
      if (count === index) {
        return { line: elementStartLine, lineLength: lines[elementStartLine].length };
      }
      count++;
      elementStartLine = -1;
    }
  }
  return undefined;
}
