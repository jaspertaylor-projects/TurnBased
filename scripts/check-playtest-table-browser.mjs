#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
let playwright;
for (const location of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright',
  '/home/anonymous/.npm/_npx/9833c18b2d85bc59/node_modules/playwright',
  '/home/anonymous/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'].filter(Boolean)) {
  try { playwright = require(location); break; } catch { /* Try the next installation. */ }
}
if (!playwright) throw new Error('Set PLAYWRIGHT_MODULE_PATH to an installed Playwright module.');
const artifacts = process.env.PLAYTEST_TABLE_ARTIFACT_DIR || '/tmp/turnbased-playtest-table';
const archive = await readFile(process.env.PLAYTEST_TABLE_ARCHIVE || 'artifacts/demos/moonlit-market/downloads/moonlit-market-with-history.json', 'utf8');
const base = process.env.CODEX_BROWSER_URL || 'http://127.0.0.1:3000';
await mkdir(artifacts, { recursive: true });
const browser = await playwright.chromium.launch({ executablePath: process.env.DEMO_CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const button = name => page.getByRole('button', { name, exact: true });
const board = page.locator('[data-layout="playtestPhysicalBoard"]');
const table = page.locator('[data-layout="playtestTabletop"]');
const placed = page.locator('[data-layout="playtestPlacedCard"]');
const inspector = page.getByRole('dialog', { name: 'Inspect playtest card', exact: true });
async function saved() {
  await page.waitForTimeout(850);
  await page.getByRole('status').filter({ hasText: 'Draft saved in this browser' }).waitFor();
}
async function geometry(label) {
  await page.waitForTimeout(150);
  const result = await board.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const viewport = element.closest('[data-layout="playtestBoardViewport"]').getBoundingClientRect();
    const scale = Number(element.dataset.scale);
    return { scale, width: bounds.width, height: bounds.height,
      expectedWidth: Number(element.dataset.mmWidth) * scale, expectedHeight: Number(element.dataset.mmHeight) * scale,
      inside: bounds.left >= viewport.left && bounds.top >= viewport.top && bounds.right <= viewport.right + 1 && bounds.bottom <= viewport.bottom + 1,
      cards: [...element.querySelectorAll('[data-layout="playtestPlacedCard"]')].map(card => {
        const rect = card.getBoundingClientRect();
        const face = card.querySelector('.lab-physical-card').getBoundingClientRect();
        return { id: card.dataset.cardId, zone: card.dataset.zone,
          mmWidth: Number(card.dataset.mmWidth), mmHeight: Number(card.dataset.mmHeight),
          width: rect.width, height: rect.height, faceWidth: face.width, faceHeight: face.height };
      }),
    };
  });
  assert.ok(result.scale > 0 && result.inside, `${label}: whole physical table fits`);
  assert.ok(Math.abs(result.width - result.expectedWidth) < 1 && Math.abs(result.height - result.expectedHeight) < 1);
  for (const card of result.cards) {
    assert.ok(Math.abs(card.width / card.mmWidth - result.scale) < .02, `${label}: card width uses table scale`);
    assert.ok(Math.abs(card.height / card.mmHeight - result.scale) < .02, `${label}: card height uses table scale`);
    assert.ok(Math.abs(card.faceWidth - card.width) < 1 && Math.abs(card.faceHeight - card.height) < 1, `${label}: card face has no distortion`);
  }
  return result;
}
let projectId;
try {
  await page.goto(`${base}/#/dashboard`);
  projectId = await page.evaluate(async text => {
    const { importDesignArchive } = await import('/src/editor/versions/archive.ts');
    const { createStudioComponent, setProjectComponentDesign } = await import('/src/editor/componentStudio/model.ts');
    const { resizeTemplateDocument } = await import('/src/editor/templateStudio/resize.ts');
    const { createPlaytestLabState } = await import('/src/editor/playtest/simulation.ts');
    const { saveEditorProject } = await import('/src/editor/storage.ts');
    let project = await importDesignArchive(text);
    const created = createStudioComponent(project, 'card', 'Square test deck');
    project = created.project;
    const studio = project.componentDesigns[created.instanceId];
    studio.template.document = resizeTemplateDocument(studio.template.document, 50, 50, true);
    studio.rows = [{ ...studio.rows[0], title: 'Square moon', body: 'A square card stays square.', cost: '0', copies: 12, customFields: { points: '1' } }];
    project = setProjectComponentDesign(project, created.instanceId, studio);
    const lab = createPlaytestLabState();
    project.playtestLab = { ...lab, config: { ...lab.config, cardSource: 'project', startingResources: 12, targetScore: 999 } };
    await saveEditorProject(project);
    return project.id;
  }, archive);
  const editorUrl = `${base}/#/editor/${projectId}?section=playtest`;
  await page.goto(editorUrl);
  await button('Start your first session').click();
  await board.waitFor();
  await saved();
  const initial = await geometry('normal');
  assert.ok(initial.cards.some(card => card.mmWidth === 50 && card.mmHeight === 50), 'Square card is visible');
  assert.ok(initial.cards.some(card => card.mmWidth === 63 && card.mmHeight === 88), 'Portrait card is visible');
  const draw = page.locator('[data-layout="playtestDrawBack"]');
  assert.match(await draw.locator('use').getAttribute('href'), /-back$/);
  assert.equal(await draw.locator('..').getAttribute('data-card-id'), null, 'Draw pile does not expose next hidden card ID');
  await page.screenshot({ path: `${artifacts}/normal.png` });

  const portrait = placed.filter({ has: page.getByRole('button', { name: /^Inspect Starberry Jam$/ }) });
  const visibleNames = await page.getByRole('button', { name: /^Inspect / }).allTextContents();
  assert.ok(visibleNames.length > 0);
  const cardInspect = await portrait.count() ? portrait.getByRole('button', { name: 'Inspect Starberry Jam', exact: true }) : page.locator('[data-zone="market"][data-mm-width="63"]').first().getByRole('button', { name: /^Inspect / });
  await cardInspect.click();
  await inspector.waitFor();
  assert.match(await inspector.innerText(), /63 × 88 mm · Design saved with this session/);
  assert.ok(await inspector.locator('image').count() > 0, 'Authored artwork layer is rendered');
  await button('Show card back').click();
  assert.match(await inspector.locator('[data-layout="playtestCardInspectorFace"]').innerText(), /MOONLIT/);
  await page.screenshot({ path: `${artifacts}/inspected-back.png` });
  await page.keyboard.press('Escape');
  await inspector.waitFor({ state: 'hidden' });

  await button('Fullscreen table').click();
  await page.waitForFunction(() => document.querySelector('[data-layout="playtestTabletop"]').dataset.fullscreen === 'true');
  const full = await geometry('fullscreen');
  assert.ok(full.scale > initial.scale, 'Fullscreen makes the table larger');
  await page.screenshot({ path: `${artifacts}/fullscreen.png` });
  await page.setViewportSize({ width: 1100, height: 780 });
  await geometry('resized fullscreen');
  const purchased = page.locator('[data-zone="market"]').filter({ has: page.locator('button.lab-physical-card:not(:disabled)') }).first();
  const purchaseId = await purchased.getAttribute('data-card-id');
  await purchased.locator('button.lab-physical-card').click();
  await page.locator(`[data-zone="challenger"][data-card-id="${purchaseId}"]`).waitFor();
  await geometry('purchased collection');
  await page.screenshot({ path: `${artifacts}/played-card.png` });
  await button('Exit fullscreen table').click();
  await page.waitForFunction(() => document.querySelector('[data-layout="playtestTabletop"]').dataset.fullscreen === 'false');
  await button('Fullscreen table').click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('[data-layout="playtestTabletop"]').dataset.fullscreen === 'false');
  await page.setViewportSize({ width: 1600, height: 1000 });
  await saved();
  const frozen = await page.evaluate(async id => {
    const { loadEditorProject } = await import('/src/editor/storage.ts');
    const project = await loadEditorProject(id);
    return { state: project.playtestLab.activeRun.state, visuals: project.playtestLab.activeRun.visuals };
  }, projectId);
  await page.reload();
  await page.locator(`[data-zone="challenger"][data-card-id="${purchaseId}"]`).waitFor();
  assert.deepEqual(await page.evaluate(async id => {
    const { loadEditorProject } = await import('/src/editor/storage.ts');
    const project = await loadEditorProject(id);
    return { state: project.playtestLab.activeRun.state, visuals: project.playtestLab.activeRun.visuals };
  }, projectId), frozen, 'Reload retains the exact state and authored visuals');

  // Change the current design after the run has captured its immutable material.
  await button('components').click();
  await page.locator('.component-design-card').filter({ has: page.getByRole('heading', { name: 'Moonlit Market deck', exact: true }) }).click();
  await page.getByRole('navigation', { name: 'Component editing tools' }).getByRole('button', { name: 'Data & copies', exact: true }).click();
  await page.getByLabel('Card 1 title', { exact: true }).fill('EDITED AFTER SESSION');
  await saved();
  await button('playtest lab').click();
  assert.deepEqual(await page.evaluate(async id => {
    const { loadEditorProject } = await import('/src/editor/storage.ts');
    return (await loadEditorProject(id)).playtestLab.activeRun.visuals;
  }, projectId), frozen.visuals, 'Editing the current card data leaves session visuals unchanged');
  await button('Start fresh session').click();
  await saved();
  await page.getByRole('tab', { name: 'Playtest journal', exact: true }).click();
  await button('Replay session').first().click();
  assert.equal(await page.locator('[data-zone="market"] button.lab-physical-card:not(:disabled)').count(), 0, 'Replay cannot buy cards');
  await button('Next move').click();
  await page.locator(`[data-zone="challenger"][data-card-id="${purchaseId}"]`).waitFor();
  await geometry('frozen replay');
  await page.screenshot({ path: `${artifacts}/replay.png` });
  assert.deepEqual(errors, []);
  await writeFile(`${artifacts}/result.json`, JSON.stringify({ passed: true, projectId, initial, full, errors }, null, 2));
  console.log('PASS actual authored cards, mixed dimensions, one table scale, fullscreen/resize, zones, back inspection, reload and immutable replay');
} catch (error) {
  await page.screenshot({ path: `${artifacts}/failure.png` });
  await writeFile(`${artifacts}/result.json`, JSON.stringify({ passed: false, projectId, error: error.message, errors }, null, 2));
  throw error;
} finally { await context.close(); await browser.close(); }
