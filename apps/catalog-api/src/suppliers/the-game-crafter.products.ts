import type { RawEntry } from './the-game-crafter-data/types';
import { DECKS } from './the-game-crafter-data/decks';
import { BOARDS } from './the-game-crafter-data/boards';
import { BOOKLETS } from './the-game-crafter-data/booklets';
import { SCOREPADS } from './the-game-crafter-data/scorepads';
import { BOXES } from './the-game-crafter-data/boxes';
import { ParsedProduct } from './supplier.interface';

/**
 * Curated catalog of The Game Crafter's *printable* products (card decks, game
 * boards, booklets, score pads, boxes).
 *
 * Unlike the stock components in `/api/part`, these products are not exposed by
 * any catalog endpoint — their sizes are fixed "identities" and their prices
 * are only computed when building a game. We therefore model them as a curated
 * static list whose specs and price tiers are sourced from The Game Crafter's
 * published pricing (https://www.thegamecrafter.com/make/pricing and
 * /make/products), cross-referenced with the developer docs for API identities.
 *
 * Sourced & verified: June 2026. These are merged into the TGC adapter's
 * ingestion alongside the live parts, landing in the catalog in the same shape
 * as BoardGamesMaker's `cards` products (product → variants → options / layout
 * / price tiers).
 *
 * PRICING NOTES (important for the quoting system):
 *  - The Game Crafter prices CARDS and BOARDS *per sheet* (a sheet holds a fixed
 *    number of cards / board panels), and books/boxes/pads *per each*. The
 *    `unitPrice` on each tier reflects that purchasable unit; the unit itself is
 *    recorded in the "Priced Per" option and the description.
 *  - There are two published copy tiers: 1+ (standard) and 100+ (bulk). There is
 *    NO published 1000-copy tier (that needs a custom quote), so none is invented.
 *  - A $0.89 per-copy handling fee and optional coatings are NOT included in the
 *    unit price (the quote engine applies its own markup/buffer separately).
 */

const INCH_TO_MM = 25.4;

export const CURATED_URL_PREFIX = 'tgc-curated:';

export interface CuratedProduct {
  group: 'deck' | 'board' | 'booklet' | 'scorepad' | 'box';
  /** Canonical slug WITHOUT the `tgc-` supplier prefix, e.g. "poker-deck". */
  slug: string;
  title: string;
  /** Catalog category, e.g. "cards" | "boards" | "booklets" | "scorepads" | "boxes". */
  category: string;
  subcategory?: string;
  sourceUrl: string;
  imageUrl?: string | null;
  description?: string;
  variants: ParsedProduct['variants'];
}

/** Map a curated product to the normalized ParsedProduct shape. */
export function curatedToParsedProduct(p: CuratedProduct): ParsedProduct {
  return {
    product: {
      externalProductId: `tgc-curated-${p.slug}`,
      // Namespaced distinctly from parts (`tgc-<uri_part>`) so curated printable
      // products can never collide with a stock part that shares the same name.
      slug: `tgc-print-${p.slug}`,
      title: p.title,
      category: p.category,
      subcategory: p.subcategory,
      shape: null,
      sourceUrl: p.sourceUrl,
      imageUrl: p.imageUrl ?? null,
      description: p.description,
      currency: 'USD',
    },
    variants: p.variants,
    rawMetadata: { curated: true, group: p.group, slug: p.slug },
  };
}

// ---------------------------------------------------------------------------
// Sourced data (verbatim from TGC published pricing — June 2026)
// ---------------------------------------------------------------------------

const PRICING_URL = 'https://www.thegamecrafter.com/make/pricing';
const PRODUCTS_URL = 'https://www.thegamecrafter.com/make/products';

/**
 * Product preview images, scraped from TGC's /make/products catalog and each
 * verified to resolve (HTTP 200, image/jpeg) — June 2026. Keyed by displayName.
 * Hook/Tuck boxes reuse the largest-capacity family image; score pads use the
 * "... Color" product image.
 */
const IMAGE_BY_NAME: Record<string, string> = {
  'Poker Deck':
    'https://www.thegamecrafter.com/product-images/PokerDeck.jpg?v=3',
  'Euro Poker Deck':
    'https://www.thegamecrafter.com/product-images/EuroPokerDeck.jpg?v=3',
  'Bridge Deck':
    'https://www.thegamecrafter.com/product-images/BridgeDeck.jpg?v=3',
  'Mini Deck': 'https://www.thegamecrafter.com/product-images/MiniDeck.jpg?v=3',
  'Tarot Deck':
    'https://www.thegamecrafter.com/product-images/TarotDeck.jpg?v=3',
  'Foil Tarot Deck':
    'https://www.thegamecrafter.com/product-images/FoilTarotDeck.jpg?v=3',
  'Foil Poker Deck':
    'https://www.thegamecrafter.com/product-images/FoilPokerDeck.jpg?v=3',
  'Foil Euro Poker Deck':
    'https://www.thegamecrafter.com/product-images/FoilEuroPokerDeck.jpg?v=3',
  'Jumbo Deck':
    'https://www.thegamecrafter.com/product-images/JumboDeck.jpg?v=3',
  'Square Deck':
    'https://www.thegamecrafter.com/product-images/SquareDeck.jpg?v=3',
  'Euro Square Deck':
    'https://www.thegamecrafter.com/product-images/EuroSquareDeck.jpg?v=3',
  'Small Square Deck':
    'https://www.thegamecrafter.com/product-images/SmallSquareDeck.jpg?v=3',
  'Micro Deck':
    'https://www.thegamecrafter.com/product-images/MicroDeck.jpg?v=3',
  'Hex Deck': 'https://www.thegamecrafter.com/product-images/HexDeck.jpg?v=3',
  'Circle Deck':
    'https://www.thegamecrafter.com/product-images/CircleDeck.jpg?v=3',
  'Domino Deck':
    'https://www.thegamecrafter.com/product-images/DominoDeck.jpg?v=3',
  'Divider Deck':
    'https://www.thegamecrafter.com/product-images/DividerDeck.jpg?v=3',
  'Business Deck':
    'https://www.thegamecrafter.com/product-images/BusinessDeck.jpg?v=3',
  'Card Crafting Deck':
    'https://www.thegamecrafter.com/product-images/CardCraftingDeck.jpg?v=3',
  'Clear Card Crafting Deck':
    'https://www.thegamecrafter.com/product-images/ClearCardCraftingDeck.jpg?v=3',
  'Clear Euro Poker Deck':
    'https://www.thegamecrafter.com/product-images/ClearEuroPokerDeck.jpg?v=3',
  'Mint Tin Deck':
    'https://www.thegamecrafter.com/product-images/MintTinDeck.jpg?v=3',
  'US Game Deck':
    'https://www.thegamecrafter.com/product-images/USGameDeck.jpg?v=3',
  'Trading Deck':
    'https://www.thegamecrafter.com/product-images/TradingDeck.jpg?v=3',
  'Accordion Board Set':
    'https://www.thegamecrafter.com/product-images/AccordionBoard.jpg?v=3',
  'Bi-Fold Game Board':
    'https://www.thegamecrafter.com/product-images/BiFoldBoard.jpg?v=3',
  'Quad-Fold Game Board':
    'https://www.thegamecrafter.com/product-images/QuadFoldBoard.jpg?v=3',
  'Large Quad-Fold Game Board':
    'https://www.thegamecrafter.com/product-images/LargeQuadFoldBoard.jpg?v=3',
  'Six-Fold Game Board':
    'https://www.thegamecrafter.com/product-images/SixFoldBoard.jpg?v=3',
  'Medium Six-Fold Game Board':
    'https://www.thegamecrafter.com/product-images/MediumSixFoldBoard.jpg?v=3',
  'Large Square Board Set':
    'https://www.thegamecrafter.com/product-images/LargeSquareBoard.jpg?v=3',
  'Square Board Set':
    'https://www.thegamecrafter.com/product-images/SquareBoard.jpg?v=3',
  'Small Square Board Set':
    'https://www.thegamecrafter.com/product-images/SmallSquareBoard.jpg?v=3',
  'Half Board Set':
    'https://www.thegamecrafter.com/product-images/HalfBoard.jpg?v=3',
  'Quarter Board Set':
    'https://www.thegamecrafter.com/product-images/QuarterBoard.jpg?v=3',
  'Domino Board Set':
    'https://www.thegamecrafter.com/product-images/DominoBoard.jpg?v=3',
  'Skinny Board Set':
    'https://www.thegamecrafter.com/product-images/SkinnyBoard.jpg?v=3',
  'Strip Board Set':
    'https://www.thegamecrafter.com/product-images/StripBoard.jpg?v=3',
  'Sliver Board Set':
    'https://www.thegamecrafter.com/product-images/SliverBoard.jpg?v=3',
  'Large Dual Layer Board Set':
    'https://www.thegamecrafter.com/product-images/LargeDualLayerBoard.jpg?v=3',
  'Medium Dual Layer Board Set':
    'https://www.thegamecrafter.com/product-images/MediumDualLayerBoard.jpg?v=3',
  'Small Dual Layer Board Set':
    'https://www.thegamecrafter.com/product-images/SmallDualLayerBoard.jpg?v=3',
  'Small Booklet':
    'https://www.thegamecrafter.com/product-images/SmallBooklet.jpg?v=3',
  'Medium Booklet':
    'https://www.thegamecrafter.com/product-images/MediumBooklet.jpg?v=3',
  'Large Booklet':
    'https://www.thegamecrafter.com/product-images/LargeBooklet.jpg?v=3',
  'Tall Booklet':
    'https://www.thegamecrafter.com/product-images/TallBooklet.jpg?v=3',
  'Jumbo Booklet':
    'https://www.thegamecrafter.com/product-images/JumboBooklet.jpg?v=3',
  'Tarot Booklet':
    'https://www.thegamecrafter.com/product-images/TarotBooklet.jpg?v=3',
  'Digest Perfect Bound Book':
    'https://www.thegamecrafter.com/product-images/DigestPerfectBoundBook.jpg?v=3',
  'Letter Perfect Bound Book':
    'https://www.thegamecrafter.com/product-images/LetterPerfectBoundBook.jpg?v=3',
  'Medium Coil Book':
    'https://www.thegamecrafter.com/product-images/MediumCoilBook.jpg?v=3',
  'Jumbo Coil Book':
    'https://www.thegamecrafter.com/product-images/JumboCoilBook.jpg?v=3',
  'Medium Mat Book':
    'https://www.thegamecrafter.com/product-images/MediumMatBook.jpg?v=3',
  'Document (Loose Sheets)':
    'https://www.thegamecrafter.com/product-images/Document.jpg?v=3',
  'Poker Folio Set':
    'https://www.thegamecrafter.com/product-images/PokerFolio.jpg?v=3',
  'Small Score Pad (Color)':
    'https://www.thegamecrafter.com/product-images/SmallScorePadColor.jpg?v=3',
  'Medium Score Pad (Color)':
    'https://www.thegamecrafter.com/product-images/MediumScorePadColor.jpg?v=3',
  'Large Score Pad (Color)':
    'https://www.thegamecrafter.com/product-images/LargeScorePadColor.jpg?v=3',
  'Poker Hook Box':
    'https://www.thegamecrafter.com/product-images/PokerHookBox108.jpg?v=3',
  'Bridge Hook Box':
    'https://www.thegamecrafter.com/product-images/BridgeHookBox108.jpg?v=3',
  'Jumbo Hook Box':
    'https://www.thegamecrafter.com/product-images/JumboHookBox90.jpg?v=3',
  'Tarot Hook Box':
    'https://www.thegamecrafter.com/product-images/TarotHookBox90.jpg?v=3',
  'Square Hook Box':
    'https://www.thegamecrafter.com/product-images/SquareHookBox96.jpg?v=3',
  'Poker Tuck Box':
    'https://www.thegamecrafter.com/product-images/PokerTuckBox108.jpg?v=3',
  'Bridge Tuck Box':
    'https://www.thegamecrafter.com/product-images/BridgeTuckBox108.jpg?v=3',
  'Jumbo Tuck Box':
    'https://www.thegamecrafter.com/product-images/JumboTuckBox90.jpg?v=3',
  'Tarot Tuck Box':
    'https://www.thegamecrafter.com/product-images/TarotTuckBox90.jpg?v=3',
  'Square Tuck Box':
    'https://www.thegamecrafter.com/product-images/SquareTuckBox96.jpg?v=3',
  'Mint Tin': 'https://www.thegamecrafter.com/product-images/MintTin.jpg?v=3',
  'Tall Mint Tin':
    'https://www.thegamecrafter.com/product-images/TallMintTin.jpg?v=3',
  'Small Stout Box':
    'https://www.thegamecrafter.com/product-images/SmallStoutBox.jpg?v=3',
  'Medium Stout Box':
    'https://www.thegamecrafter.com/product-images/MediumStoutBox.jpg?v=3',
  'Large Stout Box':
    'https://www.thegamecrafter.com/product-images/LargeStoutBox.jpg?v=3',
  'Small Pro Box':
    'https://www.thegamecrafter.com/product-images/SmallProBox.jpg?v=3',
  'Medium Pro Box':
    'https://www.thegamecrafter.com/product-images/MediumProBox.jpg?v=3',
  'Small Prototype Box':
    'https://www.thegamecrafter.com/product-images/SmallPrototypeBox.jpg?v=3',
  'Large Retail Box':
    'https://www.thegamecrafter.com/product-images/LargeRetailBox.jpg?v=3',
  'Deck Box': 'https://www.thegamecrafter.com/product-images/DeckBox.jpg?v=3',
  'Poker Booster Box':
    'https://www.thegamecrafter.com/product-images/PokerBoosterBox.jpg?v=3',
  'Poker Booster Pack':
    'https://www.thegamecrafter.com/product-images/PokerBooster.jpg?v=3',
  'Poker Envelope':
    'https://www.thegamecrafter.com/product-images/PokerEnvelope.jpg?v=3',
  'VHS Box': 'https://www.thegamecrafter.com/product-images/VHSBox.jpg?v=3',
};

const RAW: RawEntry[] = [
  ...DECKS,
  ...BOARDS,
  ...BOOKLETS,
  ...SCOREPADS,
  ...BOXES,
];

// ---------------------------------------------------------------------------
// Transform sourced data -> CuratedProduct[]
// ---------------------------------------------------------------------------

const GROUP_CATEGORY: Record<CuratedProduct['group'], string> = {
  deck: 'cards',
  board: 'boards',
  booklet: 'booklets',
  scorepad: 'scorepads',
  box: 'boxes',
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/["'.()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Extract the purchasable-unit price and a unit label from a sourced tier. */
function unitFromTier(
  tier: Record<string, number>,
): { price: number; unit: string } | null {
  if (typeof tier.costEach === 'number')
    return { price: tier.costEach, unit: 'each' };
  const sheetKey = Object.keys(tier).find((k) => k.startsWith('perSheet'));
  if (sheetKey) {
    const m = sheetKey.match(/^perSheet(\d+)$/);
    return {
      price: tier[sheetKey],
      unit: m ? `sheet of ${m[1]} cards` : 'sheet',
    };
  }
  if (typeof tier.perItem === 'number')
    return { price: tier.perItem, unit: 'item' };
  return null;
}

function buildCurated(r: RawEntry): CuratedProduct | null {
  const stdTier = r.priceTiers.find((t) => t.minCopies === 1);
  const bulkTier = r.priceTiers.find((t) => t.minCopies === 100);
  const std = stdTier ? unitFromTier(stdTier) : null;
  const bulk = bulkTier ? unitFromTier(bulkTier) : null;
  if (!std) return null; // no usable price — skip rather than guess

  const priceTiers: ParsedProduct['variants'][0]['priceTiers'] = [
    {
      minQuantity: 1,
      maxQuantity: bulk ? 99 : null,
      unitPrice: std.price,
      totalPrice: null,
      currency: 'USD',
    },
  ];
  if (bulk) {
    priceTiers.push({
      minQuantity: 100,
      maxQuantity: null,
      unitPrice: bulk.price,
      totalPrice: null,
      currency: 'USD',
    });
  }

  // Options describing the fixed product (matches the BGM cards option style).
  const options: ParsedProduct['variants'][0]['options'] = [
    {
      optionGroup: 'Spec',
      optionKey: 'api_identity',
      optionLabel: 'API Identity',
      optionValue: r.identity,
    },
    {
      optionGroup: 'Pricing',
      optionKey: 'priced_per',
      optionLabel: 'Priced Per',
      optionValue: std.unit,
    },
  ];
  if (r.cardsPerSheet)
    options.push({
      optionGroup: 'Spec',
      optionKey: 'cards_per_sheet',
      optionLabel: 'Cards per Sheet',
      optionValue: String(r.cardsPerSheet),
    });
  if (r.itemsPerSheet)
    options.push({
      optionGroup: 'Spec',
      optionKey: 'items_per_sheet',
      optionLabel: 'Items per Sheet',
      optionValue: String(r.itemsPerSheet),
    });
  if (r.cardCapacityOptions?.length)
    options.push({
      optionGroup: 'Spec',
      optionKey: 'card_capacity',
      optionLabel: 'Card Capacity',
      optionValue: r.cardCapacityOptions.join(' / '),
    });
  if (r.pages)
    options.push({
      optionGroup: 'Spec',
      optionKey: 'pages',
      optionLabel: 'Pages',
      optionValue: String(r.pages),
    });
  else if (r.maxPages)
    options.push({
      optionGroup: 'Spec',
      optionKey: 'pages',
      optionLabel: 'Pages',
      optionValue: `up to ${r.maxPages}`,
    });

  // Layout constraint from the printable dimensions.
  const layoutNotes: string[] = [];
  if (r.depthIn) layoutNotes.push(`Depth: ${r.depthIn} in`);
  if (r.thicknessIn)
    layoutNotes.push(`Thickness: ${round2(r.thicknessIn * INCH_TO_MM)} mm`);
  const hasDims = (r.widthIn ?? 0) > 0 || (r.heightIn ?? 0) > 0;
  const layoutConstraints: ParsedProduct['variants'][0]['layoutConstraints'] =
    hasDims
      ? [
          {
            faceKey: 'front',
            widthMm: r.widthIn ? round2(r.widthIn * INCH_TO_MM) : undefined,
            heightMm: r.heightIn ? round2(r.heightIn * INCH_TO_MM) : undefined,
            cutlineRequired: false,
            notes: layoutNotes.length ? layoutNotes.join('; ') : undefined,
            constraintsJson: {
              widthIn: r.widthIn,
              heightIn: r.heightIn,
              depthIn: r.depthIn,
              thicknessIn: r.thicknessIn,
            },
          },
        ]
      : [];

  const dims = hasDims ? `${r.widthIn}″ × ${r.heightIn}″` : 'size varies';
  const priceLine = bulk
    ? `$${std.price.toFixed(2)} per ${std.unit} (1+ copies), $${bulk.price.toFixed(2)} (100+ copies)`
    : `$${std.price.toFixed(2)} per ${std.unit}`;
  const description =
    `${r.displayName} — The Game Crafter custom-printed ${r.group}. ${dims}. ${priceLine} (USD). ` +
    `Excludes $0.89/copy handling fee.` +
    (r.notes ? ` ${r.notes}` : '') +
    (r.confidence !== 'high'
      ? ' NOTE: API identity inferred from storefront — verify before programmatic ordering.'
      : '');

  return {
    group: r.group,
    slug: slugify(r.displayName),
    title: r.displayName,
    category: GROUP_CATEGORY[r.group],
    subcategory: r.identity,
    sourceUrl: r.group === 'deck' ? PRODUCTS_URL : PRICING_URL,
    imageUrl: IMAGE_BY_NAME[r.displayName] ?? null,
    description,
    variants: [
      {
        variantCode: 'default',
        title: r.displayName,
        isDefault: true,
        options,
        layoutConstraints,
        priceTiers,
      },
    ],
  };
}

/** The curated printable-product catalog, derived from sourced TGC pricing. */
export const TGC_CURATED_PRODUCTS: CuratedProduct[] = RAW.map(
  buildCurated,
).filter((p): p is CuratedProduct => p !== null);
