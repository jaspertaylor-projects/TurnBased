import { createComponentInstanceId, createPlayerId } from '@turnbased/shared-types';
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
import type { EditorProject } from './types';
import { touchProject } from './projectUpdates';

function inferDisplayName(type: BuiltInComponentType, siblingCount: number): string {
  const manifest = getBuiltInComponentManifest(type);
  return `${manifest.displayName} ${siblingCount + 1}`;
}

function countSiblings(project: EditorProject, parentId: string | null, componentType: string): number {
  return Object.values(project.instances).filter(
    (instance) => instance.parentId === parentId && instance.componentType === componentType,
  ).length;
}

function isBoardGridComponentType(
  componentType: string,
): componentType is 'hex-grid' | 'square-grid' | 'checkerboard-grid' {
  return (
    componentType === 'hex-grid' || componentType === 'square-grid' || componentType === 'checkerboard-grid'
  );
}

function getGridCells(instance: ComponentInstanceModel) {
  const fallbackRows =
    typeof instance.properties.rows === 'number' && Number.isFinite(instance.properties.rows)
      ? Math.max(1, Math.trunc(instance.properties.rows))
      : 1;
  const fallbackColumns =
    typeof instance.properties.columns === 'number' && Number.isFinite(instance.properties.columns)
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
    const columnCount = parentId ? Number(project.instances[parentId]?.properties.width ?? 3) || 3 : 3;

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

export function addProjectComponent(
  project: EditorProject,
  type: BuiltInComponentType,
  parentId: string | null,
  ownerId: string | null,
): { project: EditorProject; issue?: string; instanceId?: string } {
  const manifest = getBuiltInComponentManifest(type);
  const resolvedParentId = manifest.role === 'top-level' ? null : parentId;
  const parentManifest = resolvedParentId
    ? getBuiltInComponentManifest(project.instances[resolvedParentId].componentType as BuiltInComponentType)
    : null;
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
        x:
          typeof child?.placement?.coordinates?.x === 'number'
            ? Math.trunc(child.placement.coordinates.x)
            : 0,
        y:
          typeof child?.placement?.coordinates?.y === 'number'
            ? Math.trunc(child.placement.coordinates.y)
            : 0,
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
    const labelPrefix =
      typeof instance.properties.cellLabelPrefix === 'string'
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
        maxCapacity:
          typeof instance.properties.maxCapacity === 'number' ? instance.properties.maxCapacity : null,
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
        children: [...nextChildIds, ...preservedChildIds].map((childId) =>
          createComponentInstanceId(childId),
        ),
      },
    },
  });
}

export function syncAllGeneratedBoardChildren(project: EditorProject): EditorProject {
  return Object.keys(project.instances).reduce(
    (nextProject, instanceId) => syncGeneratedBoardChildren(nextProject, instanceId),
    project,
  );
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

  const resolvedTargetParentId =
    options.targetParentId !== undefined
      ? options.targetParentId
      : source.parentId
        ? String(source.parentId)
        : null;

  // Validate placement against the target parent's manifest so we don't paste
  // a token under a board that doesn't accept it, etc.
  const manifest = getBuiltInComponentManifest(source.componentType as BuiltInComponentType);
  const parentManifest = resolvedTargetParentId
    ? getBuiltInComponentManifest(
        project.instances[resolvedTargetParentId]?.componentType as BuiltInComponentType,
      )
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

    const clonedParentId =
      oldId === sourceInstanceId
        ? resolvedTargetParentId
          ? createComponentInstanceId(resolvedTargetParentId)
          : null
        : original.parentId && idRemap.has(String(original.parentId))
          ? createComponentInstanceId(idRemap.get(String(original.parentId)) as string)
          : original.parentId;

    nextInstances[newId] = {
      ...original,
      instanceId: createComponentInstanceId(newId),
      parentId: clonedParentId,
      children: original.children.map((childId) =>
        createComponentInstanceId(idRemap.get(String(childId)) ?? String(childId)),
      ),
      // Append a suffix so outline and inspector labels don't collide.
      displayName:
        oldId === sourceInstanceId && options.displayNameSuffix
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

        return [
          id,
          {
            ...current,
            children: current.children.filter((childId) => !removals.has(childId)),
          },
        ];
      }),
  );

  return touchProject({
    ...project,
    rootInstanceIds: project.rootInstanceIds.filter((id) => !removals.has(id)),
    instances: nextInstances,
  });
}

export function listValidParents(
  project: EditorProject,
  type: BuiltInComponentType,
): ComponentInstanceModel[] {
  const manifest = getBuiltInComponentManifest(type);

  if (manifest.role === 'top-level') {
    return [];
  }

  return Object.values(project.instances).filter((instance) => {
    const parentManifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
    return validateComponentPlacement(manifest, parentManifest).valid;
  });
}
