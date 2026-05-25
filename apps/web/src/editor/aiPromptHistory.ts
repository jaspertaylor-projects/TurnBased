/**
 * Recent AI-assist prompts (used by the rulebook section's AI panel).
 *
 * Scoped GLOBALLY per browser via localStorage — a user's prompt habits tend
 * to carry across projects ("make it spookier", "add an example, two
 * sentences max", "rewrite as bullet points"), and per-project history
 * would split a useful pool into tiny per-project ones.
 *
 * MRU ordered, deduped case-insensitively, capped at 10 entries.
 */

const KEY = 'turnbased.rules.aiPromptHistory';
const MAX_ENTRIES = 10;

function readStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function writeStorage(entries: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* Storage quota / private mode — quietly drop. */
  }
}

export function loadRecentPrompts(): string[] {
  return readStorage();
}

/**
 * Push a prompt to the front of the history. If it already exists
 * (case-insensitive match), it moves to the front instead of duplicating.
 * Returns the updated list so callers don't need a second read.
 */
export function saveRecentPrompt(prompt: string): string[] {
  const trimmed = prompt.trim();
  if (!trimmed) return readStorage();
  const existing = readStorage();
  const filtered = existing.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...filtered].slice(0, MAX_ENTRIES);
  writeStorage(next);
  return next;
}

export function removeRecentPrompt(prompt: string): string[] {
  const target = prompt.toLowerCase();
  const next = readStorage().filter((entry) => entry.toLowerCase() !== target);
  writeStorage(next);
  return next;
}

export function clearRecentPrompts(): void {
  writeStorage([]);
}
