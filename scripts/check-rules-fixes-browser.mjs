#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

// A separate CDP context preserves the designer's projects, auth, and preferences.
// Catalog fixtures are deterministic and every AI response is intercepted here.
const require = createRequire(import.meta.url);
let playwright;
for (const location of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright',
  '/home/anonymous/.npm/_npx/9833c18b2d85bc59/node_modules/playwright',
  '/home/anonymous/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'].filter(Boolean)) {
  try { playwright = require(location); break; } catch { /* Try the next installation. */ }
}
if (!playwright) throw new Error('Set PLAYWRIGHT_MODULE_PATH to your Playwright installation.');
const browser = await playwright.chromium.connectOverCDP(process.env.CODEX_BROWSER_CDP_URL || 'http://127.0.0.1:9223');
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const base = process.env.CODEX_BROWSER_URL || 'http://127.0.0.1:3000';
const artifacts = process.env.RULES_FIXES_ARTIFACT_DIR || '/tmp/turnbased-rules-fixes';
await mkdir(artifacts, { recursive: true });
await writeFile(`${artifacts}/result.json`, JSON.stringify({ passed: false, status: 'running' }, null, 2));
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const button = (name) => page.getByRole('button', { name, exact: true });
const field = (name) => page.getByLabel(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
const picker = page.locator('[data-layout="componentsCatalogPickerPanel"]');
const aiPanel = page.locator('[data-layout="aiAssistPanelModal"]');
let projectId;
const pass = (message) => console.log(`PASS ${message}`);
async function saved() {
  await page.waitForTimeout(700);
  await page.getByRole('status').filter({ hasText: 'Draft saved in this browser' }).waitFor();
}
async function projectSnapshot() {
  await saved();
  return page.evaluate(async (id) => (await import('/src/editor/storage.ts')).loadEditorProject(id), projectId);
}
async function rulebook() {
  await button('rulebook').click();
  await page.locator('[data-layout="rulebookRoot"]').waitFor();
}
async function openIcons() {
  await button('art studio').click();
  await page.getByRole('button', { name: /\bIcons\b/ }).click();
  await button('Add Icon').waitFor();
}
async function openProse() {
  await rulebook();
  if (!await button('Open AI assist for Goal').isVisible()) await button('Next').click();
  await button('Open AI assist for Goal').waitFor();
}
async function openAI() {
  await openProse();
  await button('Open AI assist for Goal').click();
  await aiPanel.waitFor();
}
async function advancedAI() {
  const toggle = aiPanel.getByRole('button', { name: 'Context & tuning', exact: true });
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
}
const range = (label) => aiPanel.locator('[data-layout="aiImportanceSlider"]').filter({ hasText: new RegExp(`^${label}`) }).locator('input[type="range"]');
async function setRange(label, value) {
  await range(label).fill(String(value));
}
async function bounded() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1), 'Editor fits viewport');
  if (await aiPanel.count()) {
    const bounds = await aiPanel.boundingBox();
    const viewport = page.viewportSize();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, 'Expanded AI panel stays inside viewport');
  }
}

const products = [10, 12].map((size) => ({ id: `fixture-board-${size}`, slug: `fixture-board-${size}`,
  title: `Browser Board ${size}x${size}`, category: 'boards', subcategory: `${size}x${size}`,
  shape: 'square', currency: 'USD', supplierId: 'browser-fixture' }));
const faceFor = (size) => ({ id: 'front', faceKey: 'front', widthMm: size * 25.4, heightMm: size * 25.4, bleedMm: 3, safeZoneMm: 3, dpi: 300, cutlineRequired: false });
await context.route('**/v1/products**', async (route) => {
  const url = new URL(route.request().url());
  const slug = url.pathname.split('/')[3];
  const product = products.find((item) => item.slug === slug);
  let json;
  if (!slug) json = { items: url.searchParams.get('category') === 'boards' ? products : [], total: url.searchParams.get('category') === 'boards' ? products.length : 0, page: 1, pageSize: 100 };
  else if (!product) return route.fulfill({ status: 404, json: { error: 'Unknown browser fixture product' } });
  else {
    const size = Number(slug.split('-').at(-1));
    const face = faceFor(size);
    json = url.pathname.endsWith('/layout')
      ? { productSlug: slug, variantId: url.searchParams.get('variantId') || `${slug}-matte`, faces: [face], constraints: { panelCount: 1, cutlineRequired: false } }
      : { ...product, productVariants: ['Matte', 'Gloss'].map((finish) => ({ id: `${slug}-${finish.toLowerCase()}`, title: finish,
        options: [{ optionGroup: 'Finish', optionKey: 'finish', optionValue: finish }], layoutConstraints: [face],
        priceTiers: [{ minQuantity: 1, maxQuantity: 99, unitPrice: 4 }] })) };
  }
  await route.fulfill({ json });
});
const aiRequests = [];
let pendingAI;
await context.route('**/functions/v1/ai-rules-writer', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
  aiRequests.push(route.request().postDataJSON());
  await new Promise((resolve) => { pendingAI = { route, resolve }; });
});
async function respondAI(text) {
  assert.ok(pendingAI, 'AI response is safely intercepted');
  const { route, resolve } = pendingAI;
  pendingAI = null;
  await route.fulfill({ json: { success: true, text, model: 'browser-mock', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }, headers: { 'access-control-allow-origin': '*' } });
  resolve();
}
async function waitForAIRequest() {
  const deadline = Date.now() + 15000;
  while (!pendingAI && Date.now() < deadline) await page.waitForTimeout(25);
  assert.ok(pendingAI, 'AI request reaches the intercepted endpoint within 15 seconds');
}

try {
  await page.goto(`${base}/#/dashboard`);
  projectId = await page.evaluate(async () => {
    const { createBlankProject } = await import('/src/editor/project.ts');
    const { saveEditorProject } = await import('/src/editor/storage.ts');
    const project = { ...createBlankProject('Rules integration browser'), phase: 'ready' };
    project.brief = { ...project.brief, name: project.name, theme: 'Forest, Moonlight', artStyle: 'Storybook, Etching' };
    project.rules.chapters = [
      { id: 'components-check', title: 'Components', kind: 'components', body: '' },
      { id: 'icons-check', title: 'Iconography', kind: 'iconography', body: '' },
      { id: 'goal-check', title: 'Goal', kind: 'standard', body: 'Collect five stars to win.' },
      { id: 'setup-check', title: 'Setup', kind: 'standard', body: 'Give each player one marker.' },
    ];
    await saveEditorProject(project);
    return project.id;
  });
  const editorUrl = `${base}/#/editor/${projectId}?section=rules`;
  await page.goto(editorUrl);
  await page.locator('[data-layout="componentsChapterRoot"]').waitFor();
  await button('Add component').click();
  await picker.getByLabel(/^Size/).selectOption('fixture-board-10');
  await picker.getByLabel(/^Finish/).selectOption('Matte');
  await picker.getByLabel('Component name', { exact: true }).fill('City board');
  await picker.getByLabel(/^In-game description/).fill('Track the city districts.');
  await picker.getByRole('button', { name: 'Add item', exact: true }).click();
  const added = await projectSnapshot();
  assert.equal(added.rootInstanceIds.length, 1);
  const boardId = added.rootInstanceIds[0];
  assert.equal(added.instances[boardId].properties.catalogSlug, 'fixture-board-10');
  assert.equal(added.instances[boardId].properties.physicalWidthMm, 254);
  assert.equal(added.instances[boardId].displayName, 'City board');
  assert.equal(added.instances[boardId].notes, 'Track the city districts.');
  await button('components').click();
  await page.locator('.component-design-card').filter({ has: page.getByRole('heading', { name: 'City board', exact: true }) }).click();
  await page.getByRole('region', { name: 'Visual template editor', exact: true }).waitFor();
  await saved();
  await rulebook();
  await button('Edit linked catalog item for City board').click();
  assert.equal(await picker.getByLabel('Component name', { exact: true }).inputValue(), 'City board');
  await picker.getByLabel(/^Size/).selectOption('fixture-board-12');
  await picker.getByLabel(/^Finish/).selectOption('Gloss');
  await picker.getByLabel('Component name', { exact: true }).fill('City board revised');
  await picker.getByLabel(/^In-game description/).fill('Track districts and their score.');
  await picker.getByRole('button', { name: 'Update item', exact: true }).click();
  const updated = await projectSnapshot();
  assert.deepEqual(updated.rootInstanceIds, [boardId], 'Catalog update keeps physical identity');
  assert.equal(updated.instances[boardId].properties.catalogVariantId, 'fixture-board-12-gloss');
  assert.ok(Math.abs(updated.instances[boardId].properties.physicalWidthMm - 304.8) < 0.001);
  assert.equal(updated.instances[boardId].displayName, 'City board revised');
  assert.equal(updated.instances[boardId].notes, 'Track districts and their score.');
  assert.ok(Math.abs(updated.componentDesigns[boardId].template.document.widthMm - 304.8) < 0.001, 'Catalog update synchronizes existing authored template dimensions');
  await page.screenshot({ path: `${artifacts}/catalog.png` });
  pass('rulebook catalog add/update keeps identity, descriptions, supplier choice and authored dimensions');

  await openIcons();
  await button('Add Icon').click();
  await field('Icon Name').fill('Moon acorn');
  await field('Inline Code').fill(':moon-acorn:');
  await field('Meaning / Art Notes').fill('Gain one acorn after dusk.');
  await saved();
  await rulebook();
  const iconDescription = field('Description for Moon acorn');
  assert.equal(await iconDescription.inputValue(), 'Gain one acorn after dusk.');
  await iconDescription.fill('Gain two acorns after dusk.');
  await saved();
  await openIcons();
  assert.equal(await field('Meaning / Art Notes').inputValue(), 'Gain two acorns after dusk.');
  await field('Meaning / Art Notes').fill('Spend two acorns to move.');
  await saved();
  await page.reload();
  await rulebook();
  assert.equal(await iconDescription.inputValue(), 'Spend two acorns to move.');
  await page.screenshot({ path: `${artifacts}/iconography.png` });
  pass('Art and Iconography share icon descriptions in both directions across reload');

  await openAI();
  await aiPanel.locator('textarea').fill('Use short sentences. Keep the victory target.');
  await aiPanel.getByRole('button', { name: 'Rewrite', exact: true }).click();
  const model = await aiPanel.getByLabel(/^Model/).locator('option').nth(1).getAttribute('value');
  assert.ok(model);
  await aiPanel.getByLabel(/^Model/).selectOption(model);
  await advancedAI();
  await setRange('Rulebook', 35);
  await setRange('Prompt', 80);
  await setRange('Tags', 25);
  await setRange('Creativity', 1.15);
  await aiPanel.locator('[data-context-label="Themes"]').getByRole('button', { name: 'Moonlight', exact: true }).click();
  await aiPanel.locator('[data-context-label="Art styles"]').getByRole('button', { name: 'Etching', exact: true }).click();
  async function assertDraft() {
    assert.equal(await aiPanel.locator('textarea').inputValue(), 'Use short sentences. Keep the victory target.');
    assert.equal(await aiPanel.getByLabel(/^Model/).inputValue(), model);
    assert.equal(await aiPanel.getByRole('button', { name: 'Rewrite', exact: true }).getAttribute('aria-pressed'), 'true');
    await advancedAI();
    for (const [label, value] of [['Rulebook', '35'], ['Prompt', '80'], ['Tags', '25'], ['Creativity', '1.15']]) assert.equal(await range(label).inputValue(), value);
    assert.equal(await aiPanel.locator('[data-context-label="Themes"]').getByRole('button', { name: 'Moonlight', exact: true }).getAttribute('aria-pressed'), 'false');
    assert.equal(await aiPanel.locator('[data-context-label="Art styles"]').getByRole('button', { name: 'Etching', exact: true }).getAttribute('aria-pressed'), 'false');
  }
  await button('Close AI assist').click();
  await openAI();
  await assertDraft();
  await page.reload();
  await openAI();
  await assertDraft();
  await aiPanel.getByLabel(/^Model/).selectOption('openai/gpt-5.1');
  assert.equal(await range('Creativity').isDisabled(), true, 'Models without temperature support disable the control');
  await aiPanel.getByText('This model sets creativity automatically.', { exact: true }).waitFor();
  await aiPanel.getByLabel(/^Model/).selectOption(model);
  assert.equal(await range('Creativity').isDisabled(), false);
  assert.equal(await range('Creativity').inputValue(), '1.15', 'Switching model preserves the designer’s tuning');
  await page.screenshot({ path: `${artifacts}/ai-draft.png` });
  await bounded();
  pass('AI prompt, mode, model, weights, temperature and selected tags persist across close and reload');
  await button('Close AI assist').click();

  // Use the seeded local account only inside this isolated context; all model calls stay mocked.
  const authError = await page.evaluate(async () => {
    const { supabase } = await import('/src/lib/supabaseClient.ts');
    const { error } = await supabase.auth.signInWithPassword({ email: 'dev@turnbased.local', password: 'dev-local-only' });
    return error?.message ?? null;
  });
  assert.equal(authError, null, 'Local seeded account signs in for intercepted AI requests');
  await openAI();
  await aiPanel.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-layout="aiAssistPanelModal"]')?.textContent.includes('Writing'));
  await waitForAIRequest();
  const request = aiRequests.at(-1);
  assert.equal(request.temperature, 1.15);
  assert.equal(request.modelId, model);
  assert.deepEqual(request.contextWeights, { rulebook: 35, prompt: 80, chips: 25 });
  assert.equal(request.theme, 'Forest');
  assert.equal(request.artStyle, 'Storybook');
  await respondAI('Collect five stars. The first player to do so wins.');
  await aiPanel.waitFor({ state: 'hidden' });
  assert.equal(await field('Chapter text').first().inputValue(), 'Collect five stars. The first player to do so wins.');
  await button('Undo last AI change to Goal').click();
  assert.equal(await field('Chapter text').first().inputValue(), 'Collect five stars to win.');
  pass('mocked AI generation sends tuning and undo restores the prior chapter without paid calls');

  await openAI();
  await aiPanel.getByRole('button', { name: 'Generate', exact: true }).click();
  await waitForAIRequest();
  assert.equal(await field('Chapter text').first().isDisabled(), true, 'Active generation protects its target text');
  const newerSetup = 'Give each player two markers; this was edited while AI was writing.';
  await field('Chapter text').nth(1).fill(newerSetup);
  await respondAI('Collect five stars and declare victory.');
  await aiPanel.waitFor({ state: 'hidden' });
  assert.equal(await field('Chapter text').first().inputValue(), 'Collect five stars and declare victory.');
  assert.equal(await field('Chapter text').nth(1).inputValue(), newerSetup);
  await button('Undo last AI change to Goal').click();
  assert.equal(await field('Chapter text').first().inputValue(), 'Collect five stars to win.');
  assert.equal(await field('Chapter text').nth(1).inputValue(), newerSetup);
  await openAI();
  await aiPanel.getByRole('button', { name: 'Generate', exact: true }).click();
  await waitForAIRequest();
  await button('art studio').click();
  await respondAI('A response after leaving the section must be ignored.');
  await page.waitForTimeout(150);
  await openProse();
  assert.equal(await field('Chapter text').first().inputValue(), 'Collect five stars to win.');
  assert.equal(await field('Chapter text').nth(1).inputValue(), newerSetup);
  assert.equal(await aiPanel.count(), 0);
  pass('delayed AI replies preserve concurrent chapter edits and cannot alter an unmounted rulebook');

  await saved();
  await button('version history').click();
  await field('Remember this version').fill('Before delayed rules response');
  await button('Save checkpoint').click();
  const checkpoints = page.getByRole('complementary', { name: 'Saved checkpoints' });
  await checkpoints.getByRole('button', { name: /Before delayed rules response/ }).waitFor();
  await openProse();
  await field('Chapter text').nth(1).fill('Temporary setup experiment after the checkpoint.');
  await saved();
  await openAI();
  await aiPanel.getByRole('button', { name: 'Generate', exact: true }).click();
  await waitForAIRequest();
  await button('version history').click();
  await checkpoints.getByRole('button', { name: /Before delayed rules response/ }).click();
  await button('Restore this version').click();
  await checkpoints.getByRole('button', { name: /Safety checkpoint before switching versions/ }).waitFor();
  await respondAI('A delayed response must not modify a restored checkpoint.');
  await page.waitForTimeout(150);
  await openProse();
  assert.equal(await field('Chapter text').first().inputValue(), 'Collect five stars to win.');
  assert.equal(await field('Chapter text').nth(1).inputValue(), newerSetup);
  assert.equal(await button('Undo last AI change to Goal').count(), 0);
  pass('checkpoint restore ignores an in-flight AI reply even when the target chapter text is unchanged');

  const returnUrl = page.url();
  await page.evaluate(() => { location.hash = '#/settings'; });
  await button('Close settings and return to previous screen').click();
  await page.waitForURL(returnUrl);
  await page.locator('[data-layout="rulebookRoot"]').waitFor();
  await page.evaluate(() => { location.hash = '#/settings'; });
  await button('Close settings and return to previous screen').waitFor();
  await page.reload();
  await button('Close settings and return to previous screen').click();
  await page.waitForURL(`${base}/#/dashboard`);
  const direct = await context.newPage();
  direct.on('pageerror', (error) => errors.push(error.message));
  await direct.route('https://rules-browser.invalid/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>External history fixture</title><p>Prior external page</p>' }));
  await direct.goto('https://rules-browser.invalid/prior');
  await direct.goto(`${base}/#/settings`);
  assert.ok(await direct.evaluate(() => history.length) > 1, 'Direct settings has external history to avoid');
  await direct.getByRole('button', { name: 'Close settings and return to previous screen', exact: true }).click();
  await direct.waitForURL(`${base}/#/dashboard`);
  await direct.screenshot({ path: `${artifacts}/settings-safe-return.png` });
  await direct.close();
  pass('Settings Close returns to the exact in-app route and safely handles reloads and external history');
  assert.deepEqual(errors, []);
  await writeFile(`${artifacts}/result.json`, JSON.stringify({ passed: true, finishedAt: new Date().toISOString(), aiRequests: aiRequests.length, browserErrors: errors }, null, 2));
  console.log(`Screenshots and results: ${artifacts}`);
} catch (error) {
  await writeFile(`${artifacts}/result.json`, JSON.stringify({ passed: false, error: String(error), browserErrors: errors }, null, 2));
  console.error('Browser errors:', errors);
  await page.screenshot({ path: `${artifacts}/failure.png` }).catch(() => {});
  console.error((await page.locator('body').innerText()).slice(-8000));
  throw error;
} finally {
  if (pendingAI) { await pendingAI.route.abort().catch(() => {}); pendingAI.resolve(); }
  await context.close();
  await browser.close();
}
