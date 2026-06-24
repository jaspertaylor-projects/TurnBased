import { Loader2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  extractDeckSizeOptions,
  extractShapes,
  extractSizeOptions,
  extractTileCountOptions,
  extractVariantOptionGroups,
  findMatchingVariant,
  formatPriceTier,
  parseCardCount,
  productShape,
  type CatalogProduct,
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

const DEFAULT_STYLES: CatalogSelectorStyles = {
  label: tabletopLabel,
  input: { ...tabletopField, padding: '0.58rem 0.68rem', fontSize: '0.86rem' },
};

type SelectionUpdater = (updater: (selection: CatalogSelection) => CatalogSelection) => void;

export function selectionFromProperties(properties: Record<string, unknown>): CatalogSelection {
  return {
    catalogSlug: typeof properties.catalogSlug === 'string' ? properties.catalogSlug : '',
    catalogVariantId: typeof properties.catalogVariantId === 'string' ? properties.catalogVariantId : '',
    shape: typeof properties.shape === 'string' ? properties.shape : '',
    physicalWidthMm: typeof properties.physicalWidthMm === 'number' ? properties.physicalWidthMm : null,
    physicalHeightMm: typeof properties.physicalHeightMm === 'number' ? properties.physicalHeightMm : null,
  };
}

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

const infoBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#065f46',
  background: 'rgba(236,253,245,0.95)',
  border: '1px solid rgba(15,118,110,0.15)',
  borderRadius: '8px',
  padding: '0.3rem 0.6rem',
};

const priceBadgeStyle: CSSProperties = {
  ...infoBadgeStyle,
  color: '#92400e',
  background: 'rgba(254,243,199,0.85)',
  border: '1px solid rgba(217,119,6,0.2)',
};

const sectionDividerStyle: CSSProperties = {
  borderTop: '1px solid rgba(120,95,50,0.14)',
  paddingTop: '0.6rem',
  marginTop: '0.3rem',
};

const groupTitleStyle: CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b7280',
  marginBottom: '0.5rem',
};

const catalogErrorStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: '#dc2626',
  lineHeight: 1.4,
  marginBottom: '0.3rem',
};

function VariantOptionsPanel({
  detail,
  loading,
  selection,
  onChange,
  excludeGroups,
  styles,
}: {
  detail: ProductDetailResponse | null;
  loading: boolean;
  selection: CatalogSelection;
  onChange: SelectionUpdater;
  excludeGroups?: string[];
  styles: CatalogSelectorStyles;
}) {
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

  const prevVariantIdRef = useRef(currentVariantId);
  useEffect(() => {
    if (currentVariantId === prevVariantIdRef.current) return;
    prevVariantIdRef.current = currentVariantId;
    if (!currentVariant) return;
    const next: Record<string, string> = {};
    for (const opt of currentVariant.options) {
      if (opt.optionKey.startsWith('dro_choosesize') || opt.optionKey.startsWith('dro_choosepcs')) continue;
      next[opt.optionGroup] = opt.optionValue;
    }
    setSelections(next);
  }, [currentVariantId, currentVariant]);

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

// Thin-bordered thumbnail that hugs the image: a few px of mat, no fixed frame
// height, so the border just outlines the artwork. Click opens the lightbox.
const previewTriggerStyle: CSSProperties = {
  display: 'block',
  width: 'fit-content',
  maxWidth: '100%',
  margin: '0 auto',
  padding: '3px',
  border: '1px solid rgba(120,95,50,0.28)',
  borderRadius: '10px',
  background: 'rgba(255,253,246,0.9)',
  boxShadow: '0 1px 3px rgba(60,40,20,0.1)',
  cursor: 'zoom-in',
  lineHeight: 0,
};

const previewImageStyle: CSSProperties = {
  display: 'block',
  maxWidth: '100%',
  maxHeight: '168px',
  height: 'auto',
  borderRadius: '7px',
};

const lightboxOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  // Above every catalog host: the rulebook picker (z 40) and the new-component
  // dialog (z 300) both sit below this enlarged view.
  zIndex: 500,
  display: 'grid',
  placeItems: 'center',
  padding: '2rem',
  background: 'rgba(20,12,4,0.72)',
  backdropFilter: 'blur(4px)',
  cursor: 'zoom-out',
};

const lightboxImageStyle: CSSProperties = {
  maxWidth: '92vw',
  maxHeight: '92vh',
  objectFit: 'contain',
  borderRadius: '12px',
  boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
};

/**
 * Renders the supplier's preview image for the currently selected catalog
 * product (the `imageUrl` from the catalog API). The thumbnail border just hugs
 * the image; clicking it opens an enlarged lightbox (click anywhere or Esc to
 * dismiss). Stays out of the way when no product is selected, the product has no
 * image, or the CDN image fails to load — the selection flow never depends on
 * the artwork being present.
 */
function CatalogPreviewImage({ product }: { product: CatalogProduct | null }) {
  const imageUrl = product?.imageUrl ?? null;
  const [errored, setErrored] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

  // Reset both flags whenever the source changes so switching products re-shows
  // a working thumbnail and never leaves a stale lightbox open.
  useEffect(() => { setErrored(false); setEnlarged(false); }, [imageUrl]);

  // Esc closes the enlarged view, matching click-to-dismiss.
  useEffect(() => {
    if (!enlarged) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setEnlarged(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enlarged]);

  if (!product || !imageUrl || errored) return null;

  const label = product.customTitle || product.title || product.slug;
  return (
    <div data-layout="catalogPreviewImage" /* supplier product preview from the catalog API */ style={sectionDividerStyle}>
      <div style={groupTitleStyle}>Preview</div>
      <button
        type="button"
        data-layout="catalogPreviewTrigger"
        /* thin-bordered thumbnail; opens the enlarged lightbox on click */
        onClick={() => setEnlarged(true)}
        aria-label={`Enlarge preview of ${label}`}
        title="Click to enlarge"
        style={previewTriggerStyle}
      >
        <img
          src={imageUrl}
          alt={`Catalog preview of ${label}`}
          loading="lazy"
          onError={() => setErrored(true)}
          style={previewImageStyle}
        />
      </button>

      {enlarged ? (
        <div
          data-layout="catalogPreviewLightbox"
          /* enlarged overlay; click anywhere or press Esc to dismiss */
          role="dialog"
          aria-modal="true"
          aria-label={`Enlarged preview of ${label}`}
          onClick={() => setEnlarged(false)}
          style={lightboxOverlayStyle}
        >
          <img src={imageUrl} alt={`Enlarged catalog preview of ${label}`} style={lightboxImageStyle} />
        </div>
      ) : null}
    </div>
  );
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
}

function TilePicker({ selection, preferredUnits, onChange, styles }: PickerProps) {
  const { products, loading, error } = useCatalogProducts('tiles');
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

      {currentSlug ? <CatalogPreviewImage product={selectedProduct} /> : null}
      {currentSlug ? <VariantOptionsPanel detail={detail} loading={detailLoading} selection={selection} onChange={onChange} styles={styles} /> : null}
      <PricingPanel variant={selectedVariant} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Board: Size (with "Custom") → Finish                                */
/* ------------------------------------------------------------------ */

const CUSTOM_SIZE_SENTINEL = '__custom__';

function BoardPicker({ selection, preferredUnits, onChange, styles }: PickerProps) {
  const { products, loading, error } = useCatalogProducts('boards');
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

      {currentSlug ? <CatalogPreviewImage product={selectedProduct} /> : null}
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

function DeckPicker({ selection, preferredUnits, onChange, styles }: PickerProps) {
  const { products, loading, error } = useCatalogProducts('cards');
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

      {currentSlug ? <CatalogPreviewImage product={selectedProduct} /> : null}
      {currentSlug ? <VariantOptionsPanel detail={detail} loading={detailLoading} selection={selection} onChange={onChange} styles={styles} /> : null}
      <PricingPanel variant={selectedVariant} />
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
  const props: PickerProps = { selection, preferredUnits, onChange, styles };
  if (componentType === 'tile') return <TilePicker {...props} />;
  if (componentType === 'board') return <BoardPicker {...props} />;
  return <DeckPicker {...props} />;
}
