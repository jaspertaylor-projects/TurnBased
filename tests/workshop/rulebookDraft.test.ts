import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../apps/web/src/editor/project';
import { applyRulebookDraft, parseRulebookDraft, reverseRulebookDraft, writableRuleChapters } from '../../apps/web/src/editor/rulebookDraft';

const rules = () => createBlankProject('Moonlit Market').rules;

describe('reviewed whole-rulebook AI drafts', () => {
  it('matches exact chapter IDs and rejects missing, duplicate, invented, and invalid responses', () => {
    const before = writableRuleChapters(rules()).slice(0, 2);
    const entries = before.map((chapter) => ({ id: chapter.id, body: `Draft for ${chapter.title}` }));
    expect(parseRulebookDraft(JSON.stringify({ chapters: [...entries].reverse() }), before)).toEqual(entries);
    expect(parseRulebookDraft('```json\n'+JSON.stringify({ chapters: entries })+'\n```', before)).toEqual(entries);
    for (const chapters of [entries.slice(0, 1), [entries[0], entries[0]], [entries[0], { id: 'unknown', body: 'Bad' }], [entries[0], { id: entries[1].id, body: '' }]]) {
      expect(() => parseRulebookDraft(JSON.stringify({ chapters }), before)).toThrow();
    }
    expect(() => parseRulebookDraft('Here are your rules:', before)).toThrow(/unreadable/);
  });
  it('applies prose atomically while preserving inventory, chapter identity, order and unrelated edits', () => {
    const original = rules();
    const before = writableRuleChapters(original).slice(0, 2);
    const draft = { before, entries: before.map((chapter) => ({ id: chapter.id, body: `AI ${chapter.title}` })) };
    const unrelated = { ...original, customComponents: [{ id: 'coins', name: 'Coins', quantity: 24, notes: 'Player supply' }] };
    const after = applyRulebookDraft(unrelated, draft);
    expect(after.chapters.map((chapter) => chapter.id)).toEqual(original.chapters.map((chapter) => chapter.id));
    expect(after.customComponents).toEqual(unrelated.customComponents);
    expect(after.chapters.filter((chapter) => chapter.kind === 'components')).toEqual(original.chapters.filter((chapter) => chapter.kind === 'components'));
    expect(applyRulebookDraft(after, reverseRulebookDraft(draft))).toEqual(unrelated);
  });
  it('refuses an entire proposal or undo when any target changed or disappeared', () => {
    const original = rules();
    const before = writableRuleChapters(original).slice(0, 2);
    const draft = { before, entries: before.map((chapter) => ({ id: chapter.id, body: 'AI prose' })) };
    const changed = { ...original, chapters: original.chapters.map((chapter) => chapter.id === before[0].id ? { ...chapter, body: 'Newer designer text' } : chapter) };
    expect(() => applyRulebookDraft(changed, draft)).toThrow(/changed/);
    expect(changed.chapters.find((chapter) => chapter.id === before[0].id)?.body).toBe('Newer designer text');
    expect(() => applyRulebookDraft({ ...original, chapters: original.chapters.filter((chapter) => chapter.id !== before[1].id) }, draft)).toThrow();
    const after = applyRulebookDraft(original, draft);
    const edited = { ...after, chapters: after.chapters.map((chapter) => chapter.id === before[1].id ? { ...chapter, body: 'Manual correction' } : chapter) };
    expect(() => applyRulebookDraft(edited, reverseRulebookDraft(draft))).toThrow();
  });
});
