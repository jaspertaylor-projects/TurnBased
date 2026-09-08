/** Category listing pages to crawl for product discovery. */
export const CATEGORY_LISTING_PAGES = [
  // Cards (2 pages)
  'https://www.boardgamesmaker.com/customized/card-game-manufacturer.html',
  'https://www.boardgamesmaker.com/customized/card-game-manufacturer-2.html',
  // Boards
  'https://www.boardgamesmaker.com/customized/custom-game-boards.html',
  // Tiles
  'https://www.boardgamesmaker.com/customized/custom-game-tiles.html',
  'https://www.boardgamesmaker.com/customized/custom-shape-size-game-tile-chit.html',
  'https://www.boardgamesmaker.com/customized/custom-punch-out-tokens.html',
];

/** Friendly labels for known dro_ dropdown IDs. */
export const DROPDOWN_LABELS: Record<string, { label: string; group: string }> = {
  dro_paper_type:       { label: 'Card Stock',    group: 'Material' },
  dro_choosesize:       { label: 'Deck Size',     group: 'Configuration' },
  dro_product_effect:   { label: 'Print Effect',  group: 'Finish' },
  dro_packoption:       { label: 'Packaging',     group: 'Box' },
  dro_productgroup1:    { label: 'Product Group',  group: 'Configuration' },
  dro_choosepcs:        { label: 'Fold / Pieces',  group: 'Configuration' },
};

/** Synonym map for normalising shape keywords to canonical values. */
const SHAPE_SYNONYMS: Record<string, string> = {
  hex: 'hexagon', hexagonal: 'hexagon', hexagon: 'hexagon',
  circle: 'circle', circular: 'circle', round: 'circle',
  square: 'square',
  rectangle: 'rectangle', rectangular: 'rectangle',
  triangle: 'triangle', triangular: 'triangle',
  oval: 'oval', oblong: 'oval',
  diamond: 'diamond', rhombus: 'diamond',
  octagon: 'octagon', octagonal: 'octagon',
};

/** Attempt to match a canonical shape from free text. */
export function normalizeShape(text: string): string | null {
  const lower = text.toLowerCase();
  // Check longer keywords first to avoid false positives (e.g. "rectangular" before "angle")
  const sortedKeys = Object.keys(SHAPE_SYNONYMS).sort((a, b) => b.length - a.length);
  for (const keyword of sortedKeys) {
    if (lower.includes(keyword)) return SHAPE_SYNONYMS[keyword];
  }
  return null;
}

/** Map URL slug patterns → category. */
export function detectCategory(slug: string): { category: string; subcategory: string; shape: string | null } {
  const s = slug.toLowerCase();

  const shapes = ['hexagon', 'triangle', 'circle', 'rectangle', 'square'];
  const shape = shapes.find(sh => s.includes(sh)) || null;

  // Boards
  if (s.includes('game-board'))  return { category: 'boards', subcategory: deriveBoardSubcategory(s), shape };

  // Tiles
  if (s.includes('game-tiles') || s.includes('punch-out') || s.includes('chit'))
    return { category: 'tiles', subcategory: deriveTileSubcategory(s), shape };

  // Everything else is cards
  return { category: 'cards', subcategory: deriveCardSubcategory(s), shape };
}

function deriveCardSubcategory(s: string): string {
  if (s.includes('tarot'))      return 'tarot';
  if (s.includes('bridge'))     return 'bridge';
  if (s.includes('poker'))      return 'poker';
  if (s.includes('jumbo') || s.includes('giant'))  return 'jumbo';
  if (s.includes('hex'))        return 'hex';
  if (s.includes('circle') || s.includes('round')) return 'circle';
  if (s.includes('square'))     return 'square';
  if (s.includes('mini'))       return 'mini';
  if (s.includes('micro'))      return 'micro';
  if (s.includes('domino'))     return 'domino';
  if (s.includes('landscape') || s.includes('wide'))  return 'landscape';
  if (s.includes('tcg') || s.includes('trading') || s.includes('token') || s.includes('collectible'))
    return 'tcg';
  if (s.includes('business'))   return 'business';
  if (s.includes('skat'))       return 'skat';
  if (s.includes('trump'))      return 'trump';
  if (s.includes('photo'))      return 'photo';
  return 'standard';
}

function deriveBoardSubcategory(s: string): string {
  if (s.includes('custom-size')) return 'custom-size';
  const sizeMatch = s.match(/(\d+)x(\d+)/);
  if (sizeMatch) return `${sizeMatch[1]}x${sizeMatch[2]}`;
  const singleMatch = s.match(/board-(\d+)/);
  if (singleMatch) return `${singleMatch[1]}x${singleMatch[1]}`;
  return 'standard';
}

function deriveTileSubcategory(s: string): string {
  const shapes = ['hexagon', 'triangle', 'circle', 'rectangle', 'square'];
  const shape = shapes.find(sh => s.includes(sh)) || 'custom';
  const sizes = ['micro', 'small', 'medium', 'large'];
  const size = sizes.find(sz => s.includes(sz)) || '';
  return size ? `${shape}-${size}` : shape;
}

/** Default layout constraints per category. */
export function defaultLayout(category: string) {
  switch (category) {
    case 'boards': return { widthMm: 457, heightMm: 457, bleedMm: 3, safeZoneMm: 5, dpi: 300 };
    case 'tiles':  return { widthMm: 50,  heightMm: 50,  bleedMm: 1, safeZoneMm: 1, dpi: 300 };
    default:       return { widthMm: 63,  heightMm: 88,  bleedMm: 3, safeZoneMm: 2, dpi: 300 };
  }
}
