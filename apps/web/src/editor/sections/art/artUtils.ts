import { generateId } from '@turnbased/shared-utils';

import { createProjectPaletteReference, resolveProjectPaletteColorValue } from '../../projectPalette';
import type { EditorArtReference, EditorIconAsset, EditorProject } from '../../types';

export const INVISIBLE_ICON_FILL = 'rgba(0,0,0,0)';

export function parseTagList(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function formatTagList(tags: readonly string[]): string {
  return tags.join(', ');
}

export function addReferenceAsset(
  items: readonly EditorArtReference[],
  defaults: Partial<EditorArtReference> = {},
): EditorArtReference[] {
  return [...items, {
    id: generateId('art_ref'),
    name: '',
    category: '',
    description: '',
    tags: [],
    ...defaults,
  }];
}

export function addIconAsset(items: readonly EditorIconAsset[]): EditorIconAsset[] {
  return [...items, {
    id: generateId('art_icon'),
    mode: 'library',
    name: 'Shield',
    iconKey: 'shield',
    iconColor: createProjectPaletteReference('primary'),
    iconFillColor: INVISIBLE_ICON_FILL,
    iconStrokeWidth: 1,
    iconScale: 1,
    backgroundColor: 'rgba(255,255,255,0.94)',
    backgroundTextureId: 'none',
    backgroundTextureOpacity: 0.35,
    borderColor: createProjectPaletteReference('secondary'),
    borderWidth: 1,
    borderRadius: 20,
    customSvgMarkup: '',
    inlineCode: ':shield:',
    description: '',
    tags: [],
  }];
}

export function formatInlineCodeFromIconKey(iconKey: string): string {
  return `:${iconKey}:`;
}

export function resolveEditorColor(project: EditorProject, value: string): string {
  return resolveProjectPaletteColorValue(project.settings.colorPalette, value) ?? value;
}

export function clampNonNegativeNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}
