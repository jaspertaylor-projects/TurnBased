import assert from 'node:assert/strict';
import test from 'node:test';

const base = process.env.CATALOG_API_URL || 'http://127.0.0.1:3100';
const get = (route) => fetch(`${base}${route}`, { signal: AbortSignal.timeout(5000) });

test('catalog API is live and connected to its migrated database', async () => {
  assert.deepEqual(await (await get('/health')).json(), { status: 'ok' });
  assert.equal((await (await get('/ready')).json()).status, 'ok');
});

test('catalog pagination and product detail/layout/pricing routes work', async (t) => {
  const response = await get('/v1/products?page=1&pageSize=2');
  assert.equal(response.status, 200);
  const catalog = await response.json();
  assert.equal(catalog.pageSize, 2);
  assert.ok(Number.isInteger(catalog.total));
  assert.ok(Array.isArray(catalog.items) && catalog.items.length <= 2);
  if (!catalog.items.length) return t.diagnostic('Catalog is empty; refresh a supplier to exercise detail routes.');
  const slug = encodeURIComponent(catalog.items[0].slug);
  const detail = await get(`/v1/products/${slug}`);
  assert.equal(detail.status, 200);
  const product = await detail.json();
  assert.ok(product.productVariants.length > 0);
  const variant = product.productVariants[0];
  assert.equal((await get(`/v1/variants/${variant.id}`)).status, 200);
  assert.equal((await get(`/v1/products/${slug}/layout?variantId=${variant.id}`)).status, 200);
  const pricing = await get(`/v1/variants/${variant.id}/pricing`);
  assert.equal(pricing.status, 200);
  assert.ok(Array.isArray((await pricing.json()).tiers));
});

test('missing products and invalid quote requests retain their API errors', async () => {
  assert.equal((await get('/v1/products/monorepo-smoke-nonexistent-product')).status, 404);
  const response = await fetch(`${base}/v1/quotes`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 400);
});
