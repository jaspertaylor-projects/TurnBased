import { Visibility } from '@turnbased/shared-types';
import { z } from 'zod';

export const builtInComponentTypeSchema = z.enum([
  'board',
  'card',
  'space',
  'track',
  'text-box',
  'image-area',
  'network',
  'hex-grid',
  'square-grid',
  'checkerboard-grid',
  'zone',
  'deck',
  'hand',
  'discard',
  'bag',
  'piece',
  'token',
  'counter',
  'score-track',
  'tile',
]);

export const structuralRoleSchema = z.enum(['top-level', 'sub-component', 'leaf']);
export const componentAuthoringDiscoverabilitySchema = z.enum(['primary', 'hidden']);
export const componentCategorySchema = z.enum(['container', 'collection', 'entity', 'counter']);
export const componentSurfaceSchema = z.enum([
  'board',
  'space',
  'track',
  'zone',
  'collection',
  'entity',
  'counter',
]);
export const componentLayoutSchema = z.enum([
  'grid',
  'hex',
  'graph',
  'freeform',
  'linear',
  'circular',
  'branching',
  'stack',
  'fan',
  'pile',
]);
export const componentOrientationSchema = z.enum(['none', 'horizontal', 'vertical', 'radial']);
export const componentSelectionModeSchema = z.enum(['none', 'single', 'multiple']);
export const componentPrimaryActionSchema = z.enum([
  'select',
  'place',
  'move',
  'open',
  'draw',
  'inspect',
  'increment',
]);
export const componentOccupancyModeSchema = z.enum([
  'none',
  'single',
  'multiple',
  'stack',
  'slots',
  'track',
]);
export const componentCompositionStrategySchema = z.enum(['leaf', 'children', 'referential']);
export const componentPropertyKindSchema = z.enum([
  'string',
  'number',
  'boolean',
  'enum',
  'string_array',
  'number_array',
  'json',
]);

export const componentPropertyDefinitionSchema = z.object({
  kind: componentPropertyKindSchema,
  label: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1)).optional(),
});

export const componentAuthoringMetadataSchema = z.object({
  discoverability: componentAuthoringDiscoverabilitySchema,
});

export const componentRenderHintsSchema = z.object({
  surface: componentSurfaceSchema,
  layout: componentLayoutSchema,
  orientation: componentOrientationSchema,
  showLabel: z.boolean(),
  showCount: z.boolean(),
  showOccupancy: z.boolean(),
  showOwnership: z.boolean(),
  showCapacity: z.boolean(),
  supportsCoordinates: z.boolean(),
});

export const componentInteractionDefaultsSchema = z.object({
  selectionMode: componentSelectionModeSchema,
  primaryAction: componentPrimaryActionSchema,
  dragEnabled: z.boolean(),
  dropEnabled: z.boolean(),
  keyboardNavigable: z.boolean(),
  highlightValidDestinations: z.boolean(),
});

export const componentVisibilityDefaultsSchema = z.object({
  zoneVisibility: z.nativeEnum(Visibility).optional(),
  contentsVisibility: z.nativeEnum(Visibility).optional(),
  ownerPrivate: z.boolean().optional(),
  faceUpByDefault: z.boolean().optional(),
});

export const componentSlotDefinitionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  acceptsRoles: z.array(structuralRoleSchema),
  acceptsTypes: z.array(z.string().trim().min(1)),
  minChildren: z.number().int().nonnegative(),
  maxChildren: z.number().int().positive().nullable(),
});

export const componentCompositionSchema = z.object({
  strategy: componentCompositionStrategySchema,
  childSlots: z.array(componentSlotDefinitionSchema),
});

export const componentPlacementConstraintsSchema = z.object({
  requiresParent: z.boolean(),
  allowedParentRoles: z.array(structuralRoleSchema),
  allowedParentTypes: z.array(z.string().trim().min(1)),
  allowedChildRoles: z.array(structuralRoleSchema),
  allowedChildTypes: z.array(z.string().trim().min(1)),
  minChildren: z.number().int().nonnegative(),
  maxChildren: z.number().int().nonnegative().nullable(),
});

export const componentOccupancyRulesSchema = z.object({
  mode: componentOccupancyModeSchema,
  capacity: z.number().int().nonnegative().nullable(),
  occupantRoles: z.array(structuralRoleSchema),
  occupantTypes: z.array(z.string().trim().min(1)),
  allowMixedOccupants: z.boolean(),
  allowSharedControl: z.boolean(),
  perPlayerLimit: z.number().int().positive().nullable(),
});

export const zodSchemaSchema = z.custom<z.ZodTypeAny>(
  (value) => value instanceof z.ZodType,
  'Expected a zod schema.',
);

export const componentManifestSchema = z.object({
  type: z.string().trim().min(1),
  category: componentCategorySchema,
  role: structuralRoleSchema,
  authoring: componentAuthoringMetadataSchema,
  displayName: z.string().trim().min(1),
  description: z.string().trim().min(1),
  propertyDefinitions: z.record(z.string(), componentPropertyDefinitionSchema),
  propertiesSchema: zodSchemaSchema,
  defaultProperties: z.record(z.string(), z.unknown()),
  renderHints: componentRenderHintsSchema,
  interactionDefaults: componentInteractionDefaultsSchema,
  placementConstraints: componentPlacementConstraintsSchema,
  occupancyRules: componentOccupancyRulesSchema,
  visibilityDefaults: componentVisibilityDefaultsSchema,
  composition: componentCompositionSchema,
  tags: z.array(z.string().trim().min(1)),
});

export const componentPlacementSchema = z.object({
  slotId: z.string().trim().min(1).optional(),
  index: z.number().int().nonnegative().optional(),
  coordinates: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  trackPosition: z.number().int().nonnegative().optional(),
});

export const componentBindingsSchema = z.object({
  zoneId: z.string().trim().min(1).optional(),
  entityIds: z.array(z.string().trim().min(1)).optional(),
  ownerId: z.string().trim().min(1).nullable().optional(),
});

export const componentFrameSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  background: z.string().trim().min(1).nullable(),
  textureId: z.enum(['none', 'felt', 'wood', 'marble', 'leather', 'stone', 'sand', 'metal', 'water', 'grass']).nullable().optional(),
  textureOpacity: z.number().min(0).max(1).optional(),
  borderColor: z.string().trim().min(1).nullable(),
  borderWidth: z.number().nonnegative(),
  borderRadius: z.number().nonnegative(),
});

export const componentInstanceSchema = z.object({
  instanceId: z.string().trim().min(1),
  componentType: z.string().trim().min(1),
  category: componentCategorySchema,
  role: structuralRoleSchema,
  displayName: z.string().trim().min(1).optional(),
  notes: z.string().optional(),
  properties: z.record(z.string(), z.unknown()),
  children: z.array(z.string().trim().min(1)),
  parentId: z.string().trim().min(1).nullable(),
  placement: componentPlacementSchema.nullable(),
  bindings: componentBindingsSchema,
  frame: componentFrameSchema.optional(),
  renderOverrides: componentRenderHintsSchema.partial().optional(),
  interactionOverrides: componentInteractionDefaultsSchema.partial().optional(),
});
