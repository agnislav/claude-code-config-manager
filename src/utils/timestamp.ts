/**
 * Returns a wall-clock timestamp string in [HH:MM:SS.mmm] format.
 * Used for output channel log lines in fileWatcher, configWriter, and openFileCommands.
 */
export function formatTimestamp(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const mmm = String(now.getMilliseconds()).padStart(3, '0');
  return `[${hh}:${mm}:${ss}.${mmm}]`;
}
