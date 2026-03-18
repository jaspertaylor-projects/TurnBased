import {
  createComponentInstanceId,
  createPlayerId,
} from '@turnbased/shared-types';
import {
  createComponentInstance,
  getBuiltInComponentManifest,
  validateComponentPlacement,
} from '@turnbased/engine-components';
import type {
  BuiltInComponentType,
  ComponentInstanceModel,
  CreateComponentInstanceOptions,
} from '@turnbased/engine-components';
import { generateId } from '@turnbased/shared-utils';

import { createDefaultProjectManifest } from './manifest';
import type {
  EditorAppLayout,
  EditorProject,
  EditorProjectView,
  EditorProjectViews,
  EditorSeat,
  EditorSettings,
  RulesBuilderBrief,
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
  };
}

export function createDefaultAppLayout(name = 'New Prototype'): EditorAppLayout {
  return {
    shellTitle: name,
    introText: 'A linked multi-view match opens with the shared board and lets you jump into any player area from the summary strip.',
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
      description: `${seat.name}'s personal area stays linked to the shared board shell.`,
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
      prototypeMode: 'territory',
      phases: ['main'],
      targetScore: 3,
      maxTurns: 12,
      rulesText: 'Players alternate taking a turn. Each seat begins with 6 block resources in a linked personal view, and occupying public spaces increases score.',
      designerNotes: 'This workspace can be generated from a lightweight setup form, then refined across visual, preview, versions, component editor, and app layout tabs.',
    },
    settings: createDefaultProjectSettings(),
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
  const parentManifest = parentId ? getBuiltInComponentManifest(project.instances[parentId].componentType as BuiltInComponentType) : null;
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
    displayName: inferDisplayName(type, countSiblings(project, parentId, type)),
    parentId: parentId ? createComponentInstanceId(parentId) : null,
    placement: inferPlacement(project, type, parentId),
    bindings: ownerId ? { ownerId: createPlayerId(ownerId) } : {},
  });

  const nextInstances: EditorProject['instances'] = {
    ...project.instances,
    [instanceId]: instance,
  };

  if (parentId) {
    nextInstances[parentId] = addChildReference(project.instances[parentId], instanceId);
  }

  const nextRootInstanceIds = parentId
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

function collectDescendants(project: EditorProject, instanceId: string): string[] {
  const instance = project.instances[instanceId];
  if (!instance) {
    return [];
  }

  return instance.children.flatMap((childId) => [childId, ...collectDescendants(project, childId)]);
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

  return Object.values(project.instances).filter((instance) => {
    const parentManifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
    return validateComponentPlacement(manifest, parentManifest).valid;
  });
}
