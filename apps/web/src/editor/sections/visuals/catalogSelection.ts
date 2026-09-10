import type { CSSProperties } from 'react';

/**
 * The catalog tie for a board/tile/deck — the subset of component properties
 * that pin it to a specific supplier product + variant (thing + size + finish).
 * Shared so the component editor and the rulebook drive the exact same
 * thing → size → finish selectors.
 */
export interface CatalogSelection {
  catalogSlug: string;
  catalogVariantId: string;
  shape: string;
  physicalWidthMm: number | null;
  physicalHeightMm: number | null;
}

/** Per-context field styling so the same selectors fit the tabletop inspector
 *  or the cozy serif rulebook modal. */
export interface CatalogSelectorStyles {
  label: CSSProperties;
  input: CSSProperties;
}

export type SelectionUpdater = (updater: (selection: CatalogSelection) => CatalogSelection) => void;

export function selectionFromProperties(properties: Record<string, unknown>): CatalogSelection {
  return {
    catalogSlug: typeof properties.catalogSlug === 'string' ? properties.catalogSlug : '',
    catalogVariantId: typeof properties.catalogVariantId === 'string' ? properties.catalogVariantId : '',
    shape: typeof properties.shape === 'string' ? properties.shape : '',
    physicalWidthMm: typeof properties.physicalWidthMm === 'number' ? properties.physicalWidthMm : null,
    physicalHeightMm: typeof properties.physicalHeightMm === 'number' ? properties.physicalHeightMm : null,
  };
}
