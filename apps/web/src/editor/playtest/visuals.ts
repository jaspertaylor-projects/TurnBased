import { createDefaultCardStudio } from '../cardStudio/model';
import { listProjectDesignSets } from '../componentStudio/model';
import { migrateCardTemplate, rowTemplateData } from '../templateStudio/model';
import { renderDesignSvg } from '../templateStudio/render';
import type { ComponentDesignDocument } from '../templateStudio/types';
import type { EditorProject } from '../types';
import type { LabCard, LabCardSource, LabVisualMaterial } from './types';

const ART_REF = 'lab-art://';

function mapStrings<T>(value: T, replace: (text: string) => string): T {
  if (typeof value === 'string') return replace(value) as T;
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, replace)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, replace)])) as T;
  return value;
}

export function freezeLabVisuals(project: EditorProject, source: LabCardSource, cards: LabCard[]): LabVisualMaterial {
  const result: LabVisualMaterial = { schemaVersion: 1, templates: {}, cards: {}, assets: {} };
  if (source !== 'project') return result;
  const ids = new Set(cards.map((card) => card.id));
  const imageIds = new Map<string, string>();
  const storeImage = (value: string) => {
    if (!/^(data:image\/|https?:\/\/)/i.test(value)) return value;
    let id = imageIds.get(value);
    if (!id) { id = `art-${imageIds.size + 1}`; imageIds.set(value, id); result.assets[id] = value; }
    return `${ART_REF}${id}`;
  };
  for (const set of listProjectDesignSets(project).filter((set) => set.kind === 'card')) {
    const rows = set.studio.rows.filter((row) => ids.has(`${set.id}:${row.id}`));
    if (!rows.length) continue;
    result.templates[set.id] = mapStrings(migrateCardTemplate(set.studio.template), storeImage);
    for (const row of rows) result.cards[`${set.id}:${row.id}`] = {
      templateId: set.id, data: mapStrings(rowTemplateData(row), storeImage),
    };
  }
  return result;
}

export function resolveLabVisual(card: LabCard, visuals?: LabVisualMaterial) {
  const binding = visuals?.cards[card.id];
  const frozen = binding && visuals?.templates[binding.templateId];
  const resolveImage = (value: string) => value.startsWith(ART_REF) ? visuals?.assets[value.slice(ART_REF.length)] ?? '' : value;
  if (frozen && binding) return {
    document: mapStrings(frozen, resolveImage), data: mapStrings(binding.data, resolveImage), authored: true,
  };
  const template = createDefaultCardStudio().template;
  template.showArt = false;
  template.footerField = 'points';
  return {
    document: migrateCardTemplate(template),
    data: { title: card.name, name: card.name, body: `Acquire this card to gain ${card.points} points.`, cost: String(card.cost), points: String(card.points), category: 'Market race', artUrl: '' },
    authored: false,
  };
}

export function labCardSize(card: LabCard, visuals?: LabVisualMaterial) {
  const binding = visuals?.cards[card.id];
  const document = binding && visuals?.templates[binding.templateId];
  return { width: document?.widthMm ?? 63, height: document?.heightMm ?? 88 };
}

export function renderLabCard(card: LabCard, visuals: LabVisualMaterial | undefined, face: 'front' | 'back', prefix: string): string {
  const material = resolveLabVisual(card, visuals);
  let document: ComponentDesignDocument = material.document;
  if (face === 'back' && document.faces.length < 2) document = {
    ...document,
    faces: [{ id: 'fallback-back', name: 'Card back', background: '#294e3b', layers: [] }],
  };
  const faceId = face === 'back' ? document.faces[1]?.id ?? document.faces[0].id : document.faces[0].id;
  return renderDesignSvg(document, { faceId, data: material.data, idPrefix: prefix });
}
