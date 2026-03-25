import type { ComponentInstanceId } from '@turnbased/shared-types';

import { builtInComponentCatalog } from './catalog';
import { componentInstanceSchema, componentManifestSchema } from './schemas';
import type {
  BuiltInComponentType,
  ComponentCatalog,
  ComponentInstanceModel,
  ComponentManifest,
  ComponentValidationIssue,
  ComponentValidationResult,
  CreateComponentInstanceOptions,
  OccupancyValidationContext,
} from './types';

function hasRestrictions(values: string[] | readonly string[]): boolean {
  return values.length > 0;
}

function pushIssue(
  issues: ComponentValidationIssue[],
  issue: ComponentValidationIssue,
): void {
  issues.push(issue);
}

export function createComponentCatalog(manifests: ComponentManifest[]): ComponentCatalog {
  const registry: Record<string, ComponentManifest> = {};
  const issues: ComponentValidationIssue[] = [];

  for (const manifest of manifests) {
    const parsedManifest = componentManifestSchema.parse(manifest);
    manifest.propertiesSchema.parse(manifest.defaultProperties);

    if (registry[parsedManifest.type]) {
      pushIssue(issues, {
        code: 'duplicate_component_type',
        message: `Component type "${parsedManifest.type}" is defined more than once.`,
      });
      continue;
    }

    registry[parsedManifest.type] = manifest;
  }

  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(' '));
  }

  return { manifests: registry };
}

export function getBuiltInComponentManifest(type: BuiltInComponentType): ComponentManifest {
  return builtInComponentCatalog[type];
}

export function listBuiltInComponents(category?: ComponentManifest['category']): ComponentManifest[] {
  const manifests = Object.values(builtInComponentCatalog);
  if (!category) {
    return manifests;
  }

  return manifests.filter((manifest) => manifest.category === category);
}

export function createComponentInstance<TProperties extends Record<string, unknown>>(
  manifest: ComponentManifest<TProperties>,
  options: CreateComponentInstanceOptions<TProperties>,
): ComponentInstanceModel<TProperties> {
  const mergedProperties = {
    ...manifest.defaultProperties,
    ...(options.properties ?? {}),
  } as TProperties;

  manifest.propertiesSchema.parse(mergedProperties);

  const instance: ComponentInstanceModel<TProperties> = {
    instanceId: options.instanceId,
    componentType: manifest.type,
    category: manifest.category,
    displayName: options.displayName,
    properties: mergedProperties,
    children: options.children ?? [],
    parentId: options.parentId ?? null,
    placement: options.placement ?? null,
    bindings: options.bindings ?? {},
    frame: options.frame,
    renderOverrides: options.renderOverrides,
    interactionOverrides: options.interactionOverrides,
  };

  componentInstanceSchema.parse(instance);

  return instance;
}

export function validateComponentPlacement(
  childManifest: ComponentManifest,
  parentManifest?: ComponentManifest | null,
): ComponentValidationResult {
  const issues: ComponentValidationIssue[] = [];

  if (!parentManifest) {
    if (childManifest.placementConstraints.requiresParent) {
      pushIssue(issues, {
        code: 'parent_required',
        message: `${childManifest.type} requires a parent component.`,
      });
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  if (
    hasRestrictions(childManifest.placementConstraints.allowedParentCategories) &&
    !childManifest.placementConstraints.allowedParentCategories.includes(parentManifest.category)
  ) {
    pushIssue(issues, {
      code: 'parent_category_not_allowed',
      message: `${childManifest.type} cannot be placed inside category ${parentManifest.category}.`,
    });
  }

  if (
    hasRestrictions(childManifest.placementConstraints.allowedParentTypes) &&
    !childManifest.placementConstraints.allowedParentTypes.includes(parentManifest.type)
  ) {
    pushIssue(issues, {
      code: 'parent_type_not_allowed',
      message: `${childManifest.type} cannot be placed inside ${parentManifest.type}.`,
    });
  }

  if (
    hasRestrictions(parentManifest.placementConstraints.allowedChildCategories) &&
    !parentManifest.placementConstraints.allowedChildCategories.includes(childManifest.category)
  ) {
    pushIssue(issues, {
      code: 'child_category_not_allowed',
      message: `${parentManifest.type} cannot contain category ${childManifest.category}.`,
    });
  }

  if (
    hasRestrictions(parentManifest.placementConstraints.allowedChildTypes) &&
    !parentManifest.placementConstraints.allowedChildTypes.includes(childManifest.type)
  ) {
    pushIssue(issues, {
      code: 'child_type_not_allowed',
      message: `${parentManifest.type} cannot contain type ${childManifest.type}.`,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateComponentOccupancy(
  containerManifest: ComponentManifest,
  context: OccupancyValidationContext,
): ComponentValidationResult & { remainingCapacity: number | null } {
  const issues: ComponentValidationIssue[] = [];
  const { occupantTypes, occupantCategories, occupantOwnerIds = [] } = context;
  const rules = containerManifest.occupancyRules;

  if (rules.mode === 'none' && occupantTypes.length > 0) {
    pushIssue(issues, {
      code: 'occupancy_capacity_exceeded',
      message: `${containerManifest.type} does not support occupants.`,
    });
  }

  if (rules.capacity !== null && occupantTypes.length > rules.capacity) {
    pushIssue(issues, {
      code: 'occupancy_capacity_exceeded',
      message: `${containerManifest.type} supports at most ${rules.capacity} occupants.`,
    });
  }

  for (const category of occupantCategories) {
    if (
      hasRestrictions(rules.occupantCategories) &&
      !rules.occupantCategories.includes(category)
    ) {
      pushIssue(issues, {
        code: 'occupancy_category_not_allowed',
        message: `${containerManifest.type} cannot contain occupant category ${category}.`,
      });
    }
  }

  for (const type of occupantTypes) {
    if (hasRestrictions(rules.occupantTypes) && !rules.occupantTypes.includes(type)) {
      pushIssue(issues, {
        code: 'occupancy_type_not_allowed',
        message: `${containerManifest.type} cannot contain occupant type ${type}.`,
      });
    }
  }

  if (!rules.allowMixedOccupants && new Set(occupantTypes).size > 1) {
    pushIssue(issues, {
      code: 'occupancy_mixed_types_not_allowed',
      message: `${containerManifest.type} does not allow mixed occupant types.`,
    });
  }

  if (!rules.allowSharedControl && occupantOwnerIds.filter(Boolean).length > 1) {
    pushIssue(issues, {
      code: 'occupancy_shared_control_not_allowed',
      message: `${containerManifest.type} does not allow occupants from multiple owners.`,
    });
  }

  if (rules.perPlayerLimit !== null) {
    const counts = new Map<string, number>();

    for (const ownerId of occupantOwnerIds) {
      if (!ownerId) {
        continue;
      }

      counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
    }

    for (const [ownerId, count] of counts.entries()) {
      if (count > rules.perPlayerLimit) {
        pushIssue(issues, {
          code: 'occupancy_per_player_limit_exceeded',
          message: `${containerManifest.type} allows at most ${rules.perPlayerLimit} occupant(s) for owner ${ownerId}.`,
        });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    remainingCapacity:
      rules.capacity === null ? null : Math.max(rules.capacity - occupantTypes.length, 0),
  };
}

export function validateComponentTree(
  instances: Record<string, ComponentInstanceModel>,
  catalog: ComponentCatalog,
): ComponentValidationResult {
  const issues: ComponentValidationIssue[] = [];

  for (const instance of Object.values(instances)) {
    const manifest = catalog.manifests[instance.componentType];

    if (!manifest) {
      pushIssue(issues, {
        code: 'unknown_component_type',
        message: `Unknown component type "${instance.componentType}".`,
        instanceId: instance.instanceId,
      });
      continue;
    }

    try {
      manifest.propertiesSchema.parse(instance.properties);
    } catch {
      pushIssue(issues, {
        code: 'invalid_properties',
        message: `${instance.componentType} instance has invalid properties.`,
        instanceId: instance.instanceId,
      });
    }

    if (instance.parentId) {
      const parent = instances[instance.parentId];

      if (!parent) {
        pushIssue(issues, {
          code: 'missing_parent',
          message: `Parent ${instance.parentId} for ${instance.instanceId} was not found.`,
          instanceId: instance.instanceId,
          relatedInstanceId: instance.parentId,
        });
      } else {
        const parentManifest = catalog.manifests[parent.componentType];
        const placementResult = validateComponentPlacement(manifest, parentManifest);

        for (const placementIssue of placementResult.issues) {
          pushIssue(issues, {
            ...placementIssue,
            instanceId: instance.instanceId,
            relatedInstanceId: parent.instanceId,
          });
        }
      }
    } else if (manifest.placementConstraints.requiresParent) {
      pushIssue(issues, {
        code: 'parent_required',
        message: `${instance.componentType} instance ${instance.instanceId} requires a parent.`,
        instanceId: instance.instanceId,
      });
    }

    for (const childId of instance.children) {
      if (!instances[childId]) {
        pushIssue(issues, {
          code: 'missing_child',
          message: `Child ${childId} for ${instance.instanceId} was not found.`,
          instanceId: instance.instanceId,
          relatedInstanceId: childId as ComponentInstanceId,
        });
      }
    }
  }

  for (const instance of Object.values(instances)) {
    const manifest = catalog.manifests[instance.componentType];

    if (!manifest) {
      continue;
    }

    const childInstances = instance.children
      .map((childId) => instances[childId])
      .filter((child): child is ComponentInstanceModel => Boolean(child));

    if (
      manifest.placementConstraints.maxChildren !== null &&
      childInstances.length > manifest.placementConstraints.maxChildren
    ) {
      pushIssue(issues, {
        code: 'max_children_exceeded',
        message: `${instance.componentType} supports at most ${manifest.placementConstraints.maxChildren} children.`,
        instanceId: instance.instanceId,
      });
    }

    if (childInstances.length < manifest.placementConstraints.minChildren) {
      pushIssue(issues, {
        code: 'min_children_not_met',
        message: `${instance.componentType} requires at least ${manifest.placementConstraints.minChildren} children.`,
        instanceId: instance.instanceId,
      });
    }

    const occupancyResult = validateComponentOccupancy(manifest, {
      occupantTypes: childInstances.map((child) => child.componentType),
      occupantCategories: childInstances.map((child) => child.category),
      occupantOwnerIds: childInstances.map((child) => child.bindings.ownerId),
    });

    for (const occupancyIssue of occupancyResult.issues) {
      pushIssue(issues, {
        ...occupancyIssue,
        instanceId: instance.instanceId,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export const builtInCatalog = createComponentCatalog(Object.values(builtInComponentCatalog));
