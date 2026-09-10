import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as cheerio from 'cheerio';
import type { ParsedProduct } from './supplier.interface';
import { DROPDOWN_LABELS, normalizeShape } from './board-games-maker.metadata';

/** Shared DOM extraction for BoardGamesMaker product pages. */
export class BoardGamesMakerParser {
  protected readonly logger = new Logger('BoardGamesMakerAdapter');
  protected readonly baseUrl = 'https://www.boardgamesmaker.com';

  /**
   * Generically find every <select> whose id starts with "dro_" and
   * extract all its <option> values.  Maps known IDs to friendly labels.
   */
  protected extractAllOptions(
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
        let priceDataJson: Prisma.InputJsonValue | null = null;
        if (rawPriceData) {
          try {
            priceDataJson = JSON.parse(
              rawPriceData.replace(/'/g, '"'),
            ) as Prisma.InputJsonValue | null;
          } catch {
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
  protected extractDimensions($: cheerio.CheerioAPI): {
    widthMm: number | undefined;
    heightMm: number | undefined;
    specText: string;
  } {
    // Collect all labeled spec lines from the spec box
    const specLines: { label: string; value: string }[] = [];
    $('div.productspecbox li').each((_, el) => {
      const label = $(el)
        .find('b')
        .text()
        .trim()
        .replace(/:$/, '')
        .toLowerCase();
      const value = $(el).text().trim();
      if (label) specLines.push({ label, value });
    });

    const specText = specLines.map((s) => `${s.label}: ${s.value}`).join('\n');

    // Priority order: "tiles size" > "dimensions" > "sheet dimensions" > any spec text
    const priorityLabels = [
      'tiles size',
      'tile size',
      'tiles dimensions',
      'tile dimensions',
      'dimensions',
    ];

    for (const target of priorityLabels) {
      const spec = specLines.find((s) => s.label === target);
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
  protected parseDimString(
    text: string,
  ): { widthMm: number; heightMm: number } | null {
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
  protected extractShape(
    $: cheerio.CheerioAPI,
    slug: string,
    title: string,
  ): string | null {
    // 1. Spec-box Type line
    const typeSpec = this.extractSpecType($);
    if (typeSpec) {
      const fromType = normalizeShape(typeSpec);
      if (fromType) {
        this.logger.debug(
          `Shape from spec-box Type: "${fromType}" (raw: "${typeSpec}")`,
        );
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
  protected extractImageUrl($: cheerio.CheerioAPI): string | null {
    const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
    if (ogImage) return this.absoluteUrl(ogImage);

    const hover =
      $('img.img-hover').first().attr('original') ||
      $('img.img-hover').first().attr('src');
    if (hover) return this.absoluteUrl(hover.trim());

    return null;
  }

  /** Resolve protocol-relative or root-relative URLs against the base host. */
  protected absoluteUrl(url: string): string {
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${this.baseUrl}${url}`;
    return url;
  }

  /**
   * Pull the "Type:" value from the spec box, e.g.:
   *   <b>Type:</b> Hexagonal shaped custom cards deck (hex cards with rounded corners)
   */
  protected extractSpecType($: cheerio.CheerioAPI): string | null {
    let result: string | null = null;
    $('div.productspecbox li').each((_, el) => {
      const label = $(el)
        .find('b')
        .text()
        .trim()
        .replace(/:$/, '')
        .toLowerCase();
      if (label === 'type') {
        // Get full text and strip the label prefix
        const fullText = $(el).text().trim();
        const colonIdx = fullText.indexOf(':');
        result =
          colonIdx >= 0 ? fullText.substring(colonIdx + 1).trim() : fullText;
        return false; // break
      }
    });
    return result;
  }

  /** Parse the volume pricing table (table#tab_propricelist). */
  protected extractPriceTiers(
    $: cheerio.CheerioAPI,
  ): ParsedProduct['variants'][0]['priceTiers'] {
    const priceTiers: ParsedProduct['variants'][0]['priceTiers'] = [];

    $('table#tab_propricelist tr').each((i, row) => {
      if (i === 0) return; // skip header
      const cols = $(row).find('td');
      if (cols.length < 2) return;

      const qtyText = $(cols[0]).text().trim();
      const priceText = $(cols[1])
        .text()
        .trim()
        .replace(/[^\d.]/g, '');

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
        priceTiers.push({
          minQuantity,
          maxQuantity,
          unitPrice,
          currency: 'USD',
        });
      }
    });

    return priceTiers;
  }

  /** Turn a dro_ id like "dro_paper_type" into "Paper Type". */
  protected humaniseId(id: string): string {
    return id
      .replace(/^dro_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
