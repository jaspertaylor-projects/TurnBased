import { Loader2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ComponentInstanceModel } from '@turnbased/engine-components';

import { tabletopLabel as labelStyle } from '../../theme/tabletop';
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
  type ProductVariant,
} from '../../supplierCatalog';
import type { EditorLengthUnit } from '../../types';
import {
  getCachedLayout,
  useCatalogLayout,
  useCatalogProductDetail,
  useCatalogProducts,
} from '../../useSupplierCatalog';
import { compactInputStyle } from './boardEditorUtils';

interface CatalogPickerProps {
  componentType: 'tile' | 'board' | 'deck';
  instanceId: string;
  instance: ComponentInstanceModel;
  preferredUnits: EditorLengthUnit;
  onUpdateComponent: (
    instanceId: string,
    updater: (instance: ComponentInstanceModel) => ComponentInstanceModel,
  ) => void;
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

/** Applies layout dimensions (and variant id) to a component's properties. */
function applyLayoutFromCache(
  slug: string,
  instanceId: string,
  onUpdateComponent: CatalogPickerProps['onUpdateComponent'],
  extraProperties: Record<string, unknown> = {},
) {
  const cached = slug ? getCachedLayout(slug) : null;
  const face = cached?.faces[0] ?? null;

  onUpdateComponent(instanceId, (instance) => ({
    ...instance,
    properties: {
      ...instance.properties,
      catalogSlug: slug,
      catalogVariantId: face ? (cached!.variantId ?? '') : '',
      ...(face ? { physicalWidthMm: Number(face.widthMm), physicalHeightMm: Number(face.heightMm) } : {}),
      ...extraProperties,
    },
  }));
}

/**
 * Applies layout dimensions asynchronously once a layout fetch completes for
 * the current slug — the complement to `applyLayoutFromCache` which handles
 * the sync case. Tracks already-applied slugs so we only update once per
 * slug change, not on every render.
 */
function useApplyLayoutWhenFetched(
  slug: string,
  instanceId: string,
  onUpdateComponent: CatalogPickerProps['onUpdateComponent'],
) {
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
    onUpdateComponent(instanceId, (instance) => ({
      ...instance,
      properties: {
        ...instance.properties,
        physicalWidthMm: Number(face.widthMm),
        physicalHeightMm: Number(face.heightMm),
        catalogVariantId: layout.variantId ?? '',
      },
    }));
  }, [layout, slug, instanceId, onUpdateComponent]);
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
  borderTop: '1px solid rgba(15,118,110,0.08)',
  paddingTop: '0.6rem',
  marginTop: '0.3rem',
};

/**
 * Displays the variant option selectors (Material, Print Finish, etc.)
 * and syncs the selected variant back to the component's catalogVariantId.
 */
function VariantOptionsPanel({
  detail,
  loading,
  instanceId,
  instance,
  onUpdateComponent,
  excludeGroups,
}: {
  detail: import('../../supplierCatalog').ProductDetailResponse | null;
  loading: boolean;
  instanceId: string;
  instance: ComponentInstanceModel;
  onUpdateComponent: CatalogPickerProps['onUpdateComponent'];
  excludeGroups?: string[];
}) {
  const allGroups = useMemo(() => extractVariantOptionGroups(detail), [detail]);
  const optionGroups = useMemo(
    () => excludeGroups ? allGroups.filter((g) => !excludeGroups.includes(g.group)) : allGroups,
    [allGroups, excludeGroups],
  );

  // Track user selections per option group. Initialise from the currently
  // stored variant (if any) so round-tripping works.
  const currentVariantId = typeof instance.properties.catalogVariantId === 'string'
    ? instance.properties.catalogVariantId : '';
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

  // Re-derive selections when a different variant is set externally.
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
      onUpdateComponent(instanceId, (inst) => ({
        ...inst,
        properties: { ...inst.properties, catalogVariantId: match.id },
      }));
    }
  }

  if (optionGroups.length === 0) return null;

  return (
    <div data-layout="variantOptionsPanel" /* material / finish / config selectors */ style={sectionDividerStyle}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: '0.5rem' }}>
        Print Options
      </div>
      {optionGroups.map((og) => (
        <label key={og.group} style={{ ...labelStyle, marginBottom: '0.45rem' }}>
          {og.group}
          <select
            value={selections[og.group] ?? ''}
            onChange={(e) => handleOptionChange(og.group, e.target.value)}
            style={compactInputStyle}
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

/** Shows the single-unit price and a collapsible bulk discount section. */
function PricingPanel({ variant }: { variant: ProductVariant | null }) {
  if (!variant || variant.priceTiers.length === 0) return null;

  const firstTier = variant.priceTiers[0];

  return (
    <div data-layout="pricingPanel" /* price tier display */ style={sectionDividerStyle}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: '0.45rem' }}>
        Pricing
      </div>
      <div data-layout="pricingSummary" /* single unit price */ style={{ marginBottom: '0.35rem' }}>
        <span style={priceBadgeStyle}>
          ${firstTier.unitPrice.toFixed(2)} / unit
        </span>
      </div>
      {variant.priceTiers.length > 1 ? (
        <details style={{ fontSize: '0.76rem', color: '#374151' }}>
          <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '0.72rem', userSelect: 'none' }}>
            Bulk discount
          </summary>
          <div data-layout="priceTierList" /* full tier breakdown */ style={{ display: 'grid', gap: '0.15rem', marginTop: '0.3rem', paddingLeft: '0.2rem' }}>
            {variant.priceTiers.map((tier, i) => (
              <div key={i} style={{ fontSize: '0.74rem', color: '#374151' }}>
                {formatPriceTier(tier)}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/** Inline count badge (e.g. "54 cards", "6 tiles per sheet"). */
function CountBadge({ count, unit }: { count: number | null; unit: string }) {
  if (count == null) return null;
  return (
    <span style={infoBadgeStyle}>
      {count} {unit}{count !== 1 ? 's' : ''}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tile picker: Shape → Size                                           */
/* ------------------------------------------------------------------ */

function TilePicker({ instanceId, instance, preferredUnits, onUpdateComponent }: Omit<CatalogPickerProps, 'componentType'>) {
  const { products, loading, error } = useCatalogProducts('tiles');

  const currentShape = typeof instance.properties.shape === 'string' ? instance.properties.shape : '';
  const currentSlug = typeof instance.properties.catalogSlug === 'string' ? instance.properties.catalogSlug : '';
  const currentVariantId = typeof instance.properties.catalogVariantId === 'string'
    ? instance.properties.catalogVariantId : '';

  const shapes = useMemo(() => extractShapes(products), [products]);

  useApplyLayoutWhenFetched(currentSlug, instanceId, onUpdateComponent);

  const productsForShape = useMemo<CatalogProduct[]>(
    () => (currentShape ? products.filter((p) => productShape(p) === currentShape) : []),
    [products, currentShape],
  );
  const sizeOptions = useMemo(
    () => extractSizeOptions(productsForShape, preferredUnits),
    [productsForShape, preferredUnits],
  );

  // Fetch detail for tile count, variant options, and pricing.
  const { detail, loading: detailLoading } = useCatalogProductDetail(currentSlug || null);
  const tileCountOptions = useMemo(() => extractTileCountOptions(detail), [detail]);
  const selectedVariant = detail?.productVariants.find((v) => v.id === currentVariantId) ?? null;

  // Derive tile count from the selected variant.
  const selectedTileCount = useMemo(() => {
    const opt = tileCountOptions.find((o) => o.variantId === currentVariantId);
    return opt?.count ?? null;
  }, [tileCountOptions, currentVariantId]);

  function handleShapeChange(shape: string) {
    onUpdateComponent(instanceId, (inst) => ({
      ...inst,
      properties: {
        ...inst.properties,
        shape,
        catalogSlug: '',
        catalogVariantId: '',
      },
    }));
  }

  function handleTileCountChange(variantId: string) {
    onUpdateComponent(instanceId, (inst) => ({
      ...inst,
      properties: { ...inst.properties, catalogVariantId: variantId },
    }));
  }

  return (
    <div data-layout="tileCatalogPicker" /* catalog-driven shape+size+variant picker for tiles */>
      {error ? (
        <div style={{ fontSize: '0.72rem', color: '#dc2626', lineHeight: 1.4, marginBottom: '0.3rem' }}>
          Could not reach catalog API. Make sure the server is running on port 3100.
        </div>
      ) : null}
      <label style={labelStyle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          Shape
          {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
        </span>
        <select
          value={currentShape}
          onChange={(event) => handleShapeChange(event.target.value)}
          style={compactInputStyle}
          disabled={loading || shapes.length === 0}
        >
          <option value="">Select a shape...</option>
          {shapes.map((shape) => (
            <option key={shape} value={shape}>
              {formatShapeLabel(shape)}
            </option>
          ))}
        </select>
      </label>

      {currentShape ? (
        <label style={labelStyle}>
          Size
          <select
            value={currentSlug}
            onChange={(event) => applyLayoutFromCache(event.target.value, instanceId, onUpdateComponent)}
            style={compactInputStyle}
            disabled={sizeOptions.length === 0}
          >
            <option value="">Select a size...</option>
            {sizeOptions.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {currentSlug && tileCountOptions.length > 0 ? (
        <label style={labelStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Tiles per Sheet
            {detailLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          </span>
          <select
            value={currentVariantId}
            onChange={(e) => handleTileCountChange(e.target.value)}
            style={compactInputStyle}
            disabled={detailLoading}
          >
            <option value="">Select count...</option>
            {tileCountOptions.map((opt) => (
              <option key={opt.variantId} value={opt.variantId}>{opt.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      {selectedTileCount != null ? (
        <div data-layout="tileCountDisplay" /* count badge row */ style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <CountBadge count={selectedTileCount} unit="tile" />
        </div>
      ) : null}

      {currentSlug ? (
        <VariantOptionsPanel
          detail={detail}
          loading={detailLoading}
          instanceId={instanceId}
          instance={instance}
          onUpdateComponent={onUpdateComponent}
        />
      ) : null}

      <PricingPanel variant={selectedVariant} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Board picker: Size (with "Custom")                                  */
/* ------------------------------------------------------------------ */

const CUSTOM_SIZE_SENTINEL = '__custom__';

function BoardPicker({ instanceId, instance, preferredUnits, onUpdateComponent }: Omit<CatalogPickerProps, 'componentType'>) {
  const { products, loading, error } = useCatalogProducts('boards');
  const currentSlug = typeof instance.properties.catalogSlug === 'string' ? instance.properties.catalogSlug : '';
  const currentVariantId = typeof instance.properties.catalogVariantId === 'string'
    ? instance.properties.catalogVariantId : '';

  const sizeOptions = useMemo(
    () => extractSizeOptions(products, preferredUnits),
    [products, preferredUnits],
  );

  useApplyLayoutWhenFetched(currentSlug, instanceId, onUpdateComponent);

  // Fetch detail for variant options and pricing.
  const { detail, loading: detailLoading } = useCatalogProductDetail(currentSlug || null);
  const selectedVariant = detail?.productVariants.find((v) => v.id === currentVariantId) ?? null;

  const fixedSizes = sizeOptions.filter((o) => !o.isCustom);
  const customSize = sizeOptions.find((o) => o.isCustom) ?? null;

  const selectValue = currentSlug
    ? (sizeOptions.find((o) => o.slug === currentSlug)?.isCustom ? CUSTOM_SIZE_SENTINEL : currentSlug)
    : '';

  function handleSizeChange(value: string) {
    if (value === CUSTOM_SIZE_SENTINEL) {
      if (customSize) {
        applyLayoutFromCache(customSize.slug, instanceId, onUpdateComponent);
      } else {
        onUpdateComponent(instanceId, (inst) => ({
          ...inst,
          properties: { ...inst.properties, catalogSlug: '', catalogVariantId: '' },
        }));
      }
      return;
    }
    applyLayoutFromCache(value, instanceId, onUpdateComponent);
  }

  return (
    <div data-layout="boardCatalogPicker" /* catalog-driven size + variant picker for boards */>
      {error ? (
        <div style={{ fontSize: '0.72rem', color: '#dc2626', lineHeight: 1.4, marginBottom: '0.3rem' }}>
          Could not reach catalog API. Make sure the server is running on port 3100.
        </div>
      ) : null}
      <label style={labelStyle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          Size
          {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
        </span>
        <select
          value={selectValue}
          onChange={(event) => handleSizeChange(event.target.value)}
          style={compactInputStyle}
          disabled={loading || sizeOptions.length === 0}
        >
          <option value="">Select a size...</option>
          {fixedSizes.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.label}
            </option>
          ))}
          <option value={CUSTOM_SIZE_SENTINEL}>Custom size...</option>
        </select>
      </label>

      {currentSlug ? (
        <VariantOptionsPanel
          detail={detail}
          loading={detailLoading}
          instanceId={instanceId}
          instance={instance}
          onUpdateComponent={onUpdateComponent}
          excludeGroups={['Configuration']}
        />
      ) : null}

      <PricingPanel variant={selectedVariant} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deck picker: Card Size + Deck Size                                  */
/* ------------------------------------------------------------------ */

function DeckPicker({ instanceId, instance, preferredUnits, onUpdateComponent }: Omit<CatalogPickerProps, 'componentType'>) {
  const { products, loading, error } = useCatalogProducts('cards');

  const currentShape = typeof instance.properties.shape === 'string' ? instance.properties.shape : '';
  const currentSlug = typeof instance.properties.catalogSlug === 'string' ? instance.properties.catalogSlug : '';
  const currentVariantId = typeof instance.properties.catalogVariantId === 'string'
    ? instance.properties.catalogVariantId : '';

  // Shape is a top-line pick — hexagon, square, etc.
  const shapes = useMemo(() => extractShapes(products), [products]);

  // Filter products by selected shape, then extract card sizes from the filtered set.
  const productsForShape = useMemo<CatalogProduct[]>(
    () => (currentShape ? products.filter((p) => productShape(p) === currentShape) : products),
    [products, currentShape],
  );
  const cardSizeOptions = useMemo(
    () => extractSizeOptions(productsForShape, preferredUnits),
    [productsForShape, preferredUnits],
  );

  useApplyLayoutWhenFetched(currentSlug, instanceId, onUpdateComponent);

  // Fetch the selected card product detail for deck-size, variant options, and pricing.
  const { detail, loading: detailLoading } = useCatalogProductDetail(currentSlug || null);
  const deckSizeOptions = useMemo(() => extractDeckSizeOptions(detail), [detail]);
  const selectedVariant = detail?.productVariants.find((v) => v.id === currentVariantId) ?? null;

  // Parse the card count from the currently selected deck-size label.
  const selectedDeckSizeLabel = deckSizeOptions.find((o) => o.variantId === currentVariantId)?.label ?? '';
  const cardCount = useMemo(() => parseCardCount(selectedDeckSizeLabel), [selectedDeckSizeLabel]);

  function handleShapeChange(shape: string) {
    onUpdateComponent(instanceId, (inst) => ({
      ...inst,
      properties: {
        ...inst.properties,
        shape,
        catalogSlug: '',
        catalogVariantId: '',
      },
    }));
  }

  function handleCardSizeChange(slug: string) {
    applyLayoutFromCache(slug, instanceId, onUpdateComponent);
  }

  function handleDeckSizeChange(variantId: string) {
    onUpdateComponent(instanceId, (inst) => ({
      ...inst,
      properties: { ...inst.properties, catalogVariantId: variantId },
    }));
  }

  return (
    <div data-layout="deckCatalogPicker" /* catalog-driven shape + card-size + deck-size + variant picker */>
      {error ? (
        <div style={{ fontSize: '0.72rem', color: '#dc2626', lineHeight: 1.4, marginBottom: '0.3rem' }}>
          Could not reach catalog API. Make sure the server is running on port 3100.
        </div>
      ) : null}

      {/* Shape — top-line pick (hexagon, square, etc.) */}
      {shapes.length > 1 ? (
        <label style={labelStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Card Shape
            {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          </span>
          <select
            value={currentShape}
            onChange={(e) => handleShapeChange(e.target.value)}
            style={compactInputStyle}
            disabled={loading || shapes.length === 0}
          >
            <option value="">All shapes</option>
            {shapes.map((shape) => (
              <option key={shape} value={shape}>{formatShapeLabel(shape)}</option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Card size — dimensions of a single card */}
      <label style={labelStyle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          Card Size
          {loading && shapes.length <= 1 ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
        </span>
        <select
          value={currentSlug}
          onChange={(event) => handleCardSizeChange(event.target.value)}
          style={compactInputStyle}
          disabled={loading || cardSizeOptions.length === 0}
        >
          <option value="">Select a card size...</option>
          {cardSizeOptions.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {/* Deck size — number of cards */}
      {currentSlug ? (
        <label style={labelStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Deck Size (number of cards)
            {detailLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          </span>
          <select
            value={currentVariantId}
            onChange={(event) => handleDeckSizeChange(event.target.value)}
            style={compactInputStyle}
            disabled={detailLoading || deckSizeOptions.length === 0}
          >
            <option value="">
              {deckSizeOptions.length === 0 && !detailLoading ? 'No deck sizes available' : 'Select deck size...'}
            </option>
            {deckSizeOptions.map((option) => (
              <option key={option.variantId} value={option.variantId}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Card count badge */}
      {cardCount != null ? (
        <div data-layout="deckCardCountDisplay" /* card count badge row */ style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <CountBadge count={cardCount} unit="card" />
        </div>
      ) : null}

      {/* Variant options (material, finish, etc.) */}
      {currentSlug ? (
        <VariantOptionsPanel
          detail={detail}
          loading={detailLoading}
          instanceId={instanceId}
          instance={instance}
          onUpdateComponent={onUpdateComponent}
        />
      ) : null}

      {/* Pricing */}
      <PricingPanel variant={selectedVariant} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function CatalogPicker({ componentType, instanceId, instance, preferredUnits, onUpdateComponent }: CatalogPickerProps) {
  const shared = { instanceId, instance, preferredUnits, onUpdateComponent };
  if (componentType === 'tile') {
    return <TilePicker {...shared} />;
  }
  if (componentType === 'board') {
    return <BoardPicker {...shared} />;
  }
  return <DeckPicker {...shared} />;
}
