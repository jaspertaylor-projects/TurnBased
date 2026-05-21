import { useEffect, useRef, useState } from 'react';
import type { CatalogProduct, ProductDetailResponse, ProductLayoutResponse } from './supplierCatalog';
import { fetchCatalogProducts, fetchProductDetail, fetchProductLayout } from './supplierCatalog';

/** Simple in-memory cache keyed by category or slug. */
const productsCache = new Map<string, CatalogProduct[]>();
const layoutCache = new Map<string, ProductLayoutResponse>();
const detailCache = new Map<string, ProductDetailResponse>();

/** Read a previously fetched layout from cache (synchronous). */
export function getCachedLayout(slug: string, variantId?: string): ProductLayoutResponse | null {
  const key = `${slug}::${variantId ?? ''}`;
  return layoutCache.get(key) ?? null;
}

export function useCatalogProducts(category: string | null): {
  products: CatalogProduct[];
  loading: boolean;
  error: string | null;
} {
  const [products, setProducts] = useState<CatalogProduct[]>(() =>
    category ? productsCache.get(category) ?? [] : [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categoryRef = useRef(category);
  categoryRef.current = category;

  useEffect(() => {
    if (!category) {
      setProducts([]);
      setLoading(false);
      setError(null);
      return;
    }

    const cached = productsCache.get(category);
    if (cached) {
      setProducts(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCatalogProducts(category)
      .then((items) => {
        if (cancelled) return;
        productsCache.set(category, items);
        setProducts(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load catalog');
        setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [category]);

  return { products, loading, error };
}

export function useCatalogProductDetail(slug: string | null): {
  detail: ProductDetailResponse | null;
  loading: boolean;
  error: string | null;
} {
  // `tick` forces a re-render once an uncached fetch lands in the cache.
  const [, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive `detail` from the cache directly so we don't duplicate state. The
  // cache is the single source of truth — tick-bumps just trigger re-renders
  // when the cache mutates outside of React.
  const detail = slug ? (detailCache.get(slug) ?? null) : null;

  useEffect(() => {
    if (!slug || detailCache.has(slug)) return;

    let cancelled = false;
    // Matches the pattern used by useCatalogProducts / useCatalogLayout above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    fetchProductDetail(slug)
      .then((data) => {
        if (cancelled) return;
        detailCache.set(slug, data);
        setTick((t) => t + 1);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load product detail');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug]);

  return { detail, loading: loading && !detail, error };
}

export function useCatalogLayout(slug: string | null, variantId?: string): {
  layout: ProductLayoutResponse | null;
  loading: boolean;
  error: string | null;
} {
  const cacheKey = slug ? `${slug}::${variantId ?? ''}` : '';
  const [fetchedLayout, setFetchedLayout] = useState<ProductLayoutResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Return cached value synchronously so the layout is always in sync with
  // the current slug on the same render — no stale-layout-from-previous-slug.
  const cachedLayout = cacheKey ? layoutCache.get(cacheKey) ?? null : null;
  const layout = slug ? (cachedLayout ?? fetchedLayout) : null;

  useEffect(() => {
    if (!slug) {
      setFetchedLayout(null);
      setLoading(false);
      setError(null);
      return;
    }

    const key = `${slug}::${variantId ?? ''}`;
    if (layoutCache.has(key)) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchProductLayout(slug, variantId)
      .then((data) => {
        if (cancelled) return;
        layoutCache.set(key, data);
        setFetchedLayout(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load layout');
        setFetchedLayout(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug, variantId]);

  return { layout, loading, error };
}
