import { getPlaytestCards } from '../cardStudio/model';
import type { EditorProject } from '../types';
import { normalizeLabCards, SAMPLE_LAB_CARDS } from './simulation';
import type { LabCard, LabCardSource } from './types';

const numberValue = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export function getProjectLabCards(project: EditorProject): LabCard[] {
  const studio = getPlaytestCards(project.cardStudio);
  if (studio.length) return normalizeLabCards(studio);
  return normalizeLabCards(Object.values(project.instances)
    .filter((instance) => instance.componentType === 'card')
    .map((instance) => ({
      id: instance.instanceId,
      name: instance.displayName || String(instance.properties.title || instance.properties.name || 'Untitled card'),
      cost: numberValue(instance.properties.cost),
      points: numberValue(instance.properties.points ?? instance.properties.victory_points),
      quantity: Math.max(1, numberValue(instance.properties.quantity)),
    })));
}

export function getLabMaterial(project: EditorProject, source: LabCardSource): LabCard[] {
  return source === 'sample' ? SAMPLE_LAB_CARDS.map((card) => ({ ...card })) : getProjectLabCards(project);
}
