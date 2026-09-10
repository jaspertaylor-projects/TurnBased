import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Package, X } from 'lucide-react';
import type { EditorProject } from '../types';
import type { ProjectDesignSet } from '../componentStudio/types';
import type { CatalogProduct } from '../supplierCatalog';
import { siteLabel } from '../supplierCatalog';
import {
  applySupplierMatch,
  classifyCatalogProduct,
  currentSupplierMatchTarget,
  safeSupplierUrl,
  supplierDimensions,
  supplierMatchTarget,
  supplierProductUrl,
  supplierTrimShape,
  type SupplierMatchMode,
} from './supplierMatch';
import { useSupplierMatchDetail, useSupplierMatchProducts } from './useSupplierMatchCatalog';
import './supplierMatch.css';

const CATEGORIES = [
  ['cards', 'Printed cards'],
  ['tiles', 'Printed tokens & tiles'],
  ['boards', 'Boards & mats'],
  ['money', 'Stock coins & money'],
  ['tokens', 'Stock tokens'],
  ['pawns', 'Pawns'],
  ['meeples', 'Meeples'],
  ['dice', 'Dice'],
  ['pieces', 'Pieces'],
  ['', 'All catalog categories'],
];
const DEFAULT_CATEGORY = {
  card: 'cards',
  board: 'boards',
  mat: 'boards',
  tile: 'tiles',
  token: 'tiles',
  piece: '',
};
const TYPE_LABEL = {
  printable: 'Custom printed product',
  stock: 'Stock part · supplier appearance',
  unverified: 'Printing support unverified',
};
const mm = (value: number) => Number(value.toFixed(2));

export function SupplierMatchDialog({
  project,
  design,
  onChange,
  onClose,
}: {
  project: EditorProject;
  design: ProjectDesignSet;
  onChange: (project: EditorProject) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const latest = useRef({ project, onChange });
  useLayoutEffect(() => {
    latest.current = { project, onChange };
  }, [project, onChange]);
  const [target] = useState(() => supplierMatchTarget(project, design));
  const [category, setCategory] = useState(DEFAULT_CATEGORY[design.kind]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [variantId, setVariantId] = useState('');
  const [mode, setMode] = useState<SupplierMatchMode | ''>('');
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const products = useSupplierMatchProducts(category, query, page);
  const detail = useSupplierMatchDetail(product?.slug ?? null);
  const variant = detail.data?.productVariants.find((item) => item.id === variantId);
  const productionType = product ? classifyCatalogProduct(product) : 'unverified';
  const dimensions = variant ? supplierDimensions(variant) : null;
  const shape = product ? supplierTrimShape(product.shape) : null;
  const canFit =
    productionType === 'printable' &&
    Boolean(
      dimensions &&
      shape &&
      dimensions.widthMm >= 1 &&
      dimensions.heightMm >= 1 &&
      dimensions.widthMm <= 2000 &&
      dimensions.heightMm <= 2000,
    );
  const source = product ? supplierProductUrl(product, variant) : null;
  let stale: string | null = null;
  try {
    currentSupplierMatchTarget(project, target);
  } catch (cause) {
    stale = (cause as Error).message;
  }
  const ready = product && variant && mode && !stale;

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  function chooseProduct(value: CatalogProduct) {
    setProduct(value);
    setVariantId('');
    setMode('');
    setReview(false);
    setError(null);
  }
  function apply() {
    if (!product || !variant || !mode) return;
    try {
      latest.current.onChange(applySupplierMatch(latest.current.project, target, { product, variant, mode }));
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The match could not be applied.');
    }
  }

  return (
    <dialog
      ref={dialog}
      className="supplier-dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
    >
      <header className="supplier-dialog-header">
        <div data-layout="supplierMatchHeading">
          <span className="supplier-eyebrow">Physical production</span>
          <h2 id={titleId}>Match supplier · {design.name}</h2>
          <p>Choose a real product and variant, then review how it fits your component.</p>
        </div>
        <button
          type="button"
          className="component-button"
          aria-label="Close supplier match"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div data-layout="supplierMatchBody" className="supplier-dialog-body">
        {(stale || error) && (
          <p role="alert" className="supplier-error">
            {stale || error}
          </p>
        )}
        {!review && (
          <>
            <div data-layout="supplierCatalogFilters" className="supplier-filters">
              <label>
                Catalog category
                <select
                  aria-label="Catalog category"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setPage(1);
                  }}
                >
                  {CATEGORIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Find a supplier product
                <input
                  type="search"
                  value={query}
                  placeholder="Try circle, poker, gold coin…"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </div>
            <div data-layout="supplierCatalogBrowser" className="supplier-browser">
              <section aria-label="Supplier products" className="supplier-products">
                <p className="supplier-muted" aria-live="polite">
                  {products.loading ? 'Loading catalog…' : `${products.data?.total ?? 0} products found`}
                </p>
                {products.error && (
                  <p role="alert" className="supplier-error">
                    {products.error}
                  </p>
                )}
                {products.data?.items.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    className="supplier-product"
                    aria-pressed={product?.slug === item.slug}
                    onClick={() => chooseProduct(item)}
                  >
                    {safeSupplierUrl(item.imageUrl) ? (
                      <img alt="" src={safeSupplierUrl(item.imageUrl)!} loading="lazy" />
                    ) : (
                      <Package size={28} />
                    )}
                    <span>
                      <strong>{item.customTitle || item.title}</strong>
                      <small>
                        {siteLabel(item)} · {TYPE_LABEL[classifyCatalogProduct(item)]}
                      </small>
                    </span>
                  </button>
                ))}
                <div data-layout="supplierCatalogPagination" className="supplier-pagination">
                  <button
                    type="button"
                    className="component-button"
                    disabled={page <= 1 || products.loading}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous products
                  </button>
                  <span>Page {page}</span>
                  <button
                    type="button"
                    className="component-button"
                    disabled={products.loading || !products.data || page * 36 >= products.data.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Next products
                  </button>
                </div>
              </section>
              <section aria-label="Selected supplier product" className="supplier-selection">
                {product ? (
                  <>
                    <span className="supplier-badge">{TYPE_LABEL[productionType]}</span>
                    <h3>{product.customTitle || product.title}</h3>
                    <p>{siteLabel(product)}</p>
                    {source && (
                      <a href={source} target="_blank" rel="noopener noreferrer">
                        View supplier product <ExternalLink size={13} />
                      </a>
                    )}
                    {detail.loading && <p aria-live="polite">Loading variants…</p>}
                    {detail.error && (
                      <p role="alert" className="supplier-error">
                        {detail.error}
                      </p>
                    )}
                    {detail.data && (
                      <label>
                        Supplier variant
                        <select
                          aria-label="Supplier variant"
                          value={variantId}
                          onChange={(event) => {
                            setVariantId(event.target.value);
                            setMode('');
                          }}
                        >
                          <option value="">Choose a variant…</option>
                          {detail.data.productVariants.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {variant && (
                      <>
                        <p>
                          <strong>
                            {dimensions
                              ? `${mm(dimensions.widthMm)} × ${mm(dimensions.heightMm)} mm`
                              : 'Physical size is not provided in this catalog.'}
                          </strong>
                          {product.shape ? ` · ${product.shape}` : ''}
                        </p>
                        <dl className="supplier-options">
                          {variant.options.map((option, index) => (
                            <div data-layout="supplierVariantOption" key={`${option.optionKey}-${index}`}>
                              <dt>
                                {'optionLabel' in option && typeof option.optionLabel === 'string'
                                  ? option.optionLabel
                                  : option.optionGroup}
                              </dt>
                              <dd>{option.optionValue}</dd>
                            </div>
                          ))}
                        </dl>
                        {productionType === 'stock' ? (
                          <p className="supplier-notice">
                            This is a ready-made part. Your design will not be printed on it. The supplier’s
                            material, color, and appearance apply.
                          </p>
                        ) : (
                          <p className="supplier-notice">
                            Catalog measurements help you choose a fit. Confirm the supplier’s current
                            cutting, bleed, safe-area, and file requirements before ordering.
                          </p>
                        )}
                        {productionType === 'unverified' && (
                          <p>
                            Custom printing has not been confirmed for this product. You can save a reference
                            link only.
                          </p>
                        )}
                        <fieldset className="supplier-choices">
                          <legend>How to use this product</legend>
                          {canFit && (
                            <label>
                              <input
                                type="radio"
                                name={`${titleId}-mode`}
                                checked={mode === 'fit-template'}
                                onChange={() => setMode('fit-template')}
                              />
                              <span>
                                <strong>Fit template to supplier size</strong>
                                <small>
                                  {mm(design.studio.template.widthMm)} × {mm(design.studio.template.heightMm)}{' '}
                                  → {mm(dimensions!.widthMm)} × {mm(dimensions!.heightMm)} mm;{' '}
                                  {product.shape || 'rectangle'} trim. Scales layers and text; keeps your
                                  current bleed and safe area.
                                </small>
                              </span>
                            </label>
                          )}
                          {productionType === 'stock' ? (
                            <label>
                              <input
                                type="radio"
                                name={`${titleId}-mode`}
                                checked={mode === 'stock-part'}
                                onChange={() => setMode('stock-part')}
                              />
                              <span>
                                <strong>Use stock part</strong>
                                <small>
                                  Link this part and keep my prototype artwork and size unchanged.
                                </small>
                              </span>
                            </label>
                          ) : (
                            <label>
                              <input
                                type="radio"
                                name={`${titleId}-mode`}
                                checked={mode === 'link-only'}
                                onChange={() => setMode('link-only')}
                              />
                              <span>
                                <strong>Keep current template size</strong>
                                <small>
                                  Save the product reference. My {mm(design.studio.template.widthMm)} ×{' '}
                                  {mm(design.studio.template.heightMm)} mm design may still need adaptation
                                  for this supplier.
                                </small>
                              </span>
                            </label>
                          )}
                        </fieldset>
                      </>
                    )}
                  </>
                ) : (
                  <p className="supplier-empty">
                    Choose a product to see its variants, materials, and dimensions.
                  </p>
                )}
              </section>
            </div>
          </>
        )}
        {review && product && variant && (
          <section className="supplier-review" aria-label="Review supplier match">
            <span className="supplier-badge">{TYPE_LABEL[productionType]}</span>
            <h3>
              {design.name} → {product.customTitle || product.title}
            </h3>
            <p>
              {siteLabel(product)} · {variant.title}
            </p>
            <p>
              {design.studio.rows.reduce((sum, row) => sum + row.copies, 0)} component copies per game.
              Supplier sheet or pack quantities are checked separately in the order plan.
            </p>
            <dl className="supplier-options">
              {variant.options.map((option, index) => (
                <div data-layout="supplierReviewOption" key={index}>
                  <dt>{option.optionGroup}</dt>
                  <dd>{option.optionValue}</dd>
                </div>
              ))}
            </dl>
            {mode === 'fit-template' && dimensions ? (
              <p className="supplier-notice">
                <strong>Template change:</strong> {mm(design.studio.template.widthMm)} ×{' '}
                {mm(design.studio.template.heightMm)} mm → {mm(dimensions.widthMm)} ×{' '}
                {mm(dimensions.heightMm)} mm, {product.shape || 'rectangle'} trim. Every face’s layers and
                text will scale. Check artwork placement afterward; bleed and safe area remain unchanged.
              </p>
            ) : (
              <p className="supplier-notice">
                Your template artwork and size will stay unchanged.{' '}
                {mode === 'stock-part'
                  ? 'This purchase uses the supplier’s stock appearance. Your artwork is not a production file for this part.'
                  : 'This saves a supplier reference; it does not certify that your artwork is ready to print.'}
              </p>
            )}
            {source && (
              <a href={source} target="_blank" rel="noopener noreferrer">
                Review the supplier’s current specifications <ExternalLink size={13} />
              </a>
            )}
            <p className="supplier-muted">
              Applying a match updates this game locally. It does not place an order or send files to a
              supplier.
            </p>
          </section>
        )}
      </div>
      <footer className="supplier-dialog-footer">
        <button
          type="button"
          className="component-button"
          onClick={review ? () => setReview(false) : onClose}
        >
          {review && <ArrowLeft size={14} />}
          {review ? 'Back to selection' : 'Cancel'}
        </button>
        <button
          type="button"
          className="component-button component-button--primary"
          disabled={!ready}
          onClick={review ? apply : () => setReview(true)}
        >
          {review ? 'Apply supplier match' : 'Review match'}
        </button>
      </footer>
    </dialog>
  );
}
