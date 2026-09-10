/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankProject } from '../project';
import { createStudioComponent } from '../componentStudio/model';
import type { TemplateComponentKind } from '../templateStudio/types';
import type { EditorProject } from '../types';
import type { ProductDetailResponse } from '../supplierCatalog';
import { buildProductionPlan } from './orderPlan';

function product(supplier: 'tgc' | 'bgm', category = 'cards'): ProductDetailResponse {
  const slug = supplier === 'tgc' ? `tgc-print-${category}` : `custom-${category}`;
  return {
    id: slug,
    slug,
    title: `Supplier ${category}`,
    category,
    currency: 'USD',
    status: 'active',
    sourceUrl:
      supplier === 'tgc'
        ? 'https://www.thegamecrafter.com/make/products'
        : `https://www.boardgamesmaker.com/print/${slug}.html`,
    supplierId: supplier,
    lastSeenAt: '2026-07-04T00:00:00Z',
    productVariants: [
      {
        id: `${slug}-variant`,
        title: 'Standard',
        options:
          supplier === 'tgc'
            ? [
                { optionGroup: 'Pricing', optionKey: 'priced_per:1', optionValue: 'sheet of 18 cards' },
                { optionGroup: 'Spec', optionKey: 'cards_per_sheet:2', optionValue: '18' },
              ]
            : [
                {
                  optionGroup: 'Configuration',
                  optionKey: 'dro_choosesize:0',
                  optionValue: 'Up to 18 cards',
                },
              ],
        layoutConstraints: [
          {
            faceKey: 'front',
            widthMm: 63,
            heightMm: 88,
            bleedMm: 0,
            safeZoneMm: 0,
            dpi: 0,
            cutlineRequired: false,
          },
        ],
        priceTiers: [
          { minQuantity: 1, maxQuantity: 99, unitPrice: 2.99 },
          { minQuantity: 100, maxQuantity: 999, unitPrice: 1.69 },
        ],
      },
    ],
  };
}

function addDesign(
  project: EditorProject,
  detail: ProductDetailResponse,
  kind: TemplateComponentKind,
  counts: number[],
) {
  const created = createStudioComponent(project, kind, `Designed ${kind}`);
  const next = created.project;
  const studio = next.componentDesigns![created.instanceId];
  const size = detail.productVariants[0].layoutConstraints[0];
  studio.template.widthMm = size.widthMm;
  studio.template.heightMm = size.heightMm;
  if (studio.template.document) {
    studio.template.document.widthMm = size.widthMm;
    studio.template.document.heightMm = size.heightMm;
  }
  studio.rows = counts.map((copies, index) => ({ ...studio.rows[0], id: `row-${index}`, copies }));
  Object.assign(next.instances[created.instanceId].properties, {
    catalogSlug: detail.slug,
    catalogVariantId: detail.productVariants[0].id,
    catalogSourceUrl: detail.sourceUrl,
    catalogProductTitle: detail.title,
  });
  return { project: next, id: created.instanceId };
}

test('complete deck and coin materials count canonical designs once and round full sheets per game', () => {
  const deck = product('bgm');
  const coin = product('bgm', 'tiles');
  coin.productVariants[0].layoutConstraints[0] = {
    ...coin.productVariants[0].layoutConstraints[0],
    widthMm: 25.4,
    heightMm: 25.4,
  };
  coin.productVariants[0].options = [
    { optionGroup: 'Configuration', optionKey: 'dro_choosepcs:1', optionValue: '36 tiles per sheet' },
  ];
  const first = addDesign(createBlankProject('Materials'), deck, 'card', [3, 3, 3, 3, 3, 3]);
  const second = addDesign(first.project, coin, 'token', [24]);
  const before = structuredClone(second.project);
  const plan = buildProductionPlan(second.project, 3, { [deck.slug]: deck, [coin.slug]: coin });
  assert.equal(plan.rows.length, 2);
  assert.equal(plan.totalPhysical, 126);
  assert.equal(plan.rows[0].purchase.unit, 'deck');
  assert.equal(plan.rows[0].purchase.totalUnits, 3);
  assert.equal(plan.rows[1].purchase.unit, 'sheet');
  assert.equal(plan.rows[1].purchase.totalUnits, 3);
  assert.equal(plan.rows[1].purchase.overagePhysical, 36);
  assert.equal(plan.providers.length, 1);
  assert.equal(plan.estimate.complete, false);
  assert.equal(plan.estimate.knownSubtotal, 0);
  assert.match(plan.rows[1].estimate.reason!, /interpolated or mixed/);
  assert.ok(plan.rows.every((row) => row.issues.some((item) => item.code === 'artwork-review')));
  assert.deepEqual(second.project, before);
  // Real imported BGM metadata also uses dro_choosesize with a Tiles per Sheet label.
  coin.productVariants[0].options = [
    {
      optionGroup: 'Configuration',
      optionKey: 'dro_choosesize:1',
      optionValue: '36',
      optionLabel: 'Tiles per Sheet',
    },
  ];
  assert.equal(
    buildProductionPlan(second.project, 1, { [coin.slug]: coin }).rows[1].purchase.unitsPerPack,
    36,
  );
});

test('printed sheet estimates choose bulk tiers using game copies rather than purchased sheet count', () => {
  const detail = product('tgc');
  const { project } = addDesign(createBlankProject('Many decks'), detail, 'card', [18, 18]);
  const small = buildProductionPlan(project, 60, { [detail.slug]: detail }).rows[0];
  assert.equal(small.purchase.totalUnits, 120);
  assert.equal(small.purchase.tierQuantity, 60);
  assert.equal(small.estimate.unitPrice, 2.99);
  assert.equal(small.estimate.amount, 358.8);
  const bulk = buildProductionPlan(project, 100, { [detail.slug]: detail });
  assert.equal(bulk.rows[0].estimate.amount, 338);
  assert.equal(bulk.estimate.complete, true);
  assert.deepEqual(bulk.estimate.excludes, [
    'shipping',
    'tax',
    'provider fees',
    'packaging or materials not listed',
  ]);
});

test('actual BGM circle tile options retain sheet capacity even when option labels were omitted', () => {
  const detail = product('bgm', 'tiles');
  detail.slug = 'circle-game-tiles-micro-1inch';
  detail.sourceUrl = `https://www.boardgamesmaker.com/print/${detail.slug}.html`;
  const variant = detail.productVariants[0];
  variant.title = '36 tiles/sheet - 1.6mm thick';
  variant.options = [
    { optionGroup: 'Material', optionKey: 'dro_paper_type:0', optionValue: '1.6mm thick' },
    { optionGroup: 'Configuration', optionKey: 'dro_choosesize:1', optionValue: '36' },
  ];
  variant.layoutConstraints[0].widthMm = 25.4;
  variant.layoutConstraints[0].heightMm = 25.4;
  const { project } = addDesign(createBlankProject('Real coins'), detail, 'token', [24]);
  let row = buildProductionPlan(project, 2, { [detail.slug]: detail }).rows[0];
  assert.equal(row.status, 'ready');
  assert.equal(row.purchase.unitsPerPack, 36);
  assert.equal(row.purchase.totalUnits, 2);
  assert.equal(row.purchase.overagePhysical, 24);
  variant.options[1].optionValue = '25.4 mm';
  row = buildProductionPlan(project, 1, { [detail.slug]: detail }).rows[0];
  assert.equal(row.purchase.totalUnits, null);
  assert.equal(row.status, 'review');
  variant.title = '1 inch circle tiles';
  variant.options[1].optionValue = '36';
  assert.equal(buildProductionPlan(project, 1, { [detail.slug]: detail }).rows[0].purchase.totalUnits, null);
});

test('stock coins use total item quantities and never claim the template will be printed', () => {
  const detail = product('tgc', 'money');
  detail.slug = 'tgc-stock-coins';
  detail.sourceUrl = 'https://www.thegamecrafter.com/parts/stock-coins';
  detail.productVariants[0].priceTiers = [
    { minQuantity: 1, maxQuantity: 99, unitPrice: 0.3 },
    { minQuantity: 100, maxQuantity: 999, unitPrice: 0.1657 },
  ];
  const { project, id } = addDesign(createBlankProject('Stock'), detail, 'token', [24]);
  project.componentDesigns![id].template.widthMm = 999;
  const row = buildProductionPlan(project, 5, { [detail.slug]: detail }).rows[0];
  assert.equal(row.productionType, 'stock');
  assert.equal(row.purchase.totalUnits, 120);
  assert.equal(row.purchase.tierBasis, 'physical items');
  assert.equal(row.estimate.amount, 19.88);
  assert.equal(row.status, 'ready');
  assert.ok(row.issues.some((item) => item.code === 'stock-artwork'));
  assert.ok(!row.issues.some((item) => item.code === 'dimension-mismatch'));
});

test('per-item printed products retain published page capacity and exact supplied tier boundaries', () => {
  const detail = product('tgc', 'booklets');
  detail.productVariants[0].options = [
    { optionGroup: 'Pricing', optionKey: 'priced_per:1', optionValue: 'each' },
    { optionGroup: 'Spec', optionKey: 'pages:2', optionValue: 'up to 12' },
  ];
  const { project } = addDesign(createBlankProject('Booklets'), detail, 'piece', [2]);
  const row = buildProductionPlan(project, 60, { [detail.slug]: detail }).rows[0];
  assert.equal(row.purchase.unit, 'item');
  assert.equal(row.purchase.pageCapacity, 12);
  assert.equal(row.purchase.totalUnits, 120);
  assert.equal(row.estimate.unitPrice, 2.99);
  // A finite upper bound is not permission to extrapolate the final price forever.
  const beyond = buildProductionPlan(project, 1000, { [detail.slug]: detail });
  assert.equal(beyond.rows[0].estimate.amount, null);
  assert.equal(beyond.estimate.complete, false);
});

test('oversized decks and mismatched template dimensions or shapes cannot be marked ready', () => {
  const detail = product('bgm');
  const { project, id } = addDesign(createBlankProject('Bad match'), detail, 'card', [19]);
  let row = buildProductionPlan(project, 1, { [detail.slug]: detail }).rows[0];
  assert.equal(row.status, 'review');
  assert.ok(row.issues.some((item) => item.code === 'deck-capacity'));
  project.componentDesigns![id].rows[0].copies = 18;
  project.componentDesigns![id].template.widthMm = 70;
  detail.shape = 'hexagon';
  row = buildProductionPlan(project, 1, { [detail.slug]: detail }).rows[0];
  assert.ok(row.issues.some((item) => item.code === 'dimension-mismatch'));
  assert.ok(row.issues.some((item) => item.code === 'shape-mismatch'));
  assert.equal(row.estimate.amount, null);
});

test('missing, inactive, unsafe or ambiguous catalog data stays unknown instead of inventing prices', () => {
  for (const change of [
    (detail: ProductDetailResponse) => {
      detail.currency = 'EUR';
    },
    (detail: ProductDetailResponse) => {
      detail.productVariants[0].priceTiers = [{ minQuantity: 2, maxQuantity: 5, unitPrice: 1 }];
    },
    (detail: ProductDetailResponse) => {
      detail.productVariants[0].priceTiers.push({ minQuantity: 1, maxQuantity: 3, unitPrice: 2 });
    },
    (detail: ProductDetailResponse) => {
      detail.productVariants[0].options[1].optionValue = '18 / 36';
      detail.productVariants[0].options[0].optionValue = 'sheet';
    },
    (detail: ProductDetailResponse) => {
      detail.productVariants[0].options[1].optionValue = '36';
    },
    (detail: ProductDetailResponse) => {
      detail.productVariants[0].options[1].optionValue = '18.5';
    },
    (detail: ProductDetailResponse) => {
      detail.status = 'inactive';
    },
    (detail: ProductDetailResponse) => {
      detail.productVariants[0].status = 'inactive';
    },
    (detail: ProductDetailResponse) => {
      detail.productVariants[0].layoutConstraints = [];
    },
    (detail: ProductDetailResponse) => {
      detail.sourceUrl = 'javascript:alert(1)';
    },
  ]) {
    const detail = product('tgc');
    const { project } = addDesign(createBlankProject('Unknown'), detail, 'card', [18]);
    change(detail);
    if (detail.sourceUrl?.startsWith('javascript:')) {
      Object.values(project.instances)[0].properties.catalogSourceUrl = detail.sourceUrl;
    }
    const plan = buildProductionPlan(project, 1, { [detail.slug]: detail });
    assert.equal(plan.rows[0].estimate.amount, null);
    assert.equal(plan.estimate.complete, false);
  }
  const detail = product('tgc');
  const { project } = addDesign(createBlankProject('Offline'), detail, 'card', [18]);
  assert.ok(
    buildProductionPlan(project, 1).rows[0].issues.some((item) => item.code === 'catalog-unavailable'),
  );
  detail.productVariants[0].id = 'replacement';
  assert.ok(
    buildProductionPlan(project, 1, { [detail.slug]: detail }).rows[0].issues.some(
      (item) => item.code === 'variant-unavailable',
    ),
  );
});

test('zero, invalid and overflowing quantities cannot turn into a payable estimate', () => {
  const detail = product('tgc');
  const { project, id } = addDesign(createBlankProject('Quantities'), detail, 'card', [0]);
  for (const count of [0, -1, 1.5, Infinity, NaN])
    assert.throws(() => buildProductionPlan(project, count), /positive whole/);
  assert.equal(buildProductionPlan(project, 1, { [detail.slug]: detail }).rows[0].status, 'empty');
  for (const count of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER]) {
    project.componentDesigns![id].rows[0].copies = count;
    const row = buildProductionPlan(project, 2, { [detail.slug]: detail }).rows[0];
    assert.equal(row.totalPhysical, null);
    assert.equal(row.estimate.amount, null);
    assert.equal(row.status, 'review');
  }
});

test('a complete physical inventory cannot silently omit rulebook-only materials', () => {
  const detail = product('tgc');
  const { project } = addDesign(createBlankProject('Missing material'), detail, 'card', [18]);
  project.rules.customComponents.push({ id: 'bank', name: 'Coin bank', description: 'Bring 24 coins.' });
  const plan = buildProductionPlan(project, 1, { [detail.slug]: detail });
  assert.equal(plan.estimate.complete, false);
  assert.ok(
    plan.issues.some((item) => item.code === 'rulebook-only-component' && /Coin bank/.test(item.message)),
  );
});
