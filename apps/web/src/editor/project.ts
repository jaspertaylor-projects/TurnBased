import {
  createComponentInstanceId,
  createPlayerId,
} from '@turnbased/shared-types';
import {
  createComponentInstance,
  getGridCellLabel,
  getGridCoordinateKey,
  getBuiltInComponentManifest,
  readGridCellCoordinates,
  validateComponentPlacement,
} from '@turnbased/engine-components';
import type {
  BuiltInComponentType,
  ComponentInstanceModel,
  CreateComponentInstanceOptions,
} from '@turnbased/engine-components';
import { generateId } from '@turnbased/shared-utils';

import { createDefaultProjectManifest } from './manifest';
import { createDefaultProjectColorPalette } from './projectPalette';
import { getUserSettings } from '../userSettings';
import type {
  CustomRulebookComponent,
  EditorAppLayout,
  EditorArtDirection,
  EditorProject,
  EditorProjectView,
  EditorProjectViews,
  EditorRuleConfig,
  EditorSeat,
  EditorSettings,
  RulesBuilderBrief,
  RulesChapter,
} from './types';

function now(): string {
  return new Date().toISOString();
}

const DEFAULT_SEAT_COLORS = [
  '#f97316',
  '#0ea5e9',
  '#8b5cf6',
  '#10b981',
  '#ec4899',
  '#f59e0b',
];

const DEFAULT_SEAT_ICONS = [
  'crown',
  'shield',
  'sparkles',
  'leaf',
  'flame',
  'gem',
];

export function createDefaultProjectSettings(): EditorSettings {
  return {
    timeControlMode: 'none',
    timeControlSeconds: 300,
    colorPalette: createDefaultProjectColorPalette(),
    aiModels: getUserSettings().defaultAIModels,
  };
}

export function createDefaultProjectArtDirection(): EditorArtDirection {
  return {
    theme: '',
    definedArtStyles: [],
    recurringAssets: [],
    icons: [],
    images: [],
  };
}

export function getDefaultSeatIconKey(index: number): string {
  return DEFAULT_SEAT_ICONS[index % DEFAULT_SEAT_ICONS.length];
}

export function createDefaultSeats(playerCount = 2): EditorSeat[] {
  return Array.from({ length: Math.max(1, playerCount) }, (_, index) => ({
    id: `player_${index + 1}`,
    name: `Player ${index + 1}`,
    color: DEFAULT_SEAT_COLORS[index % DEFAULT_SEAT_COLORS.length],
    identity: {
      badgeLabel: String(index + 1),
      iconKey: getDefaultSeatIconKey(index),
      customAvatarUrl: null,
    },
    resources: {
      startingBlocks: 6,
      resourceLabel: 'Blocks',
    },
  }));
}

export function createDefaultRulesBrief(): RulesBuilderBrief {
  return {
    name: '',
    minPlayers: 2,
    maxPlayers: 4,
    hasDistinctSoloMode: false,
    isCampaignGame: false,
    theme: '',
    artStyle: '',
    minAge: 10,
    playtimeMinMinutes: 30,
    playtimeMaxMinutes: 60,
  };
}

/* The brief stores `theme` and `artStyle` as a single comma-joined string so
   downstream consumers (AI grounding, runtime, project description) get a
   stable scalar. UI surfaces that want to render them as chip lists go
   through splitBriefList; appendBriefList adds a new value to the joined
   string, dedupes case-insensitively, and trims. */
export function splitBriefList(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of value.split(',')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function appendBriefList(value: string, entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) return value;
  // Filter out the literal "none" placeholder that normalizeRulesBuilderBrief
  // injects when the brief field was left empty at project creation — once
  // a real entry is being added, the placeholder should evaporate.
  const existing = splitBriefList(value).filter((item) => item.toLowerCase() !== 'none');
  if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    return existing.join(', ');
  }
  return [...existing, trimmed].join(', ');
}

export function normalizeRulesBuilderBrief(brief: RulesBuilderBrief): RulesBuilderBrief {
  const normalizedMin = Math.max(1, Math.min(6, Math.trunc(brief.minPlayers || 1)));
  const normalizedMax = Math.max(normalizedMin, Math.min(6, Math.trunc(brief.maxPlayers || normalizedMin)));
  const normalizedAge = Math.max(0, Math.min(99, Math.trunc(brief.minAge || 0)));
  const rawPtMin = Math.max(1, Math.min(999, Math.trunc(brief.playtimeMinMinutes || 1)));
  const rawPtMax = Math.max(1, Math.min(999, Math.trunc(brief.playtimeMaxMinutes || rawPtMin)));
  const normalizedPtMin = Math.min(rawPtMin, rawPtMax);
  const normalizedPtMax = Math.max(rawPtMin, rawPtMax);

  return {
    ...brief,
    name: brief.name.trim(),
    minPlayers: normalizedMin,
    maxPlayers: normalizedMax,
    theme: brief.theme.trim() || 'none',
    artStyle: brief.artStyle.trim() || 'none',
    minAge: normalizedAge,
    playtimeMinMinutes: normalizedPtMin,
    playtimeMaxMinutes: normalizedPtMax,
  };
}

export function createDefaultAppLayout(name = 'New Prototype'): EditorAppLayout {
  return {
    shellTitle: name,
    introText: 'A linked multi-view match opens with the shared board and lets you jump into each player resources area from the summary strip.',
    hudItems: ['Turn tracker', 'Blocks', 'Active player'],
    sidePanels: ['Rules', 'Players', 'Board context'],
    primaryActionLabel: 'Take turn',
    summaryStripLabel: 'Players',
    linkedViewLabel: 'Linked Views',
    resourceSummaryLabel: 'Blocks',
    navigationMode: 'summary_strip',
    avatarStyle: 'lucide',
  };
}

export function createDefaultProjectViews(seats: EditorSeat[], projectName = 'New Prototype'): EditorProjectViews {
  const sharedViewId = 'view_shared_board';
  const items: EditorProjectView[] = [
    {
      id: sharedViewId,
      kind: 'shared',
      label: 'Main Board',
      linkedSeatId: null,
      parentViewId: null,
      description: `${projectName} starts in the shared board view with the player summary strip visible above it.`,
    },
    ...seats.map((seat) => ({
      id: `view_${seat.id}`,
      kind: 'player' as const,
      label: `${seat.name} View`,
      linkedSeatId: seat.id,
      parentViewId: sharedViewId,
      description: `${seat.name}'s resources view stays linked to the shared board shell.`,
    })),
  ];

  return {
    defaultViewId: sharedViewId,
    selectedViewId: sharedViewId,
    items,
  };
}

export function syncProjectViews(existing: EditorProjectViews | undefined, seats: EditorSeat[], projectName: string): EditorProjectViews {
  const defaults = createDefaultProjectViews(seats, projectName);
  const existingItems = existing?.items ?? [];
  const nextItems = defaults.items.map((defaultView) => {
    const match = defaultView.kind === 'shared'
      ? existingItems.find((item) => item.kind === 'shared')
      : existingItems.find((item) => item.linkedSeatId === defaultView.linkedSeatId);

    return match ? {
      ...defaultView,
      label: match.label || defaultView.label,
      description: match.description || defaultView.description,
    } : defaultView;
  });
  const validIds = new Set(nextItems.map((item) => item.id));
  const defaultViewId = existing?.defaultViewId && validIds.has(existing.defaultViewId)
    ? existing.defaultViewId
    : defaults.defaultViewId;
  const selectedViewId = existing?.selectedViewId && validIds.has(existing.selectedViewId)
    ? existing.selectedViewId
    : defaultViewId;

  return {
    defaultViewId,
    selectedViewId,
    items: nextItems,
  };
}

function inferDisplayName(type: BuiltInComponentType, siblingCount: number): string {
  const manifest = getBuiltInComponentManifest(type);
  return `${manifest.displayName} ${siblingCount + 1}`;
}

function countSiblings(project: EditorProject, parentId: string | null, componentType: string): number {
  return Object.values(project.instances).filter((instance) => (
    instance.parentId === parentId && instance.componentType === componentType
  )).length;
}

function isBoardGridComponentType(componentType: string): componentType is 'hex-grid' | 'square-grid' | 'checkerboard-grid' {
  return componentType === 'hex-grid' || componentType === 'square-grid' || componentType === 'checkerboard-grid';
}

function getGridCells(instance: ComponentInstanceModel) {
  const fallbackRows = typeof instance.properties.rows === 'number' && Number.isFinite(instance.properties.rows)
    ? Math.max(1, Math.trunc(instance.properties.rows))
    : 1;
  const fallbackColumns = typeof instance.properties.columns === 'number' && Number.isFinite(instance.properties.columns)
    ? Math.max(1, Math.trunc(instance.properties.columns))
    : 1;

  return readGridCellCoordinates(instance.properties.cells, fallbackRows, fallbackColumns);
}

function collectRemovedInstanceIds(project: EditorProject, instanceId: string): string[] {
  const instance = project.instances[instanceId];
  if (!instance) {
    return [];
  }

  return instance.children.flatMap((childId) => [childId, ...collectRemovedInstanceIds(project, childId)]);
}

function inferPlacement(
  project: EditorProject,
  type: BuiltInComponentType,
  parentId: string | null,
): CreateComponentInstanceOptions<Record<string, unknown>>['placement'] {
  const siblings = Object.values(project.instances).filter((instance) => instance.parentId === parentId);

  if (type === 'space') {
    const index = siblings.filter((instance) => instance.componentType === 'space').length;
    const columnCount = parentId
      ? Number(project.instances[parentId]?.properties.width ?? 3) || 3
      : 3;

    return {
      index,
      coordinates: {
        x: index % columnCount,
        y: Math.floor(index / columnCount),
      },
    };
  }

  if (type === 'piece' || type === 'token') {
    return {
      index: siblings.filter((instance) => instance.category === 'entity').length,
      trackPosition: siblings.length,
    };
  }

  if (type === 'counter' || type === 'score-track') {
    return {
      index: siblings.length,
    };
  }

  return {
    index: siblings.length,
  };
}

function addChildReference(parent: ComponentInstanceModel, childId: string): ComponentInstanceModel {
  return {
    ...parent,
    children: [...parent.children, createComponentInstanceId(childId)],
  };
}

export function createBlankProject(name = 'Untitled Prototype'): EditorProject {
  const timestamp = now();
  const brief = createDefaultRulesBrief();
  const seats = createDefaultSeats(2);

  return {
    id: generateId('project'),
    name,
    description: 'An AI-generated linked multi-view prototype workspace.',
    createdAt: timestamp,
    updatedAt: timestamp,
    phase: 'ready',
    manifest: createDefaultProjectManifest(),
    brief,
    seats,
    views: createDefaultProjectViews(seats, name),
    rootInstanceIds: [],
    instances: {},
    rules: {
      rulesText: '',
      designerNotes: '',
      chapters: createDefaultRulesChapters(),
      customComponents: [],
    },
    settings: createDefaultProjectSettings(),
    art: createDefaultProjectArtDirection(),
    appLayout: createDefaultAppLayout(name),
  };
}

export function touchProject(project: EditorProject): EditorProject {
  return {
    ...project,
    updatedAt: now(),
  };
}

export function renameProject(project: EditorProject, name: string): EditorProject {
  return touchProject({
    ...project,
    name,
  });
}

export function updateProjectDescription(project: EditorProject, description: string): EditorProject {
  return touchProject({
    ...project,
    description,
  });
}

export function updateProjectRules(
  project: EditorProject,
  updater: (rules: EditorProject['rules']) => EditorProject['rules'],
): EditorProject {
  return touchProject({
    ...project,
    rules: updater(project.rules),
  });
}

// ── Rulebook chapters ───────────────────────────────────────────────────

const DEFAULT_CHAPTER_TITLES = [
  'Concept',
  'Components',
  'Setup',
  'Game Structure',
  'Taking a Turn',
  'End Game',
  'Glossary',
];

export function createDefaultRulesChapters(): RulesChapter[] {
  return DEFAULT_CHAPTER_TITLES.map((title) => ({
    id: generateId('chapter'),
    title,
    body: '',
    kind: title === 'Components' ? 'components' as const : 'standard' as const,
  }));
}

export function createBlankChapter(title = 'New Chapter'): RulesChapter {
  return { id: generateId('chapter'), title, body: '', kind: 'standard' };
}

// ── Custom rulebook components ──────────────────────────────────────────

export function addCustomRulebookComponent(
  rules: EditorRuleConfig,
  component: CustomRulebookComponent,
): EditorRuleConfig {
  return { ...rules, customComponents: [...rules.customComponents, component] };
}

export function updateCustomRulebookComponent(
  rules: EditorRuleConfig,
  componentId: string,
  patch: Partial<Omit<CustomRulebookComponent, 'id'>>,
): EditorRuleConfig {
  return {
    ...rules,
    customComponents: rules.customComponents.map((entry) =>
      entry.id === componentId ? { ...entry, ...patch } : entry,
    ),
  };
}

export function removeCustomRulebookComponent(
  rules: EditorRuleConfig,
  componentId: string,
): EditorRuleConfig {
  return {
    ...rules,
    customComponents: rules.customComponents.filter((entry) => entry.id !== componentId),
  };
}

export function updateChapter(
  rules: EditorRuleConfig,
  chapterId: string,
  patch: Partial<Omit<RulesChapter, 'id'>>,
): EditorRuleConfig {
  return {
    ...rules,
    chapters: rules.chapters.map((chapter) =>
      chapter.id === chapterId ? { ...chapter, ...patch } : chapter,
    ),
  };
}

export function addChapter(rules: EditorRuleConfig, chapter: RulesChapter = createBlankChapter()): EditorRuleConfig {
  return { ...rules, chapters: [...rules.chapters, chapter] };
}

export function removeChapter(rules: EditorRuleConfig, chapterId: string): EditorRuleConfig {
  return { ...rules, chapters: rules.chapters.filter((chapter) => chapter.id !== chapterId) };
}

export function moveChapter(rules: EditorRuleConfig, chapterId: string, direction: -1 | 1): EditorRuleConfig {
  const index = rules.chapters.findIndex((chapter) => chapter.id === chapterId);
  if (index === -1) return rules;
  const target = index + direction;
  if (target < 0 || target >= rules.chapters.length) return rules;
  const next = [...rules.chapters];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return { ...rules, chapters: next };
}

export function updateProjectSeats(
  project: EditorProject,
  updater: (seats: EditorProject['seats']) => EditorProject['seats'],
): EditorProject {
  const nextSeats = updater(project.seats);
  return touchProject({
    ...project,
    seats: nextSeats,
    views: syncProjectViews(project.views, nextSeats, project.name),
  });
}

export function updateProjectSettings(
  project: EditorProject,
  updater: (settings: EditorProject['settings']) => EditorProject['settings'],
): EditorProject {
  return touchProject({
    ...project,
    settings: updater(project.settings),
  });
}

export function updateProjectArt(
  project: EditorProject,
  updater: (art: EditorProject['art']) => EditorProject['art'],
): EditorProject {
  return touchProject({
    ...project,
    art: updater(project.art),
  });
}

export function updateProjectBrief(
  project: EditorProject,
  updater: (brief: EditorProject['brief']) => EditorProject['brief'],
): EditorProject {
  const nextBrief = updater(project.brief);
  return touchProject({
    ...project,
    brief: nextBrief,
  });
}

export function updateProjectAppLayout(
  project: EditorProject,
  updater: (layout: EditorProject['appLayout']) => EditorProject['appLayout'],
): EditorProject {
  return touchProject({
    ...project,
    appLayout: updater(project.appLayout),
  });
}

export function addProjectSeat(project: EditorProject): EditorProject {
  const nextSeat = createDefaultSeats(project.seats.length + 1)[project.seats.length];
  return updateProjectSeats(project, (seats) => [...seats, nextSeat]);
}

export function removeProjectSeat(project: EditorProject, seatId: string): EditorProject {
  if (project.seats.length <= 1) {
    return project;
  }

  const nextSeats = project.seats.filter((seat) => seat.id !== seatId);
  const nextInstances = Object.fromEntries(
    Object.entries(project.instances).map(([instanceId, instance]) => {
      if (instance.bindings.ownerId !== seatId) {
        return [instanceId, instance];
      }

      return [instanceId, {
        ...instance,
        bindings: {
          ...instance.bindings,
          ownerId: undefined,
        },
      }];
    }),
  );

  return touchProject({
    ...project,
    seats: nextSeats,
    views: syncProjectViews(project.views, nextSeats, project.name),
    instances: nextInstances,
  });
}

export function addProjectComponent(
  project: EditorProject,
  type: BuiltInComponentType,
  parentId: string | null,
  ownerId: string | null,
): { project: EditorProject; issue?: string; instanceId?: string } {
  const manifest = getBuiltInComponentManifest(type);
  const resolvedParentId = manifest.role === 'top-level' ? null : parentId;
  const parentManifest = resolvedParentId ? getBuiltInComponentManifest(project.instances[resolvedParentId].componentType as BuiltInComponentType) : null;
  const placementValidation = validateComponentPlacement(manifest, parentManifest);

  if (!placementValidation.valid) {
    return {
      project,
      issue: placementValidation.issues[0]?.message ?? 'That component cannot be placed there.',
    };
  }

  const instanceId = generateId(`component_${type}`);
  const instance = createComponentInstance(manifest, {
    instanceId: createComponentInstanceId(instanceId),
    displayName: inferDisplayName(type, countSiblings(project, resolvedParentId, type)),
    parentId: resolvedParentId ? createComponentInstanceId(resolvedParentId) : null,
    placement: inferPlacement(project, type, resolvedParentId),
    bindings: ownerId ? { ownerId: createPlayerId(ownerId) } : {},
  });

  const nextInstances: EditorProject['instances'] = {
    ...project.instances,
    [instanceId]: instance,
  };

  if (resolvedParentId) {
    nextInstances[resolvedParentId] = addChildReference(project.instances[resolvedParentId], instanceId);
  }

  const nextRootInstanceIds = resolvedParentId
    ? project.rootInstanceIds
    : [...project.rootInstanceIds, instanceId];

  return {
    project: touchProject({
      ...project,
      rootInstanceIds: nextRootInstanceIds,
      instances: nextInstances,
    }),
    instanceId,
  };
}

export function updateComponentInstance(
  project: EditorProject,
  instanceId: string,
  updater: (instance: ComponentInstanceModel) => ComponentInstanceModel,
): EditorProject {
  const current = project.instances[instanceId];
  if (!current) {
    return project;
  }

  return touchProject({
    ...project,
    instances: {
      ...project.instances,
      [instanceId]: updater(current),
    },
  });
}

export function syncGeneratedBoardChildren(project: EditorProject, instanceId: string): EditorProject {
  const instance = project.instances[instanceId];
  if (!instance || !isBoardGridComponentType(instance.componentType)) {
    return project;
  }

  const desiredCells = getGridCells(instance);
  const existingCellIds = instance.children
    .map(String)
    .filter((childId) => project.instances[childId]?.componentType === 'space');
  const preservedChildIds = instance.children
    .map(String)
    .filter((childId) => project.instances[childId]?.componentType !== 'space');
  const existingCellsByCoordinate = new Map(
    existingCellIds.map((childId) => {
      const child = project.instances[childId];
      const coordinate = {
        x: typeof child?.placement?.coordinates?.x === 'number' ? Math.trunc(child.placement.coordinates.x) : 0,
        y: typeof child?.placement?.coordinates?.y === 'number' ? Math.trunc(child.placement.coordinates.y) : 0,
      };

      return [getGridCoordinateKey(coordinate), childId] as const;
    }),
  );
  const nextInstances: EditorProject['instances'] = {
    ...project.instances,
  };
  const nextChildIds: string[] = [];
  const spaceManifest = getBuiltInComponentManifest('space');

  for (const [index, coordinate] of desiredCells.entries()) {
    const existingCellId = existingCellsByCoordinate.get(getGridCoordinateKey(coordinate)) ?? null;
    const nextCellId = existingCellId ?? generateId('component_space');
    const currentCell = existingCellId ? nextInstances[existingCellId] : null;
    const labelPrefix = typeof instance.properties.cellLabelPrefix === 'string'
      ? instance.properties.cellLabelPrefix
      : undefined;
    const nextLabel = getGridCellLabel(instance.componentType, coordinate, labelPrefix);
    const nextCell = createComponentInstance(spaceManifest, {
      instanceId: createComponentInstanceId(nextCellId),
      displayName: nextLabel,
      parentId: createComponentInstanceId(instanceId),
      placement: {
        index,
        coordinates: {
          x: coordinate.x,
          y: coordinate.y,
        },
      },
      properties: {
        label: nextLabel,
        x: coordinate.x,
        y: coordinate.y,
        maxCapacity: typeof instance.properties.maxCapacity === 'number' ? instance.properties.maxCapacity : null,
      },
      children: currentCell?.children ?? [],
      bindings: currentCell?.bindings ?? {},
      frame: currentCell?.frame,
      renderOverrides: currentCell?.renderOverrides,
      interactionOverrides: currentCell?.interactionOverrides,
    });

    nextInstances[nextCellId] = nextCell;
    nextChildIds.push(nextCellId);
  }

  const desiredCoordinateKeys = new Set(desiredCells.map((cell) => getGridCoordinateKey(cell)));

  for (const removedCellId of existingCellIds.filter((childId) => {
    const child = project.instances[childId];
    const coordinate = {
      x: typeof child?.placement?.coordinates?.x === 'number' ? Math.trunc(child.placement.coordinates.x) : 0,
      y: typeof child?.placement?.coordinates?.y === 'number' ? Math.trunc(child.placement.coordinates.y) : 0,
    };

    return !desiredCoordinateKeys.has(getGridCoordinateKey(coordinate));
  })) {
    for (const descendantId of [removedCellId, ...collectRemovedInstanceIds(project, removedCellId)]) {
      delete nextInstances[descendantId];
    }
  }

  return touchProject({
    ...project,
    instances: {
      ...nextInstances,
      [instanceId]: {
        ...instance,
        children: [...nextChildIds, ...preservedChildIds].map((childId) => createComponentInstanceId(childId)),
      },
    },
  });
}

export function syncAllGeneratedBoardChildren(project: EditorProject): EditorProject {
  return Object.keys(project.instances).reduce((nextProject, instanceId) => (
    syncGeneratedBoardChildren(nextProject, instanceId)
  ), project);
}

function collectDescendants(project: EditorProject, instanceId: string): string[] {
  const instance = project.instances[instanceId];
  if (!instance) {
    return [];
  }

  return instance.children.flatMap((childId) => [childId, ...collectDescendants(project, childId)]);
}

/**
 * Clone an instance and all of its descendants into the same project, assigning
 * fresh ids to every copied node and reparenting them correctly. If
 * `targetParentId` is provided, the top-level clone is attached there;
 * otherwise it is attached to the same parent as the source (or added as a
 * new root if the source was a root).
 *
 * Returns the updated project and the id of the newly created top-level clone.
 */
export function duplicateComponentSubtree(
  project: EditorProject,
  sourceInstanceId: string,
  options: {
    targetParentId?: string | null;
    displayNameSuffix?: string;
  } = {},
): { project: EditorProject; instanceId?: string; issue?: string } {
  const source = project.instances[sourceInstanceId];
  if (!source) {
    return { project, issue: 'Component to duplicate was not found.' };
  }

  const resolvedTargetParentId = options.targetParentId !== undefined
    ? options.targetParentId
    : (source.parentId ? String(source.parentId) : null);

  // Validate placement against the target parent's manifest so we don't paste
  // a token under a board that doesn't accept it, etc.
  const manifest = getBuiltInComponentManifest(source.componentType as BuiltInComponentType);
  const parentManifest = resolvedTargetParentId
    ? getBuiltInComponentManifest(project.instances[resolvedTargetParentId]?.componentType as BuiltInComponentType)
    : null;
  const placement = validateComponentPlacement(manifest, parentManifest);
  if (!placement.valid) {
    return { project, issue: placement.issues[0]?.message ?? 'That component cannot be pasted there.' };
  }

  // Build id remap for the entire subtree up front so we can rewire parent
  // and children references in a single pass.
  const idRemap = new Map<string, string>();
  function assignId(id: string, type: string) {
    idRemap.set(id, generateId(`component_${type}`));
  }
  assignId(sourceInstanceId, source.componentType);
  for (const descendantId of collectDescendants(project, sourceInstanceId)) {
    const descendant = project.instances[descendantId];
    if (descendant) {
      assignId(descendantId, descendant.componentType);
    }
  }

  const nextInstances: EditorProject['instances'] = { ...project.instances };

  // Clone each node with its remapped id, remapped parent, and remapped
  // children. Keep other fields (properties, frame, bindings, etc.) identical.
  for (const [oldId, newId] of idRemap.entries()) {
    const original = project.instances[oldId];
    if (!original) continue;

    const clonedParentId = oldId === sourceInstanceId
      ? (resolvedTargetParentId ? createComponentInstanceId(resolvedTargetParentId) : null)
      : (original.parentId && idRemap.has(String(original.parentId))
        ? createComponentInstanceId(idRemap.get(String(original.parentId)) as string)
        : original.parentId);

    nextInstances[newId] = {
      ...original,
      instanceId: createComponentInstanceId(newId),
      parentId: clonedParentId,
      children: original.children.map((childId) => createComponentInstanceId(
        idRemap.get(String(childId)) ?? String(childId),
      )),
      // Append a suffix so outline and inspector labels don't collide.
      displayName: oldId === sourceInstanceId && options.displayNameSuffix
        ? `${original.displayName ?? ''}${options.displayNameSuffix}`
        : original.displayName,
    };
  }

  const newTopLevelId = idRemap.get(sourceInstanceId) as string;

  // Attach the top-level clone into the target parent's children list, or
  // append it to rootInstanceIds if it has no parent.
  if (resolvedTargetParentId) {
    const targetParent = nextInstances[resolvedTargetParentId];
    if (targetParent) {
      nextInstances[resolvedTargetParentId] = addChildReference(targetParent, newTopLevelId);
    }
  }

  const nextRootInstanceIds = resolvedTargetParentId
    ? project.rootInstanceIds
    : [...project.rootInstanceIds, newTopLevelId];

  return {
    project: touchProject({
      ...project,
      rootInstanceIds: nextRootInstanceIds,
      instances: nextInstances,
    }),
    instanceId: newTopLevelId,
  };
}

export function removeComponentInstance(project: EditorProject, instanceId: string): EditorProject {
  const instance = project.instances[instanceId];
  if (!instance) {
    return project;
  }

  const removals = new Set([instanceId, ...collectDescendants(project, instanceId)]);
  const nextInstances = Object.fromEntries(
    Object.entries(project.instances)
      .filter(([id]) => !removals.has(id))
      .map(([id, current]) => {
        if (!current.children.some((childId) => removals.has(childId))) {
          return [id, current];
        }

        return [id, {
          ...current,
          children: current.children.filter((childId) => !removals.has(childId)),
        }];
      }),
  );

  return touchProject({
    ...project,
    rootInstanceIds: project.rootInstanceIds.filter((id) => !removals.has(id)),
    instances: nextInstances,
  });
}

export function listValidParents(project: EditorProject, type: BuiltInComponentType): ComponentInstanceModel[] {
  const manifest = getBuiltInComponentManifest(type);

  if (manifest.role === 'top-level') {
    return [];
  }

  return Object.values(project.instances).filter((instance) => {
    const parentManifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
    return validateComponentPlacement(manifest, parentManifest).valid;
  });
}
