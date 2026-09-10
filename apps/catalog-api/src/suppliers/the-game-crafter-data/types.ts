export interface RawEntry {
  group: 'deck' | 'board' | 'booklet' | 'scorepad' | 'box';
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
