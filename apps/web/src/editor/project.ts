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
import type { EditorProject } from './types';

function now(): string {
  return new Date().toISOString();
}

function createDefaultSeats() {
  return [
    { id: 'player_one', name: 'Player One', color: '#f97316' },
    { id: 'player_two', name: 'Player Two', color: '#0ea5e9' },
  ];
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

  return {
    id: generateId('project'),
    name,
    description: 'A component-first prototype built in the browser.',
    createdAt: timestamp,
    updatedAt: timestamp,
    manifest: createDefaultProjectManifest(),
    seats: createDefaultSeats(),
    rootInstanceIds: [],
    instances: {},
    rules: {
      prototypeMode: 'territory',
      phases: ['main'],
      targetScore: 3,
      maxTurns: 12,
      rulesText: 'Players alternate moving their owned pieces into public spaces. Controlled spaces count toward the target score.',
      designerNotes: 'Use spaces or public zones as the scoring surface. Put pieces in reserve zones or hands, then deploy them during preview.',
    },
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
  return touchProject({
    ...project,
    seats: updater(project.seats),
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
