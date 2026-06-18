import type { EditorLengthUnit } from './types';
import { MM_PER_INCH } from './units';

const CATALOG_API_BASE = '/v1';

export interface CatalogProduct {
  id: string;
  slug: string;
  title: string;
  customTitle?: string;
  category: string;
  subcategory: string;
  shape?: string | null;
  currency: string;
  /**
   * Primary preview image captured during ingestion (`og:image`, falling back
   * to the main gallery image). An absolute URL to the supplier CDN, or `null`
   * if none was found. Rendered directly — the API does not proxy it.
   */
  imageUrl?: string | null;
}

export interface CatalogProductsResponse {
  items: CatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LayoutFace {
  id: string;
  faceKey: string;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safeZoneMm: number;
  dpi: number;
  panelCount?: number;
  cutlineRequired?: boolean;
}

export interface LayoutConstraints {
  panelCount: number;
  cutlineRequired: boolean;
}

export interface ProductLayoutResponse {
  productSlug: string;
  variantId: string;
  faces: LayoutFace[];
  constraints: LayoutConstraints;
}

export interface ProductVariant {
  id: string;
  title: string;
  isDefault?: boolean;
  options: { optionGroup: string; optionKey: string; optionValue: string }[];
  layoutConstraints: {
    faceKey: string;
    widthMm: number;
    heightMm: number;
    bleedMm: number;
    safeZoneMm: number;
    dpi: number;
    cutlineRequired: boolean;
  }[];
  priceTiers: { minQuantity: number; maxQuantity: number; unitPrice: number }[];
}

export interface ProductDetailResponse {
  id: string;
  slug: string;
  title: string;
  customTitle?: string;
  category: string;
  shape?: string | null;
  imageUrl?: string | null;
  productVariants: ProductVariant[];
}

/** A "size" option derived from a list of catalog products. */
export interface CatalogSizeOption {
  /** Product slug that represents this size. */
  slug: string;
  /** User-facing label (e.g. "18 × 18"). */
  label: string;
  /** Raw subcategory from the API (e.g. "18x18", "custom-size"). */
  subcategory: string;
  /** Whether this size represents a user-defined custom input. */
  isCustom: boolean;
}

/**
 * Human-friendly label for a subcategory encoding a product size. For
 * dimensional subcategories (e.g. "18x18") the label is rendered in the
 * user's preferred unit; shape-size tiles ("hexagon-large") stay textual.
 */
export function formatSizeLabel(
  subcategory: string,
  title: string | undefined,
  customTitle: string | undefined,
  unit: EditorLengthUnit,
): string {
  if (!subcategory) return customTitle || title || 'Unknown';
  if (subcategory === 'custom-size' || subcategory === 'custom') return 'Custom size…';
  const dims = subcategory.match(/^(\d+)x(\d+)$/);
  if (dims) {
    // The supplier encodes board dimensions in inches — convert if the user
    // prefers millimeters so all catalog labels share one unit system.
    const widthInches = Number(dims[1]);
    const heightInches = Number(dims[2]);
    if (unit === 'inches') return `${widthInches}″ × ${heightInches}″`;
    const toMm = (inches: number) => Math.round(inches * MM_PER_INCH);
    return `${toMm(widthInches)} × ${toMm(heightInches)} mm`;
  }
  // Shape-size tile style (e.g. "hexagon-large").
  const shapeSize = subcategory.match(/^([a-z]+)-([a-z]+)$/);
  if (shapeSize) {
    const [, , size] = shapeSize;
    return size.charAt(0).toUpperCase() + size.slice(1);
  }
  return customTitle || title || subcategory;
}

/**
 * Extract an ordered list of distinct size options from a product list.
 * Dedupes by subcategory; the first product for each subcategory wins.
 */
export function extractSizeOptions(
  products: CatalogProduct[],
  unit: EditorLengthUnit,
): CatalogSizeOption[] {
  const seen = new Map<string, CatalogSizeOption>();
  for (const product of products) {
    const key = product.subcategory || product.slug;
    if (seen.has(key)) continue;
    const isCustom = /custom/i.test(product.subcategory);
    seen.set(key, {
      slug: product.slug,
      label: formatSizeLabel(product.subcategory, product.title, product.customTitle, unit),
      subcategory: product.subcategory,
      isCustom,
    });
  }
  return Array.from(seen.values());
}

/**
 * Distinct shapes present in a product list. Products with a null or
 * empty shape are bucketed under `"rectangle"` — the standard card /
 * tile form factor.
 */
export function extractShapes(products: CatalogProduct[]): string[] {
  const shapes = new Set<string>();
  for (const product of products) {
    shapes.add(productShape(product));
  }
  return Array.from(shapes);
}

/** Returns the canonical shape for a product, defaulting nulls and squares to `"rectangle"`. */
export function productShape(product: CatalogProduct): string {
  const raw = product.shape || 'rectangle';
  return raw === 'square' ? 'rectangle' : raw;
}

/**
 * From a product-detail response, extract the distinct "deck size" values
 * across all variants (the `dro_choosesize` option from the supplier, which
 * the API exposes under the "Configuration" option group and whose
 * optionKey starts with `dro_choosesize`).
 */
export function extractDeckSizeOptions(detail: ProductDetailResponse | null): Array<{
  variantId: string;
  label: string;
}> {
  if (!detail) return [];
  const seen = new Map<string, { variantId: string; label: string }>();
  for (const variant of detail.productVariants) {
    const deckSizeOption = variant.options.find((o) => o.optionKey.startsWith('dro_choosesize'));
    if (!deckSizeOption) continue;
    const label = deckSizeOption.optionValue;
    if (seen.has(label)) continue;
    seen.set(label, { variantId: variant.id, label });
  }
  return Array.from(seen.values());
}

/* ------------------------------------------------------------------ */
/* Variant option extraction                                           */
/* ------------------------------------------------------------------ */

/** A single option group (e.g. "Material") with its available values. */
export interface VariantOptionGroup {
  group: string;
  values: string[];
}

/**
 * Extract the distinct option groups and their selectable values from a
 * product-detail response. Groups whose key starts with `dro_choosesize`
 * or `dro_choosepcs` are excluded — those are handled by the dedicated
 * deck-size / tile-count pickers.
 */
export function extractVariantOptionGroups(
  detail: ProductDetailResponse | null,
): VariantOptionGroup[] {
  if (!detail) return [];

  const groupMap = new Map<string, Set<string>>();
  const groupOrder: string[] = [];

  for (const variant of detail.productVariants) {
    for (const opt of variant.options) {
      // Skip size/count options — they have their own dedicated UI.
      if (opt.optionKey.startsWith('dro_choosesize') || opt.optionKey.startsWith('dro_choosepcs')) continue;
      if (!groupMap.has(opt.optionGroup)) {
        groupMap.set(opt.optionGroup, new Set());
        groupOrder.push(opt.optionGroup);
      }
      groupMap.get(opt.optionGroup)!.add(opt.optionValue);
    }
  }

  return groupOrder.map((group) => ({
    group,
    values: Array.from(groupMap.get(group)!),
  }));
}

/**
 * Given a set of user-selected option values (keyed by option group), find
 * the best-matching variant. Returns the first variant whose options are a
 * superset of the selections, or `null` if none match.
 */
export function findMatchingVariant(
  detail: ProductDetailResponse | null,
  selections: Record<string, string>,
): ProductVariant | null {
  if (!detail) return null;

  const entries = Object.entries(selections).filter(([, v]) => v !== '');
  if (entries.length === 0) return detail.productVariants[0] ?? null;

  return detail.productVariants.find((variant) =>
    entries.every(([group, value]) =>
      variant.options.some((o) => o.optionGroup === group && o.optionValue === value),
    ),
  ) ?? null;
}

/**
 * Format a price tier into a human-readable label.
 */
export function formatPriceTier(tier: { minQuantity: number; maxQuantity: number | null; unitPrice: number }): string {
  const qty = tier.maxQuantity == null
    ? `${tier.minQuantity}+`
    : tier.minQuantity === tier.maxQuantity
    ? `${tier.minQuantity}`
    : `${tier.minQuantity}–${tier.maxQuantity}`;
  return `${qty} units: $${tier.unitPrice.toFixed(2)} each`;
}

/**
 * Extract the number of cards from a deck-size label (e.g. "54 cards" → 54).
 * Returns null if the label doesn't contain a parseable card count.
 */
export function parseCardCount(label: string): number | null {
  const match = label.match(/(\d+)\s*(?:cards?|pcs?|pieces?)/i);
  if (match) return Number(match[1]);
  // Try plain number at start of string
  const plain = label.match(/^(\d+)/);
  return plain ? Number(plain[1]) : null;
}

/**
 * Extract the tiles-per-sheet count from variant options. The supplier
 * encodes this under the "Configuration" group with key `dro_choosepcs`.
 */
export function extractTileCountOptions(detail: ProductDetailResponse | null): Array<{
  variantId: string;
  label: string;
  count: number | null;
}> {
  if (!detail) return [];
  const seen = new Map<string, { variantId: string; label: string; count: number | null }>();
  for (const variant of detail.productVariants) {
    const opt = variant.options.find((o) => o.optionKey.startsWith('dro_choosepcs'));
    if (!opt) continue;
    const label = opt.optionValue;
    if (seen.has(label)) continue;
    const countMatch = label.match(/(\d+)/);
    seen.set(label, {
      variantId: variant.id,
      label,
      count: countMatch ? Number(countMatch[1]) : null,
    });
  }
  return Array.from(seen.values());
}

/**
 * Maps a component type to its corresponding catalog API category.
 */
export function getCatalogCategory(componentType: string): string | null {
  switch (componentType) {
    case 'board': return 'boards';
    case 'deck': return 'cards';
    case 'tile': return 'tiles';
    default: return null;
  }
}

export async function fetchCatalogProducts(category: string): Promise<CatalogProduct[]> {
  const url = `${CATALOG_API_BASE}/products?category=${encodeURIComponent(category)}&pageSize=50`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Catalog API error: ${response.status}`);
  }
  const data: CatalogProductsResponse = await response.json();
  return data.items;
}

export async function fetchProductLayout(slug: string, variantId?: string): Promise<ProductLayoutResponse> {
  const params = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
  const url = `${CATALOG_API_BASE}/products/${encodeURIComponent(slug)}/layout${params}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Catalog layout API error: ${response.status}`);
  }
  const data = await response.json();
  // Normalize numeric fields — the API may return them as strings.
  data.faces = (data.faces ?? []).map((face: Record<string, unknown>) => ({
    ...face,
    widthMm: Number(face.widthMm),
    heightMm: Number(face.heightMm),
    bleedMm: Number(face.bleedMm),
    safeZoneMm: Number(face.safeZoneMm),
    dpi: Number(face.dpi),
  }));
  return data;
}

export async function fetchProductDetail(slug: string): Promise<ProductDetailResponse> {
  const url = `${CATALOG_API_BASE}/products/${encodeURIComponent(slug)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Catalog detail API error: ${response.status}`);
  }
  return response.json();
}
