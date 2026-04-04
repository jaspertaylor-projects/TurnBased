import { z } from 'zod';

import type { BuiltInComponentType } from './types';

export type ComponentManifestDefinition = Omit<import('./types').ComponentManifest, 'authoring'>;

export const countSchema = z.number().int().nonnegative().nullable();
export const boardSurfaceTextureIdSchema = z.enum(['none', 'felt', 'water', 'grass', 'wood', 'marble', 'leather', 'stone', 'sand', 'metal']);
export const primaryComponentTypes = new Set<BuiltInComponentType>([
  'board',
  'deck',
  'piece',
  'token',
  'space',
  'track',
  'hex-grid',
  'square-grid',
  'network',
  'card',
  'text-box',
  'image-area',
]);

export const gridCellAppearancePropertyDefinitions = {
  cellBackground: { kind: 'string', label: 'Cell Background' },
  cellTextureId: { kind: 'enum', label: 'Cell Texture', options: boardSurfaceTextureIdSchema.options },
  cellTextureOpacity: { kind: 'number', label: 'Cell Texture Opacity' },
  cellBorderColor: { kind: 'string', label: 'Cell Border Color' },
  cellBorderWidth: { kind: 'number', label: 'Cell Border Width' },
  cellBorderRadius: { kind: 'number', label: 'Cell Border Radius' },
} as const;

export function createGridCellAppearanceSchema(defaultBorderWidth: number, defaultBorderRadius: number) {
  return {
    cellBackground: z.string().trim().min(1).nullable().default(null),
    cellTextureId: boardSurfaceTextureIdSchema.default('none'),
    cellTextureOpacity: z.number().min(0).max(1).default(0.3),
    cellBorderColor: z.string().trim().min(1).nullable().default(null),
    cellBorderWidth: z.number().nonnegative().default(defaultBorderWidth),
    cellBorderRadius: z.number().nonnegative().default(defaultBorderRadius),
  };
}

export function createGridCellAppearanceDefaults(defaultBorderWidth: number, defaultBorderRadius: number) {
  return {
    cellBackground: null,
    cellTextureId: 'none' as const,
    cellTextureOpacity: 0.3,
    cellBorderColor: null,
    cellBorderWidth: defaultBorderWidth,
    cellBorderRadius: defaultBorderRadius,
  };
}

export const defaultContainerRenderHints = {
  showLabel: true,
  showCount: false,
  showOccupancy: true,
  showOwnership: false,
  showCapacity: true,
  supportsCoordinates: true,
} as const;

export const defaultEntityRenderHints = {
  showLabel: true,
  showCount: false,
  showOccupancy: false,
  showOwnership: true,
  showCapacity: false,
  supportsCoordinates: false,
} as const;

export const defaultCollectionRenderHints = {
  showLabel: true,
  showCount: true,
  showOccupancy: false,
  showOwnership: true,
  showCapacity: true,
  supportsCoordinates: false,
} as const;

export const defaultCounterRenderHints = {
  showLabel: true,
  showCount: true,
  showOccupancy: false,
  showOwnership: true,
  showCapacity: true,
  supportsCoordinates: false,
} as const;
