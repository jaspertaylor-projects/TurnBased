import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { AlertTriangle, Check, PackagePlus, X } from 'lucide-react';

import type { BuiltInComponentType } from '@turnbased/engine-components';

import {
  formatPriceTier,
  parseCardCount,
  productShape,
  type CatalogProduct,
  type ProductVariant,
} from '../../supplierCatalog';
import { formatDimensions } from '../../units';
import { useCatalogLayout, useCatalogProductDetail, useCatalogProducts } from '../../useSupplierCatalog';
import { useUserSettings } from '../../../userSettings';
import {
  CatalogSelector,
  type CatalogSelection,
  type CatalogSelectorStyles,
} from '../visuals/CatalogSelector';
import { SERIF_STACK } from './rulebookStyles';

type CatalogCategory = 'boards' | 'cards' | 'tiles';
type ComponentGenre = CatalogCategory | 'custom';

interface CatalogGenreOption {
  category: ComponentGenre;
  label: string;
  componentType: Extract<BuiltInComponentType, 'board' | 'deck' | 'tile'> | null;
}

export interface CatalogComponentSelection {
  type: Extract<BuiltInComponentType, 'board' | 'deck' | 'tile'>;
  componentName: string;
  gameDescription: string;
  productSlug: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  category: CatalogCategory;
  priceEach: number | null;
  physicalWidthMm: number | null;
  physicalHeightMm: number | null;
  maxCards: number | null;
}

export interface CatalogComponentInitialSelection {
  category: CatalogCategory;
  componentName: string;
  gameDescription: string;
  productSlug: string;
  variantId: string;
}

const GENRE_OPTIONS: CatalogGenreOption[] = [
  { category: 'boards', label: 'Boards', componentType: 'board' },
  { category: 'cards', label: 'Cards', componentType: 'deck' },
  { category: 'tiles', label: 'Tiles', componentType: 'tile' },
  { category: 'custom', label: 'Custom', componentType: null },
];

const EMPTY_SELECTION: CatalogSelection = {
  catalogSlug: '',
  catalogVariantId: '',
  shape: '',
  physicalWidthMm: null,
  physicalHeightMm: null,
};

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: '8.6rem',
  right: '1.5rem',
  zIndex: 40,
  width: 'min(560px, calc(100vw - 3rem))',
  maxHeight: 'calc(100vh - 10rem)',
  overflow: 'hidden',
  borderRadius: '14px',
  border: '1px solid rgba(120, 95, 50, 0.28)',
  background: 'rgba(255, 253, 246, 0.99)',
  boxShadow: '0 18px 42px rgba(60, 40, 20, 0.26)',
  display: 'grid',
  gridTemplateRows: 'auto auto minmax(0, 1fr) auto',
};

const fieldStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  border: '1px solid rgba(120, 95, 50, 0.24)',
  borderRadius: '8px',
  background: 'rgba(255, 253, 246, 0.95)',
  color: '#3b2412',
  fontFamily: SERIF_STACK,
  fontSize: '0.84rem',
  padding: '0.45rem 0.55rem',
  outline: 'none',
};

const labelStyle: CSSProperties = {
  display: 'grid', gap: '0.25rem', fontFamily: SERIF_STACK, color: '#3b2412', fontSize: '0.76rem', fontWeight: 700,
};

// The shared catalog selectors take their field styling from the host so they
// fit the rulebook's cozy serif modal here (and the tabletop inspector elsewhere).
const selectorStyles: CatalogSelectorStyles = { label: labelStyle, input: fieldStyle };

function productLabel(product: CatalogProduct): string {
  return product.customTitle || product.title || product.slug;
}

function variantLabel(variant: ProductVariant, category: CatalogCategory): string {
  const optionText = variant.options
    .filter((option) => {
      if (option.optionKey.startsWith('sku')) return false;
      if (category === 'boards' && option.optionKey.startsWith('dro_choose')) return false;
      return true;
    })
    .map((option) => option.optionValue)
    .filter(Boolean)
    .join(' / ');
  return optionText || variant.title || variant.id;
}

function firstPrice(variant: ProductVariant | null): number | null {
  return variant?.priceTiers[0]?.unitPrice ?? null;
}

function cardCountFromVariant(variant: ProductVariant | null): number | null {
  const sizeOption = variant?.options.find((option) => option.optionKey.startsWith('dro_choosesize'));
  return sizeOption ? parseCardCount(sizeOption.optionValue) : null;
}

export interface ComponentPickerProps {
  onSelect: (selection: CatalogComponentSelection) => void;
  onAddCustom: (entry: { name: string; description: string }) => void;
  onClose: () => void;
  initialSelection?: CatalogComponentInitialSelection | null;
}

export function ComponentPicker({ onSelect, onAddCustom, onClose, initialSelection = null }: ComponentPickerProps) {
  const { preferredUnits } = useUserSettings();
  const isEditingCatalogItem = initialSelection !== null;
  const [category, setCategory] = useState<ComponentGenre>(initialSelection?.category ?? 'boards');
  const [selection, setSelection] = useState<CatalogSelection>(() => (
    initialSelection
      ? { ...EMPTY_SELECTION, catalogSlug: initialSelection.productSlug, catalogVariantId: initialSelection.variantId }
      : EMPTY_SELECTION
  ));
  const [catalogComponentName, setCatalogComponentName] = useState(initialSelection?.componentName ?? '');
  const [catalogGameDescription, setCatalogGameDescription] = useState(initialSelection?.gameDescription ?? '');
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  const genre = GENRE_OPTIONS.find((option) => option.category === category) ?? GENRE_OPTIONS[0];
  const catalogCategory = category === 'custom' ? null : category;

  // Resolve the live catalog data for the current selection so we can build the
  // submit payload (product/variant titles, price, dimensions).
  const { products } = useCatalogProducts(catalogCategory);
  const { detail } = useCatalogProductDetail(selection.catalogSlug || null);
  const { layout } = useCatalogLayout(selection.catalogSlug || null, selection.catalogVariantId || undefined);

  const selectedProduct = products.find((product) => product.slug === selection.catalogSlug) ?? null;
  const selectedVariant = detail?.productVariants.find((variant) => variant.id === selection.catalogVariantId) ?? null;
  const hasSelection = Boolean(selection.catalogSlug && selection.catalogVariantId);

  // Editing an existing catalog item: derive the shape from the product once it
  // loads, so the shape-filtered size dropdowns populate with the saved size.
  useEffect(() => {
    if (!selection.catalogSlug || selection.shape || !selectedProduct) return;
    const shape = productShape(selectedProduct);
    if (shape) setSelection((s) => ({ ...s, shape }));
  }, [selectedProduct, selection.catalogSlug, selection.shape]);

  function changeCategory(nextCategory: ComponentGenre) {
    if (isEditingCatalogItem) return;
    setCategory(nextCategory);
    setSelection(EMPTY_SELECTION);
    setCatalogComponentName('');
    setCatalogGameDescription('');
  }

  function submitSelection() {
    if (category === 'custom') {
      const name = customName.trim();
      if (!name) return;
      onAddCustom({ name, description: customDescription.trim() });
      return;
    }
    if (!genre.componentType || !catalogCategory) return;
    if (!hasSelection) return;
    const componentName = catalogComponentName.trim();
    const gameDescription = catalogGameDescription.trim();
    if (!componentName || !gameDescription) return;
    const face = layout?.faces[0] ?? null;
    onSelect({
      type: genre.componentType,
      componentName,
      gameDescription,
      productSlug: selection.catalogSlug,
      variantId: selection.catalogVariantId,
      productTitle: selectedProduct ? productLabel(selectedProduct) : selection.catalogSlug,
      variantTitle: selectedVariant ? variantLabel(selectedVariant, catalogCategory) : '',
      category: catalogCategory,
      priceEach: firstPrice(selectedVariant),
      physicalWidthMm: face ? Number(face.widthMm) : selection.physicalWidthMm,
      physicalHeightMm: face ? Number(face.heightMm) : selection.physicalHeightMm,
      maxCards: genre.componentType === 'deck' ? cardCountFromVariant(selectedVariant) : null,
    });
  }

  const canSubmit = category === 'custom'
    ? customName.trim().length > 0
    : hasSelection && catalogComponentName.trim().length > 0 && catalogGameDescription.trim().length > 0;

  return (
    <>
      <div
        data-layout="componentsCatalogPickerScrim"
        /* invisible page overlay: closes the floating catalog picker on
           outside click. */
        style={{ position: 'fixed', inset: 0, zIndex: 39 }}
        onClick={onClose}
      />
      <div data-layout="componentsCatalogPickerPanel" style={panelStyle}>
        <div
          data-layout="componentsCatalogPickerHeader"
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 0.85rem 0.55rem', borderBottom: '1px solid rgba(120, 95, 50, 0.14)' }}
        >
          <PackagePlus size={17} style={{ color: '#0f766e', flex: '0 0 auto' }} />
          <div data-layout="componentsCatalogPickerTitle" style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div style={{ fontFamily: SERIF_STACK, fontWeight: 800, color: '#3b2412', fontSize: '0.98rem' }}>
              Add catalog item
            </div>
            <div style={{ fontFamily: SERIF_STACK, color: 'rgba(80, 55, 25, 0.68)', fontSize: '0.76rem' }}>
              {isEditingCatalogItem ? 'Change the linked supplier item or variant.' : 'Pick a thing, a size, and a finish.'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close catalog picker"
            style={{ display: 'grid', placeItems: 'center', width: '28px', height: '28px', borderRadius: '999px', border: 'none', background: 'rgba(120, 95, 50, 0.08)', color: 'rgba(120, 60, 30, 0.7)', cursor: 'pointer' }}
          >
            <X size={15} />
          </button>
        </div>

        <div
          data-layout="componentsCatalogPickerFilters"
          /* genre selector — boards / cards / tiles / custom. */
          style={{ padding: '0.7rem 0.85rem 0.35rem' }}
        >
          <label style={labelStyle}>
            Genre
            <select
              value={category}
              onChange={(event) => changeCategory(event.target.value as ComponentGenre)}
              style={fieldStyle}
              disabled={isEditingCatalogItem}
            >
              {GENRE_OPTIONS
                .filter((option) => !isEditingCatalogItem || option.category === category)
                .map((option) => (
                  <option key={option.category} value={option.category}>{option.label}</option>
                ))}
            </select>
          </label>
        </div>

        {category === 'custom' ? (
          <div
            data-layout="componentsCustomPickerBody"
            style={{ minHeight: 0, overflowY: 'auto', display: 'grid', alignContent: 'start', gap: '0.75rem', padding: '0.85rem', borderTop: '1px solid rgba(120, 95, 50, 0.1)', borderBottom: '1px solid rgba(120, 95, 50, 0.1)' }}
          >
            <div
              data-layout="componentsCustomWarning"
              style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', padding: '0.65rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(217, 119, 6, 0.3)', background: 'rgba(255, 247, 237, 0.95)', color: '#9a3412', fontFamily: SERIF_STACK, fontSize: '0.82rem', lineHeight: 1.45 }}
            >
              <AlertTriangle size={17} style={{ flex: '0 0 auto', marginTop: '0.05rem' }} />
              <div>
                <strong>Custom components are rulebook-only.</strong> They will appear in the Components chapter, but they are not in our supplier catalog and cannot be bought from us.
              </div>
            </div>
            <label style={{ ...labelStyle, fontSize: '0.8rem', fontWeight: 800 }}>
              Component name
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="e.g. Reputation markers"
                style={{ ...fieldStyle, fontSize: '0.92rem' }}
              />
            </label>
            <label style={{ ...labelStyle, fontSize: '0.8rem', fontWeight: 800 }}>
              Rulebook description
              <textarea
                value={customDescription}
                onChange={(event) => setCustomDescription(event.target.value)}
                placeholder="What is it? How should players recognize or use it?"
                style={{ ...fieldStyle, minHeight: '96px', resize: 'vertical', lineHeight: 1.5 }}
              />
            </label>
          </div>
        ) : (
          <div
            data-layout="componentsCatalogPickerBody"
            /* the same thing -> size -> finish selectors as the component editor,
               followed by the rulebook identity fields. */
            style={{ minHeight: 0, overflowY: 'auto', display: 'grid', alignContent: 'start', gap: '0.7rem', padding: '0.5rem 0.85rem 0.85rem', borderTop: '1px solid rgba(120, 95, 50, 0.1)', borderBottom: '1px solid rgba(120, 95, 50, 0.1)' }}
          >
            {genre.componentType ? (
              <CatalogSelector
                componentType={genre.componentType}
                selection={selection}
                preferredUnits={preferredUnits}
                onChange={setSelection}
                styles={selectorStyles}
              />
            ) : null}

            {layout?.faces[0] ? (
              <div data-layout="componentsCatalogSizeSummary" style={{ fontFamily: SERIF_STACK, fontSize: '0.78rem', color: '#3b2412' }}>
                {formatDimensions(layout.faces[0].widthMm, layout.faces[0].heightMm, preferredUnits)}
                {firstPrice(selectedVariant) !== null ? ` · from $${firstPrice(selectedVariant)!.toFixed(2)} each` : ''}
              </div>
            ) : null}
            {selectedVariant && selectedVariant.priceTiers.length > 1 ? (
              <div style={{ display: 'grid', gap: '0.1rem', fontFamily: SERIF_STACK, fontSize: '0.74rem', color: 'rgba(80,55,25,0.7)' }}>
                {selectedVariant.priceTiers.slice(0, 3).map((tier) => (
                  <span key={`${tier.minQuantity}-${tier.maxQuantity ?? 'up'}`}>{formatPriceTier(tier)}</span>
                ))}
              </div>
            ) : null}

            {hasSelection ? (
              <div
                data-layout="componentsCatalogUserFields"
                /* the supplier SKU isn't the component's game name or rules text. */
                style={{ display: 'grid', gap: '0.45rem', borderTop: '1px solid rgba(120, 95, 50, 0.12)', paddingTop: '0.6rem' }}
              >
                <label style={labelStyle}>
                  Component name
                  <input
                    value={catalogComponentName}
                    onChange={(event) => setCatalogComponentName(event.target.value)}
                    placeholder="e.g. City board"
                    style={fieldStyle}
                  />
                </label>
                <label style={labelStyle}>
                  In-game description
                  <textarea
                    value={catalogGameDescription}
                    onChange={(event) => setCatalogGameDescription(event.target.value)}
                    placeholder="What players call it and how it is used during play."
                    style={{ ...fieldStyle, minHeight: '68px', resize: 'vertical', lineHeight: 1.45 }}
                  />
                </label>
              </div>
            ) : null}
          </div>
        )}

        <div
          data-layout="componentsCatalogPickerActions"
          style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.65rem 0.85rem' }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.45rem 0.75rem', borderRadius: '999px', border: '1px solid rgba(120, 95, 50, 0.3)', background: 'rgba(255, 253, 246, 0.95)', color: '#3b2412', cursor: 'pointer', fontFamily: SERIF_STACK, fontWeight: 700, fontSize: '0.8rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submitSelection}
            disabled={!canSubmit}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', borderRadius: '999px', border: '1px solid rgba(15, 118, 110, 0.45)', background: canSubmit ? 'rgba(13, 148, 136, 0.95)' : 'rgba(13, 148, 136, 0.36)', color: '#fffdf6', cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: SERIF_STACK, fontWeight: 800, fontSize: '0.8rem' }}
          >
            <Check size={14} />
            {category === 'custom' ? 'Add custom' : isEditingCatalogItem ? 'Update item' : 'Add item'}
          </button>
        </div>
      </div>
    </>
  );
}
