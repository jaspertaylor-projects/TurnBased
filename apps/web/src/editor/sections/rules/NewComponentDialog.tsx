import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, PackagePlus, X } from 'lucide-react';

import {
  parseCardCount,
  type CatalogProduct,
  type ProductVariant,
} from '../../supplierCatalog';
import { formatDimensions } from '../../units';
import { useCatalogLayout, useCatalogProductDetail, useCatalogProducts } from '../../useSupplierCatalog';
import { useUserSettings } from '../../../userSettings';
import { tabletop, parchmentSurface, cardShadow } from '../../theme/tabletop';
import { CatalogSelector, type CatalogSelection, type CatalogSelectorStyles } from '../visuals/CatalogSelector';

type CatalogCategory = 'boards' | 'cards' | 'tiles';
type ComponentType = 'board' | 'deck' | 'tile';

interface GenreOption {
  category: CatalogCategory;
  label: string;
  type: ComponentType;
}

const GENRE_OPTIONS: GenreOption[] = [
  { category: 'boards', label: 'Board', type: 'board' },
  { category: 'cards', label: 'Deck of cards', type: 'deck' },
  { category: 'tiles', label: 'Tiles', type: 'tile' },
];

/** The catalog tie carried back when a new component is created from the picker. */
export interface NewComponentCatalog {
  catalogSlug: string;
  catalogVariantId: string;
  catalogProductTitle: string;
  catalogVariantTitle: string;
  physicalWidthMm: number | null;
  physicalHeightMm: number | null;
  maxCards: number | null;
}

const EMPTY_SELECTION: CatalogSelection = {
  catalogSlug: '',
  catalogVariantId: '',
  shape: '',
  physicalWidthMm: null,
  physicalHeightMm: null,
};

const fieldStyle = {
  boxSizing: 'border-box' as const,
  width: '100%',
  border: `1px solid ${tabletop.parchment.edge}`,
  borderRadius: '10px',
  background: tabletop.parchment.sunken,
  color: tabletop.ink.strong,
  fontSize: '0.86rem',
  fontWeight: 600,
  padding: '0.58rem 0.68rem',
  outline: 'none',
};

const labelStyle = {
  display: 'grid' as const,
  gap: '0.3rem',
  color: tabletop.ink.soft,
  fontSize: '0.8rem',
  fontWeight: 700,
};

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

/**
 * The "New component" picker: choose a thing, a size, and a finish from the
 * catalog first, then create the component (already tied to that catalog item)
 * and drop into the editor. A skip link still allows creating an untied
 * component when the catalog is unavailable or set-up is deferred.
 */
export function NewComponentDialog({
  onClose,
  onCreateCatalog,
  onCreateUntied,
}: {
  onClose: () => void;
  onCreateCatalog: (type: ComponentType, catalog: NewComponentCatalog) => void;
  onCreateUntied: (type: ComponentType) => void;
}) {
  const { preferredUnits } = useUserSettings();
  const [category, setCategory] = useState<CatalogCategory>('boards');
  const [selection, setSelection] = useState<CatalogSelection>(EMPTY_SELECTION);

  const genre = GENRE_OPTIONS.find((option) => option.category === category) ?? GENRE_OPTIONS[0];

  const { products } = useCatalogProducts(category);
  const { detail } = useCatalogProductDetail(selection.catalogSlug || null);
  const { layout } = useCatalogLayout(selection.catalogSlug || null, selection.catalogVariantId || undefined);

  const selectedProduct = products.find((p) => p.slug === selection.catalogSlug) ?? null;
  const selectedVariant = detail?.productVariants.find((v) => v.id === selection.catalogVariantId) ?? null;
  const hasSelection = Boolean(selection.catalogSlug && selection.catalogVariantId);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const priceLabel = useMemo(() => {
    const price = firstPrice(selectedVariant);
    return price !== null ? ` · from $${price.toFixed(2)} each` : '';
  }, [selectedVariant]);

  function changeCategory(next: CatalogCategory) {
    setCategory(next);
    setSelection(EMPTY_SELECTION);
  }

  function handleCreate() {
    if (!hasSelection) return;
    const face = layout?.faces[0] ?? null;
    onCreateCatalog(genre.type, {
      catalogSlug: selection.catalogSlug,
      catalogVariantId: selection.catalogVariantId,
      catalogProductTitle: selectedProduct ? productLabel(selectedProduct) : selection.catalogSlug,
      catalogVariantTitle: selectedVariant ? variantLabel(selectedVariant, category) : '',
      physicalWidthMm: face ? Number(face.widthMm) : selection.physicalWidthMm,
      physicalHeightMm: face ? Number(face.heightMm) : selection.physicalHeightMm,
      maxCards: genre.type === 'deck' ? cardCountFromVariant(selectedVariant) : null,
    });
  }

  return (
    <div
      data-layout="newComponentDialogOverlay"
      /* fixed centered overlay for the catalog-first new-component picker */
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(36,22,8,0.32)', backdropFilter: 'blur(6px)' }}
    >
      <section
        data-layout="newComponentDialogPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-component-dialog-title"
        style={{ width: 'min(560px, 100%)', maxHeight: 'min(640px, calc(100vh - 2rem))', borderRadius: '16px', border: `1px solid ${tabletop.brass.deep}`, background: parchmentSurface, boxShadow: cardShadow, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div
          data-layout="newComponentDialogHeader"
          style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.85rem 1rem', borderBottom: `2px solid ${tabletop.brass.deep}`, background: `linear-gradient(180deg, ${tabletop.wood.light}, ${tabletop.wood.mid} 48%, ${tabletop.wood.base})` }}
        >
          <PackagePlus size={18} style={{ color: tabletop.ink.onWood, flex: '0 0 auto' }} />
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <h2 id="new-component-dialog-title" style={{ margin: 0, fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 700, color: tabletop.ink.onWood, fontSize: '1.15rem', letterSpacing: '0.02em' }}>
              New component
            </h2>
            <div style={{ color: tabletop.ink.onWoodSoft, fontSize: '0.78rem' }}>
              Pick a thing, a size, and a finish.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: '30px', height: '30px', borderRadius: '999px', border: '1px solid rgba(216,185,119,0.4)', background: 'rgba(247,239,218,0.14)', color: tabletop.ink.onWood, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
          >
            <X size={15} />
          </button>
        </div>

        <div
          data-layout="newComponentDialogBody"
          style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0.9rem 1rem', display: 'grid', alignContent: 'start', gap: '0.7rem' }}
        >
          <label style={labelStyle}>
            Component type
            <select value={category} onChange={(event) => changeCategory(event.target.value as CatalogCategory)} style={fieldStyle}>
              {GENRE_OPTIONS.map((option) => (
                <option key={option.category} value={option.category}>{option.label}</option>
              ))}
            </select>
          </label>

          <CatalogSelector
            componentType={genre.type}
            selection={selection}
            preferredUnits={preferredUnits}
            onChange={setSelection}
            styles={selectorStyles}
          />

          {layout?.faces[0] ? (
            <div data-layout="newComponentSizeSummary" style={{ fontSize: '0.8rem', color: tabletop.ink.base, fontWeight: 600 }}>
              {formatDimensions(layout.faces[0].widthMm, layout.faces[0].heightMm, preferredUnits)}{priceLabel}
            </div>
          ) : null}
        </div>

        <div
          data-layout="newComponentDialogFooter"
          style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', padding: '0.8rem 1rem', borderTop: `1px solid ${tabletop.parchment.edge}` }}
        >
          <button
            type="button"
            onClick={() => onCreateUntied(genre.type)}
            style={{ border: 'none', background: 'none', color: tabletop.ink.soft, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}
          >
            Skip — set up in the editor
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!hasSelection}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.95rem', borderRadius: '999px', border: 'none', background: hasSelection ? 'linear-gradient(180deg, #d8b977, #b8924e)' : 'rgba(184,146,78,0.35)', color: hasSelection ? '#3a2c10' : 'rgba(58,44,16,0.6)', fontWeight: 800, fontSize: '0.82rem', cursor: hasSelection ? 'pointer' : 'not-allowed', boxShadow: hasSelection ? 'inset 0 1px 0 rgba(255,255,255,0.4)' : 'none' }}
          >
            Create component
            <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}
