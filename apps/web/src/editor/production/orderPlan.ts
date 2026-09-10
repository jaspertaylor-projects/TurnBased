import type { EditorProject } from '../types';
import type { ProductDetailResponse, ProductVariant } from '../supplierCatalog';
import type { ProjectDesignSet } from '../componentStudio/types';
import { listProjectDesignSets } from '../componentStudio/model';
import {
  classifyCatalogProduct,
  safeSupplierUrl,
  supplierDimensions,
  supplierProductUrl,
  supplierTrimShape,
} from './supplierMatch';

export interface ProductionIssue {
  code: string;
  message: string;
  severity: 'warning' | 'blocking';
}

export interface ProductionPurchase {
  unit: 'deck' | 'sheet' | 'item' | 'unknown';
  unitsPerPack: number | null;
  unitsPerGame: number | null;
  totalUnits: number | null;
  overagePhysical: number | null;
  pageCapacity: number | null;
  /** Printed-goods discounts count copies of this game, not cards or sheets. */
  tierQuantity: number | null;
  tierBasis: 'game copies' | 'physical items' | 'unknown';
}

export interface ProductionEstimate {
  amount: number | null;
  unitPrice: number | null;
  currency: 'USD';
  source: 'cached catalog';
  reason: string | null;
}

export interface ProductionPlanRow {
  id: string;
  designSetId: string;
  instanceId: string | null;
  name: string;
  kind: ProjectDesignSet['kind'];
  designCount: number;
  copiesPerGame: number | null;
  totalPhysical: number | null;
  widthMm: number;
  heightMm: number;
  provider: { code: 'bgm' | 'tgc' | 'unknown'; name: string; id: string | null };
  supplier: string;
  productSlug: string | null;
  productTitle: string;
  variantId: string | null;
  variantTitle: string;
  sourceUrl: string | null;
  productionType: 'printable' | 'stock' | 'unverified';
  /** Ready means the materials plan has no blockers; artwork still needs supplier review. */
  status: 'ready' | 'review' | 'unmatched' | 'empty';
  issues: ProductionIssue[];
  purchase: ProductionPurchase;
  estimate: ProductionEstimate;
  catalogDate: string | null;
}

export type ProductionRow = ProductionPlanRow;

export interface ProductionPlan {
  gameCopies: number;
  rows: ProductionPlanRow[];
  totalPhysical: number | null;
  providers: Array<{
    code: ProductionPlanRow['provider']['code'];
    name: string;
    rowIds: string[];
  }>;
  estimate: {
    currency: 'USD';
    knownSubtotal: number;
    complete: boolean;
    excludes: string[];
  };
  issues: ProductionIssue[];
}

const unknownPurchase = (): ProductionPurchase => ({
  unit: 'unknown',
  unitsPerPack: null,
  unitsPerGame: null,
  totalUnits: null,
  overagePhysical: null,
  pageCapacity: null,
  tierQuantity: null,
  tierBasis: 'unknown',
});
const unknownEstimate = (reason: string): ProductionEstimate => ({
  amount: null,
  unitPrice: null,
  currency: 'USD',
  source: 'cached catalog',
  reason,
});
const string = (value: unknown): string => (typeof value === 'string' ? value : '');
const positiveInteger = (value: number) => Number.isSafeInteger(value) && value > 0;
const issue = (code: string, message: string, severity: ProductionIssue['severity'] = 'blocking') => ({
  code,
  message,
  severity,
});

function supplierUrl(value: unknown): string | null {
  try {
    const safe = safeSupplierUrl(value);
    if (!safe) return null;
    const url = new URL(safe);
    if (url.protocol !== 'https:') return null;
    if (
      ![
        'thegamecrafter.com',
        'www.thegamecrafter.com',
        'boardgamesmaker.com',
        'www.boardgamesmaker.com',
      ].includes(url.hostname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function option(variant: ProductVariant, keys: string[]): string {
  return variant.options.find((item) => keys.includes(item.optionKey.split(':')[0]))?.optionValue ?? '';
}

function countOption(value: string): number | null {
  // Reject ranges or lists of capacities: they are choices, not one configured count.
  if (/(?:^|\s)-\s*\d/.test(value)) return null;
  const matches = value.match(/\d+(?:\.\d+)?/g);
  if (matches?.length !== 1) return null;
  const count = Number(matches[0]);
  return positiveInteger(count) ? count : null;
}

function configuredCapacity(values: string[]): number | null {
  const counts = values.filter(Boolean).map(countOption);
  return counts.length > 0 && counts.every((value) => value !== null) && new Set(counts).size === 1
    ? counts[0]
    : null;
}

function purchasing(
  row: ProductionPlanRow,
  detail: ProductDetailResponse,
  variant: ProductVariant,
  gameCopies: number,
): ProductionPurchase {
  const physical = row.copiesPerGame!;
  const per = option(variant, ['priced_per']).toLowerCase();
  const tgcPrinted = row.provider.code === 'tgc' && row.productionType === 'printable';
  let unit: ProductionPurchase['unit'] = 'unknown';
  let capacity: number | null = null;
  if (row.productionType === 'stock') {
    unit = 'item';
    capacity = 1;
  } else if (tgcPrinted && /sheet/.test(per)) {
    unit = 'sheet';
    capacity = configuredCapacity([
      option(variant, ['cards_per_sheet', 'items_per_sheet']),
      /\d/.test(per) ? per : '',
    ]);
  } else if (tgcPrinted && /^(each|item)$/.test(per)) {
    unit = 'item';
    capacity = 1;
  } else if (row.provider.code === 'bgm' && detail.category === 'cards') {
    unit = 'deck';
    capacity = countOption(option(variant, ['dro_choosesize']));
    if (capacity && physical > capacity)
      row.issues.push(
        issue(
          'deck-capacity',
          `${physical} cards exceed this variant's ${capacity}-card capacity. Choose a larger deck or split the design before ordering.`,
        ),
      );
  } else if (row.provider.code === 'bgm' && detail.category === 'tiles') {
    unit = 'sheet';
    const describedCount = variant.title.match(/(\d+)\s*tiles?\s*(?:\/|per\s+)\s*sheet/i)?.[1];
    capacity = configuredCapacity([
      option(variant, ['dro_choosepcs']),
      variant.options.find((item) => /tiles per sheet/i.test(item.optionLabel ?? ''))?.optionValue ?? '',
      // Older clients retain key/value pairs but omit optionLabel. A descriptive
      // variant title must corroborate dro_choosesize; never parse a physical size as a pack count.
      describedCount && option(variant, ['dro_choosesize']) ? describedCount : '',
      describedCount ? option(variant, ['dro_choosesize']) : '',
    ]);
  } else if (row.provider.code === 'bgm' && ['boards', 'mats', 'boxes'].includes(detail.category)) {
    unit = 'item';
    capacity = 1;
  }
  if (!capacity || unit === 'unknown') {
    row.issues.push(
      issue(
        'purchase-unit',
        'The catalog does not specify a reliable purchasing unit. Confirm pack or sheet quantities with the supplier.',
      ),
    );
    return unknownPurchase();
  }
  // Each game receives complete packs. Never silently pool leftovers across different games.
  const unitsPerGame = Math.ceil(physical / capacity);
  const totalUnits = unitsPerGame * gameCopies;
  const overagePhysical = totalUnits * capacity - row.totalPhysical!;
  if (![totalUnits, overagePhysical].every(Number.isSafeInteger)) {
    row.issues.push(
      issue(
        'quantity-overflow',
        'These quantities are too large to calculate safely. Reduce the order size.',
      ),
    );
    return unknownPurchase();
  }
  return {
    unit,
    unitsPerPack: capacity,
    unitsPerGame,
    totalUnits,
    overagePhysical,
    pageCapacity: countOption(option(variant, ['pages'])),
    tierQuantity: row.productionType === 'stock' ? row.totalPhysical : gameCopies,
    tierBasis: row.productionType === 'stock' ? 'physical items' : 'game copies',
  };
}

function estimate(
  row: ProductionPlanRow,
  detail: ProductDetailResponse,
  variant: ProductVariant,
): ProductionEstimate {
  if (row.issues.some((item) => item.severity === 'blocking'))
    return unknownEstimate('Resolve the component plan before estimating its cost.');
  if (detail.currency !== 'USD')
    return unknownEstimate(
      'A supported USD catalog price is not available. No currency conversion was assumed.',
    );
  if (row.provider.code === 'bgm' && ['cards', 'tiles'].includes(detail.category))
    return unknownEstimate(
      'These cached prices use interpolated or mixed purchasing units. Confirm the configured deck or sheet price with BoardGamesMaker.',
    );
  if (variant.options.some((item) => item.optionKey.startsWith('generated_')))
    return unknownEstimate(
      'Some cached configuration options were inferred. Confirm the selected options and price with the supplier.',
    );
  const { totalUnits, tierQuantity } = row.purchase;
  if (totalUnits === null || tierQuantity === null)
    return unknownEstimate('The purchasing unit has not been confirmed.');
  const matching = variant.priceTiers.filter((tier) => {
    const min = Number(tier.minQuantity),
      max = tier.maxQuantity === null ? null : Number(tier.maxQuantity);
    return (
      positiveInteger(min) &&
      (max === null || (positiveInteger(max) && max >= min)) &&
      tierQuantity >= min &&
      (max === null || tierQuantity <= max)
    );
  });
  if (matching.length !== 1)
    return unknownEstimate('No single published price tier covers this quantity. Request supplier pricing.');
  const unitPrice = Number(matching[0].unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0)
    return unknownEstimate('A valid cached unit price is not available.');
  const amount = Math.round(unitPrice * totalUnits * 100) / 100;
  if (!Number.isSafeInteger(Math.round(amount * 100)))
    return unknownEstimate('This order is too large to estimate safely.');
  return { amount, unitPrice, currency: 'USD', source: 'cached catalog', reason: null };
}

function buildRow(
  project: EditorProject,
  set: ProjectDesignSet,
  gameCopies: number,
  details: Readonly<Record<string, ProductDetailResponse | undefined>>,
): ProductionPlanRow {
  const properties = set.instanceId ? (project.instances[set.instanceId]?.properties ?? {}) : {};
  const slug = string(properties.catalogSlug);
  const detail = details[slug]?.slug === slug ? details[slug] : undefined;
  const variantId = string(properties.catalogVariantId);
  const variant = detail?.productVariants.find((item) => item.id === variantId);
  const sourceUrl =
    supplierUrl(detail ? supplierProductUrl(detail, variant) : null) ??
    supplierUrl(properties.catalogSourceUrl);
  const host = sourceUrl ? new URL(sourceUrl).hostname : '';
  const code = /(^|\.)thegamecrafter\.com$/.test(host)
    ? 'tgc'
    : /(^|\.)boardgamesmaker\.com$/.test(host)
      ? 'bgm'
      : 'unknown';
  const type = classifyCatalogProduct({ slug, sourceUrl });
  const copies = set.studio.rows.map((row) => row.copies);
  const valid = copies.every((count) => Number.isSafeInteger(count) && count >= 0);
  const sum = valid ? copies.reduce((total, count) => total + count, 0) : NaN;
  const copiesPerGame = Number.isSafeInteger(sum) ? sum : null;
  const totalPhysical =
    copiesPerGame !== null && Number.isSafeInteger(copiesPerGame * gameCopies)
      ? copiesPerGame * gameCopies
      : null;
  const row: ProductionPlanRow = {
    id: set.id,
    designSetId: set.id,
    instanceId: set.instanceId,
    name: set.name,
    kind: set.kind,
    designCount: set.studio.rows.length,
    copiesPerGame,
    totalPhysical,
    widthMm: set.studio.template.widthMm,
    heightMm: set.studio.template.heightMm,
    provider: {
      code,
      name: code === 'tgc' ? 'The Game Crafter' : code === 'bgm' ? 'BoardGamesMaker' : 'Unmatched supplier',
      id: detail?.supplierId ?? (string(properties.catalogSupplierId) || null),
    },
    supplier: code === 'tgc' ? 'The Game Crafter' : code === 'bgm' ? 'BoardGamesMaker' : 'Unmatched supplier',
    productSlug: slug || null,
    productTitle: detail?.title ?? string(properties.catalogProductTitle),
    variantId: variantId || null,
    variantTitle: variant?.title ?? string(properties.catalogVariantTitle),
    sourceUrl,
    productionType: type,
    status: 'review',
    issues: [],
    purchase: unknownPurchase(),
    estimate: unknownEstimate('Choose and review a supplier match first.'),
    catalogDate: detail?.lastSeenAt ?? null,
  };
  if (copiesPerGame === null || totalPhysical === null)
    row.issues.push(
      issue(
        'invalid-quantity',
        'Component copies must be non-negative whole numbers within the supported numeric range.',
      ),
    );
  if (copiesPerGame === 0) {
    row.status = 'empty';
    row.estimate = {
      amount: 0,
      unitPrice: null,
      currency: 'USD',
      source: 'cached catalog',
      reason: 'No physical copies requested.',
    };
    return row;
  }
  if (!slug || !variantId) {
    row.status = 'unmatched';
    row.issues.push(issue('supplier-match', 'Choose a supplier product and variant for this component.'));
    return row;
  }
  if (!detail)
    row.issues.push(
      issue('catalog-unavailable', 'Load this supplier product before preparing its quantities and price.'),
    );
  else if (!variant)
    row.issues.push(
      issue(
        'variant-unavailable',
        'The selected variant is no longer in this product. Choose a current supplier match.',
      ),
    );
  if (!sourceUrl || code === 'unknown')
    row.issues.push(issue('supplier-url', 'A verified supplier product link is missing.'));
  if (detail?.status && detail.status !== 'active')
    row.issues.push(issue('inactive-product', 'This catalog product is not active. Choose another product.'));
  if (variant?.status && variant.status !== 'active')
    row.issues.push(
      issue('inactive-variant', 'This catalog variant is not active. Choose another configuration.'),
    );
  if (type === 'unverified')
    row.issues.push(
      issue('production-type', 'Confirm whether this product accepts custom artwork or is a stock part.'),
    );
  if (variant && type === 'printable') {
    const dimensions = supplierDimensions(variant);
    if (!dimensions)
      row.issues.push(
        issue(
          'supplier-dimensions',
          'Supplier trim dimensions are missing. Review its template before preparing artwork.',
        ),
      );
    else if (
      Math.abs(dimensions.widthMm - row.widthMm) > 0.15 ||
      Math.abs(dimensions.heightMm - row.heightMm) > 0.15
    )
      row.issues.push(
        issue(
          'dimension-mismatch',
          `Artwork is ${row.widthMm} × ${row.heightMm} mm; the selected product is ${dimensions.widthMm} × ${dimensions.heightMm} mm. Fit the template or choose a matching product.`,
        ),
      );
    const shape = detail?.shape ? supplierTrimShape(detail.shape) : null;
    if (shape && set.studio.template.document && shape !== set.studio.template.document.trimShape)
      row.issues.push(
        issue(
          'shape-mismatch',
          'The artwork trim shape differs from the selected supplier product. Fit the template or choose a matching shape.',
        ),
      );
    row.issues.push(
      issue(
        'artwork-review',
        'Review supplier templates, bleed, safe areas, and every printed face before uploading. Cached layout metadata is not production certification.',
        'warning',
      ),
    );
  } else if (type === 'stock')
    row.issues.push(
      issue(
        'stock-artwork',
        'This is a stock part. Its factory appearance is supplied; your template artwork will not be printed on it.',
        'warning',
      ),
    );
  if (detail && variant && totalPhysical !== null) {
    row.purchase = purchasing(row, detail, variant, gameCopies);
    row.estimate = estimate(row, detail, variant);
    if (row.estimate.reason) row.issues.push(issue('price-review', row.estimate.reason, 'warning'));
  }
  row.status = row.issues.some((item) => item.severity === 'blocking') ? 'review' : 'ready';
  return row;
}

/** A local materials plan only: no provider calls, project mutations, payment, or order submission. */
export function buildProductionPlan(
  project: EditorProject,
  gameCopies: number,
  detailsBySlug: Readonly<Record<string, ProductDetailResponse | undefined>> = {},
): ProductionPlan {
  if (!positiveInteger(gameCopies)) throw new RangeError('Game copies must be a positive whole number.');
  const rows = listProjectDesignSets(project).map((set) => buildRow(project, set, gameCopies, detailsBySlug));
  const groups = new Map<string, ProductionPlan['providers'][number]>();
  for (const row of rows.filter((item) => item.status !== 'empty')) {
    const key = row.provider.id ?? row.provider.code;
    const group = groups.get(key) ?? { code: row.provider.code, name: row.provider.name, rowIds: [] };
    group.rowIds.push(row.id);
    groups.set(key, group);
  }
  const total = rows.reduce((sum, row) => sum + (row.totalPhysical ?? NaN), 0);
  return {
    gameCopies,
    rows,
    totalPhysical: Number.isSafeInteger(total) ? total : null,
    providers: [...groups.values()],
    estimate: {
      currency: 'USD',
      knownSubtotal: Math.round(rows.reduce((sum, row) => sum + (row.estimate.amount ?? 0), 0) * 100) / 100,
      complete:
        total > 0 &&
        !(project.rules.customComponents ?? []).length &&
        rows.every((row) => row.estimate.amount !== null),
      excludes: ['shipping', 'tax', 'provider fees', 'packaging or materials not listed'],
    },
    issues: [
      issue(
        'supplier-confirmation',
        'This is a materials plan with cached estimates. The supplier confirms production requirements, availability, packaging, and the final order price.',
        'warning',
      ),
      ...(project.rules.customComponents ?? []).map((component) =>
        issue(
          'rulebook-only-component',
          `${component.name} exists only in the rulebook. Add its physical materials before treating this as a complete game.`,
        ),
      ),
      ...(!rows.length ? [issue('empty-game', 'Add physical components before preparing an order.')] : []),
    ],
  };
}
