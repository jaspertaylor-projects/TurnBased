#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
let playwright;
for (const location of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright', '/home/anonymous/.npm/_npx/9833c18b2d85bc59/node_modules/playwright', '/home/anonymous/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'].filter(Boolean)) {
  try { playwright = require(location); break; } catch { /* Try another installation. */ }
}
if (!playwright) throw new Error('Set PLAYWRIGHT_MODULE_PATH to an installed Playwright module.');
const artifacts = process.env.SUPPLIER_MATCH_ARTIFACT_DIR || '/tmp/turnbased-supplier-matching';
const base = process.env.CODEX_BROWSER_URL || 'http://127.0.0.1:3000';
await mkdir(artifacts, { recursive: true });
const browser = await playwright.chromium.launch({ executablePath: process.env.DEMO_CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
const mutations = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/v1/') && request.method() !== 'GET') mutations.push(request.url()); });
const button = name => page.getByRole('button', { name, exact: true });
const dialog = page.getByRole('dialog', { name: 'Match supplier · 24 Moonlit coins', exact: true });
let ids;
async function savedProject() {
  if (await button('Open sidebar').isVisible()) await button('Open sidebar').click();
  await page.waitForTimeout(800);
  await page.getByRole('status').filter({ hasText: 'Draft saved in this browser' }).waitFor();
  return page.evaluate(async id => (await import('/src/editor/storage.ts')).loadEditorProject(id), ids.projectId);
}
async function openPhysical(name) {
  await button('components').click();
  if (await button('All components').isVisible()) await button('All components').click();
  await page.locator('.component-design-card').filter({ has: page.getByRole('heading', { name, exact: true }) }).click();
  await button('Physical specs').click();
}
async function choosePrinted() {
  await dialog.waitFor();
  await dialog.getByLabel('Find a supplier product', { exact: true }).fill('circle');
  const product = dialog.getByRole('button').filter({ hasText: 'Custom Circle Game Tiles 1" Micro Size' });
  await product.click();
  await dialog.getByLabel('Supplier variant', { exact: true }).selectOption({ label: '36 tiles/sheet - 1.6mm thick' });
}
async function bounded() {
  const bounds = await dialog.evaluate(node => {
    const box = node.getBoundingClientRect();
    const footer = node.querySelector('footer').getBoundingClientRect();
    return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: innerWidth, height: innerHeight, footer: footer.bottom, overflow: node.scrollWidth - node.clientWidth };
  });
  assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.right <= bounds.width && bounds.bottom <= bounds.height && bounds.footer <= bounds.height && bounds.overflow <= 1, JSON.stringify(bounds));
}
try {
  await page.goto(`${base}/#/dashboard`);
  ids = await page.evaluate(async () => {
    const { createBlankProject } = await import('/src/editor/project.ts');
    const { createStudioComponent, setProjectComponentDesign } = await import('/src/editor/componentStudio/model.ts');
    const { saveEditorProject } = await import('/src/editor/storage.ts');
    const coins = createStudioComponent(createBlankProject('Supplier matching regression'), 'token', '24 Moonlit coins');
    let project = coins.project;
    const studio = project.componentDesigns[coins.instanceId];
    studio.rows[0].copies = 24;
    studio.rows[0].title = 'Moon coin';
    project = setProjectComponentDesign(project, coins.instanceId, studio);
    const deck = createStudioComponent(project, 'card', 'Moonlit cards');
    await saveEditorProject(deck.project);
    return { projectId: project.id, coinsId: coins.instanceId, cardsId: deck.instanceId };
  });
  await page.goto(`${base}/#/editor/${ids.projectId}`);
  await openPhysical('24 Moonlit coins');
  await button('Match supplier product').click();
  await choosePrinted();
  await bounded();
  assert.equal(await button('Review match').isEnabled(), false, 'No fit or link choice is selected implicitly');
  await dialog.getByRole('radio', { name: /^Fit template to supplier size/ }).check();
  await button('Review match').click();
  await page.screenshot({ path: `${artifacts}/printed-coins-review.png` });
  assert.match(await dialog.innerText(), /32 × 32 mm → 25.4 × 25.4 mm/);
  await button('Close supplier match').click();
  let project = await savedProject();
  assert.equal(project.instances[ids.coinsId].properties.catalogSlug, undefined, 'Review cancellation does not write a match');
  assert.equal(project.componentDesigns[ids.coinsId].template.widthMm, 32);
  await button('Match supplier product').click();
  await choosePrinted();
  await dialog.getByRole('radio', { name: /^Fit template to supplier size/ }).check();
  await button('Review match').click();
  await button('Apply supplier match').click();
  await dialog.waitFor({ state: 'hidden' });
  project = await savedProject();
  const matched = project.instances[ids.coinsId].properties;
  assert.equal(matched.catalogSlug, 'circle-game-tiles-micro-1inch');
  assert.equal(matched.catalogProductionType, 'printable');
  assert.equal(matched.catalogMatchMode, 'fit-template');
  assert.equal(matched.physicalWidthMm, 25.4);
  assert.equal(matched.quantity, 24);
  assert.equal(project.componentDesigns[ids.coinsId].template.document.trimShape, 'ellipse');
  await page.screenshot({ path: `${artifacts}/printed-coins-applied.png` });
  await page.reload();
  await openPhysical('24 Moonlit coins');
  await page.getByText('Custom Circle Game Tiles 1" Micro Size', { exact: true }).waitFor();
  await button('Change supplier match').click();
  await dialog.getByLabel('Catalog category', { exact: true }).selectOption('money');
  await dialog.getByLabel('Find a supplier product', { exact: true }).fill('Medieval');
  await dialog.getByRole('button').filter({ hasText: 'Coin, Medieval, Gold' }).click();
  const variants = dialog.getByLabel('Supplier variant', { exact: true });
  await variants.locator('option').nth(1).waitFor({ state: 'attached' });
  await variants.selectOption({ index: 1 });
  assert.equal(await dialog.getByRole('radio', { name: /^Fit template/ }).count(), 0);
  assert.match(await dialog.innerText(), /Your design will not be printed on it/);
  await dialog.getByRole('radio', { name: /^Use stock part/ }).check();
  await button('Review match').click();
  await page.setViewportSize({ width: 760, height: 820 });
  await bounded();
  await page.screenshot({ path: `${artifacts}/stock-coin-review.png` });
  await button('Apply supplier match').click();
  await page.setViewportSize({ width: 1600, height: 1000 });
  project = await savedProject();
  assert.equal(project.instances[ids.coinsId].properties.catalogProductionType, 'stock');
  assert.equal(project.instances[ids.coinsId].properties.catalogMatchMode, 'stock-part');
  assert.equal(project.componentDesigns[ids.coinsId].template.widthMm, 25.4);
  assert.equal(project.instances[ids.coinsId].properties.quantity, 24);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openPhysical('Moonlit cards');
  await button('Match supplier product').click();
  const cardDialog = page.getByRole('dialog', { name: 'Match supplier · Moonlit cards', exact: true });
  assert.equal(await cardDialog.getByLabel('Catalog category', { exact: true }).inputValue(), 'cards');
  await page.keyboard.press('Escape');
  await cardDialog.waitFor({ state: 'hidden' });
  assert.deepEqual(errors, []);
  assert.deepEqual(mutations, []);
  await writeFile(`${artifacts}/result.json`, JSON.stringify({ passed: true, projectId: ids.projectId, errors, catalogWrites: mutations, coverage: ['live custom printed coin product+variant', 'explicit fit and review', 'cancel without edits', '24-copy quantity preserved', '25.4mm circle template fit', 'reload match persistence', 'stock part appearance and unchanged artwork', 'bounded 1600px and 760px dialog', 'cards shared dialog', 'Escape cancels'] }, null, 2));
  console.log(`Supplier matching browser PASS: zero page errors, zero catalog writes; ${artifacts}`);
} catch (error) {
  await page.screenshot({ path: `${artifacts}/failure.png` }).catch(() => {});
  await writeFile(`${artifacts}/result.json`, JSON.stringify({ passed: false, error: String(error), errors }, null, 2));
  throw error;
} finally { await context.close(); await browser.close(); }
