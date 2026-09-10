import { Injectable } from '@nestjs/common';
import {
  SupplierCatalogAdapter,
  RawSupplierPage,
  ParsedProduct,
} from './supplier.interface';
import * as cheerio from 'cheerio';

import {
  CATEGORY_LISTING_PAGES,
  detectCategory,
  defaultLayout,
} from './board-games-maker.metadata';

import { BoardGamesMakerParser } from './board-games-maker.parser';

@Injectable()
export class BoardGamesMakerAdapter
  extends BoardGamesMakerParser
  implements SupplierCatalogAdapter
{
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
            const full = href.startsWith('http')
              ? href
              : `${this.baseUrl}${href}`;
            allUrls.add(full);
          }
        });
      } catch (err: unknown) {
        this.logger.error(
          `Failed to discover from ${listingUrl}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.logger.log(
      `Discovered ${allUrls.size} product URLs across ${CATEGORY_LISTING_PAGES.length} category pages`,
    );
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
        Accept: 'text/html,application/xhtml+xml',
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
    const { widthMm, heightMm, specText } = this.extractDimensions($);

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
        widthPx: Math.round(
          ((widthMm ?? defaults.widthMm) / 25.4) * defaults.dpi,
        ),
        heightPx: Math.round(
          ((heightMm ?? defaults.heightMm) / 25.4) * defaults.dpi,
        ),
        bleedMm: defaults.bleedMm,
        safeZoneMm: defaults.safeZoneMm,
        dpi: defaults.dpi,
        panelCount: 1,
        cutlineRequired: true,
        ...(isNonRectangular
          ? { notes: `Shape: ${shape} — requires custom die-cut cutline` }
          : {}),
      },
    ];

    const variants: ParsedProduct['variants'] = [];

    // For cards, generate permutations of Deck Sizes, Materials, and Finishes
    if (category === 'cards') {
      const deckSizeOptions = options.filter(
        (o) =>
          o.optionKey === 'dro_choosesize' || o.optionGroup === 'Configuration',
      );

      // BoardGamesMaker explicitly binds Card Stock to both Material and sometimes Finish, but true finishes appear under 'effect'.
      // If effect dropdown doesn't exist natively, we will generate standard BGM card finish permutations so quoting can support it.
      let finishOptions = options.filter(
        (o) => o.optionGroup === 'Finish' || o.optionKey.includes('effect'),
      );
      if (finishOptions.length === 0) {
        // BGM sometimes selects finishes in popup or checkout; insert standardized known finish options
        finishOptions = [
          {
            optionGroup: 'Finish',
            optionKey: 'generated_finish',
            optionLabel: 'Print Finish',
            optionValue: 'Smooth',
            priceDataJson: null,
          },
          {
            optionGroup: 'Finish',
            optionKey: 'generated_finish',
            optionLabel: 'Print Finish',
            optionValue: 'Linen',
            priceDataJson: null,
          },
          {
            optionGroup: 'Finish',
            optionKey: 'generated_finish',
            optionLabel: 'Print Finish',
            optionValue: 'Holographic',
            priceDataJson: null,
          },
          {
            optionGroup: 'Finish',
            optionKey: 'generated_finish',
            optionLabel: 'Print Finish',
            optionValue: 'MPC Finish',
            priceDataJson: null,
          },
        ];
      }

      let materialOptions = options.filter(
        (o) => o.optionGroup === 'Material' || o.optionKey === 'dro_paper_type',
      );
      if (materialOptions.length === 0) {
        materialOptions = [
          {
            optionGroup: 'Material',
            optionKey: 'default',
            optionLabel: 'Material',
            optionValue: 'Standard',
            priceDataJson: null,
          },
        ];
      }

      if (deckSizeOptions.length > 0) {
        deckSizeOptions.forEach((deckSize, dIdx) => {
          materialOptions.slice(0, 3).forEach((material, mIdx) => {
            finishOptions.slice(0, 4).forEach((finish, fIdx) => {
              const piecesMatch = deckSize.optionValue.match(/(\d+)/);
              const piecesCount = piecesMatch
                ? parseInt(piecesMatch[1], 10)
                : 54;

              const matSafe = material.optionValue
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .substring(0, 15);
              const finishSafe = finish.optionValue
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .substring(0, 15);
              const variantCode = `${slug}-${piecesCount}cards-${matSafe}-${finishSafe}`;

              const variantTiers = priceTiers.map((pt) => ({
                ...pt,
                unitPrice:
                  Math.round((pt.unitPrice / 54) * piecesCount * 100) / 100,
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
      let materialOptions = options.filter(
        (o) =>
          o.optionGroup === 'Material' ||
          o.optionKey.includes('paper') ||
          o.optionKey.includes('material'),
      );
      let finishOptions = options.filter(
        (o) => o.optionGroup === 'Finish' || o.optionKey.includes('effect'),
      );

      if (materialOptions.length === 0) {
        materialOptions = [
          {
            optionGroup: 'Material',
            optionKey: 'generated_board_mat',
            optionLabel: 'Board Material',
            optionValue: '1.5mm Cardboard',
            priceDataJson: null,
          },
          {
            optionGroup: 'Material',
            optionKey: 'generated_board_mat',
            optionLabel: 'Board Material',
            optionValue: '2.0mm Cardboard',
            priceDataJson: null,
          },
        ];
      }
      if (finishOptions.length === 0) {
        finishOptions = [
          {
            optionGroup: 'Finish',
            optionKey: 'generated_board_finish',
            optionLabel: 'Print Finish',
            optionValue: 'Gloss',
            priceDataJson: null,
          },
          {
            optionGroup: 'Finish',
            optionKey: 'generated_board_finish',
            optionLabel: 'Print Finish',
            optionValue: 'Matte',
            priceDataJson: null,
          },
        ];
      }

      materialOptions.slice(0, 3).forEach((material, mIdx) => {
        finishOptions.slice(0, 3).forEach((finish, fIdx) => {
          const matSafe = material.optionValue
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 15);
          const finishSafe = finish.optionValue
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 15);
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
      const perSheetMatch =
        specText.match(/(\d+)\s*(?:pieces|tiles)\s*per\s*sheet/i) ||
        specText.match(/tiles\s*per\s*sheet:\s*(\d+)/i) ||
        specText.match(/\((\d+)\s*pieces\)/i);
      if (perSheetMatch) {
        tilesPerSheet = parseInt(perSheetMatch[1], 10);
      }

      // Finish/Thickness options are usually in dro_paper_type or effect
      const finishOptions = options
        .filter(
          (o) =>
            o.optionKey.includes('effect') ||
            o.optionKey === 'dro_paper_type' ||
            o.optionGroup === 'Finish',
        )
        .slice(0, 4);

      if (finishOptions.length > 0) {
        finishOptions.forEach((finish, fIdx) => {
          const finishSafe = finish.optionValue
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 20);
          const variantCode = `${slug}-${tilesPerSheet}tiles-persheet-${finishSafe}`;

          // Calculate unit cost per tile based on the BGM sheet price interpolation
          const variantTiers = priceTiers.map((pt) => ({
            ...pt,
            unitPrice: Math.round((pt.unitPrice / tilesPerSheet) * 1000) / 1000,
          }));

          variants.push({
            variantCode,
            title: `${tilesPerSheet} tiles/sheet - ${finish.optionValue}`,
            isDefault: fIdx === 0,
            options: [
              finish,
              {
                optionGroup: 'Configuration',
                optionKey: 'dro_choosesize',
                optionLabel: 'Tiles per Sheet',
                optionValue: `${tilesPerSheet}`,
                priceDataJson: null,
              },
            ],
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

    return Promise.resolve({
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
    });
  }
}
