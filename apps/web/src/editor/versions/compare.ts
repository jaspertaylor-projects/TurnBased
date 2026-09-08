import { canonicalSerialize } from '@turnbased/shared-utils';
import type { EditorProject } from '../types';
import { listProjectDesignSets } from '../componentStudio/model';

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
  const oldSets = new Map((before ? listProjectDesignSets(before) : []).map((set) => [set.id, set]));
  const newSets = new Map(listProjectDesignSets(after).map((set) => [set.id, set]));
  for (const id of new Set([...oldSets.keys(), ...newSets.keys()])) {
    const oldSet = oldSets.get(id);
    const newSet = newSets.get(id);
    const label = newSet?.name ?? oldSet?.name ?? 'Component';
    add('Component designs', `${label} · Data table`, oldSet?.studio.rows, newSet?.studio.rows);
    add('Component designs', `${label} · Table fields`, oldSet?.studio.customColumns, newSet?.studio.customColumns);
    add('Component designs', `${label} · Faces and template`, oldSet?.studio.template, newSet?.studio.template);
  }
  add('Playtesting', 'Sessions, findings & protocol', before?.playtestLab, after.playtestLab);
  add('Art', 'Art direction & assets', before?.art, after.art);
  add('Table', 'Player setup', before?.seats, after.seats);
  add('Table', 'Views', before?.views, after.views);
  add('Table', 'Layout', before?.appLayout, after.appLayout);
  add('Game', 'Settings', before?.settings, after.settings);
  return changes;
}
