import { Check, Loader2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  extractDeckSizeOptions,
  extractShapes,
  extractSites,
  extractSizeOptions,
  extractTileCountOptions,
  extractVariantOptionGroups,
  findMatchingVariant,
  formatPriceTier,
  getCatalogCategory,
  parseCardCount,
  productShape,
  type CatalogProduct,
  type CatalogSite,
  type ProductDetailResponse,
  type ProductVariant,
} from '../../supplierCatalog';
import { tabletopField, tabletopLabel } from '../../theme/tabletop';
import type { EditorLengthUnit } from '../../types';
import {
  getCachedLayout,
  useCatalogLayout,
  useCatalogProductDetail,
  useCatalogProducts,
} from '../../useSupplierCatalog';

import type { CatalogSelection, CatalogSelectorStyles, SelectionUpdater } from './catalogSelection';
export type { CatalogSelection, CatalogSelectorStyles } from './catalogSelection';
import { CatalogPreviewImage } from './CatalogPreviewImage';
import { infoBadgeStyle, priceBadgeStyle, sectionDividerStyle, groupTitleStyle, catalogErrorStyle } from './catalogSelectorStyles';

const DEFAULT_STYLES: CatalogSelectorStyles = {
  label: tabletopLabel,
  input: { ...tabletopField, padding: '0.58rem 0.68rem', fontSize: '0.86rem' },
};

const SHAPE_LABELS: Record<string, string> = {
  rectangle: 'Rectangle',
  circle: 'Circle',
  hexagon: 'Hexagon',
  triangle: 'Triangle',
};

function formatShapeLabel(shape: string): string {
  return SHAPE_LABELS[shape] ?? (shape.charAt(0).toUpperCase() + shape.slice(1));
}

/** Applies layout dimensions (and variant id) from the cached layout. */
function applyLayoutFromCache(
  slug: string,
  onChange: SelectionUpdater,
  extra: Partial<CatalogSelection> = {},
) {
  const cached = slug ? getCachedLayout(slug) : null;
  const face = cached?.faces[0] ?? null;

  onChange((selection) => ({
    ...selection,
    catalogSlug: slug,
    catalogVariantId: face ? (cached!.variantId ?? '') : '',
    ...(face ? { physicalWidthMm: Number(face.widthMm), physicalHeightMm: Number(face.heightMm) } : {}),
    ...extra,
  }));
}

/** Applies layout dimensions asynchronously once a layout fetch completes. */
function useApplyLayoutWhenFetched(slug: string, onChange: SelectionUpdater) {
  const { layout } = useCatalogLayout(slug || null);
  const appliedSlugRef = useRef(slug);

  useEffect(() => {
    if (!slug) {
      appliedSlugRef.current = '';
      return;
    }
    if (!layout || layout.faces.length === 0) return;
    if (layout.productSlug !== slug) return;
    if (appliedSlugRef.current === slug) return;

    appliedSlugRef.current = slug;
    const face = layout.faces[0];
    onChange((selection) => ({
      ...selection,
      physicalWidthMm: Number(face.widthMm),
      physicalHeightMm: Number(face.heightMm),
      catalogVariantId: layout.variantId ?? '',
    }));
  }, [layout, slug, onChange]);
}

/* ------------------------------------------------------------------ */
/* Shared sub-components                                               */
/* ------------------------------------------------------------------ */

interface VariantOptionsPanelProps {
  detail: ProductDetailResponse | null;
  loading: boolean;
  selection: CatalogSelection;
  onChange: SelectionUpdater;
  excludeGroups?: string[];
  styles: CatalogSelectorStyles;
}

function VariantOptionsPanel(props: VariantOptionsPanelProps) {
  const variant = props.detail?.productVariants.find((entry) => entry.id === props.selection.catalogVariantId);
  // Reset draft option choices when a different variant is selected or its
  // asynchronous detail first arrives; partial unmatched choices stay local.
  const key = `${props.selection.catalogSlug}:${props.selection.catalogVariantId}:${variant ? 'ready' : 'pending'}`;
  return <VariantOptionsEditor key={key} {...props} />;
}

function VariantOptionsEditor({ detail, loading, selection, onChange, excludeGroups, styles }: VariantOptionsPanelProps) {
  const allGroups = useMemo(() => extractVariantOptionGroups(detail), [detail]);
  const optionGroups = useMemo(
    () => (excludeGroups ? allGroups.filter((g) => !excludeGroups.includes(g.group)) : allGroups),
    [allGroups, excludeGroups],
  );

  const currentVariantId = selection.catalogVariantId;
  const currentVariant = detail?.productVariants.find((v) => v.id === currentVariantId) ?? null;

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    if (!currentVariant) return {};
    const init: Record<string, string> = {};
    for (const opt of currentVariant.options) {
      if (opt.optionKey.startsWith('dro_choosesize') || opt.optionKey.startsWith('dro_choosepcs')) continue;
      init[opt.optionGroup] = opt.optionValue;
    }
    return init;
  });

  function handleOptionChange(group: string, value: string) {
    const next = { ...selections, [group]: value };
    setSelections(next);
    const match = findMatchingVariant(detail, next);
    if (match) {
      onChange((s) => ({ ...s, catalogVariantId: match.id }));
    }
  }

  if (optionGroups.length === 0) return null;

  return (
    <div data-layout="variantOptionsPanel" /* material / finish / config selectors */ style={sectionDividerStyle}>
      <div style={groupTitleStyle}>Finish &amp; Material</div>
      {optionGroups.map((og) => (
        <label key={og.group} style={{ ...styles.label, marginBottom: '0.45rem' }}>
          {og.group}
          <select
            value={selections[og.group] ?? ''}
            onChange={(e) => handleOptionChange(og.group, e.target.value)}
            style={styles.input}
            disabled={loading}
          >
            <option value="">Select {og.group.toLowerCase()}...</option>
            {og.values.map((val) => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function PricingPanel({ variant }: { variant: ProductVariant | null }) {
  if (!variant || variant.priceTiers.length === 0) return null;
  const firstTier = variant.priceTiers[0];
  return (
    <div data-layout="pricingPanel" style={sectionDividerStyle}>
      <div style={groupTitleStyle}>Pricing</div>
      <div data-layout="pricingSummary" style={{ marginBottom: '0.35rem' }}>
        <span style={priceBadgeStyle}>${firstTier.unitPrice.toFixed(2)} / unit</span>
      </div>
      {variant.priceTiers.length > 1 ? (
        <details style={{ fontSize: '0.76rem', color: '#374151' }}>
          <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '0.72rem', userSelect: 'none' }}>
            Bulk discount
          </summary>
          <div data-layout="priceTierList" style={{ display: 'grid', gap: '0.15rem', marginTop: '0.3rem', paddingLeft: '0.2rem' }}>
            {variant.priceTiers.map((tier, i) => (
              <div key={i} style={{ fontSize: '0.74rem', color: '#374151' }}>{formatPriceTier(tier)}</div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function CountBadge({ count, unit }: { count: number | null; unit: string }) {
  if (count == null) return null;
  return <span style={infoBadgeStyle}>{count} {unit}{count !== 1 ? 's' : ''}</span>;
}

function Spinner() {
  return <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />;
}

/* ------------------------------------------------------------------ */
/* Tile: Shape → Size → Tiles per Sheet → Finish                       */
/* ------------------------------------------------------------------ */

interface PickerProps {
  selection: CatalogSelection;
  preferredUnits: EditorLengthUnit;
  onChange: SelectionUpdater;
  styles: CatalogSelectorStyles;
  // Products are fetched once by CatalogSelector and pre-filtered by the active
  // site selection before being handed to whichever picker is showing.
  products: CatalogProduct[];
  loading: boolean;
  error: string | null;
}

function TilePicker({ selection, preferredUnits, onChange, styles, products, loading, error }: PickerProps) {
  const { catalogSlug: currentSlug, catalogVariantId: currentVariantId, shape: currentShape } = selection;

  const shapes = useMemo(() => extractShapes(products), [products]);
  useApplyLayoutWhenFetched(currentSlug, onChange);

  const productsForShape = useMemo<CatalogProduct[]>(
    () => (currentShape ? products.filter((p) => productShape(p) === currentShape) : []),
    [products, currentShape],
  );
  const sizeOptions = useMemo(() => extractSizeOptions(productsForShape, preferredUnits), [productsForShape, preferredUnits]);

  const { detail, loading: detailLoading } = useCatalogProductDetail(currentSlug || null);
  const tileCountOptions = useMemo(() => extractTileCountOptions(detail), [detail]);
  const selectedProduct = products.find((p) => p.slug === currentSlug) ?? null;
  const selectedVariant = detail?.productVariants.find((v) => v.id === currentVariantId) ?? null;
  const selectedTileCount = useMemo(() => tileCountOptions.find((o) => o.variantId === currentVariantId)?.count ?? null, [tileCountOptions, currentVariantId]);

  return (
    <div data-layout="tileCatalogPicker">
      {error ? <div style={catalogErrorStyle}>Could not reach catalog API. Make sure the server is running on port 3100.</div> : null}
      <label style={styles.label}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Shape {loading ? <Spinner /> : null}</span>
        <select
          value={currentShape}
          onChange={(e) => onChange((s) => ({ ...s, shape: e.target.value, catalogSlug: '', catalogVariantId: '' }))}
          style={styles.input}
          disabled={loading || shapes.length === 0}
        >
          <option value="">Select a shape...</option>
          {shapes.map((shape) => <option key={shape} value={shape}>{formatShapeLabel(shape)}</option>)}
        </select>
      </label>

      {currentShape ? (
        <label style={styles.label}>
          Size
          <select value={currentSlug} onChange={(e) => applyLayoutFromCache(e.target.value, onChange)} style={styles.input} disabled={sizeOptions.length === 0}>
            <option value="">Select a size...</option>
            {sizeOptions.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
          </select>
        </label>
      ) : null}

      {currentSlug && tileCountOptions.length > 0 ? (
        <label style={styles.label}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Tiles per Sheet {detailLoading ? <Spinner /> : null}</span>
          <select value={currentVariantId} onChange={(e) => onChange((s) => ({ ...s, catalogVariantId: e.target.value }))} style={styles.input} disabled={detailLoading}>
            <option value="">Select count...</option>
            {tileCountOptions.map((o) => <option key={o.variantId} value={o.variantId}>{o.label}</option>)}
          </select>
        </label>
      ) : null}

      {selectedTileCount != null ? (
        <div data-layout="tileCountDisplay" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <CountBadge count={selectedTileCount} unit="tile" />
        </div>
      ) : null}

      {currentSlug ? <CatalogPreviewImage key={selectedProduct?.imageUrl ?? currentSlug} product={selectedProduct} /> : null}
      {currentSlug ? <VariantOptionsPanel detail={detail} loading={detailLoading} selection={selection} onChange={onChange} styles={styles} /> : null}
      <PricingPanel variant={selectedVariant} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Board: Size (with "Custom") → Finish                                */
/* ------------------------------------------------------------------ */

const CUSTOM_SIZE_SENTINEL = '__custom__';

function BoardPicker({ selection, preferredUnits, onChange, styles, products, loading, error }: PickerProps) {
  const { catalogSlug: currentSlug, catalogVariantId: currentVariantId } = selection;

  const sizeOptions = useMemo(() => extractSizeOptions(products, preferredUnits), [products, preferredUnits]);
  useApplyLayoutWhenFetched(currentSlug, onChange);

  const { detail, loading: detailLoading } = useCatalogProductDetail(currentSlug || null);
  const selectedProduct = products.find((p) => p.slug === currentSlug) ?? null;
  const selectedVariant = detail?.productVariants.find((v) => v.id === currentVariantId) ?? null;

  const fixedSizes = sizeOptions.filter((o) => !o.isCustom);
  const customSize = sizeOptions.find((o) => o.isCustom) ?? null;
  const selectValue = currentSlug
    ? (sizeOptions.find((o) => o.slug === currentSlug)?.isCustom ? CUSTOM_SIZE_SENTINEL : currentSlug)
    : '';

  function handleSizeChange(value: string) {
    if (value === CUSTOM_SIZE_SENTINEL) {
      if (customSize) applyLayoutFromCache(customSize.slug, onChange);
      else onChange((s) => ({ ...s, catalogSlug: '', catalogVariantId: '' }));
      return;
    }
    applyLayoutFromCache(value, onChange);
  }

  return (
    <div data-layout="boardCatalogPicker">
      {error ? <div style={catalogErrorStyle}>Could not reach catalog API. Make sure the server is running on port 3100.</div> : null}
      <label style={styles.label}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Size {loading ? <Spinner /> : null}</span>
        <select value={selectValue} onChange={(e) => handleSizeChange(e.target.value)} style={styles.input} disabled={loading || sizeOptions.length === 0}>
          <option value="">Select a size...</option>
          {fixedSizes.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
          <option value={CUSTOM_SIZE_SENTINEL}>Custom size...</option>
        </select>
      </label>

      {currentSlug ? <CatalogPreviewImage key={selectedProduct?.imageUrl ?? currentSlug} product={selectedProduct} /> : null}
      {currentSlug ? (
        <VariantOptionsPanel detail={detail} loading={detailLoading} selection={selection} onChange={onChange} excludeGroups={['Configuration']} styles={styles} />
      ) : null}
      <PricingPanel variant={selectedVariant} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deck: Card Shape → Card Size → Deck Size → Finish                   */
/* ------------------------------------------------------------------ */

function DeckPicker({ selection, preferredUnits, onChange, styles, products, loading, error }: PickerProps) {
  const { catalogSlug: currentSlug, catalogVariantId: currentVariantId, shape: currentShape } = selection;

  const shapes = useMemo(() => extractShapes(products), [products]);
  const productsForShape = useMemo<CatalogProduct[]>(
    () => (currentShape ? products.filter((p) => productShape(p) === currentShape) : products),
    [products, currentShape],
  );
  const cardSizeOptions = useMemo(() => extractSizeOptions(productsForShape, preferredUnits), [productsForShape, preferredUnits]);

  useApplyLayoutWhenFetched(currentSlug, onChange);

  const { detail, loading: detailLoading } = useCatalogProductDetail(currentSlug || null);
  const deckSizeOptions = useMemo(() => extractDeckSizeOptions(detail), [detail]);
  const selectedProduct = products.find((p) => p.slug === currentSlug) ?? null;
  const selectedVariant = detail?.productVariants.find((v) => v.id === currentVariantId) ?? null;
  const selectedDeckSizeLabel = deckSizeOptions.find((o) => o.variantId === currentVariantId)?.label ?? '';
  const cardCount = useMemo(() => parseCardCount(selectedDeckSizeLabel), [selectedDeckSizeLabel]);

  return (
    <div data-layout="deckCatalogPicker">
      {error ? <div style={catalogErrorStyle}>Could not reach catalog API. Make sure the server is running on port 3100.</div> : null}

      {shapes.length > 1 ? (
        <label style={styles.label}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Card Shape {loading ? <Spinner /> : null}</span>
          <select value={currentShape} onChange={(e) => onChange((s) => ({ ...s, shape: e.target.value, catalogSlug: '', catalogVariantId: '' }))} style={styles.input} disabled={loading || shapes.length === 0}>
            <option value="">All shapes</option>
            {shapes.map((shape) => <option key={shape} value={shape}>{formatShapeLabel(shape)}</option>)}
          </select>
        </label>
      ) : null}

      <label style={styles.label}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Card Size {loading && shapes.length <= 1 ? <Spinner /> : null}</span>
        <select value={currentSlug} onChange={(e) => applyLayoutFromCache(e.target.value, onChange)} style={styles.input} disabled={loading || cardSizeOptions.length === 0}>
          <option value="">Select a card size...</option>
          {cardSizeOptions.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
        </select>
      </label>

      {currentSlug ? (
        <label style={styles.label}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Deck Size (number of cards) {detailLoading ? <Spinner /> : null}</span>
          <select value={currentVariantId} onChange={(e) => onChange((s) => ({ ...s, catalogVariantId: e.target.value }))} style={styles.input} disabled={detailLoading || deckSizeOptions.length === 0}>
            <option value="">{deckSizeOptions.length === 0 && !detailLoading ? 'No deck sizes available' : 'Select deck size...'}</option>
            {deckSizeOptions.map((o) => <option key={o.variantId} value={o.variantId}>{o.label}</option>)}
          </select>
        </label>
      ) : null}

      {cardCount != null ? (
        <div data-layout="deckCardCountDisplay" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <CountBadge count={cardCount} unit="card" />
        </div>
      ) : null}

      {currentSlug ? <CatalogPreviewImage key={selectedProduct?.imageUrl ?? currentSlug} product={selectedProduct} /> : null}
      {currentSlug ? <VariantOptionsPanel detail={detail} loading={detailLoading} selection={selection} onChange={onChange} styles={styles} /> : null}
      <PricingPanel variant={selectedVariant} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Site (supplier) filter                                              */
/* ------------------------------------------------------------------ */

const siteChipBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  fontSize: '0.74rem',
  fontWeight: 700,
  borderRadius: '999px',
  padding: '0.26rem 0.6rem',
  cursor: 'pointer',
  transition: 'background 0.12s, border-color 0.12s, color 0.12s',
};

/**
 * "Show components from" multi-select. `selected === null` means every site
 * (the default); an explicit array narrows it, and an empty array shows none.
 * Collapses back to `null` once every site is re-selected so the common
 * "everything" case stays the clean default.
 */
function SiteFilter({
  sites,
  selected,
  onChange,
}: {
  sites: CatalogSite[];
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
}) {
  const allIds = useMemo(() => sites.map((s) => s.id), [sites]);
  const isOn = (id: string) => selected === null || selected.includes(id);
  const noneSelected = selected !== null && selected.length === 0;

  function toggle(id: string) {
    const current = selected === null ? allIds : selected;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange(next.length === allIds.length ? null : next);
  }

  return (
    <div data-layout="catalogSiteFilter" /* supplier multi-select; defaults to all sites */ style={{ marginBottom: '0.2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <div style={groupTitleStyle}>Show components from</div>
        <button
          type="button"
          onClick={() => onChange(noneSelected || selected !== null ? null : [])}
          style={{ border: 'none', background: 'none', color: '#0f766e', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
        >
          {selected === null ? 'Clear all' : 'Select all'}
        </button>
      </div>
      <div data-layout="catalogSiteChips" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {sites.map((site) => {
          const on = isOn(site.id);
          return (
            <button
              key={site.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(site.id)}
              style={{
                ...siteChipBaseStyle,
                background: on ? 'rgba(16,185,129,0.16)' : 'rgba(120,95,50,0.06)',
                border: `1px solid ${on ? 'rgba(15,118,110,0.4)' : 'rgba(120,95,50,0.2)'}`,
                color: on ? '#065f46' : '#8a7350',
              }}
            >
              {on ? <Check size={12} /> : null}
              {site.label}
            </button>
          );
        })}
      </div>
      {noneSelected ? (
        <div style={{ fontSize: '0.72rem', color: '#8a7350', marginTop: '0.4rem' }}>
          No sites selected — pick at least one to see components.
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * The shared thing → size → finish catalog selector. Drives a plain
 * `CatalogSelection` so it can be hosted by the component-editor inspector
 * (bound to an instance) or the rulebook add-component modal (bound to local
 * draft state) — both get identical selectors.
 *
 * Owns the catalog fetch for the active category so it can offer a "show
 * components from" site filter (defaulting to every supplier) before handing
 * the filtered products to whichever picker matches the component type.
 */
export function CatalogSelector({
  componentType,
  selection,
  preferredUnits,
  onChange,
  styles = DEFAULT_STYLES,
}: {
  componentType: 'tile' | 'board' | 'deck';
  selection: CatalogSelection;
  preferredUnits: EditorLengthUnit;
  onChange: SelectionUpdater;
  styles?: CatalogSelectorStyles;
}) {
  const category = getCatalogCategory(componentType) ?? '';
  const { products: allProducts, loading, error } = useCatalogProducts(category || null);

  const sites = useMemo(() => extractSites(allProducts), [allProducts]);
  // null = all sites (the default); explicit array narrows it; [] shows none.
  const [selectedSites, setSelectedSites] = useState<string[] | null>(null);

  const products = useMemo(() => {
    // Single-site categories have no meaningful filter, so never let a stale
    // selection (carried over from a multi-site genre) hide everything.
    if (selectedSites === null || sites.length <= 1) return allProducts;
    const allow = new Set(selectedSites);
    return allProducts.filter((p) => p.supplierId && allow.has(p.supplierId));
  }, [allProducts, selectedSites, sites.length]);

  const props: PickerProps = { selection, preferredUnits, onChange, styles, products, loading, error };

  return (
    <div data-layout="catalogSelector">
      {sites.length > 1 ? (
        <SiteFilter sites={sites} selected={selectedSites} onChange={setSelectedSites} />
      ) : null}
      {componentType === 'tile' ? <TilePicker {...props} /> : null}
      {componentType === 'board' ? <BoardPicker {...props} /> : null}
      {componentType === 'deck' ? <DeckPicker {...props} /> : null}
    </div>
  );
}
