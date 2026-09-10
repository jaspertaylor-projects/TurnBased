import { useEffect, useState } from 'react';
import type { CatalogProduct, ProductDetailResponse, ProductLayoutResponse } from './supplierCatalog';
import { fetchCatalogProducts, fetchProductDetail, fetchProductLayout } from './supplierCatalog';

/** Simple in-memory cache keyed by category or slug. */
const productsCache = new Map<string, CatalogProduct[]>();
const layoutCache = new Map<string, ProductLayoutResponse>();
const detailCache = new Map<string, ProductDetailResponse>();
const EMPTY_PRODUCTS: CatalogProduct[] = [];

/** Read a previously fetched layout from cache (synchronous). */
export function getCachedLayout(slug: string, variantId?: string): ProductLayoutResponse | null {
  return layoutCache.get(`${slug}::${variantId ?? ''}`) ?? null;
}

interface CatalogResult<T> {
  key: string | null;
  data: T | null;
  error: string | null;
}

/** Keep results tied to their request, including while a new selection loads. */
function useCachedCatalogResource<T>(
  key: string | null,
  cache: Map<string, T>,
  load: (key: string) => Promise<T>,
  failureMessage: string,
) {
  const [result, setResult] = useState<CatalogResult<T>>({ key, data: null, error: null });
  if (result.key !== key) {
    // Reset this hook's state before rendering children for a different request.
    // No previous product's data, loading status, or error can cross the boundary.
    setResult({ key, data: null, error: null });
  }
  const current = result.key === key ? result : null;
  const cached = key ? cache.get(key) : undefined;
  const data = key ? cached ?? current?.data ?? null : null;
  const error = key && !cached ? current?.error ?? null : null;

  useEffect(() => {
    if (!key || cache.has(key)) return;
    let cancelled = false;
    load(key).then((data) => {
      if (cancelled) return;
      cache.set(key, data);
      setResult({ key, data, error: null });
    }).catch((cause) => {
      if (cancelled) return;
      setResult({ key, data: null, error: cause instanceof Error ? cause.message : failureMessage });
    });
    return () => { cancelled = true; };
  }, [key, cache, load, failureMessage]);

  return { data, loading: Boolean(key && data === null && error === null), error };
}

export function useCatalogProducts(category: string | null): {
  products: CatalogProduct[];
  loading: boolean;
  error: string | null;
} {
  const { data, loading, error } = useCachedCatalogResource(
    category, productsCache, fetchCatalogProducts, 'Failed to load catalog',
  );
  return { products: data ?? EMPTY_PRODUCTS, loading, error };
}

export function useCatalogProductDetail(slug: string | null): {
  detail: ProductDetailResponse | null;
  loading: boolean;
  error: string | null;
} {
  const { data, loading, error } = useCachedCatalogResource(
    slug, detailCache, fetchProductDetail, 'Failed to load product detail',
  );
  return { detail: data, loading, error };
}

function loadLayout(key: string): Promise<ProductLayoutResponse> {
  const separator = key.lastIndexOf('::');
  return fetchProductLayout(key.slice(0, separator), key.slice(separator + 2) || undefined);
}

export function useCatalogLayout(slug: string | null, variantId?: string): {
  layout: ProductLayoutResponse | null;
  loading: boolean;
  error: string | null;
} {
  const key = slug ? `${slug}::${variantId ?? ''}` : null;
  const { data, loading, error } = useCachedCatalogResource(key, layoutCache, loadLayout, 'Failed to load layout');
  return { layout: data, loading, error };
}
