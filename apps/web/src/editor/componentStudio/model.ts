import { createComponentInstanceId } from '@turnbased/shared-types';
import { createComponentInstance, getBuiltInComponentManifest } from '@turnbased/engine-components';
import type { BuiltInComponentType, ComponentInstanceModel } from '@turnbased/engine-components';
import type { EditorProject } from '../types';
import type { CardStudioRow, CardStudioState } from '../cardStudio/types';
import type { TemplateComponentKind } from '../templateStudio/types';
import { createDefaultCardStudio, MAX_CARD_ROWS, normalizeCardStudioState } from '../cardStudio/model';
import { createTemplateDocument, migrateCardTemplate } from '../templateStudio/model';
import { addProjectComponent, duplicateComponentSubtree, removeComponentInstance } from '../project';
import type { ProjectDesignSet } from './types';
import { resizeTemplateDocument } from '../templateStudio/resize';

export const LEGACY_DESIGN_SET_ID = 'legacy-card-studio';
const PHYSICAL_TYPES = new Set(['board', 'deck', 'card', 'tile', 'piece', 'token']);

export function getComponentDesignKind(instance: ComponentInstanceModel): TemplateComponentKind | null {
  if (instance.componentType === 'deck' || instance.componentType === 'card') return 'card';
  if (instance.componentType === 'board') return instance.properties.studioKind === 'mat' ? 'mat' : 'board';
  if (['tile', 'piece', 'token'].includes(instance.componentType))
    return instance.componentType as TemplateComponentKind;
  return null;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
}

function quantity(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function stableRow(id: string, title: string, values: Partial<CardStudioRow> = {}): CardStudioRow {
  return {
    id,
    title,
    body: '',
    cost: '0',
    category: '',
    copies: 1,
    artUrl: '',
    customFields: {},
    ...values,
  };
}

function splitCopies(row: CardStudioRow): CardStudioRow[] {
  // Existing physical templates can exceed the table's 99-copy row limit.
  // Preserve their quantity as deterministic rows instead of silently truncating it.
  const batches = Math.min(1000, Math.ceil(row.copies / 99));
  return Array.from({ length: batches }, (_, index) => ({
    ...row,
    id: index === 0 ? row.id : `${row.id}_copies_${index + 1}`,
    copies: index === batches - 1 ? row.copies - index * 99 : 99,
  }));
}

function normalizeStudio(studio: CardStudioState, key: string): CardStudioState {
  const ids = new Set<string>();
  const rows = (Array.isArray(studio?.rows) ? studio.rows : []).map((row, index) => {
    let id = typeof row?.id === 'string' && row.id ? row.id : `${key}_row_${index + 1}`;
    while (ids.has(id)) id = `${id}_${index + 1}`;
    ids.add(id);
    return { ...row, id };
  });
  return normalizeCardStudioState({ ...studio, rows });
}

function deriveStudio(
  project: EditorProject,
  instance: ComponentInstanceModel,
  kind: TemplateComponentKind,
): CardStudioState {
  const id = String(instance.instanceId);
  const name = instance.displayName || stringValue(instance.properties.label, 'Untitled component');
  const base = createDefaultCardStudio();
  const starter = createTemplateDocument(kind);
  const width =
    typeof instance.properties.physicalWidthMm === 'number' && instance.properties.physicalWidthMm > 0
      ? instance.properties.physicalWidthMm
      : starter.widthMm;
  const height =
    typeof instance.properties.physicalHeightMm === 'number' && instance.properties.physicalHeightMm > 0
      ? instance.properties.physicalHeightMm
      : starter.heightMm;
  const document = resizeTemplateDocument(starter, width, height, true);
  const rows =
    kind === 'card'
      ? (instance.componentType === 'card'
          ? [instance]
          : instance.children.map((childId) => project.instances[String(childId)])
        )
          .filter((child) => child?.componentType === 'card')
          .map((child) =>
            stableRow(
              String(child.instanceId),
              child.displayName || stringValue(child.properties.title, 'Card'),
              {
                body: stringValue(child.properties.body ?? child.properties.subtitle),
                cost: stringValue(child.properties.cost, '0'),
                category: stringValue(child.properties.category),
                copies: quantity(child.properties.quantity),
                artUrl: stringValue(child.properties.imageUrl),
                customFields: {
                  points: stringValue(child.properties.points ?? child.properties.victory_points, '0'),
                },
              },
            ),
          )
      : [
          stableRow(`${id}_design`, name, {
            copies: quantity(instance.properties.quantity),
            category: kind,
            body: instance.notes || '',
          }),
        ];
  return {
    ...base,
    rows: rows.flatMap(splitCopies),
    template: {
      ...base.template,
      widthMm: document.widthMm,
      heightMm: document.heightMm,
      document,
    },
  };
}

/** The physical instance is the inventory identity. Designs add authoring data, not another inventory. */
export function listProjectDesignSets(project: EditorProject): ProjectDesignSet[] {
  const rootIds = project.rootInstanceIds.filter((id) =>
    PHYSICAL_TYPES.has(project.instances[id]?.componentType),
  );
  const movableIds = Object.values(project.instances)
    .filter((instance) => ['piece', 'token'].includes(instance.componentType))
    .map((instance) => String(instance.instanceId));
  const sets: ProjectDesignSet[] = [];
  for (const id of new Set([...rootIds, ...movableIds])) {
    const instance = project.instances[id];
    const kind = getComponentDesignKind(instance);
    if (!kind) continue;
    const stored = project.componentDesigns?.[id];
    sets.push({
      id,
      instanceId: id,
      name: instance.displayName || stringValue(instance.properties.label, 'Untitled component'),
      kind,
      studio: stored ?? deriveStudio(project, instance, kind),
    });
  }
  if (project.cardStudio)
    sets.push({
      id: LEGACY_DESIGN_SET_ID,
      instanceId: null,
      name: 'Original card deck',
      kind: 'card',
      studio: project.cardStudio,
    });
  return sets;
}

/** Call after image hydration. Reads do not create inventory or random identifiers. */
export function normalizeProjectComponentDesigns(project: EditorProject): EditorProject {
  const designs = Object.fromEntries(
    Object.entries(project.componentDesigns ?? {})
      .filter(([id]) => Boolean(project.instances[id] && getComponentDesignKind(project.instances[id])))
      .map(([id, studio]) => [id, normalizeStudio(studio, id)]),
  );
  return {
    ...project,
    ...(project.componentDesigns ? { componentDesigns: designs } : {}),
    ...(project.cardStudio
      ? {
          cardStudio: normalizeStudio(project.cardStudio, LEGACY_DESIGN_SET_ID),
        }
      : {}),
  };
}

export function materializeLegacyDesign(project: EditorProject): {
  project: EditorProject;
  instanceId: string;
} {
  const baseId = `${project.id}_legacy_card_studio`;
  let instanceId = baseId;
  let suffix = 2;
  while (project.instances[instanceId]) instanceId = `${baseId}_${suffix++}`;
  if (!project.cardStudio)
    throw new Error('The original card deck is no longer available. Open it from Components again.');
  const deck = createComponentInstance(getBuiltInComponentManifest('deck'), {
    instanceId: createComponentInstanceId(instanceId),
    displayName: 'Original card deck',
    parentId: null,
  });
  const studio = project.cardStudio;
  const { cardStudio: _legacy, ...rest } = project;
  void _legacy;
  const next = {
    ...rest,
    rootInstanceIds: [...project.rootInstanceIds, instanceId],
    instances: { ...project.instances, [instanceId]: deck },
  };
  return {
    project: setProjectComponentDesign(next, instanceId, studio),
    instanceId,
  };
}

export function setProjectComponentDesign(
  project: EditorProject,
  setId: string,
  studio: CardStudioState,
): EditorProject {
  if (setId === LEGACY_DESIGN_SET_ID) {
    if (!project.cardStudio)
      throw new Error('The original deck has moved into Components. Open its new component to keep editing.');
    const materialized = materializeLegacyDesign({
      ...project,
      cardStudio: studio,
    });
    return materialized.project;
  }
  const instance = project.instances[setId];
  const kind = instance && getComponentDesignKind(instance);
  if (!instance || !kind) throw new Error('This component is no longer in your game.');
  if (studio.rows.length > MAX_CARD_ROWS || studio.rows.some((row) => row.copies > 99))
    throw new Error(
      'This physical inventory exceeds one design table. Split it into smaller component sets before editing.',
    );
  const normalized = normalizeStudio(studio, setId);
  const document =
    normalized.template.document ??
    (kind === 'card' ? migrateCardTemplate(normalized.template) : createTemplateDocument(kind));
  const nextStudio = {
    ...normalized,
    template: {
      ...normalized.template,
      widthMm: document.widthMm,
      heightMm: document.heightMm,
      document,
    },
  };
  const dimensionsChanged =
    (typeof instance.properties.physicalWidthMm === 'number' &&
      Math.abs(instance.properties.physicalWidthMm - document.widthMm) > 0.001) ||
    (typeof instance.properties.physicalHeightMm === 'number' &&
      Math.abs(instance.properties.physicalHeightMm - document.heightMm) > 0.001);
  const properties = {
    ...instance.properties,
    physicalWidthMm: document.widthMm,
    physicalHeightMm: document.heightMm,
    ...(instance.componentType !== 'deck'
      ? {
          quantity: normalized.rows.reduce((total, row) => total + row.copies, 0),
        }
      : {}),
    // A custom-size edit invalidates the old supplier size; never silently keep a misleading match.
    ...(dimensionsChanged && instance.properties.catalogSlug
      ? {
          catalogSlug: '',
          catalogVariantId: '',
          catalogProductTitle: '',
          catalogVariantTitle: '',
        }
      : {}),
  };
  return {
    ...project,
    instances: { ...project.instances, [setId]: { ...instance, properties } },
    componentDesigns: { ...project.componentDesigns, [setId]: nextStudio },
  };
}

export function createStudioComponent(
  project: EditorProject,
  kind: TemplateComponentKind,
  name: string,
): { project: EditorProject; instanceId: string } {
  const type: BuiltInComponentType = kind === 'card' ? 'deck' : kind === 'mat' ? 'board' : kind;
  const result = addProjectComponent(project, type, null, null);
  if (!result.instanceId || result.issue)
    throw new Error(result.issue || 'The component could not be created.');
  const instanceId = result.instanceId;
  const instance = result.project.instances[instanceId];
  const starter = createTemplateDocument(kind);
  const next = {
    ...result.project,
    instances: {
      ...result.project.instances,
      [instanceId]: {
        ...instance,
        displayName: name.trim() || 'Untitled component',
        properties: {
          ...instance.properties,
          physicalWidthMm: starter.widthMm,
          physicalHeightMm: starter.heightMm,
          label: name.trim() || 'Untitled component',
          ...(kind === 'mat' ? { studioKind: 'mat' } : {}),
        },
      },
    },
  };
  const studio = deriveStudio(next, next.instances[instanceId], kind);
  if (kind === 'card')
    studio.rows = [stableRow(`${instanceId}_design`, 'My first card', { category: 'Card' })];
  return {
    project: setProjectComponentDesign(next, instanceId, studio),
    instanceId,
  };
}

export function renameStudioComponent(
  project: EditorProject,
  setId: string,
  name: string,
): { project: EditorProject; instanceId: string } {
  const target =
    setId === LEGACY_DESIGN_SET_ID ? materializeLegacyDesign(project) : { project, instanceId: setId };
  const instance = target.project.instances[target.instanceId];
  if (!instance) throw new Error('This component is no longer in your game.');
  return {
    project: {
      ...target.project,
      instances: {
        ...target.project.instances,
        [target.instanceId]: {
          ...instance,
          displayName: name.trim() || 'Untitled component',
          properties: {
            ...instance.properties,
            label: name.trim() || 'Untitled component',
          },
        },
      },
    },
    instanceId: target.instanceId,
  };
}

export function removeStudioComponent(project: EditorProject, setId: string): EditorProject {
  if (setId === LEGACY_DESIGN_SET_ID) {
    const { cardStudio: _legacy, ...rest } = project;
    void _legacy;
    return rest;
  }
  const next = removeComponentInstance(project, setId);
  return {
    ...next,
    componentDesigns: Object.fromEntries(
      Object.entries(next.componentDesigns ?? {}).filter(([id]) => Boolean(next.instances[id])),
    ),
  };
}

export function duplicateStudioComponent(
  project: EditorProject,
  setId: string,
): { project: EditorProject; instanceId: string } {
  const target =
    setId === LEGACY_DESIGN_SET_ID ? materializeLegacyDesign(project) : { project, instanceId: setId };
  const source = target.project.instances[target.instanceId];
  if (source?.componentType === 'card' && !source.parentId) {
    // Old archives allowed standalone cards. New card sets use valid deck roots.
    const studio = listProjectDesignSets(target.project).find((set) => set.id === target.instanceId)!.studio;
    const copied = createStudioComponent(target.project, 'card', `${source.displayName || 'Card'} Copy`);
    return {
      ...copied,
      project: setProjectComponentDesign(copied.project, copied.instanceId, structuredClone(studio)),
    };
  }
  const result = duplicateComponentSubtree(target.project, target.instanceId, {
    displayNameSuffix: ' Copy',
  });
  if (!result.instanceId || result.issue)
    throw new Error(result.issue || 'The component could not be copied.');
  const studio = listProjectDesignSets(target.project).find((set) => set.id === target.instanceId)?.studio;
  const remap = new Map<string, string>();
  function pairChildren(sourceId: string, copyId: string) {
    if (remap.has(sourceId)) return;
    remap.set(sourceId, copyId);
    const source = target.project.instances[sourceId];
    const copy = result.project.instances[copyId];
    source?.children.forEach((childId, index) => {
      const copiedChild = copy?.children[index];
      if (copiedChild) pairChildren(String(childId), String(copiedChild));
    });
  }
  pairChildren(target.instanceId, result.instanceId);
  let copied = result.project;
  for (const [sourceId, copyId] of remap) {
    const sourceStudio =
      sourceId === target.instanceId ? studio : target.project.componentDesigns?.[sourceId];
    if (!sourceStudio) continue;
    const nextStudio = structuredClone(sourceStudio);
    // Existing cards may use their physical instance ID as a row ID.
    nextStudio.rows = nextStudio.rows.map((row) => ({
      ...row,
      id: remap.get(row.id) ?? row.id,
    }));
    copied = setProjectComponentDesign(copied, copyId, nextStudio);
  }
  return {
    project: copied,
    instanceId: result.instanceId,
  };
}
