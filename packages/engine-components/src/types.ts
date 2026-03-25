import type {
  ComponentInstanceId,
  EntityId,
  PlayerId,
  ZoneId,
  Visibility,
} from '@turnbased/shared-types';
import type { z } from 'zod';

export type BuiltInComponentType =
  | 'board'
  | 'space'
  | 'track'
  | 'hex-grid'
  | 'square-grid'
  | 'checkerboard-grid'
  | 'zone'
  | 'resource-pile'
  | 'deck'
  | 'hand'
  | 'discard'
  | 'bag'
  | 'piece'
  | 'token'
  | 'counter'
  | 'score-track';

export type ComponentCategory = 'container' | 'collection' | 'entity' | 'counter';
export type ComponentSurface =
  | 'board'
  | 'space'
  | 'track'
  | 'zone'
  | 'collection'
  | 'entity'
  | 'counter';
export type ComponentLayout =
  | 'grid'
  | 'hex'
  | 'graph'
  | 'freeform'
  | 'linear'
  | 'circular'
  | 'branching'
  | 'stack'
  | 'fan'
  | 'pile';
export type ComponentOrientation = 'none' | 'horizontal' | 'vertical' | 'radial';
export type ComponentSelectionMode = 'none' | 'single' | 'multiple';
export type ComponentPrimaryAction =
  | 'select'
  | 'place'
  | 'move'
  | 'open'
  | 'draw'
  | 'inspect'
  | 'increment';
export type ComponentOccupancyMode = 'none' | 'single' | 'multiple' | 'stack' | 'slots' | 'track';
export type ComponentCompositionStrategy = 'leaf' | 'children' | 'referential';
export type ComponentPropertyKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'string_array'
  | 'number_array'
  | 'json';
export type BoardBorderStyle = 'solid' | 'dashed' | 'dotted' | 'double';
export type BoardSurfaceTextureId = 'none' | 'felt' | 'wood' | 'marble' | 'leather' | 'stone' | 'sand' | 'metal' | 'water' | 'grass';

export interface ComponentPropertyDefinition {
  kind: ComponentPropertyKind;
  label: string;
  description?: string;
  required?: boolean;
  options?: readonly string[];
}

export interface ComponentRenderHints {
  surface: ComponentSurface;
  layout: ComponentLayout;
  orientation: ComponentOrientation;
  showLabel: boolean;
  showCount: boolean;
  showOccupancy: boolean;
  showOwnership: boolean;
  showCapacity: boolean;
  supportsCoordinates: boolean;
}

export interface ComponentInteractionDefaults {
  selectionMode: ComponentSelectionMode;
  primaryAction: ComponentPrimaryAction;
  dragEnabled: boolean;
  dropEnabled: boolean;
  keyboardNavigable: boolean;
  highlightValidDestinations: boolean;
}

export interface ComponentVisibilityDefaults {
  zoneVisibility?: Visibility;
  contentsVisibility?: Visibility;
  ownerPrivate?: boolean;
  faceUpByDefault?: boolean;
}

export interface ComponentSlotDefinition {
  id: string;
  label: string;
  acceptsCategories: ComponentCategory[];
  acceptsTypes: string[];
  minChildren: number;
  maxChildren: number | null;
}

export interface ComponentComposition {
  strategy: ComponentCompositionStrategy;
  childSlots: ComponentSlotDefinition[];
}

export interface ComponentPlacementConstraints {
  requiresParent: boolean;
  allowedParentCategories: ComponentCategory[];
  allowedParentTypes: string[];
  allowedChildCategories: ComponentCategory[];
  allowedChildTypes: string[];
  minChildren: number;
  maxChildren: number | null;
}

export interface ComponentOccupancyRules {
  mode: ComponentOccupancyMode;
  capacity: number | null;
  occupantCategories: ComponentCategory[];
  occupantTypes: string[];
  allowMixedOccupants: boolean;
  allowSharedControl: boolean;
  perPlayerLimit: number | null;
}

export interface ComponentManifest<TProperties extends Record<string, unknown> = Record<string, unknown>> {
  type: string;
  category: ComponentCategory;
  displayName: string;
  description: string;
  propertyDefinitions: Record<string, ComponentPropertyDefinition>;
  propertiesSchema: z.ZodType<TProperties>;
  defaultProperties: TProperties;
  renderHints: ComponentRenderHints;
  interactionDefaults: ComponentInteractionDefaults;
  placementConstraints: ComponentPlacementConstraints;
  occupancyRules: ComponentOccupancyRules;
  visibilityDefaults: ComponentVisibilityDefaults;
  composition: ComponentComposition;
  tags: string[];
}

export interface ComponentPlacement {
  slotId?: string;
  index?: number;
  coordinates?: {
    x: number;
    y: number;
  };
  trackPosition?: number;
}

export interface ComponentBindings {
  zoneId?: ZoneId;
  entityIds?: EntityId[];
  ownerId?: PlayerId | null;
}

export interface ComponentFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  background: string | null;
  textureId?: BoardSurfaceTextureId | null;
  textureOpacity?: number;
  borderColor: string | null;
  borderWidth: number;
  borderRadius: number;
}

export interface BoardAppearanceProperties {
  surfaceColor: string;
  surfaceTexture: BoardSurfaceTextureId;
  surfaceTextureOpacity: number;
  surfaceBorderColor: string;
  surfaceBorderWidth: number;
  surfaceBorderStyle: BoardBorderStyle;
}

export interface GridCellCoordinate {
  x: number;
  y: number;
}

export interface GridCellStyle {
  background?: string | null;
  textureId?: BoardSurfaceTextureId | null;
  textureOpacity?: number;
  borderWidth?: number;
  borderRadius?: number;
}

export interface ComponentInstanceModel<TProperties extends Record<string, unknown> = Record<string, unknown>> {
  instanceId: ComponentInstanceId;
  componentType: string;
  category: ComponentCategory;
  displayName?: string;
  properties: TProperties;
  children: ComponentInstanceId[];
  parentId: ComponentInstanceId | null;
  placement: ComponentPlacement | null;
  bindings: ComponentBindings;
  frame?: ComponentFrame;
  renderOverrides?: Partial<ComponentRenderHints>;
  interactionOverrides?: Partial<ComponentInteractionDefaults>;
}

export interface ComponentCatalog {
  manifests: Record<string, ComponentManifest>;
}

export type BoardComponentPresetFamily = 'space' | 'track' | 'grid';

export interface BoardComponentPreset {
  id: string;
  family: BoardComponentPresetFamily;
  familyLabel: string;
  componentType: BuiltInComponentType;
  label: string;
  description: string;
  properties: Record<string, unknown>;
  frame: Partial<ComponentFrame>;
}

export interface CreateComponentInstanceOptions<TProperties extends Record<string, unknown>> {
  instanceId: ComponentInstanceId;
  displayName?: string;
  properties?: Partial<TProperties>;
  children?: ComponentInstanceId[];
  parentId?: ComponentInstanceId | null;
  placement?: ComponentPlacement | null;
  bindings?: ComponentBindings;
  frame?: ComponentFrame;
  renderOverrides?: Partial<ComponentRenderHints>;
  interactionOverrides?: Partial<ComponentInteractionDefaults>;
}

export interface ComponentValidationIssue {
  code:
    | 'unknown_component_type'
    | 'duplicate_component_type'
    | 'parent_required'
    | 'parent_forbidden'
    | 'parent_category_not_allowed'
    | 'parent_type_not_allowed'
    | 'child_category_not_allowed'
    | 'child_type_not_allowed'
    | 'max_children_exceeded'
    | 'min_children_not_met'
    | 'occupancy_capacity_exceeded'
    | 'occupancy_category_not_allowed'
    | 'occupancy_type_not_allowed'
    | 'occupancy_shared_control_not_allowed'
    | 'occupancy_mixed_types_not_allowed'
    | 'occupancy_per_player_limit_exceeded'
    | 'invalid_properties'
    | 'missing_parent'
    | 'missing_child';
  message: string;
  instanceId?: ComponentInstanceId;
  relatedInstanceId?: ComponentInstanceId;
}

export interface ComponentValidationResult {
  valid: boolean;
  issues: ComponentValidationIssue[];
}

export interface OccupancyValidationContext {
  occupantTypes: string[];
  occupantCategories: ComponentCategory[];
  occupantOwnerIds?: Array<PlayerId | null | undefined>;
}
