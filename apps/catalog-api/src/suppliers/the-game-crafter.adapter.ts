import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SupplierCatalogAdapter,
  RawSupplierPage,
  ParsedProduct,
} from './supplier.interface';
import {
  TGC_CURATED_PRODUCTS,
  CURATED_URL_PREFIX,
  curatedToParsedProduct,
  CuratedProduct,
} from './the-game-crafter.products';

const DEFAULT_API_BASE = 'https://www.thegamecrafter.com/api';
const PUBLIC_BASE = 'https://www.thegamecrafter.com';
const PAGE_SIZE = 100; // Wing API maximum.
const INCH_TO_MM = 25.4;

/**
 * Shape of a single Part object returned by the Game Crafter "Wing" API.
 * Only the fields we consume are typed; the API returns many more.
 */
interface TgcPart {
  id: string;
  sku_id?: string;
  name: string;
  uri_part?: string;
  shop_uri?: string;
  category?: string;
  family?: string;
  material?: string;
  color?: string;
  description?: string;
  preview_uri?: string;
  number_of_sides?: number;
  // Dimensions are expressed in inches.
  width?: number;
  height?: number;
  depth?: number;
  weight?: number;
  // Tiered unit prices (strings such as "0.3525").
  price?: string;
  price_10?: string;
  price_100?: string;
  price_1000?: string;
  // Availability flags.
  discontinued?: number;
  public?: number;
  virtual?: number;
}

/**
 * Adapter for The Game Crafter (https://www.thegamecrafter.com).
 *
 * Unlike the BoardGamesMaker adapter (which scrapes HTML), this talks to the
 * authenticated Wing REST API. The catalog is modelled as flat "parts" — each
 * part is a single SKU with built-in volume pricing — so a part maps to one
 * CatalogProduct with a single default variant carrying the price tiers.
 *
 * Auth: a session is minted from username + password + api_key_id and cached
 * in memory. If a request fails because the session expired, it re-mints once.
 */
@Injectable()
export class TheGameCrafterAdapter implements SupplierCatalogAdapter {
  private readonly logger = new Logger(TheGameCrafterAdapter.name);
  private readonly apiBase: string;

  private sessionId: string | null = null;
  /** In-flight login, so concurrent callers share one session mint. */
  private sessionPromise: Promise<string> | null = null;

  constructor(private readonly config: ConfigService) {
    this.apiBase = (
      this.config.get<string>('GAMECRAFTER_API_BASE') ?? DEFAULT_API_BASE
    ).replace(/\/$/, '');
  }

  // ---------------------------------------------------------------------------
  // SupplierCatalogAdapter
  // ---------------------------------------------------------------------------

  /**
   * Pages through the entire parts catalog and returns the API URL for each
   * live part. The processor enqueues one fetch job per URL.
   */
  async discoverProductUrls(): Promise<string[]> {
    const urls: string[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const body = await this.apiGet(
        `/part?_items_per_page=${PAGE_SIZE}&_page_number=${page}`,
      );
      const items: TgcPart[] = body?.result?.items ?? [];
      const paging = body?.result?.paging;
      totalPages = Number(paging?.total_pages ?? page);

      for (const part of items) {
        if (!this.isIngestible(part)) continue;
        urls.push(`${this.apiBase}/part/${part.id}`);
      }

      this.logger.log(
        `Discovered page ${page}/${totalPages} (${urls.length} parts so far)`,
      );
      page += 1;
    } while (page <= totalPages);

    // Append the curated printable products (decks, boards, booklets, boxes).
    const curatedUrls = TGC_CURATED_PRODUCTS.map(
      (p) => `${CURATED_URL_PREFIX}${p.slug}`,
    );
    urls.push(...curatedUrls);

    this.logger.log(
      `Discovery complete: ${urls.length - curatedUrls.length} parts + ` +
        `${curatedUrls.length} curated products`,
    );
    return urls;
  }

  /**
   * Fetches a single part. The raw JSON of the part object is stored as the
   * snapshot `html` so parseProduct can re-hydrate it without another request.
   */
  async fetchProduct(url: string): Promise<RawSupplierPage> {
    // Curated printable products carry their full definition; no API call.
    if (url.startsWith(CURATED_URL_PREFIX)) {
      const slug = url.slice(CURATED_URL_PREFIX.length);
      const product = TGC_CURATED_PRODUCTS.find((p) => p.slug === slug);
      if (!product) {
        throw new Error(`Unknown curated product: ${slug}`);
      }
      return { url, html: JSON.stringify(product) };
    }

    const id = this.partIdFromUrl(url);
    const body = await this.apiGet(`/part/${id}`);
    const part: TgcPart | undefined = body?.result;
    if (!part?.id) {
      throw new Error(`No part returned for ${url}`);
    }
    return { url, html: JSON.stringify(part) };
  }

  async parseProduct(page: RawSupplierPage): Promise<ParsedProduct> {
    if (page.url.startsWith(CURATED_URL_PREFIX)) {
      const curated: CuratedProduct = JSON.parse(page.html);
      return curatedToParsedProduct(curated);
    }

    const part: TgcPart = JSON.parse(page.html);

    const slugBase = part.uri_part || part.id;
    const slug = `tgc-${slugBase}`;
    const category = (part.category || 'uncategorized').trim().toLowerCase();
    const sourceUrl = part.shop_uri
      ? `${PUBLIC_BASE}${part.shop_uri}`
      : `${PUBLIC_BASE}/parts/${slugBase}`;

    return {
      product: {
        externalProductId: part.id,
        slug,
        title: part.name,
        category,
        subcategory: part.family || undefined,
        shape: null,
        sourceUrl,
        imageUrl: this.normalizeImageUrl(part.preview_uri),
        description: part.description || undefined,
        currency: 'USD',
      },
      variants: [
        {
          variantCode: 'default',
          title: part.name,
          isDefault: true,
          options: this.buildOptions(part),
          layoutConstraints: this.buildLayout(part),
          priceTiers: this.buildPriceTiers(part),
        },
      ],
      rawMetadata: part as unknown as Record<string, unknown>,
    };
  }

  // ---------------------------------------------------------------------------
  // Mapping helpers
  // ---------------------------------------------------------------------------

  /** Keep public, non-discontinued parts. */
  private isIngestible(part: TgcPart): boolean {
    return part.public !== 0 && part.discontinued !== 1;
  }

  private buildOptions(part: TgcPart): ParsedProduct['variants'][0]['options'] {
    const options: ParsedProduct['variants'][0]['options'] = [];
    if (part.material) {
      options.push({
        optionGroup: 'Material',
        optionKey: 'material',
        optionLabel: 'Material',
        optionValue: part.material,
      });
    }
    if (part.color) {
      options.push({
        optionGroup: 'Color',
        optionKey: 'color',
        optionLabel: 'Color',
        optionValue: part.color,
      });
    }
    if (part.number_of_sides && part.number_of_sides > 0) {
      options.push({
        optionGroup: 'Configuration',
        optionKey: 'number_of_sides',
        optionLabel: 'Number of Sides',
        optionValue: String(part.number_of_sides),
      });
    }
    return options;
  }

  private buildLayout(
    part: TgcPart,
  ): ParsedProduct['variants'][0]['layoutConstraints'] {
    const width = Number(part.width) || 0;
    const height = Number(part.height) || 0;
    if (width <= 0 && height <= 0) return []; // virtual/digital part, no physical size

    const depth = Number(part.depth) || 0;
    const notes: string[] = [];
    if (depth > 0) notes.push(`Depth: ${(depth * INCH_TO_MM).toFixed(2)} mm`);
    if (part.weight) notes.push(`Weight: ${part.weight} oz`);
    if (part.material) notes.push(`Material: ${part.material}`);

    return [
      {
        faceKey: 'front',
        widthMm: width > 0 ? round2(width * INCH_TO_MM) : undefined,
        heightMm: height > 0 ? round2(height * INCH_TO_MM) : undefined,
        cutlineRequired: false,
        notes: notes.length ? notes.join('; ') : undefined,
        constraintsJson: {
          widthIn: width || undefined,
          heightIn: height || undefined,
          depthIn: depth || undefined,
          weightOz: part.weight ?? undefined,
        },
      },
    ];
  }

  private buildPriceTiers(
    part: TgcPart,
  ): ParsedProduct['variants'][0]['priceTiers'] {
    const breaks: Array<{ min: number; max: number | null; raw?: string }> = [
      { min: 1, max: 9, raw: part.price },
      { min: 10, max: 99, raw: part.price_10 },
      { min: 100, max: 999, raw: part.price_100 },
      { min: 1000, max: null, raw: part.price_1000 },
    ];

    const tiers: ParsedProduct['variants'][0]['priceTiers'] = [];
    for (const b of breaks) {
      const unit = Number(b.raw);
      if (!Number.isFinite(unit) || unit <= 0) continue;
      tiers.push({
        minQuantity: b.min,
        maxQuantity: b.max,
        unitPrice: unit,
        totalPrice: null,
        currency: 'USD',
      });
    }
    return tiers;
  }

  private normalizeImageUrl(preview?: string): string | null {
    if (!preview) return null;
    if (preview.startsWith('//')) return `https:${preview}`;
    if (preview.startsWith('http')) return preview;
    return `${PUBLIC_BASE}${preview.startsWith('/') ? '' : '/'}${preview}`;
  }

  private partIdFromUrl(url: string): string {
    const id = url.split('/').pop()?.split('?')[0];
    if (!id) throw new Error(`Cannot extract part id from url: ${url}`);
    return id;
  }

  // ---------------------------------------------------------------------------
  // Wing API / session handling
  // ---------------------------------------------------------------------------

  /** GET an API path with the current session, re-authenticating once on expiry. */
  private async apiGet(path: string, retryOnAuth = true): Promise<any> {
    const sessionId = await this.getSession();
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(
      `${this.apiBase}${path}${sep}session_id=${encodeURIComponent(sessionId)}`,
    );
    const body = await res.json().catch(() => null);

    if (body?.error) {
      const { code, message } = body.error;
      // 440/441 indicate a missing or expired session — re-mint once and retry.
      if (retryOnAuth && (code === 440 || code === 441)) {
        this.logger.warn(`Session rejected (${code}); re-authenticating`);
        this.sessionId = null;
        this.sessionPromise = null;
        return this.apiGet(path, false);
      }
      throw new Error(`TGC API error ${code}: ${message}`);
    }
    if (!res.ok) {
      throw new Error(`TGC API HTTP ${res.status} for ${path}`);
    }
    return body;
  }

  private getSession(): Promise<string> {
    if (this.sessionId) return Promise.resolve(this.sessionId);
    if (!this.sessionPromise) {
      this.sessionPromise = this.login().catch((err) => {
        this.sessionPromise = null; // allow retry on next call
        throw err;
      });
    }
    return this.sessionPromise;
  }

  private async login(): Promise<string> {
    const username = this.config.get<string>('GAMECRAFTER_USERNAME');
    const password = this.config.get<string>('GAMECRAFTER_PASSWORD');
    const apiKeyId = this.config.get<string>('GAMECRAFTER_PUBLIC_KEY');
    const sessionOverride = this.config.get<string>('GAMECRAFTER_SESSION_ID');

    // Allow operating with a pre-minted session token instead of credentials.
    if (sessionOverride) {
      this.sessionId = sessionOverride;
      return sessionOverride;
    }

    if (!username || !password || !apiKeyId) {
      throw new Error(
        'The Game Crafter credentials missing: set GAMECRAFTER_USERNAME, ' +
          'GAMECRAFTER_PASSWORD and GAMECRAFTER_PUBLIC_KEY (API Key ID) in the environment.',
      );
    }

    const form = new URLSearchParams({
      username,
      password,
      api_key_id: apiKeyId,
    });
    const res = await fetch(`${this.apiBase}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const body = await res.json().catch(() => null);
    if (body?.error) {
      throw new Error(
        `TGC login failed (${body.error.code}): ${body.error.message}`,
      );
    }
    const id: string | undefined = body?.result?.id ?? body?.id;
    if (!id) {
      throw new Error('TGC login returned no session id');
    }
    this.sessionId = id;
    this.logger.log('Authenticated with The Game Crafter API');
    return id;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
