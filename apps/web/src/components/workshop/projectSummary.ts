import type { EditorProject } from '../../editor/types';
import type { EditorSection } from '../../editor/constants';

export function summarizeProject(project: EditorProject, versionCount = 0) {
  const chapters = project.rules.chapters.filter((chapter) => chapter.body.trim()).length;
  const components = Object.values(project.instances).filter((instance) => !instance.parentId).length;
  const designs = project.cardStudio?.rows.length ?? 0;
  const copies = project.cardStudio?.rows.reduce((total, row) => total + row.copies, 0) ?? 0;
  const rulesStarted = chapters > 0 || project.rules.rulesText.trim().length > 0;
  const next: { label: string; section: EditorSection } = !rulesStarted
    ? { label: 'Shape your first rules', section: 'rules' }
    : designs === 0 && components === 0
      ? { label: 'Make your first cards', section: 'card_studio' }
        : versionCount === 0
          ? { label: 'Save your first checkpoint', section: 'versions' }
        : { label: 'Plan your next playtest', section: 'playtest' };
  return { chapters, components, designs, copies, rulesStarted, next };
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
