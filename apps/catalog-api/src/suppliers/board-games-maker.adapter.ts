import { Injectable, Logger } from '@nestjs/common';
import { SupplierCatalogAdapter, RawSupplierPage, ParsedProduct } from './supplier.interface';
import * as cheerio from 'cheerio';

import { CATEGORY_LISTING_PAGES, DROPDOWN_LABELS, normalizeShape, detectCategory, defaultLayout } from './board-games-maker.metadata';

@Injectable()
export class BoardGamesMakerAdapter implements SupplierCatalogAdapter {
  private readonly logger = new Logger(BoardGamesMakerAdapter.name);
  private readonly baseUrl = 'https://www.boardgamesmaker.com';

  // ── Discovery ────────────────────────────────────────────────────────

  async discoverProductUrls(): Promise<string[]> {
    const allUrls = new Set<string>();

    for (const listingUrl of CATEGORY_LISTING_PAGES) {
      try {
        this.logger.log(`Discovering from ${listingUrl}`);
        const res = await this.fetchPage(listingUrl);
        const $ = cheerio.load(res);

        // Product links live under /print/*.html
        $('a[href*="/print/"]').each((_, el) => {
          const href = $(el).attr('href');
          if (href && href.endsWith('.html')) {
            const full = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
            allUrls.add(full);
          }
        });
      } catch (err: any) {
        this.logger.error(`Failed to discover from ${listingUrl}: ${err.message}`);
      }
    }

    this.logger.log(`Discovered ${allUrls.size} product URLs across ${CATEGORY_LISTING_PAGES.length} category pages`);
    return Array.from(allUrls);
  }

  // ── Fetching ──────────────────────────────────────────────────────────

  async fetchProduct(url: string): Promise<RawSupplierPage> {
    this.logger.log(`Fetching product ${url}`);
    const html = await this.fetchPage(url);
    return { url, html };
  }

  private async fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.text();
  }

  // ── Parsing ───────────────────────────────────────────────────────────

  async parseProduct(page: RawSupplierPage): Promise<ParsedProduct> {
    const $ = cheerio.load(page.html);

    // 1. Slug & IDs
    const slugMatch = page.url.match(/\/print\/(.+)\.html/);
    const slug = slugMatch ? slugMatch[1] : `bgm-auto-${Date.now()}`;
    const externalProductId = slug;

    // 2. Title
    const title = $('h1').first().text().trim() || 'Unknown Product';

    // 3. Category + Subcategory from slug (shape resolved separately below)
    const { category, subcategory } = detectCategory(slug);

    // 4. Options — generic extraction of ALL dro_* dropdowns
    const options = this.extractAllOptions($);

    // 5. Specifications / Dimensions
    const { widthMm, heightMm, specText } = this.extractDimensions($, category);

    // 5b. Shape — extracted from spec-box Type line, title, then slug
    const shape = this.extractShape($, slug, title);

    // 5c. Primary preview image
    const imageUrl = this.extractImageUrl($);

    // 6. Pricing Table
    const priceTiers = this.extractPriceTiers($);

    // 7. Layout defaults
    const defaults = defaultLayout(category);

    // Non-rectangular shapes need a custom cutline note for downstream renderers
    const isNonRectangular = shape && !['rectangle', 'square'].includes(shape);

    const defaultLayoutConstraints = [
      {
        faceKey: 'front',
        widthMm: widthMm ?? defaults.widthMm,
        heightMm: heightMm ?? defaults.heightMm,
        widthPx: Math.round(((widthMm ?? defaults.widthMm) / 25.4) * defaults.dpi),
        heightPx: Math.round(((heightMm ?? defaults.heightMm) / 25.4) * defaults.dpi),
        bleedMm: defaults.bleedMm,
        safeZoneMm: defaults.safeZoneMm,
        dpi: defaults.dpi,
        panelCount: 1,
        cutlineRequired: true,
        ...(isNonRectangular ? { notes: `Shape: ${shape} — requires custom die-cut cutline` } : {}),
      },
    ];

    let variants: ParsedProduct['variants'] = [];

    // For cards, generate permutations of Deck Sizes, Materials, and Finishes
    if (category === 'cards') {
      const deckSizeOptions = options.filter(o => o.optionKey === 'dro_choosesize' || o.optionGroup === 'Configuration');

      // BoardGamesMaker explicitly binds Card Stock to both Material and sometimes Finish, but true finishes appear under 'effect'.
      // If effect dropdown doesn't exist natively, we will generate standard BGM card finish permutations so quoting can support it.
      let finishOptions = options.filter(o => o.optionGroup === 'Finish' || o.optionKey.includes('effect'));
      if (finishOptions.length === 0) {
          // BGM sometimes selects finishes in popup or checkout; insert standardized known finish options
          finishOptions = [
             { optionGroup: 'Finish', optionKey: 'generated_finish', optionLabel: 'Print Finish', optionValue: 'Smooth', priceDataJson: null },
             { optionGroup: 'Finish', optionKey: 'generated_finish', optionLabel: 'Print Finish', optionValue: 'Linen', priceDataJson: null },
             { optionGroup: 'Finish', optionKey: 'generated_finish', optionLabel: 'Print Finish', optionValue: 'Holographic', priceDataJson: null },
             { optionGroup: 'Finish', optionKey: 'generated_finish', optionLabel: 'Print Finish', optionValue: 'MPC Finish', priceDataJson: null },
          ];
      }

      let materialOptions = options.filter(o => o.optionGroup === 'Material' || o.optionKey === 'dro_paper_type');
      if (materialOptions.length === 0) {
          materialOptions = [{ optionGroup: 'Material', optionKey: 'default', optionLabel: 'Material', optionValue: 'Standard', priceDataJson: null }];
      }

      if (deckSizeOptions.length > 0) {
        deckSizeOptions.forEach((deckSize, dIdx) => {
          materialOptions.slice(0, 3).forEach((material, mIdx) => {
            finishOptions.slice(0, 4).forEach((finish, fIdx) => {
              const piecesMatch = deckSize.optionValue.match(/(\d+)/);
              const piecesCount = piecesMatch ? parseInt(piecesMatch[1], 10) : 54;

              const matSafe = material.optionValue.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 15);
              const finishSafe = finish.optionValue.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 15);
              const variantCode = `${slug}-${piecesCount}cards-${matSafe}-${finishSafe}`;

              const variantTiers = priceTiers.map(pt => ({
                ...pt,
                unitPrice: Math.round(((pt.unitPrice / 54) * piecesCount) * 100) / 100,
              }));

              variants.push({
                variantCode,
                title: `${deckSize.optionValue} - ${material.optionValue} - ${finish.optionValue}`,
                isDefault: dIdx === 0 && mIdx === 0 && fIdx === 0,
                options: [deckSize, material, finish],
                layoutConstraints: defaultLayoutConstraints,
                priceTiers: variantTiers,
              });
            });
          });
        });
      }
    } else if (category === 'boards') {
      // Board extraction: focus on identifying Materials and Finishes
      let materialOptions = options.filter(o => o.optionGroup === 'Material' || o.optionKey.includes('paper') || o.optionKey.includes('material'));
      let finishOptions = options.filter(o => o.optionGroup === 'Finish' || o.optionKey.includes('effect'));

      if (materialOptions.length === 0) {
          materialOptions = [
              { optionGroup: 'Material', optionKey: 'generated_board_mat', optionLabel: 'Board Material', optionValue: '1.5mm Cardboard', priceDataJson: null },
              { optionGroup: 'Material', optionKey: 'generated_board_mat', optionLabel: 'Board Material', optionValue: '2.0mm Cardboard', priceDataJson: null }
          ];
      }
      if (finishOptions.length === 0) {
          finishOptions = [
              { optionGroup: 'Finish', optionKey: 'generated_board_finish', optionLabel: 'Print Finish', optionValue: 'Gloss', priceDataJson: null },
              { optionGroup: 'Finish', optionKey: 'generated_board_finish', optionLabel: 'Print Finish', optionValue: 'Matte', priceDataJson: null }
          ];
      }

      materialOptions.slice(0, 3).forEach((material, mIdx) => {
        finishOptions.slice(0, 3).forEach((finish, fIdx) => {
            const matSafe = material.optionValue.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 15);
            const finishSafe = finish.optionValue.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 15);
            const variantCode = `${slug}-${matSafe}-${finishSafe}`;

            variants.push({
              variantCode,
              title: `${material.optionValue} - ${finish.optionValue}`,
              isDefault: mIdx === 0 && fIdx === 0,
              options: [material, finish],
              layoutConstraints: defaultLayoutConstraints,
              priceTiers,
            });
        });
      });
    } else if (category === 'tiles') {
      let tilesPerSheet = 1;
      // Extract pieces per sheet from spec text: e.g. "100 pieces per sheet" or "(100 pieces)" or "Tiles per sheet: 100"
      const perSheetMatch = specText.match(/(\d+)\s*(?:pieces|tiles)\s*per\s*sheet/i) || specText.match(/tiles\s*per\s*sheet:\s*(\d+)/i) || specText.match(/\((\d+)\s*pieces\)/i);
      if (perSheetMatch) {
         tilesPerSheet = parseInt(perSheetMatch[1], 10);
      }

      // Finish/Thickness options are usually in dro_paper_type or effect
      const finishOptions = options.filter(o => o.optionKey.includes('effect') || o.optionKey === 'dro_paper_type' || o.optionGroup === 'Finish').slice(0, 4);

      if (finishOptions.length > 0) {
          finishOptions.forEach((finish, fIdx) => {
            const finishSafe = finish.optionValue.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 20);
            const variantCode = `${slug}-${tilesPerSheet}tiles-persheet-${finishSafe}`;

            // Calculate unit cost per tile based on the BGM sheet price interpolation
            const variantTiers = priceTiers.map(pt => ({
              ...pt,
              unitPrice: Math.round((pt.unitPrice / tilesPerSheet) * 1000) / 1000,
            }));

            variants.push({
              variantCode,
              title: `${tilesPerSheet} tiles/sheet - ${finish.optionValue}`,
              isDefault: fIdx === 0,
              options: [finish, {
                 optionGroup: 'Configuration', optionKey: 'dro_choosesize',
                 optionLabel: 'Tiles per Sheet', optionValue: `${tilesPerSheet}`, priceDataJson: null
              }],
              layoutConstraints: defaultLayoutConstraints,
              priceTiers: variantTiers,
            });
          });
      }
    }

    // Fallback if it's not cards/tiles or missing required dropdowns
    if (variants.length === 0) {
      variants.push({
        variantCode: `${slug}-default`,
        title: 'Standard Base Configuration',
        isDefault: true,
        options,
        layoutConstraints: defaultLayoutConstraints,
        priceTiers,
      });
    }

    return {
      product: {
        externalProductId,
        slug,
        title,
        category,
        subcategory,
        shape,
        sourceUrl: page.url,
        imageUrl,
        currency: 'USD',
      },
      variants,
      rawMetadata: {
        rawSpecText: specText.substring(0, 1000),
      },
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * Generically find every <select> whose id starts with "dro_" and
   * extract all its <option> values.  Maps known IDs to friendly labels.
   */
  private extractAllOptions(
    $: cheerio.CheerioAPI,
  ): ParsedProduct['variants'][0]['options'] {
    const options: ParsedProduct['variants'][0]['options'] = [];

    $('select[id^="dro_"]').each((_, selectEl) => {
      const $select = $(selectEl);
      const rawId = $select.attr('id') || '';

      // Normalise id → base key (strip dynamic suffixes like _PPN_0001)
      const baseKey = rawId.replace(/_[A-Z]{3}_\d+$/, '');
      const mapping = DROPDOWN_LABELS[baseKey];
      const group = mapping?.group ?? 'Other';
      const label = mapping?.label ?? this.humaniseId(baseKey);

      $select.find('option').each((__, optEl) => {
        const val = $(optEl).text().trim();
        if (!val || val.toLowerCase() === 'select' || val === '--') return;

        const rawPriceData = $(optEl).attr('pricedata');
        let priceDataJson: any = null;
        if (rawPriceData) {
          try {
            priceDataJson = JSON.parse(rawPriceData.replace(/'/g, '"'));
          } catch (e) {
            // failed to parse
          }
        }

        options.push({
          optionGroup: group,
          optionKey: rawId,
          optionLabel: label,
          optionValue: val,
          priceDataJson,
        });
      });
    });

    return options;
  }

  /**
   * Extract component dimensions from the spec box.
   *
   * BGM pages use labeled specs inside div.productspecbox like:
   *   <b>Dimensions:</b> 57mm x 89mm, 2.25" x 3.5"
   *   <b>Tiles size:</b> 0.5" x 0.5"
   *   <b>Sheet dimensions:</b> 9" x 9" (228.6mm x 228.6mm)
   *
   * We prioritise "Tiles size" and "Dimensions" over "Sheet dimensions".
   */
  private extractDimensions(
    $: cheerio.CheerioAPI,
    _category: string,
  ): { widthMm: number | undefined; heightMm: number | undefined; specText: string } {
    // Collect all labeled spec lines from the spec box
    const specLines: { label: string; value: string }[] = [];
    $('div.productspecbox li').each((_, el) => {
      const label = $(el).find('b').text().trim().replace(/:$/, '').toLowerCase();
      const value = $(el).text().trim();
      if (label) specLines.push({ label, value });
    });

    const specText = specLines.map(s => `${s.label}: ${s.value}`).join('\n');

    // Priority order: "tiles size" > "dimensions" > "sheet dimensions" > any spec text
    const priorityLabels = ['tiles size', 'tile size', 'tiles dimensions', 'tile dimensions', 'dimensions'];

    for (const target of priorityLabels) {
      const spec = specLines.find(s => s.label === target);
      if (spec) {
        const dims = this.parseDimString(spec.value);
        if (dims) return { ...dims, specText };
      }
    }

    // Fallback: try parsing from any spec text
    const fallback = this.parseDimString(specText);
    if (fallback) return { ...fallback, specText };

    return { widthMm: undefined, heightMm: undefined, specText };
  }

  /** Parse a dimension string, trying mm first, then inches. */
  private parseDimString(text: string): { widthMm: number; heightMm: number } | null {
    // Try mm first: "57mm x 89mm" or "508mm x 609mm"
    const mmMatch = text.match(
      /(\d+(?:\.\d+)?)\s*mm\s*[xX×]\s*(\d+(?:\.\d+)?)\s*mm/,
    );
    if (mmMatch) {
      return {
        widthMm: parseFloat(mmMatch[1]),
        heightMm: parseFloat(mmMatch[2]),
      };
    }

    // Try inches: 0.5" x 0.5" or 20" x 24"
    const inchMatch = text.match(
      /(\d+(?:\.\d+)?)\s*["″]\s*[xX×]\s*(\d+(?:\.\d+)?)\s*["″]/,
    );
    if (inchMatch) {
      return {
        widthMm: Math.round(parseFloat(inchMatch[1]) * 25.4 * 100) / 100,
        heightMm: Math.round(parseFloat(inchMatch[2]) * 25.4 * 100) / 100,
      };
    }

    return null;
  }

  /**
   * Extract the card/component shape from multiple page sources.
   *
   * Priority:
   *   1. Spec-box "Type" line  (e.g. "Hexagonal shaped custom cards deck")
   *   2. H1 title              (e.g. "Hex Deck Custom Blank Cards")
   *   3. URL slug               (e.g. "custom-hexagonal-game-cards")
   */
  private extractShape(
    $: cheerio.CheerioAPI,
    slug: string,
    title: string,
  ): string | null {
    // 1. Spec-box Type line
    const typeSpec = this.extractSpecType($);
    if (typeSpec) {
      const fromType = normalizeShape(typeSpec);
      if (fromType) {
        this.logger.debug(`Shape from spec-box Type: "${fromType}" (raw: "${typeSpec}")`);
        return fromType;
      }
    }

    // 2. H1 title
    const fromTitle = normalizeShape(title);
    if (fromTitle) {
      this.logger.debug(`Shape from title: "${fromTitle}" (raw: "${title}")`);
      return fromTitle;
    }

    // 3. URL slug
    const fromSlug = normalizeShape(slug);
    if (fromSlug) {
      this.logger.debug(`Shape from slug: "${fromSlug}" (raw: "${slug}")`);
      return fromSlug;
    }

    return null;
  }

  /**
   * Extract the primary preview image for the product.
   *
   * Priority:
   *   1. og:image meta tag (clean, canonical "Product_Show" render)
   *   2. The main gallery image (img.img-hover[original])
   */
  private extractImageUrl($: cheerio.CheerioAPI): string | null {
    const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
    if (ogImage) return this.absoluteUrl(ogImage);

    const hover =
      $('img.img-hover').first().attr('original') ||
      $('img.img-hover').first().attr('src');
    if (hover) return this.absoluteUrl(hover.trim());

    return null;
  }

  /** Resolve protocol-relative or root-relative URLs against the base host. */
  private absoluteUrl(url: string): string {
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${this.baseUrl}${url}`;
    return url;
  }

  /**
   * Pull the "Type:" value from the spec box, e.g.:
   *   <b>Type:</b> Hexagonal shaped custom cards deck (hex cards with rounded corners)
   */
  private extractSpecType($: cheerio.CheerioAPI): string | null {
    let result: string | null = null;
    $('div.productspecbox li').each((_, el) => {
      const label = $(el).find('b').text().trim().replace(/:$/, '').toLowerCase();
      if (label === 'type') {
        // Get full text and strip the label prefix
        const fullText = $(el).text().trim();
        const colonIdx = fullText.indexOf(':');
        result = colonIdx >= 0 ? fullText.substring(colonIdx + 1).trim() : fullText;
        return false; // break
      }
    });
    return result;
  }

  /** Parse the volume pricing table (table#tab_propricelist). */
  private extractPriceTiers(
    $: cheerio.CheerioAPI,
  ): ParsedProduct['variants'][0]['priceTiers'] {
    const priceTiers: ParsedProduct['variants'][0]['priceTiers'] = [];

    $('table#tab_propricelist tr').each((i, row) => {
      if (i === 0) return; // skip header
      const cols = $(row).find('td');
      if (cols.length < 2) return;

      const qtyText = $(cols[0]).text().trim();
      const priceText = $(cols[1]).text().trim().replace(/[^\d.]/g, '');

      let minQuantity = 1;
      let maxQuantity: number | null = null;

      if (qtyText.includes('-')) {
        const [lo, hi] = qtyText.split('-');
        minQuantity = parseInt(lo, 10);
        maxQuantity = parseInt(hi, 10);
      } else if (qtyText.includes('+')) {
        minQuantity = parseInt(qtyText.replace('+', ''), 10);
      } else {
        minQuantity = parseInt(qtyText, 10);
      }

      const unitPrice = parseFloat(priceText);
      if (!isNaN(minQuantity) && !isNaN(unitPrice)) {
        priceTiers.push({ minQuantity, maxQuantity, unitPrice, currency: 'USD' });
      }
    });

    return priceTiers;
  }

  /** Turn a dro_ id like "dro_paper_type" into "Paper Type". */
  private humaniseId(id: string): string {
    return id
      .replace(/^dro_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
