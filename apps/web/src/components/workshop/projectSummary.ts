import type { EditorProject } from '../../editor/types';
import type { EditorSection } from '../../editor/constants';
import { listProjectDesignSets } from '../../editor/componentStudio/model';

export function summarizeProject(project: EditorProject, versionCount = 0) {
  const chapters = project.rules.chapters.filter((chapter) => chapter.body.trim()).length;
  const sets = listProjectDesignSets(project);
  const setInstances = new Set(sets.flatMap((set) => set.instanceId ? [set.instanceId] : []));
  const components = sets.length + Object.values(project.instances).filter((instance) => !instance.parentId && !setInstances.has(String(instance.instanceId))).length;
  const decks = sets.filter((set) => set.kind === 'card');
  const designs = decks.reduce((total, set) => total + set.studio.rows.length, 0);
  const copies = decks.reduce((total, set) => total + set.studio.rows.reduce((sum, row) => sum + row.copies, 0), 0);
  const componentCopies = sets.reduce((total, set) => total + set.studio.rows.reduce((sum, row) => sum + row.copies, 0), 0);
  const rulesStarted = chapters > 0 || project.rules.rulesText.trim().length > 0;
  const next: { label: string; section: EditorSection } = !rulesStarted
    ? { label: 'Shape your first rules', section: 'rules' }
    : designs === 0 && components === 0
      ? { label: 'Make your first component', section: 'component_editor' }
        : versionCount === 0
          ? { label: 'Save your first checkpoint', section: 'versions' }
        : { label: 'Plan your next playtest', section: 'playtest' };
  return { chapters, components, designs, copies, componentCopies, designSets: sets.length, families: [...new Set(sets.map((set) => set.kind))], rulesStarted, next };
}

export function projectLink(projectId: string, section: EditorSection = 'workshop') {
  return `#/editor/${encodeURIComponent(projectId)}?section=${section}`;
}

export function formatProjectDate(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? 'Recently'
    : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function projectPlayerLabel(project: EditorProject) {
  const { minPlayers, maxPlayers } = project.brief;
  return `${minPlayers === maxPlayers ? minPlayers : `${minPlayers}–${maxPlayers}`} player${maxPlayers === 1 ? '' : 's'}`;
}
