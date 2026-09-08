import type { EditorRuleConfig, RulesChapter } from './types';

export interface RulebookDraftEntry { id: string; body: string }
export interface RulebookDraft {
  before: RulesChapter[];
  entries: RulebookDraftEntry[];
}

export function writableRuleChapters(rules: EditorRuleConfig): RulesChapter[] {
  return rules.chapters.filter((chapter) => !chapter.kind || chapter.kind === 'standard');
}

export function parseRulebookDraft(text: string, chapters: RulesChapter[]): RulebookDraftEntry[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); } catch { throw new Error('The AI returned an unreadable draft. Your rulebook has not changed.'); }
  const entries = parsed && typeof parsed === 'object' && 'chapters' in parsed ? parsed.chapters : null;
  if (!Array.isArray(entries) || entries.length !== chapters.length) throw new Error('The AI did not return every requested chapter. Your rulebook has not changed.');
  const expected = new Set(chapters.map((chapter) => chapter.id));
  const found = new Map<string, string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !expected.has(entry.id) || found.has(entry.id)
      || typeof entry.body !== 'string' || !entry.body.trim() || entry.body.length > 24000) {
      throw new Error('The AI returned an invalid chapter. Your rulebook has not changed.');
    }
    found.set(entry.id, entry.body.trim());
  }
  return chapters.map((chapter) => ({ id: chapter.id, body: found.get(chapter.id)! }));
}

/** Only the requested prose changes; chapter identities, order and structured inventory stay intact. */
export function applyRulebookDraft(rules: EditorRuleConfig, draft: RulebookDraft): EditorRuleConfig {
  const entries = new Map(draft.entries.map((entry) => [entry.id, entry.body]));
  if (draft.before.length !== entries.size || draft.before.some((before) => {
    const current = rules.chapters.find((chapter) => chapter.id === before.id);
    return !entries.has(before.id) || !current || current.body !== before.body || current.title !== before.title || current.kind !== before.kind;
  })) throw new Error('A chapter changed after generation. Review a fresh draft before applying it.');
  return { ...rules, chapters: rules.chapters.map((chapter) => entries.has(chapter.id) ? { ...chapter, body: entries.get(chapter.id)! } : chapter) };
}

export function reverseRulebookDraft(draft: RulebookDraft): RulebookDraft {
  const generated = new Map(draft.entries.map((entry) => [entry.id, entry.body]));
  return {
    before: draft.before.map((chapter) => ({ ...chapter, body: generated.get(chapter.id)! })),
    entries: draft.before.map((chapter) => ({ id: chapter.id, body: chapter.body })),
  };
}
