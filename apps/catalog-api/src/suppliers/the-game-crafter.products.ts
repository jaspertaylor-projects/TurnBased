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
  'Poker Deck': 'https://www.thegamecrafter.com/product-images/PokerDeck.jpg?v=3',
  'Euro Poker Deck': 'https://www.thegamecrafter.com/product-images/EuroPokerDeck.jpg?v=3',
  'Bridge Deck': 'https://www.thegamecrafter.com/product-images/BridgeDeck.jpg?v=3',
  'Mini Deck': 'https://www.thegamecrafter.com/product-images/MiniDeck.jpg?v=3',
  'Tarot Deck': 'https://www.thegamecrafter.com/product-images/TarotDeck.jpg?v=3',
  'Foil Tarot Deck': 'https://www.thegamecrafter.com/product-images/FoilTarotDeck.jpg?v=3',
  'Foil Poker Deck': 'https://www.thegamecrafter.com/product-images/FoilPokerDeck.jpg?v=3',
  'Foil Euro Poker Deck': 'https://www.thegamecrafter.com/product-images/FoilEuroPokerDeck.jpg?v=3',
  'Jumbo Deck': 'https://www.thegamecrafter.com/product-images/JumboDeck.jpg?v=3',
  'Square Deck': 'https://www.thegamecrafter.com/product-images/SquareDeck.jpg?v=3',
  'Euro Square Deck': 'https://www.thegamecrafter.com/product-images/EuroSquareDeck.jpg?v=3',
  'Small Square Deck': 'https://www.thegamecrafter.com/product-images/SmallSquareDeck.jpg?v=3',
  'Micro Deck': 'https://www.thegamecrafter.com/product-images/MicroDeck.jpg?v=3',
  'Hex Deck': 'https://www.thegamecrafter.com/product-images/HexDeck.jpg?v=3',
  'Circle Deck': 'https://www.thegamecrafter.com/product-images/CircleDeck.jpg?v=3',
  'Domino Deck': 'https://www.thegamecrafter.com/product-images/DominoDeck.jpg?v=3',
  'Divider Deck': 'https://www.thegamecrafter.com/product-images/DividerDeck.jpg?v=3',
  'Business Deck': 'https://www.thegamecrafter.com/product-images/BusinessDeck.jpg?v=3',
  'Card Crafting Deck': 'https://www.thegamecrafter.com/product-images/CardCraftingDeck.jpg?v=3',
  'Clear Card Crafting Deck': 'https://www.thegamecrafter.com/product-images/ClearCardCraftingDeck.jpg?v=3',
  'Clear Euro Poker Deck': 'https://www.thegamecrafter.com/product-images/ClearEuroPokerDeck.jpg?v=3',
  'Mint Tin Deck': 'https://www.thegamecrafter.com/product-images/MintTinDeck.jpg?v=3',
  'US Game Deck': 'https://www.thegamecrafter.com/product-images/USGameDeck.jpg?v=3',
  'Trading Deck': 'https://www.thegamecrafter.com/product-images/TradingDeck.jpg?v=3',
  'Accordion Board Set': 'https://www.thegamecrafter.com/product-images/AccordionBoard.jpg?v=3',
  'Bi-Fold Game Board': 'https://www.thegamecrafter.com/product-images/BiFoldBoard.jpg?v=3',
  'Quad-Fold Game Board': 'https://www.thegamecrafter.com/product-images/QuadFoldBoard.jpg?v=3',
  'Large Quad-Fold Game Board': 'https://www.thegamecrafter.com/product-images/LargeQuadFoldBoard.jpg?v=3',
  'Six-Fold Game Board': 'https://www.thegamecrafter.com/product-images/SixFoldBoard.jpg?v=3',
  'Medium Six-Fold Game Board': 'https://www.thegamecrafter.com/product-images/MediumSixFoldBoard.jpg?v=3',
  'Large Square Board Set': 'https://www.thegamecrafter.com/product-images/LargeSquareBoard.jpg?v=3',
  'Square Board Set': 'https://www.thegamecrafter.com/product-images/SquareBoard.jpg?v=3',
  'Small Square Board Set': 'https://www.thegamecrafter.com/product-images/SmallSquareBoard.jpg?v=3',
  'Half Board Set': 'https://www.thegamecrafter.com/product-images/HalfBoard.jpg?v=3',
  'Quarter Board Set': 'https://www.thegamecrafter.com/product-images/QuarterBoard.jpg?v=3',
  'Domino Board Set': 'https://www.thegamecrafter.com/product-images/DominoBoard.jpg?v=3',
  'Skinny Board Set': 'https://www.thegamecrafter.com/product-images/SkinnyBoard.jpg?v=3',
  'Strip Board Set': 'https://www.thegamecrafter.com/product-images/StripBoard.jpg?v=3',
  'Sliver Board Set': 'https://www.thegamecrafter.com/product-images/SliverBoard.jpg?v=3',
  'Large Dual Layer Board Set': 'https://www.thegamecrafter.com/product-images/LargeDualLayerBoard.jpg?v=3',
  'Medium Dual Layer Board Set': 'https://www.thegamecrafter.com/product-images/MediumDualLayerBoard.jpg?v=3',
  'Small Dual Layer Board Set': 'https://www.thegamecrafter.com/product-images/SmallDualLayerBoard.jpg?v=3',
  'Small Booklet': 'https://www.thegamecrafter.com/product-images/SmallBooklet.jpg?v=3',
  'Medium Booklet': 'https://www.thegamecrafter.com/product-images/MediumBooklet.jpg?v=3',
  'Large Booklet': 'https://www.thegamecrafter.com/product-images/LargeBooklet.jpg?v=3',
  'Tall Booklet': 'https://www.thegamecrafter.com/product-images/TallBooklet.jpg?v=3',
  'Jumbo Booklet': 'https://www.thegamecrafter.com/product-images/JumboBooklet.jpg?v=3',
  'Tarot Booklet': 'https://www.thegamecrafter.com/product-images/TarotBooklet.jpg?v=3',
  'Digest Perfect Bound Book': 'https://www.thegamecrafter.com/product-images/DigestPerfectBoundBook.jpg?v=3',
  'Letter Perfect Bound Book': 'https://www.thegamecrafter.com/product-images/LetterPerfectBoundBook.jpg?v=3',
  'Medium Coil Book': 'https://www.thegamecrafter.com/product-images/MediumCoilBook.jpg?v=3',
  'Jumbo Coil Book': 'https://www.thegamecrafter.com/product-images/JumboCoilBook.jpg?v=3',
  'Medium Mat Book': 'https://www.thegamecrafter.com/product-images/MediumMatBook.jpg?v=3',
  'Document (Loose Sheets)': 'https://www.thegamecrafter.com/product-images/Document.jpg?v=3',
  'Poker Folio Set': 'https://www.thegamecrafter.com/product-images/PokerFolio.jpg?v=3',
  'Small Score Pad (Color)': 'https://www.thegamecrafter.com/product-images/SmallScorePadColor.jpg?v=3',
  'Medium Score Pad (Color)': 'https://www.thegamecrafter.com/product-images/MediumScorePadColor.jpg?v=3',
  'Large Score Pad (Color)': 'https://www.thegamecrafter.com/product-images/LargeScorePadColor.jpg?v=3',
  'Poker Hook Box': 'https://www.thegamecrafter.com/product-images/PokerHookBox108.jpg?v=3',
  'Bridge Hook Box': 'https://www.thegamecrafter.com/product-images/BridgeHookBox108.jpg?v=3',
  'Jumbo Hook Box': 'https://www.thegamecrafter.com/product-images/JumboHookBox90.jpg?v=3',
  'Tarot Hook Box': 'https://www.thegamecrafter.com/product-images/TarotHookBox90.jpg?v=3',
  'Square Hook Box': 'https://www.thegamecrafter.com/product-images/SquareHookBox96.jpg?v=3',
  'Poker Tuck Box': 'https://www.thegamecrafter.com/product-images/PokerTuckBox108.jpg?v=3',
  'Bridge Tuck Box': 'https://www.thegamecrafter.com/product-images/BridgeTuckBox108.jpg?v=3',
  'Jumbo Tuck Box': 'https://www.thegamecrafter.com/product-images/JumboTuckBox90.jpg?v=3',
  'Tarot Tuck Box': 'https://www.thegamecrafter.com/product-images/TarotTuckBox90.jpg?v=3',
  'Square Tuck Box': 'https://www.thegamecrafter.com/product-images/SquareTuckBox96.jpg?v=3',
  'Mint Tin': 'https://www.thegamecrafter.com/product-images/MintTin.jpg?v=3',
  'Tall Mint Tin': 'https://www.thegamecrafter.com/product-images/TallMintTin.jpg?v=3',
  'Small Stout Box': 'https://www.thegamecrafter.com/product-images/SmallStoutBox.jpg?v=3',
  'Medium Stout Box': 'https://www.thegamecrafter.com/product-images/MediumStoutBox.jpg?v=3',
  'Large Stout Box': 'https://www.thegamecrafter.com/product-images/LargeStoutBox.jpg?v=3',
  'Small Pro Box': 'https://www.thegamecrafter.com/product-images/SmallProBox.jpg?v=3',
  'Medium Pro Box': 'https://www.thegamecrafter.com/product-images/MediumProBox.jpg?v=3',
  'Small Prototype Box': 'https://www.thegamecrafter.com/product-images/SmallPrototypeBox.jpg?v=3',
  'Large Retail Box': 'https://www.thegamecrafter.com/product-images/LargeRetailBox.jpg?v=3',
  'Deck Box': 'https://www.thegamecrafter.com/product-images/DeckBox.jpg?v=3',
  'Poker Booster Box': 'https://www.thegamecrafter.com/product-images/PokerBoosterBox.jpg?v=3',
  'Poker Booster Pack': 'https://www.thegamecrafter.com/product-images/PokerBooster.jpg?v=3',
  'Poker Envelope': 'https://www.thegamecrafter.com/product-images/PokerEnvelope.jpg?v=3',
  'VHS Box': 'https://www.thegamecrafter.com/product-images/VHSBox.jpg?v=3',
};

interface RawEntry {
  group: CuratedProduct['group'];
  identity: string;
  displayName: string;
  widthIn?: number;
  heightIn?: number;
  depthIn?: number;
  thicknessIn?: number;
  cardsPerSheet?: number;
  itemsPerSheet?: number;
  pages?: number;
  maxPages?: number;
  cardCapacityOptions?: number[];
  /** Price tiers verbatim from the source; keys vary by product type. */
  priceTiers: Array<Record<string, number>>;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

const RAW: RawEntry[] = [
  // ----- Card decks (category: cards) -----
  { group: 'deck', identity: 'PokerDeck', displayName: 'Poker Deck', widthIn: 2.5, heightIn: 3.5, cardsPerSheet: 18, priceTiers: [{ minCopies: 1, perSheet18: 2.99 }, { minCopies: 100, perSheet18: 1.69 }], confidence: 'high', notes: 'Standard US poker size.' },
  { group: 'deck', identity: 'EuroPokerDeck', displayName: 'Euro Poker Deck', widthIn: 2.48, heightIn: 3.46, cardsPerSheet: 18, priceTiers: [{ minCopies: 1, perSheet18: 3.09 }, { minCopies: 100, perSheet18: 1.78 }], confidence: 'high', notes: 'European 63x88mm poker size.' },
  { group: 'deck', identity: 'BridgeDeck', displayName: 'Bridge Deck', widthIn: 2.25, heightIn: 3.5, cardsPerSheet: 18, priceTiers: [{ minCopies: 1, perSheet18: 3.09 }, { minCopies: 100, perSheet18: 1.78 }], confidence: 'high', notes: 'Narrow bridge size.' },
  { group: 'deck', identity: 'MiniDeck', displayName: 'Mini Deck', widthIn: 1.75, heightIn: 2.5, cardsPerSheet: 32, priceTiers: [{ minCopies: 1, perSheet32: 3.85 }, { minCopies: 100, perSheet32: 2.2 }], confidence: 'high', notes: 'Single Mini product (no Mini-American/European split).' },
  { group: 'deck', identity: 'TarotDeck', displayName: 'Tarot Deck', widthIn: 2.75, heightIn: 4.75, cardsPerSheet: 10, priceTiers: [{ minCopies: 1, perSheet10: 2.84 }, { minCopies: 100, perSheet10: 1.55 }], confidence: 'high' },
  { group: 'deck', identity: 'FoilTarotDeck', displayName: 'Foil Tarot Deck', widthIn: 2.75, heightIn: 4.75, cardsPerSheet: 10, priceTiers: [{ minCopies: 1, perSheet10: 7.47 }, { minCopies: 100, perSheet10: 3.43 }], confidence: 'high', notes: 'Foil-stamped tarot.' },
  { group: 'deck', identity: 'FoilPokerDeck', displayName: 'Foil Poker Deck', widthIn: 2.5, heightIn: 3.5, cardsPerSheet: 18, priceTiers: [{ minCopies: 1, perSheet18: 6.19 }, { minCopies: 100, perSheet18: 3.13 }], confidence: 'high' },
  { group: 'deck', identity: 'FoilPokerDeck', displayName: 'Foil Euro Poker Deck', widthIn: 2.48, heightIn: 3.46, cardsPerSheet: 18, priceTiers: [{ minCopies: 1, perSheet18: 6.39 }, { minCopies: 100, perSheet18: 3.33 }], confidence: 'medium', notes: 'Euro variant of foil poker; identity may take a size param.' },
  { group: 'deck', identity: 'JumboDeck', displayName: 'Jumbo Deck', widthIn: 3.5, heightIn: 5.5, cardsPerSheet: 6, priceTiers: [{ minCopies: 1, perSheet6: 2.7 }, { minCopies: 100, perSheet6: 1.43 }], confidence: 'high' },
  { group: 'deck', identity: 'SquareDeck', displayName: 'Square Deck', widthIn: 3.5, heightIn: 3.5, cardsPerSheet: 12, priceTiers: [{ minCopies: 1, perSheet12: 3.0 }, { minCopies: 100, perSheet12: 1.62 }], confidence: 'high', notes: 'Large square (3.5in).' },
  { group: 'deck', identity: 'EuroSquareDeck', displayName: 'Euro Square Deck', widthIn: 2.76, heightIn: 2.76, cardsPerSheet: 15, priceTiers: [{ minCopies: 1, perSheet15: 3.55 }, { minCopies: 100, perSheet15: 1.7 }], confidence: 'high', notes: '70mm square.' },
  { group: 'deck', identity: 'SmallSquareDeck', displayName: 'Small Square Deck', widthIn: 2.5, heightIn: 2.5, cardsPerSheet: 24, priceTiers: [{ minCopies: 1, perSheet24: 3.55 }, { minCopies: 100, perSheet24: 1.98 }], confidence: 'high' },
  { group: 'deck', identity: 'MicroDeck', displayName: 'Micro Deck', widthIn: 1.25, heightIn: 1.75, cardsPerSheet: 36, priceTiers: [{ minCopies: 1, perSheet36: 3.09 }, { minCopies: 100, perSheet36: 1.78 }], confidence: 'high', notes: 'Smallest card.' },
  { group: 'deck', identity: 'HexDeck', displayName: 'Hex Deck', widthIn: 3.75, heightIn: 3.25, cardsPerSheet: 12, priceTiers: [{ minCopies: 1, perSheet12: 3.0 }, { minCopies: 100, perSheet12: 1.62 }], confidence: 'high', notes: 'Hexagonal card.' },
  { group: 'deck', identity: 'CircleDeck', displayName: 'Circle Deck', widthIn: 3.5, heightIn: 3.5, cardsPerSheet: 12, priceTiers: [{ minCopies: 1, perSheet12: 3.0 }, { minCopies: 100, perSheet12: 1.62 }], confidence: 'high', notes: 'Round card (3.5in dia).' },
  { group: 'deck', identity: 'DominoDeck', displayName: 'Domino Deck', widthIn: 1.75, heightIn: 3.5, cardsPerSheet: 24, priceTiers: [{ minCopies: 1, perSheet24: 3.55 }, { minCopies: 100, perSheet24: 1.98 }], confidence: 'high' },
  { group: 'deck', identity: 'DividerDeck', displayName: 'Divider Deck', widthIn: 3.0, heightIn: 3.5, cardsPerSheet: 15, priceTiers: [{ minCopies: 1, perSheet15: 3.55 }, { minCopies: 100, perSheet15: 1.7 }], confidence: 'high', notes: 'Tabbed dividers.' },
  { group: 'deck', identity: 'BusinessDeck', displayName: 'Business Deck', widthIn: 2.0, heightIn: 3.5, cardsPerSheet: 21, priceTiers: [{ minCopies: 1, perSheet21: 3.6 }, { minCopies: 100, perSheet21: 1.9 }], confidence: 'high', notes: 'Business-card sized.' },
  { group: 'deck', identity: 'CardCraftingDeck', displayName: 'Card Crafting Deck', widthIn: 2.66, heightIn: 4.7, cardsPerSheet: 10, priceTiers: [{ minCopies: 1, perSheet10: 2.84 }, { minCopies: 100, perSheet10: 1.55 }], confidence: 'high' },
  { group: 'deck', identity: 'ClearCardCraftingDeck', displayName: 'Clear Card Crafting Deck', widthIn: 2.66, heightIn: 4.7, cardsPerSheet: 10, priceTiers: [{ minCopies: 1, perSheet10: 11.88 }, { minCopies: 100, perSheet10: 5.91 }], confidence: 'high', notes: 'Transparent stock; premium price.' },
  { group: 'deck', identity: 'ClearCardCraftingDeck', displayName: 'Clear Euro Poker Deck', widthIn: 2.48, heightIn: 3.46, cardsPerSheet: 18, priceTiers: [{ minCopies: 1, perSheet18: 11.88 }, { minCopies: 100, perSheet18: 5.91 }], confidence: 'medium', notes: 'Clear poker-size deck; verify identity/size param.' },
  { group: 'deck', identity: 'MintTinDeck', displayName: 'Mint Tin Deck', widthIn: 2.05, heightIn: 3.43, cardsPerSheet: 18, priceTiers: [{ minCopies: 1, perSheet18: 3.09 }, { minCopies: 100, perSheet18: 1.78 }], confidence: 'high', notes: 'Sized to fit Mint Tin.' },
  { group: 'deck', identity: 'USGameDeck', displayName: 'US Game Deck', widthIn: 2.2, heightIn: 3.43, cardsPerSheet: 18, priceTiers: [{ minCopies: 1, perSheet18: 3.09 }, { minCopies: 100, perSheet18: 1.78 }], confidence: 'high' },
  { group: 'deck', identity: 'TradingDeck', displayName: 'Trading Deck', widthIn: 2.5, heightIn: 3.5, cardsPerSheet: 18, priceTiers: [{ minCopies: 1, perSheet18: 3.5 }, { minCopies: 100, perSheet18: 1.85 }], confidence: 'medium', notes: 'On storefront but not in dev-doc identity list; identity inferred.' },

  // ----- Game boards (category: boards) -----
  { group: 'board', identity: 'Board (Accordion)', displayName: 'Accordion Board Set', widthIn: 8, heightIn: 16, thicknessIn: 0.07, itemsPerSheet: 1, priceTiers: [{ minCopies: 1, perSheet: 10.5 }, { minCopies: 100, perSheet: 7.05 }], confidence: 'high', notes: 'Boards priced per sheet; optional UV/Linen +$0.25/sheet each.' },
  { group: 'board', identity: 'Board (Bi-Fold)', displayName: 'Bi-Fold Game Board', widthIn: 9, heightIn: 18, thicknessIn: 0.07, itemsPerSheet: 1, priceTiers: [{ minCopies: 1, perSheet: 8.5 }, { minCopies: 100, perSheet: 6.24 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Quad-Fold)', displayName: 'Quad-Fold Game Board', widthIn: 18, heightIn: 18, thicknessIn: 0.07, itemsPerSheet: 1, priceTiers: [{ minCopies: 1, perSheet: 11.89 }, { minCopies: 100, perSheet: 8.7 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Large Quad-Fold)', displayName: 'Large Quad-Fold Game Board', widthIn: 20, heightIn: 20, thicknessIn: 0.07, itemsPerSheet: 1, priceTiers: [{ minCopies: 1, perSheet: 14.73 }, { minCopies: 100, perSheet: 10.87 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Six-Fold)', displayName: 'Six-Fold Game Board', widthIn: 27, heightIn: 18, thicknessIn: 0.07, itemsPerSheet: 1, priceTiers: [{ minCopies: 1, perSheet: 20.3 }, { minCopies: 100, perSheet: 16.3 }], confidence: 'high', notes: 'Largest fold board.' },
  { group: 'board', identity: 'Board (Medium Six-Fold)', displayName: 'Medium Six-Fold Game Board', widthIn: 16, heightIn: 16, thicknessIn: 0.07, itemsPerSheet: 1, priceTiers: [{ minCopies: 1, perSheet: 12.8 }, { minCopies: 100, perSheet: 9.45 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Large Square)', displayName: 'Large Square Board Set', widthIn: 10, heightIn: 10, thicknessIn: 0.07, itemsPerSheet: 1, priceTiers: [{ minCopies: 1, perSheet: 10.0 }, { minCopies: 100, perSheet: 5.95 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Square)', displayName: 'Square Board Set', widthIn: 8, heightIn: 8, thicknessIn: 0.07, itemsPerSheet: 2, priceTiers: [{ minCopies: 1, perItem: 5.33, perSheet: 10.67 }, { minCopies: 100, perSheet: 5.95 }], confidence: 'high', notes: '2 per sheet.' },
  { group: 'board', identity: 'Board (Small Square)', displayName: 'Small Square Board Set', widthIn: 4, heightIn: 4, thicknessIn: 0.07, itemsPerSheet: 8, priceTiers: [{ minCopies: 1, perItem: 1.48, perSheet: 11.8 }, { minCopies: 100, perItem: 0.76, perSheet: 6.1 }], confidence: 'high', notes: '8 per sheet.' },
  { group: 'board', identity: 'Board (Half)', displayName: 'Half Board Set', widthIn: 5, heightIn: 10, thicknessIn: 0.07, itemsPerSheet: 3, priceTiers: [{ minCopies: 1, perItem: 3.67, perSheet: 11.0 }, { minCopies: 100, perSheet: 5.95 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Quarter)', displayName: 'Quarter Board Set', widthIn: 5, heightIn: 5, thicknessIn: 0.07, itemsPerSheet: 6, priceTiers: [{ minCopies: 1, perItem: 1.67, perSheet: 10.0 }, { minCopies: 100, perSheet: 5.95 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Domino)', displayName: 'Domino Board Set', widthIn: 4, heightIn: 8, thicknessIn: 0.07, itemsPerSheet: 4, priceTiers: [{ minCopies: 1, perItem: 2.75, perSheet: 11.0 }, { minCopies: 100, perSheet: 5.95 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Skinny)', displayName: 'Skinny Board Set', widthIn: 4, heightIn: 10, thicknessIn: 0.07, itemsPerSheet: 4, priceTiers: [{ minCopies: 1, perItem: 2.85, perSheet: 11.4 }, { minCopies: 100, perSheet: 5.95 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Strip)', displayName: 'Strip Board Set', widthIn: 2, heightIn: 10, thicknessIn: 0.07, itemsPerSheet: 7, priceTiers: [{ minCopies: 1, perItem: 1.75, perSheet: 12.25 }, { minCopies: 100, perSheet: 5.95 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Sliver)', displayName: 'Sliver Board Set', widthIn: 2, heightIn: 8, thicknessIn: 0.07, itemsPerSheet: 10, priceTiers: [{ minCopies: 1, perItem: 1.27, perSheet: 12.75 }, { minCopies: 100, perItem: 0.61, perSheet: 6.1 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Dual Layer Large)', displayName: 'Large Dual Layer Board Set', widthIn: 8, heightIn: 10, thicknessIn: 0.14, itemsPerSheet: 1, priceTiers: [{ minCopies: 1, perSheet: 9.1 }, { minCopies: 100, perSheet: 4.97 }], confidence: 'high', notes: '4mm thick, 1 printed side.' },
  { group: 'board', identity: 'Board (Dual Layer Medium)', displayName: 'Medium Dual Layer Board Set', widthIn: 8, heightIn: 4, thicknessIn: 0.14, itemsPerSheet: 2, priceTiers: [{ minCopies: 1, perSheet: 8.76 }, { minCopies: 100, perSheet: 4.63 }], confidence: 'high' },
  { group: 'board', identity: 'Board (Dual Layer Small)', displayName: 'Small Dual Layer Board Set', widthIn: 3.5, heightIn: 5.5, thicknessIn: 0.14, itemsPerSheet: 4, priceTiers: [{ minCopies: 1, perSheet: 8.51 }, { minCopies: 100, perSheet: 4.38 }], confidence: 'high' },

  // ----- Booklets / books / documents (category: booklets) -----
  { group: 'booklet', identity: 'Booklet', displayName: 'Small Booklet', widthIn: 2.5, heightIn: 3.5, maxPages: 40, priceTiers: [{ minCopies: 1, costEach: 2.75 }, { minCopies: 100, costEach: 2.01 }], confidence: 'high', notes: 'Saddle-stitched; example 4 pages.' },
  { group: 'booklet', identity: 'Booklet', displayName: 'Medium Booklet', widthIn: 3.5, heightIn: 5, maxPages: 40, priceTiers: [{ minCopies: 1, costEach: 2.75 }, { minCopies: 100, costEach: 2.01 }], confidence: 'high' },
  { group: 'booklet', identity: 'Booklet', displayName: 'Large Booklet', widthIn: 5, heightIn: 8, maxPages: 40, priceTiers: [{ minCopies: 1, costEach: 1.88 }, { minCopies: 100, costEach: 1.38 }], confidence: 'high' },
  { group: 'booklet', identity: 'Booklet', displayName: 'Tall Booklet', widthIn: 4.5, heightIn: 8, maxPages: 40, priceTiers: [{ minCopies: 1, costEach: 2.31 }, { minCopies: 100, costEach: 1.72 }], confidence: 'high' },
  { group: 'booklet', identity: 'Booklet', displayName: 'Jumbo Booklet', widthIn: 8, heightIn: 10, maxPages: 40, priceTiers: [{ minCopies: 1, costEach: 2.06 }, { minCopies: 100, costEach: 1.5 }], confidence: 'high' },
  { group: 'booklet', identity: 'Booklet', displayName: 'Tarot Booklet', widthIn: 2.75, heightIn: 4.75, maxPages: 40, priceTiers: [{ minCopies: 1, costEach: 2.75 }, { minCopies: 100, costEach: 2.01 }], confidence: 'high' },
  { group: 'booklet', identity: 'PerfectBoundBook', displayName: 'Digest Perfect Bound Book', widthIn: 5.38, heightIn: 8.39, maxPages: 200, priceTiers: [{ minCopies: 1, costEach: 11.45 }, { minCopies: 100, costEach: 8.64 }], confidence: 'high', notes: 'Example 40 pages.' },
  { group: 'booklet', identity: 'PerfectBoundBook', displayName: 'Letter Perfect Bound Book', widthIn: 8.51, heightIn: 11, maxPages: 200, priceTiers: [{ minCopies: 1, costEach: 12.1 }, { minCopies: 100, costEach: 9.0 }], confidence: 'high' },
  { group: 'booklet', identity: 'CoilBook', displayName: 'Medium Coil Book', widthIn: 5.61, heightIn: 7.5, maxPages: 200, priceTiers: [{ minCopies: 1, costEach: 7.65 }, { minCopies: 100, costEach: 5.69 }], confidence: 'high', notes: 'Spiral/coil bound.' },
  { group: 'booklet', identity: 'CoilBook', displayName: 'Jumbo Coil Book', widthIn: 9.36, heightIn: 10, maxPages: 200, priceTiers: [{ minCopies: 1, costEach: 7.34 }, { minCopies: 100, costEach: 5.37 }], confidence: 'high' },
  { group: 'booklet', identity: 'MatBook', displayName: 'Medium Mat Book', widthIn: 5.61, heightIn: 7.5, maxPages: 100, priceTiers: [{ minCopies: 1, costEach: 8.18 }, { minCopies: 100, costEach: 6.02 }], confidence: 'medium', notes: 'Identity inferred.' },
  { group: 'booklet', identity: 'Document', displayName: 'Document (Loose Sheets)', widthIn: 8.5, heightIn: 11, maxPages: 1000, priceTiers: [{ minCopies: 1, costEach: 1.82 }, { minCopies: 100, costEach: 1.33 }], confidence: 'high', notes: 'Loose printed sheets, up to 1000 pages.' },
  { group: 'booklet', identity: 'Folio', displayName: 'Poker Folio Set', widthIn: 10, heightIn: 3.5, priceTiers: [{ minCopies: 1, costEach: 2.6 }, { minCopies: 100, costEach: 1.32 }], confidence: 'high', notes: 'Folded rules folio; identity inferred.' },

  // ----- Score pads (category: scorepads) -----
  { group: 'scorepad', identity: 'ScorePad', displayName: 'Small Score Pad (Color)', widthIn: 3.5, heightIn: 5.5, pages: 40, priceTiers: [{ minCopies: 1, costEach: 7.0 }, { minCopies: 100, costEach: 4.3 }], confidence: 'high' },
  { group: 'scorepad', identity: 'ScorePad', displayName: 'Medium Score Pad (Color)', widthIn: 4.5, heightIn: 8, pages: 40, priceTiers: [{ minCopies: 1, costEach: 7.0 }, { minCopies: 100, costEach: 4.3 }], confidence: 'high' },
  { group: 'scorepad', identity: 'ScorePad', displayName: 'Large Score Pad (Color)', widthIn: 8, heightIn: 10, pages: 40, priceTiers: [{ minCopies: 1, costEach: 9.6 }, { minCopies: 100, costEach: 7.2 }], confidence: 'high' },

  // ----- Boxes & packaging (category: boxes) -----
  { group: 'box', identity: 'HookBox', displayName: 'Poker Hook Box', widthIn: 2.5, heightIn: 3.5, cardCapacityOptions: [18, 36, 54, 72, 90, 108], priceTiers: [{ minCopies: 1, costEach: 3.28 }, { minCopies: 100, costEach: 1.4 }], confidence: 'high', notes: 'Same price all capacities; depth varies.' },
  { group: 'box', identity: 'HookBox', displayName: 'Bridge Hook Box', widthIn: 2.25, heightIn: 3.5, cardCapacityOptions: [54, 108], priceTiers: [{ minCopies: 1, costEach: 3.28 }, { minCopies: 100, costEach: 1.4 }], confidence: 'high' },
  { group: 'box', identity: 'HookBox', displayName: 'Jumbo Hook Box', widthIn: 3.5, heightIn: 5.5, cardCapacityOptions: [36, 90], priceTiers: [{ minCopies: 1, costEach: 3.28 }, { minCopies: 100, costEach: 1.4 }], confidence: 'high' },
  { group: 'box', identity: 'HookBox', displayName: 'Tarot Hook Box', widthIn: 2.75, heightIn: 4.75, cardCapacityOptions: [40, 90], priceTiers: [{ minCopies: 1, costEach: 3.28 }, { minCopies: 100, costEach: 1.4 }], confidence: 'high' },
  { group: 'box', identity: 'HookBox', displayName: 'Square Hook Box', widthIn: 3.5, heightIn: 3.75, cardCapacityOptions: [48, 96], priceTiers: [{ minCopies: 1, costEach: 3.28 }, { minCopies: 100, costEach: 1.4 }], confidence: 'high' },
  { group: 'box', identity: 'TuckBox', displayName: 'Poker Tuck Box', widthIn: 2.5, heightIn: 3.5, cardCapacityOptions: [36, 54, 72, 90, 108], priceTiers: [{ minCopies: 1, costEach: 5.85 }, { minCopies: 100, costEach: 3.65 }], confidence: 'high', notes: 'Same price all capacities; depth varies.' },
  { group: 'box', identity: 'TuckBox', displayName: 'Bridge Tuck Box', widthIn: 2.25, heightIn: 3.5, cardCapacityOptions: [54, 108], priceTiers: [{ minCopies: 1, costEach: 5.85 }, { minCopies: 100, costEach: 3.65 }], confidence: 'high' },
  { group: 'box', identity: 'TuckBox', displayName: 'Jumbo Tuck Box', widthIn: 3.5, heightIn: 5.5, cardCapacityOptions: [90], priceTiers: [{ minCopies: 1, costEach: 5.85 }, { minCopies: 100, costEach: 3.65 }], confidence: 'high' },
  { group: 'box', identity: 'TuckBox', displayName: 'Tarot Tuck Box', widthIn: 2.75, heightIn: 4.75, cardCapacityOptions: [40, 90], priceTiers: [{ minCopies: 1, costEach: 5.85 }, { minCopies: 100, costEach: 3.65 }], confidence: 'high' },
  { group: 'box', identity: 'TuckBox', displayName: 'Square Tuck Box', widthIn: 3.5, heightIn: 3.75, cardCapacityOptions: [48, 96], priceTiers: [{ minCopies: 1, costEach: 5.85 }, { minCopies: 100, costEach: 3.65 }], confidence: 'high' },
  { group: 'box', identity: 'MintTin', displayName: 'Mint Tin', widthIn: 2.13, heightIn: 3.55, depthIn: 0.83, priceTiers: [{ minCopies: 1, costEach: 5.02 }, { minCopies: 100, costEach: 3.72 }], confidence: 'high' },
  { group: 'box', identity: 'MintTin', displayName: 'Tall Mint Tin', widthIn: 2.2, heightIn: 3.6, depthIn: 1.25, priceTiers: [{ minCopies: 1, costEach: 5.02 }, { minCopies: 100, costEach: 3.72 }], confidence: 'high' },
  { group: 'box', identity: 'StoutBox', displayName: 'Small Stout Box', widthIn: 3.6, heightIn: 5.5, depthIn: 2.0, priceTiers: [{ minCopies: 1, costEach: 13.0 }, { minCopies: 100, costEach: 9.5 }], confidence: 'high', notes: 'Telescoping 2-piece box.' },
  { group: 'box', identity: 'StoutBox', displayName: 'Medium Stout Box', widthIn: 5.63, heightIn: 8.59, depthIn: 2.0, priceTiers: [{ minCopies: 1, costEach: 15.5 }, { minCopies: 100, costEach: 11.4 }], confidence: 'high', notes: 'Full box printed.' },
  { group: 'box', identity: 'StoutBox', displayName: 'Large Stout Box', widthIn: 10.75, heightIn: 10.75, depthIn: 3.0, priceTiers: [{ minCopies: 1, costEach: 28.0 }, { minCopies: 100, costEach: 25.0 }], confidence: 'high', notes: 'Full box printed.' },
  { group: 'box', identity: 'ProBox', displayName: 'Small Pro Box', widthIn: 5.5, heightIn: 3.5, depthIn: 1.0, priceTiers: [{ minCopies: 1, costEach: 9.09 }, { minCopies: 100, costEach: 6.42 }], confidence: 'high' },
  { group: 'box', identity: 'ProBox', displayName: 'Medium Pro Box', widthIn: 8.2, heightIn: 4.7, depthIn: 1.4, priceTiers: [{ minCopies: 1, costEach: 11.25 }, { minCopies: 100, costEach: 7.7 }], confidence: 'high' },
  { group: 'box', identity: 'PrototypeBox', displayName: 'Small Prototype Box', widthIn: 4.75, heightIn: 3.63, depthIn: 2.13, priceTiers: [{ minCopies: 1, costEach: 5.7 }, { minCopies: 100, costEach: 4.69 }], confidence: 'high', notes: 'Plain prototype box.' },
  { group: 'box', identity: 'RetailBox', displayName: 'Large Retail Box', widthIn: 11.63, heightIn: 9.13, depthIn: 2.0, priceTiers: [{ minCopies: 1, costEach: 14.4 }, { minCopies: 100, costEach: 9.5 }], confidence: 'high' },
  { group: 'box', identity: 'DeckBox', displayName: 'Deck Box', widthIn: 3.77, heightIn: 7.9, depthIn: 3.03, priceTiers: [{ minCopies: 1, costEach: 15.75 }, { minCopies: 100, costEach: 10.75 }], confidence: 'high', notes: 'Full box printed.' },
  { group: 'box', identity: 'BoosterBox', displayName: 'Poker Booster Box', widthIn: 5.18, heightIn: 5.75, depthIn: 2.35, priceTiers: [{ minCopies: 1, costEach: 9.65 }, { minCopies: 100, costEach: 5.9 }], confidence: 'high' },
  { group: 'box', identity: 'BoosterPack', displayName: 'Poker Booster Pack', widthIn: 2.5, heightIn: 3.5, depthIn: 0.23, priceTiers: [{ minCopies: 1, costEach: 2.76 }, { minCopies: 100, costEach: 0.95 }], confidence: 'high' },
  { group: 'box', identity: 'Envelope', displayName: 'Poker Envelope', widthIn: 2.85, heightIn: 4.4, depthIn: 0.23, priceTiers: [{ minCopies: 1, costEach: 1.73 }, { minCopies: 100, costEach: 1.05 }], confidence: 'high' },
  { group: 'box', identity: 'VHSBox', displayName: 'VHS Box', widthIn: 7.4, heightIn: 4.5, depthIn: 0.9, priceTiers: [{ minCopies: 1, costEach: 4.57 }, { minCopies: 100, costEach: 2.25 }], confidence: 'high' },
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
    { optionGroup: 'Spec', optionKey: 'api_identity', optionLabel: 'API Identity', optionValue: r.identity },
    { optionGroup: 'Pricing', optionKey: 'priced_per', optionLabel: 'Priced Per', optionValue: std.unit },
  ];
  if (r.cardsPerSheet)
    options.push({ optionGroup: 'Spec', optionKey: 'cards_per_sheet', optionLabel: 'Cards per Sheet', optionValue: String(r.cardsPerSheet) });
  if (r.itemsPerSheet)
    options.push({ optionGroup: 'Spec', optionKey: 'items_per_sheet', optionLabel: 'Items per Sheet', optionValue: String(r.itemsPerSheet) });
  if (r.cardCapacityOptions?.length)
    options.push({ optionGroup: 'Spec', optionKey: 'card_capacity', optionLabel: 'Card Capacity', optionValue: r.cardCapacityOptions.join(' / ') });
  if (r.pages)
    options.push({ optionGroup: 'Spec', optionKey: 'pages', optionLabel: 'Pages', optionValue: String(r.pages) });
  else if (r.maxPages)
    options.push({ optionGroup: 'Spec', optionKey: 'pages', optionLabel: 'Pages', optionValue: `up to ${r.maxPages}` });

  // Layout constraint from the printable dimensions.
  const layoutNotes: string[] = [];
  if (r.depthIn) layoutNotes.push(`Depth: ${r.depthIn} in`);
  if (r.thicknessIn) layoutNotes.push(`Thickness: ${round2(r.thicknessIn * INCH_TO_MM)} mm`);
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
export const TGC_CURATED_PRODUCTS: CuratedProduct[] = RAW.map(buildCurated).filter(
  (p): p is CuratedProduct => p !== null,
);
