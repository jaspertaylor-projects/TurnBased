export interface RawSupplierPage {
  url: string;
  html: string;
}

export type ParsedProduct = {
  product: {
    externalProductId?: string;
    slug: string;
    title: string;
    category: string;
    subcategory?: string;
    shape?: string | null;
    sourceUrl: string;
    imageUrl?: string | null;
    description?: string;
    currency: string;
  };
  variants: Array<{
    variantCode: string;
    title: string;
    isDefault?: boolean;
    options: Array<{
      optionGroup: string;
      optionKey: string;
      optionLabel: string;
      optionValue: string;
      priceDataJson?: any;
    }>;
    layoutConstraints: Array<{
      faceKey: string;
      widthMm?: number;
      heightMm?: number;
      widthPx?: number;
      heightPx?: number;
      bleedMm?: number;
      safeZoneMm?: number;
      dpi?: number;
      panelCount?: number;
      cutlineRequired?: boolean;
      notes?: string;
      constraintsJson?: Record<string, unknown>;
    }>;
    priceTiers: Array<{
      minQuantity: number;
      maxQuantity?: number | null;
      unitPrice: number;
      totalPrice?: number | null;
      currency: string;
    }>;
  }>;
  rawMetadata: Record<string, unknown>;
};

export interface SupplierCatalogAdapter {
  discoverProductUrls(): Promise<string[]>;
  fetchProduct(url: string): Promise<RawSupplierPage>;
  parseProduct(page: RawSupplierPage): Promise<ParsedProduct>;
}
