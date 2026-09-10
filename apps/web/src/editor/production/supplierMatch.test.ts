/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import type { CatalogProduct, ProductVariant } from '../supplierCatalog';
import { createBlankProject } from '../project';
import { createDefaultCardStudio } from '../cardStudio/model';
import {
  createStudioComponent,
  listProjectDesignSets,
  normalizeProjectComponentDesigns,
} from '../componentStudio/model';
import {
  applySupplierMatch,
  classifyCatalogProduct,
  safeSupplierUrl,
  supplierDimensions,
  supplierMatchTarget,
  supplierProductUrl,
  unlinkSupplierMatch,
} from './supplierMatch';

const printed: CatalogProduct = {
  id: 'printed',
  slug: 'circle-game-tiles-micro-1inch',
  title: 'Custom Circle Tiles',
  category: 'tiles',
  subcategory: 'circle-micro',
  shape: 'circle',
  currency: 'USD',
  supplierId: 'bgm',
  sourceUrl: 'https://www.boardgamesmaker.com/print/circle-game-tiles-micro-1inch.html',
};
const variant: ProductVariant = {
  id: 'circle-36',
  title: '36 tiles/sheet · 1.6mm',
  options: [{ optionGroup: 'Configuration', optionKey: 'dro_choosesize:0', optionValue: '36' }],
  layoutConstraints: [
    {
      faceKey: 'front',
      widthMm: 25.4,
      heightMm: 25.4,
      bleedMm: 1,
      safeZoneMm: 1,
      dpi: 300,
      cutlineRequired: true,
    },
  ],
  priceTiers: [],
};
const stock: CatalogProduct = {
  ...printed,
  id: 'stock',
  slug: 'tgc-coin-medieval-gold',
  title: 'Coin, Medieval, Gold',
  category: 'money',
  supplierId: 'tgc',
  sourceUrl: 'https://www.thegamecrafter.com/parts/coin-medieval-gold',
};

test('supplier classification separates custom print, stock, and unverified URLs', () => {
  assert.equal(classifyCatalogProduct(printed), 'printable');
  assert.equal(classifyCatalogProduct(stock), 'stock');
  assert.equal(
    classifyCatalogProduct({
      ...stock,
      slug: 'tgc-print-poker-deck',
      sourceUrl: 'https://www.thegamecrafter.com/make/products',
    }),
    'printable',
  );
  assert.equal(
    classifyCatalogProduct({ ...printed, sourceUrl: 'https://www.boardgamesmaker.com.evil.test/print/fake' }),
    'unverified',
  );
  assert.equal(classifyCatalogProduct({ ...printed, sourceUrl: 'javascript:alert(1)' }), 'unverified');
  assert.equal(safeSupplierUrl('javascript:alert(1)'), null);
  assert.equal(safeSupplierUrl('https://user:password@example.com'), null);
  assert.equal(safeSupplierUrl(stock.sourceUrl), stock.sourceUrl);
  assert.equal(
    supplierProductUrl(
      { ...stock, slug: 'tgc-print-poker-deck' },
      {
        ...variant,
        options: [{ optionGroup: 'Identity', optionKey: 'api_identity:0', optionValue: 'PokerDeck' }],
      },
    ),
    'https://www.thegamecrafter.com/make/products/PokerDeck',
  );
});

test('explicit printable fit scales all faces and physical size without copying unverified bleed requirements', () => {
  const created = createStudioComponent(createBlankProject('Printed coins'), 'token', '24 coins');
  const [design] = listProjectDesignSets(created.project);
  design.studio.rows[0].copies = 24;
  const before = structuredClone(created.project);
  const doc = design.studio.template.document!;
  const output = applySupplierMatch(created.project, supplierMatchTarget(created.project, design), {
    product: printed,
    variant,
    mode: 'fit-template',
  });
  assert.deepEqual(created.project, before);
  const next = output.componentDesigns![design.id].template.document!;
  assert.equal(next.widthMm, 25.4);
  assert.equal(next.heightMm, 25.4);
  assert.equal(next.trimShape, 'ellipse');
  assert.equal(next.bleedMm, doc.bleedMm);
  assert.equal(next.safeMm, doc.safeMm);
  for (const [faceIndex, face] of next.faces.entries()) {
    assert.equal(face.layers.length, doc.faces[faceIndex].layers.length);
    for (const [index, layer] of face.layers.entries())
      assert.ok(
        Math.abs(layer.width - (doc.faces[faceIndex].layers[index].width * 25.4) / doc.widthMm) < 0.00001,
      );
  }
  assert.equal(output.instances[design.id].properties.quantity, 24);
  assert.equal(output.instances[design.id].properties.catalogSlug, printed.slug);
  assert.equal(output.instances[design.id].properties.catalogVariantId, variant.id);
  assert.equal(output.instances[design.id].properties.physicalWidthMm, 25.4);
  assert.equal(output.instances[design.id].properties.catalogProductionType, 'printable');
  assert.equal(output.instances[design.id].properties.catalogMatchMode, 'fit-template');
  assert.deepEqual(
    normalizeProjectComponentDesigns(JSON.parse(JSON.stringify(output))).instances,
    JSON.parse(JSON.stringify(output.instances)),
  );
});

test('stock with no physical dimensions remains explicitly nonprintable and never changes artwork or quantity', () => {
  for (const kind of ['card', 'board', 'token', 'tile', 'mat', 'piece'] as const) {
    const created = createStudioComponent(createBlankProject(kind), kind, kind);
    const [design] = listProjectDesignSets(created.project);
    const noSize = { ...variant, layoutConstraints: [] };
    assert.equal(supplierDimensions(noSize), null);
    const output = applySupplierMatch(created.project, supplierMatchTarget(created.project, design), {
      product: stock,
      variant: noSize,
      mode: 'stock-part',
    });
    assert.deepEqual(output.componentDesigns, created.project.componentDesigns);
    assert.equal(output.instances[design.id].properties.catalogProductionType, 'stock');
    assert.equal(output.instances[design.id].properties.catalogWidthMm, null);
    assert.throws(
      () =>
        applySupplierMatch(created.project, supplierMatchTarget(created.project, design), {
          product: stock,
          variant,
          mode: 'fit-template',
        }),
      /supplier’s appearance/,
    );
  }
});

test('link-only preserves current design and unrelated newer project changes; target edits are rejected', () => {
  const created = createStudioComponent(createBlankProject('Match review'), 'token', 'Coins');
  const [design] = listProjectDesignSets(created.project);
  const target = supplierMatchTarget(created.project, design);
  const latest = { ...created.project, name: 'Renamed while selecting' };
  const output = applySupplierMatch(latest, target, { product: printed, variant, mode: 'link-only' });
  assert.equal(output.name, latest.name);
  assert.deepEqual(output.componentDesigns, latest.componentDesigns);
  const edited = structuredClone(latest);
  edited.componentDesigns![design.id].rows[0].title = 'Newer coin';
  assert.throws(
    () => applySupplierMatch(edited, target, { product: printed, variant, mode: 'fit-template' }),
    /changed while/,
  );
  assert.throws(
    () =>
      applySupplierMatch({ ...latest, instances: {}, rootInstanceIds: [] }, target, {
        product: printed,
        variant,
        mode: 'link-only',
      }),
    /no longer available/,
  );
  assert.throws(
    () =>
      applySupplierMatch({ ...latest, id: 'other-project' }, target, {
        product: printed,
        variant,
        mode: 'link-only',
      }),
    /no longer available/,
  );
});

test('legacy deck materializes only when applied, preserves row IDs, and unlink removes all match metadata', () => {
  const project = { ...createBlankProject('Original deck'), cardStudio: createDefaultCardStudio() };
  const [design] = listProjectDesignSets(project);
  const target = supplierMatchTarget(project, design);
  assert.equal(Object.keys(project.instances).length, 0);
  const output = applySupplierMatch(project, target, { product: printed, variant, mode: 'link-only' });
  assert.equal(output.cardStudio, undefined);
  const [materialized] = listProjectDesignSets(output);
  assert.equal(listProjectDesignSets(output).length, 1);
  assert.deepEqual(
    materialized.studio.rows.map((row) => row.id),
    design.studio.rows.map((row) => row.id),
  );
  assert.throws(
    () => applySupplierMatch(output, target, { product: printed, variant, mode: 'link-only' }),
    /no longer available/,
  );
  const unlinked = unlinkSupplierMatch(output, materialized.id);
  assert.equal(
    Object.keys(unlinked.instances[materialized.id].properties).some((key) => key.startsWith('catalog')),
    false,
  );
  assert.deepEqual(unlinked.componentDesigns, output.componentDesigns);
});

test('unsupported and missing printable dimensions cannot silently resize a template', () => {
  const created = createStudioComponent(createBlankProject('Bounds'), 'board', 'Board');
  const [design] = listProjectDesignSets(created.project);
  for (const widthMm of [0, NaN, 0.5, 2100]) {
    const invalid = { ...variant, layoutConstraints: [{ ...variant.layoutConstraints[0], widthMm }] };
    assert.throws(
      () =>
        applySupplierMatch(created.project, supplierMatchTarget(created.project, design), {
          product: printed,
          variant: invalid,
          mode: 'fit-template',
        }),
      /supported dimensions/,
    );
  }
  assert.throws(
    () =>
      applySupplierMatch(created.project, supplierMatchTarget(created.project, design), {
        product: { ...printed, shape: 'custom-star' },
        variant,
        mode: 'fit-template',
      }),
    /supported dimensions/,
  );
});
