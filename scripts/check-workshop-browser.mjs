#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';

// Uses a separate browser context: the designer's projects remain untouched.
const require = createRequire(import.meta.url);
let playwright;
for (const location of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright',
  '/home/anonymous/.npm/_npx/9833c18b2d85bc59/node_modules/playwright',
  '/home/anonymous/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'].filter(Boolean)) {
  try { playwright = require(location); break; } catch { /* Try the next installation. */ }
}
if (!playwright) throw new Error('Set PLAYWRIGHT_MODULE_PATH to your Playwright installation.');
const browser = await playwright.chromium.connectOverCDP(process.env.CODEX_BROWSER_CDP_URL || 'http://127.0.0.1:9223');
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const base = process.env.CODEX_BROWSER_URL || 'http://127.0.0.1:3000';
const artifacts = process.env.WORKSHOP_ARTIFACT_DIR || '/tmp/turnbased-workshop-smoke';
await mkdir(artifacts, { recursive: true });
const button = (name) => page.getByRole('button', { name, exact: true });
const tab = (name) => page.getByRole('tab', { name, exact: true });
const section = async (name) => { await button(name).click(); };
async function saved() {
  // Let this edit's debounced save start before accepting the saved status.
  await page.waitForTimeout(700);
  await page.getByRole('status').filter({ hasText: 'Draft saved in this browser' }).waitFor();
}
async function openCardData() {
  await section('components');
  const allComponents = button('All components');
  if (await allComponents.isVisible()) await allComponents.click();
  await page.locator('.component-design-card').filter({
    has: page.getByRole('heading', { name: 'Original card deck', exact: true }),
  }).click();
  await page.getByRole('navigation', { name: 'Component editing tools' })
    .getByRole('button', { name: 'Data & copies', exact: true }).click();
}
async function download(name) {
  const pending = page.waitForEvent('download');
  await button(name).click();
  const file = await pending;
  const path = `${artifacts}/${file.suggestedFilename()}`;
  await file.saveAs(path);
  return { path, content: await readFile(path, 'utf8') };
}
async function bounded() {
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, 'Document stays inside viewport');
}
try {
  await page.goto(`${base}/#/new`);
  await button('Try Little Woodland').click();
  await page.waitForURL(/#\/editor\//);
  const originalUrl = page.url();
  assert.equal(await page.locator('[data-layout="componentDesignSetCount"] dd').innerText(), '1');
  assert.equal(await page.locator('[data-layout="physicalComponentCopyCount"] dd').innerText(), '10');
  await button('Components').click();
  await page.getByRole('region', { name: 'Components workbench', exact: true }).waitFor();
  console.log('PASS unified Components overview counts and next-step link');
  await openCardData();
  const title = page.getByLabel('Card 1 title', { exact: true });
  await title.fill('Checkpoint card');
  await saved();
  await section('version history');
  await page.getByLabel('Remember this version').fill('Before the balance change');
  await button('Save checkpoint').click();
  const checkpoints = page.getByRole('complementary', { name: 'Saved checkpoints' });
  await checkpoints.getByRole('button', { name: /Before the balance change/ }).waitFor();
  await openCardData();
  await title.fill('Unsaved experiment card');
  await saved();
  await section('version history');
  await checkpoints.getByRole('button', { name: /Before the balance change/ }).click();
  await button('Restore this version').click();
  await checkpoints.getByRole('button', { name: /Safety checkpoint before switching versions/ }).waitFor();
  await openCardData();
  assert.equal(await title.inputValue(), 'Checkpoint card');
  await page.screenshot({ path: `${artifacts}/cards.png` });
  await bounded();
  console.log('PASS checkpoint restore, safety copy, and card persistence');

  await section('playtest lab');
  await button('Start your first session').click();
  await page.getByRole('button', { name: /^Gather \d+ coins$/ }).click();
  assert.ok(await page.locator('[data-layout="playtestTranscriptRow"]').count() >= 2, 'Human move and opponent reply are recorded');
  await tab('Agent workspace').click();
  const observation = JSON.parse(await page.locator('[data-layout="playtestAgentObservation"] pre').innerText());
  await page.getByLabel('Agent response JSON').fill(JSON.stringify({ chosenActionId: 'invented', expectedStep: observation.step }));
  await button('Validate and apply move').click();
  await page.getByRole('alert').filter({ hasText: /not legal/ }).waitFor();
  await page.getByLabel('Agent response JSON').fill(JSON.stringify({ chosenActionId: 'gather', expectedStep: observation.step }));
  await button('Validate and apply move').click();
  await page.getByText('Agent move validated and added to the session transcript.', { exact: true }).waitFor();
  const packet = JSON.parse((await download('Download self-contained agent packet')).content);
  assert.ok(packet);
  await tab('Run experiments').click();
  await button('Run 20 games').click();
  await page.getByRole('heading', { name: /20 completed games/ }).waitFor();
  assert.equal(await page.locator('.lab-results-table tbody tr').count(), 20);
  await page.screenshot({ path: `${artifacts}/experiments.png` });
  await bounded();
  await tab('Playtest journal').click();
  await page.getByLabel('Playtest finding').fill('Test whether early cheap cards make the first seat too strong.');
  await button('Save finding').click();
  await page.getByText('Test whether early cheap cards make the first seat too strong.', { exact: true }).waitFor();
  await saved();
  console.log('PASS legal agent moves, rejected illegal move, 20 simulations, and findings');

  await section('print & share');
  await page.getByLabel('Component', { exact: true }).selectOption({ label: 'Original card deck · card' });
  const cards = await download('Download component sheets');
  assert.match(cards.content, /Checkpoint card/);
  assert.match(cards.content, /@page/);
  const rules = await download('Download rulebook');
  assert.match(rules.content, /Little Woodland/);
  const backup = await download('Download full backup');
  const archive = JSON.parse(backup.content);
  assert.ok(archive.checkpoints.length >= 3);
  assert.equal(archive.version, 2);
  assert.equal(archive.project.playtestLab.batches[0].results.length, 20);
  assert.equal(archive.project.cardStudio, undefined, 'Legacy deck migrated into Components');
  const archivedDesigns = Object.values(archive.project.componentDesigns);
  assert.equal(archivedDesigns.length, 1, 'Archive contains one authored deck without duplicates');
  assert.equal(archivedDesigns[0].rows[0].title, 'Checkpoint card');
  assert.ok(archivedDesigns[0].template.document.faces[0].layers.length > 5, 'Archive retains editable layers');
  await page.getByLabel('Import game backup', { exact: true }).setInputFiles(backup.path);
  const originalId = new URL(originalUrl).hash.split('?')[0];
  await page.waitForURL((url) => url.hash.includes('/editor/') && url.hash.split('?')[0] !== originalId);
  await page.waitForFunction(() => document.querySelector('[aria-label="Project name"]')?.value === 'Little Woodland (imported)');
  await openCardData();
  assert.equal(await title.inputValue(), 'Checkpoint card');
  await page.reload();
  await openCardData();
  assert.equal(await title.inputValue(), 'Checkpoint card');
  await section('version history');
  await checkpoints.getByRole('button', { name: /Before the balance change/ }).waitFor();
  await page.screenshot({ path: `${artifacts}/versions.png` });
  await bounded();
  assert.deepEqual(errors, []);
  console.log('PASS component/rulebook downloads, editable-template archive, full history import, reload, and bounded layout');
  console.log(`Screenshots and downloads: ${artifacts}`);
} catch (error) {
  console.error('Browser errors:', errors);
  await page.screenshot({ path: `${artifacts}/failure.png` }).catch(() => {});
  console.error((await page.locator('body').innerText()).slice(-7000));
  throw error;
} finally {
  await context.close();
  await browser.close();
}
