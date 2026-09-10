import { useEffect, useState, type CSSProperties } from 'react';
import type { CatalogProduct } from '../../supplierCatalog';
import { groupTitleStyle, sectionDividerStyle } from './catalogSelectorStyles';

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
export function CatalogPreviewImage({ product }: { product: CatalogProduct | null }) {
  const imageUrl = product?.imageUrl ?? null;
  const [errored, setErrored] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

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
      <div data-layout="catalogPreviewHeading" style={groupTitleStyle}>Preview</div>
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
