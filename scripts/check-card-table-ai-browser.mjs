#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let playwright;
for (const path of [
  process.env.PLAYWRIGHT_MODULE_PATH,
  'playwright',
  '/home/anonymous/.npm/_npx/9833c18b2d85bc59/node_modules/playwright',
  '/home/anonymous/.npm/_npx/e41f203b7505f1fb/node_modules/playwright',
].filter(Boolean)) {
  try {
    playwright = require(path);
    break;
  } catch {}
}
if (!playwright) throw new Error('Set PLAYWRIGHT_MODULE_PATH to an installed Playwright package.');
const browser = await playwright.chromium.launch({
  executablePath: process.env.DEMO_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const base = process.env.CODEX_BROWSER_URL || 'http://127.0.0.1:3000';
const output = resolve(process.env.CARD_TABLE_AI_ARTIFACT_DIR || 'artifacts/card-table-ai-browser');
await mkdir(output, { recursive: true });
const result = { passed: false, checks: [], requests: [], browserErrors: [] };
page.on('pageerror', (error) => result.browserErrors.push(error.message));
const pass = (text) => {
  result.checks.push(text);
  console.log(`PASS ${text}`);
};
let mode = 'success',
  release = null;
await context.route('**/functions/v1/ai-card-table', async (route) => {
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  const body = route.request().postDataJSON();
  result.requests.push(body);
  const currentMode = mode;
  if (currentMode === 'deferred')
    await new Promise((resolve) => {
      release = resolve;
    });
  if (currentMode === 'wallet')
    return route.fulfill({
      status: 402,
      headers,
      json: { error: 'Insufficient wallet balance for this edit.' },
    });
  let edits = body.target.rowIds.map((rowId, index) => ({
    rowId,
    value:
      body.target.field === 'copies'
        ? 3
        : body.target.field.startsWith('custom:')
          ? String(index + 7)
          : `AI ${body.target.field} ${index + 1}`,
  }));
  if (currentMode === 'malformed') edits = edits.slice(1);
  await route
    .fulfill({ headers, json: { success: true, field: body.target.field, edits, model: body.modelId } })
    .catch(() => {});
});
await context.route('**/functions/v1/ai-rules-writer', (route) => route.abort());
await context.route('**/functions/v1/ai-image-agent', (route) => route.abort());
const button = (name) => page.getByRole('button', { name, exact: true });
const dialog = () => page.getByRole('dialog', { name: 'AI table editor' });
const preview = () => page.getByRole('region', { name: 'Review AI table changes' });
let projectId, componentId;
async function saved() {
  await page.waitForTimeout(650);
  await page.getByRole('status').filter({ hasText: 'Draft saved in this browser' }).waitFor();
}
async function snapshot() {
  await saved();
  return page.evaluate(
    async (id) => await (await import('/src/editor/storage.ts')).loadEditorProject(id),
    projectId,
  );
}
async function table() {
  await button('components').click();
  const gallery = page.locator('.component-design-card').filter({ hasText: 'AI test deck' });
  if (await gallery.isVisible()) await gallery.click();
  await page
    .getByRole('navigation', { name: 'Component editing tools' })
    .getByRole('button', { name: 'Data & copies', exact: true })
    .click();
  await page.getByLabel('Card 1 body', { exact: true }).waitFor();
}
async function request(column = 'body') {
  await button(`AI edit ${column} column`).click();
  await dialog()
    .getByLabel('AI table instructions', { exact: true })
    .fill('Rewrite this field using the complete game context.');
  await dialog().getByRole('button', { name: 'Generate suggestions', exact: true }).click();
}
async function waitRequest() {
  await page.waitForFunction(() => document.querySelector('[role="status"]') !== null);
  for (let i = 0; i < 100 && !release; i++) await page.waitForTimeout(30);
  assert(release, 'Mock request reached deferred handler');
}
async function editBehindDialog(label, value) {
  await page.getByLabel(label, { exact: true }).evaluate((input, next) => {
    const prototype =
      input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
try {
  await page.goto(`${base}/#/auth`);
  await button('Use local dev account').click();
  await page.waitForURL(/#\/dashboard/);
  await page.goto(`${base}/#/new`);
  await page.getByLabel('Game name', { exact: true }).fill('AI table browser check');
  await page.getByLabel('Theme or first idea', { exact: true }).fill('Lantern-lit woodland markets');
  await button('Create game').click();
  await page.waitForURL(/#\/editor\//);
  projectId = page.url().match(/#\/editor\/([^?]+)/)[1];
  await button('components').click();
  await button('New component').click();
  await page.getByLabel('Component name').fill('AI test deck');
  await button('Create component').click();
  await table();
  await button('Import').click();
  await page.getByLabel('Choose CSV or TSV').setInputFiles(resolve('docs/demos/moonlit-market-cards.csv'));
  await page.getByRole('dialog').getByRole('combobox').selectOption('replace');
  await button('Replace table').click();
  const original = await snapshot();
  componentId = Object.keys(original.componentDesigns)[0];
  const originalStudio = original.componentDesigns[componentId];
  await request();
  await preview().waitFor();
  assert.equal(
    await page.getByLabel('Card 1 body', { exact: true }).inputValue(),
    originalStudio.rows[0].body,
  );
  await button('Cancel').click();
  assert.equal(
    await page.getByLabel('Card 1 body', { exact: true }).inputValue(),
    originalStudio.rows[0].body,
  );
  pass('Whole-column preview does not overwrite cells, and Cancel preserves the table.');
  await request();
  await preview().waitFor();
  await page.screenshot({ path: `${output}/column-preview.png` });
  await button('Apply 6 cells').click();
  let changed = await snapshot();
  assert.deepEqual(
    changed.componentDesigns[componentId].rows.map((row) => row.body),
    Array.from({ length: 6 }, (_, i) => `AI body ${i + 1}`),
  );
  assert.deepEqual(
    changed.componentDesigns[componentId].rows.map((row) => [row.id, row.copies]),
    originalStudio.rows.map((row) => [row.id, row.copies]),
  );
  await button('Undo AI edit').click();
  assert.deepEqual((await snapshot()).componentDesigns[componentId].rows, originalStudio.rows);
  pass('Apply updates the entire column atomically, and one AI undo restores it.');
  await page.getByLabel('Card 2 points', { exact: true }).focus();
  await button('AI edit selected cell').click();
  await dialog().getByLabel('AI table instructions', { exact: true }).fill('Set this point value to seven.');
  await button('Generate suggestions').click();
  await preview().waitFor();
  await button('Apply 1 cell').click();
  changed = await snapshot();
  assert.equal(changed.componentDesigns[componentId].rows[1].customFields.points, '7');
  assert.equal(changed.componentDesigns[componentId].rows[0].customFields.points, '1');
  await page.getByLabel('Card 2 points', { exact: true }).fill('8');
  await saved();
  assert(await button('Undo AI edit').isDisabled());
  pass('Custom single-cell editing changes only its cell; a later manual edit invalidates AI undo.');
  mode = 'deferred';
  release = null;
  await request();
  await waitRequest();
  await editBehindDialog('Card 1 cost', '9');
  release();
  await preview().waitFor();
  await button('Apply 6 cells').click();
  changed = await snapshot();
  assert.equal(changed.componentDesigns[componentId].rows[0].cost, '9');
  await button('Undo AI edit').click();
  assert.equal((await snapshot()).componentDesigns[componentId].rows[0].cost, '9');
  pass('Apply and undo preserve unrelated concurrent table edits.');
  mode = 'deferred';
  release = null;
  await request();
  await waitRequest();
  await editBehindDialog('Card 1 body', 'Human wrote this while AI was pending.');
  await dialog().getByRole('alert').filter({ hasText: 'selected value changed' }).waitFor();
  release();
  await page.waitForTimeout(500);
  assert.equal(await preview().count(), 0);
  assert(await button('Apply 6 cells').isDisabled());
  await button('Cancel').click();
  assert.equal(
    await page.getByLabel('Card 1 body', { exact: true }).inputValue(),
    'Human wrote this while AI was pending.',
  );
  pass('A target edited while generation is pending invalidates the entire response.');
  mode = 'malformed';
  await request();
  await dialog().getByRole('alert').waitFor();
  assert(await button('Apply 6 cells').isDisabled());
  await button('Cancel').click();
  mode = 'wallet';
  await request();
  await dialog().getByRole('alert').filter({ hasText: 'Insufficient wallet balance' }).waitFor();
  await button('Cancel').click();
  pass('Malformed response and wallet errors are visible and leave all cells untouched.');
  mode = 'deferred';
  release = null;
  await request();
  await waitRequest();
  await page.goto(`${base}/#/dashboard`);
  release();
  await page.goto(`${base}/#/editor/${projectId}?section=component_editor`);
  await table();
  assert.equal(await dialog().count(), 0);
  assert(await button('Undo AI edit').isDisabled());
  pass('Navigation unmount cancels pending requests and prevents stale AI undo.');
  await page.reload();
  await table();
  assert.equal(
    await page.getByLabel('Card 1 body', { exact: true }).inputValue(),
    'Human wrote this while AI was pending.',
  );
  assert.equal(await page.getByLabel('Card 2 points', { exact: true }).inputValue(), '8');
  pass('Accepted and manual edits persist after reload.');
  mode = 'success';
  await request('title');
  await preview().waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const bounds = await dialog().boundingBox();
  assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 391 && bounds.y + bounds.height <= 845);
  await page.screenshot({ path: `${output}/mobile-preview.png` });
  await button('Cancel').click();
  pass('Preview dialog stays bounded on a narrow mobile viewport.');
  const sent = result.requests[0];
  assert.equal(sent.game.name, 'AI table browser check');
  assert.equal(sent.game.theme, 'Lantern-lit woodland markets');
  assert.equal(sent.rows.length, 6);
  assert(sent.game.rules.includes('Setup'));
  assert(!('artUrl' in sent.rows[0]));
  assert.deepEqual(result.browserErrors, []);
  pass('Requests include full rules/theme/table context without artwork bytes; no browser errors.');
  result.passed = true;
} catch (error) {
  result.error = { message: error.message, stack: error.stack };
  console.error(error);
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  release?.();
  await writeFile(`${output}/result.json`, JSON.stringify(result, null, 2));
  await context.close();
  await browser.close();
  console.log(JSON.stringify({ passed: result.passed, output, error: result.error?.message }));
}
