import { canonicalSerialize } from '@turnbased/shared-utils';
import type { EditorProject } from '../types';

export interface DesignChange {
  area: string;
  label: string;
  before: string;
  after: string;
}

export function compareDesigns(before: EditorProject | null, after: EditorProject): DesignChange[] {
  const changes: DesignChange[] = [];
  const add = (area: string, label: string, oldValue: unknown, newValue: unknown) => {
    const text = (value: unknown) => typeof value === 'string' ? value : value == null ? '' : canonicalSerialize(value);
    if (text(oldValue) !== text(newValue)) changes.push({ area, label, before: text(oldValue), after: text(newValue) });
  };
  add('Game', 'Name', before?.name, after.name);
  add('Game', 'Description', before?.description, after.description);
  add('Game', 'Design brief', before?.brief, after.brief);
  const chapterIds = new Set([...(before?.rules.chapters ?? []).map((chapter) => chapter.id), ...after.rules.chapters.map((chapter) => chapter.id)]);
  chapterIds.forEach((id) => {
    const oldChapter = before?.rules.chapters.find((chapter) => chapter.id === id);
    const newChapter = after.rules.chapters.find((chapter) => chapter.id === id);
    add('Rulebook', newChapter?.title ?? oldChapter?.title ?? 'Chapter', oldChapter ? `${oldChapter.title}\n${oldChapter.body}` : '', newChapter ? `${newChapter.title}\n${newChapter.body}` : '');
  });
  add('Rulebook', 'Custom components', before?.rules.customComponents, after.rules.customComponents);
  add('Rulebook', 'Legacy rule text', before?.rules.rulesText, after.rules.rulesText);
  add('Rulebook', 'Designer notes', before?.rules.designerNotes, after.rules.designerNotes);
  const ids = new Set([...Object.keys(before?.instances ?? {}), ...Object.keys(after.instances)]);
  ids.forEach((id) => {
    const oldItem = before?.instances[id];
    const newItem = after.instances[id];
    add('Components', newItem?.displayName ?? oldItem?.displayName ?? id, oldItem, newItem);
  });
  add('Card studio', 'Card table', before?.cardStudio?.rows, after.cardStudio?.rows);
  add('Card studio', 'Custom table fields', before?.cardStudio?.customColumns, after.cardStudio?.customColumns);
  add('Card studio', 'Card template', before?.cardStudio?.template, after.cardStudio?.template);
  add('Playtesting', 'Sessions, findings & protocol', before?.playtestLab, after.playtestLab);
  add('Art', 'Art direction & assets', before?.art, after.art);
  add('Table', 'Player setup', before?.seats, after.seats);
  add('Table', 'Views', before?.views, after.views);
  add('Table', 'Layout', before?.appLayout, after.appLayout);
  add('Game', 'Settings', before?.settings, after.settings);
  return changes;
}
