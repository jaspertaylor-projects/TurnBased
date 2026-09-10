import { useEffect, useState } from 'react';
import type { CatalogProductsResponse, ProductDetailResponse } from '../supplierCatalog';

function useCatalogRequest<T>(url: string | null) {
  const [result, setResult] = useState<{ url: string; data: T | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let active = true;
    const deadline = window.setTimeout(() => controller.abort(), 15000);
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`The catalog could not be loaded (${response.status}).`);
        return (await response.json()) as T;
      })
      .then((data) => {
        if (active) setResult({ url, data, error: null });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            url,
            data: null,
            error: controller.signal.aborted
              ? 'The catalog took too long to respond. Try your search again.'
              : error instanceof Error
                ? error.message
                : 'The catalog could not be loaded.',
          });
      })
      .finally(() => window.clearTimeout(deadline));
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(deadline);
    };
  }, [url]);
  return {
    data: result?.url === url ? result.data : null,
    error: result?.url === url ? result.error : null,
    loading: Boolean(url && result?.url !== url),
  };
}

export function useSupplierMatchProducts(category: string, query: string, page: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: '36' });
  if (category) params.set('category', category);
  if (query.trim()) params.set('q', query.trim());
  return useCatalogRequest<CatalogProductsResponse>(`/v1/products?${params}`);
}

export function useSupplierMatchDetail(slug: string | null) {
  return useCatalogRequest<ProductDetailResponse>(slug ? `/v1/products/${encodeURIComponent(slug)}` : null);
}
