#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// A fresh CDP context keeps the designer's signed-in profile and games untouched.
const require = createRequire(import.meta.url);
let playwright;
for (const location of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright',
  '/home/anonymous/.npm/_npx/9833c18b2d85bc59/node_modules/playwright',
  '/home/anonymous/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'].filter(Boolean)) {
  try { playwright = require(location); break; } catch { /* Try the next installation. */ }
}
if (!playwright) throw new Error('Set PLAYWRIGHT_MODULE_PATH to your Playwright installation.');
const browser = await playwright.chromium.connectOverCDP(process.env.CODEX_BROWSER_CDP_URL || 'http://127.0.0.1:9223');
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const artifacts = process.env.COMPONENT_TEMPLATE_ARTIFACT_DIR || '/tmp/turnbased-component-templates';
const base = process.env.CODEX_BROWSER_URL || 'http://127.0.0.1:3000';
await mkdir(artifacts, { recursive: true });
await writeFile(`${artifacts}/result.json`, JSON.stringify({ passed: false, running: true, startedAt: new Date().toISOString() }, null, 2));
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const button = (name) => page.getByRole('button', { name, exact: true });
const field = (name) => page.getByLabel(name, { exact: true });
const editor = page.getByRole('region', { name: 'Visual template editor', exact: true });
const rendered = page.locator('[data-layout="templateRenderedDesign"]');
const properties = page.getByRole('complementary', { name: 'Template properties' });
const faceButtons = page.locator('[data-layout="templateFaceSelector"]');
const editingTab = (name) => page.getByRole('navigation', { name: 'Component editing tools' }).getByRole('button', { name, exact: true });
const selectLayer = (name) => page.getByRole('option', { name: `Select layer ${name}`, exact: true }).click();
async function fill(name, value) {
  await field(name).fill(String(value));
  await field(name).press('Tab');
}
async function download(name, filename) {
  const [file] = await Promise.all([page.waitForEvent('download'), button(name).click()]);
  const path = `${artifacts}/${filename || file.suggestedFilename()}`;
  await file.saveAs(path);
  return { path, content: await readFile(path, 'utf8') };
}
const template = async () => JSON.parse((await download('Download template', 'current-template.json')).content).document;
const design = async () => JSON.parse((await download('Export component design', 'current-component.json')).content);
const layerByName = (document, name, face = 0) => {
  const layer = document.faces[face].layers.find((item) => item.name === name);
  assert.ok(layer, `Layer ${name} exists on face ${face}`);
  return layer;
};
async function saved() {
  // Wait beyond the debounced write before checking its completion status.
  await page.waitForTimeout(700);
  await page.getByRole('status').filter({ hasText: 'Draft saved in this browser' }).waitFor();
}
async function bounded(label) {
  const bounds = await page.evaluate(() => {
    const viewport = document.querySelector('[data-layout="templateCanvasViewport"]');
    const canvas = viewport?.getBoundingClientRect();
    const footer = document.querySelector('.template-statusbar')?.getBoundingClientRect();
    return { overflowX: document.documentElement.scrollWidth - innerWidth,
      overflowY: document.documentElement.scrollHeight - innerHeight,
      canvas: canvas && { x: canvas.x, y: canvas.y, right: canvas.right, bottom: canvas.bottom, width: canvas.width, height: canvas.height },
      canvasOverflowX: viewport && viewport.scrollWidth - viewport.clientWidth,
      canvasOverflowY: viewport && viewport.scrollHeight - viewport.clientHeight,
      footer: footer?.bottom, width: innerWidth, height: innerHeight };
  });
  assert.ok(bounds.overflowX <= 1 && bounds.overflowY <= 1, `${label}: page fits viewport ${JSON.stringify(bounds)}`);
  if (bounds.canvas) {
    assert.ok(bounds.canvas.width > 100 && bounds.canvas.height > 100, `${label}: useful canvas area`);
    assert.ok(bounds.canvas.x >= 0 && bounds.canvas.right <= bounds.width + 1 && bounds.canvas.bottom <= bounds.height + 1, `${label}: canvas is bounded`);
    assert.ok(bounds.footer <= bounds.height + 1, `${label}: editor footer remains visible`);
    assert.ok(bounds.canvasOverflowX <= 1 && bounds.canvasOverflowY <= 1, `${label}: default fitted canvas needs no scrollbars`);
  }
}
async function openDeck() {
  await button('components').click();
  const back = button('All components');
  if (await back.isVisible()) await back.click();
  await page.locator('.component-design-card').filter({ has: page.getByRole('heading', { name: 'Original card deck', exact: true }) }).click();
  await editor.waitFor();
}
async function drag(locator, dx, dy) {
  const rect = await locator.boundingBox();
  assert.ok(rect, 'Pointer target has visible geometry');
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
}
async function addText(name, content) {
  await button('Add text layer').click();
  await fill('Layer name', name);
  await fill('Text content', content);
  const layer = (await template()).faces.flatMap((face) => face.layers).find((item) => item.name === name);
  assert.ok(layer, `Added text layer ${name} exists`);
  return layer;
}
async function checkModalKeys(label) {
  const dialog = page.getByRole('dialog', { name: label, exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.evaluate((element) => element.contains(document.activeElement)), true, `${label}: focus transfers into modal`);
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate((element) => document.activeElement === document.body || element.contains(document.activeElement)), true, `${label}: Tab cannot focus background controls`);
  }
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
}

try {
  await page.goto(`${base}/#/new`);
  await button('Try Little Woodland').click();
  await page.waitForURL(/#\/editor\//);
  await openDeck();
  const initial = await design();
  assert.equal(initial.kind, 'card');
  assert.ok(initial.studio.template.document, 'Legacy deck materializes an editable document');
  assert.ok(initial.studio.rows.length > 1, 'Starter deck retains its table rows');
  assert.ok(initial.studio.template.document.faces[0].layers.length > 5, 'Legacy design is individual editable layers');
  console.log('PASS Little Woodland legacy deck materialization');

  await editingTab('Data & copies').click();
  await fill('Card 1 title', 'Browser Acorn');
  await fill('Card 2 title', 'Browser Fern');
  await editingTab('Template').click();
  const rowOptions = await field('Preview data row').locator('option').evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, label: node.textContent })));
  await field('Preview data row').selectOption({ label: 'Browser Acorn' });
  assert.match(await rendered.innerText(), /Browser Acorn/);
  await field('Preview data row').selectOption({ label: 'Browser Fern' });
  assert.match(await rendered.innerText(), /Browser Fern/);

  const staticText = await addText('Browser static text', 'Play a little. Learn a lot.');
  await fill('Layer X', 6);
  await fill('Layer Y', 71);
  await fill('Layer width', 50);
  await fill('Layer height', 7);
  await fill('Font size', 8);
  await field('Text alignment').selectOption('center');
  const boundText = await addText('Browser bound text', 'Design: {{title}}');
  await fill('Layer X', 6);
  await fill('Layer Y', 61);
  await fill('Layer width', 50);
  await fill('Layer height', 8);
  await fill('Font size', 10);
  await field('Preview data row').selectOption({ label: 'Browser Acorn' });
  const boundNode = rendered.locator(`[data-layer-id="${boundText.id}"]`);
  assert.match(await boundNode.textContent(), /Design: Browser Acorn/);
  await field('Preview data row').selectOption({ label: 'Browser Fern' });
  assert.match(await boundNode.textContent(), /Design: Browser Fern/);
  assert.match(await rendered.locator(`[data-layer-id="${staticText.id}"]`).textContent(), /Play a little/);
  await selectLayer('Browser static text');
  await fill('Text content', 'W'.repeat(20));
  await fill('Layer height', 12);
  await fill('Font size', 12);
  const measuredLines = await rendered.locator(`[data-layer-id="${staticText.id}"] tspan`).evaluateAll((lines) => lines.map((line) => line.getComputedTextLength()));
  assert.ok(measuredLines.length > 1 && measuredLines.every((width) => width <= 50), 'Wide-glyph text fits its real SVG box');
  await fill('Text content', 'Play a little. Learn a lot.');
  await fill('Layer height', 7);
  await fill('Font size', 8);
  assert.equal((await design()).studio.rows.length, initial.studio.rows.length, 'Template edits retain every data row');
  console.log('PASS static text, data-bound text, inspector properties, and shared live previews');

  await button('Add rectangle layer').click();
  await fill('Layer name', 'Browser drag shape');
  await fill('Layer X', 14);
  await fill('Layer Y', 38);
  await fill('Layer width', 12);
  await fill('Layer height', 10);
  let shape = layerByName(await template(), 'Browser drag shape');
  const beforeDrag = { ...shape };
  await drag(rendered.locator(`[data-layer-id="${shape.id}"] rect`).last(), 31, 19);
  shape = layerByName(await template(), 'Browser drag shape');
  assert.ok(shape.x > beforeDrag.x && shape.y > beforeDrag.y, 'Real pointer drag changes X and Y');
  const beforeResize = { ...shape };
  await drag(page.locator('[data-resize-handle="se"]'), 24, 18);
  shape = layerByName(await template(), 'Browser drag shape');
  assert.ok(shape.width > beforeResize.width && shape.height > beforeResize.height, 'Real corner-handle drag changes width and height');
  await fill('Rotation', 23);
  assert.match(await rendered.locator(`[data-layer-id="${shape.id}"]`).getAttribute('transform'), /rotate\(23 /);
  await drag(page.locator('[data-rotate-handle]'), 27, 12);
  shape = layerByName(await template(), 'Browser drag shape');
  assert.notEqual(shape.rotation, 23, 'Real rotation-handle drag changes the angle');
  const beforeRotatedResize = { ...shape };
  await drag(page.locator('[data-resize-handle="se"]'), 18, 19);
  shape = layerByName(await template(), 'Browser drag shape');
  assert.ok(shape.width !== beforeRotatedResize.width || shape.height !== beforeRotatedResize.height, 'Rotated corner handle resizes artwork');
  assert.equal(shape.rotation, beforeRotatedResize.rotation, 'Rotated resize retains its angle');
  await button('Send selected layers to back').click();
  assert.equal((await template()).faces[0].layers[0].id, shape.id);
  await button('Bring selected layers to front').click();
  assert.equal((await template()).faces[0].layers.at(-1).id, shape.id);
  await button('Hide layer Browser drag shape').click();
  assert.equal(await rendered.locator(`[data-layer-id="${shape.id}"]`).count(), 0);
  await button('Show layer Browser drag shape').click();
  await selectLayer('Browser drag shape');
  const beforeDuplicate = (await template()).faces[0].layers.length;
  await button('Duplicate selected layers').click();
  assert.equal((await template()).faces[0].layers.length, beforeDuplicate + 1);
  await button('Delete selected layers').click();
  assert.equal((await template()).faces[0].layers.length, beforeDuplicate);
  await button('Undo template change').click();
  assert.equal((await template()).faces[0].layers.length, beforeDuplicate + 1);
  await button('Redo template change').click();
  assert.equal((await template()).faces[0].layers.length, beforeDuplicate);
  await selectLayer('Browser drag shape');
  await editor.focus();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  assert.equal((await template()).faces[0].layers.length, beforeDuplicate + 1, 'Keyboard copy/paste adds a distinct layer');
  await page.keyboard.press('Delete');
  assert.equal((await template()).faces[0].layers.length, beforeDuplicate);
  // Keep the proof sheet readable after exercising overlapping edit gestures.
  await selectLayer('Browser drag shape');
  await fill('Layer X', 52);
  await fill('Layer Y', 79);
  await fill('Layer width', 4);
  await fill('Layer height', 4);
  await selectLayer('Browser bound text');
  await fill('Layer Y', 69);
  await fill('Layer height', 4);
  await fill('Font size', 8);
  await selectLayer('Browser static text');
  await fill('Layer Y', 75);
  await fill('Layer height', 4);
  await fill('Font size', 7);
  await bounded('Card editing');
  await page.screenshot({ path: `${artifacts}/card-template-editor.png` });
  console.log('PASS pointer move/resize, rotation, z-order, visibility, duplicate/delete, copy/paste, undo/redo');

  await button('Manage template faces').click();
  let current = await template();
  if (current.faces.length === 1) await button('Add face').click();
  else await faceButtons.getByRole('button', { name: current.faces[1].name, exact: true }).click();
  await fill('Face name', 'Browser back');
  await addText('Browser back text', 'Woodland playtest back');
  await button('Add image layer').click();
  await fill('Layer name', 'Browser uploaded art');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7k8AAAAASUVORK5CYII=', 'base64');
  await field('Upload layer artwork').setInputFiles({ name: 'browser-art.png', mimeType: 'image/png', buffer: png });
  await button('Replace uploaded artwork').waitFor();
  current = await template();
  assert.match(layerByName(current, 'Browser uploaded art', 1).source, /^data:image\/png;base64,/);
  assert.match(await rendered.locator('image').last().getAttribute('href'), /^data:image\/png;base64,/);
  const backSvg = await download('SVG', 'card-back.svg');
  assert.match(backSvg.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '), /Woodland playtest back/);
  assert.match(backSvg.content, /data:image\/png;base64,/);
  await faceButtons.getByRole('button', { name: current.faces[0].name, exact: true }).click();
  const reusable = await download('Download template', 'reusable-template.json');
  const exportedDocument = JSON.parse(reusable.content).document;
  await selectLayer('Browser static text');
  await button('Layouts').click();
  await checkModalKeys('Template layouts');
  assert.deepEqual(await template(), exportedDocument, 'Layout dialog shortcuts do not edit artwork underneath');
  await fill('Text content', 'Temporary replacement');
  const beforeImport = await template();
  await field('Import template file').setInputFiles(reusable.path);
  await checkModalKeys('Replace template confirmation');
  assert.deepEqual(await template(), beforeImport, 'Cancelled import and dialog shortcuts preserve current artwork');
  await field('Import template file').setInputFiles(reusable.path);
  await button('Use this template').click();
  assert.deepEqual(await template(), exportedDocument, 'JSON import restores all faces, layers, and embedded image bytes');
  const svg = await download('SVG', 'card-front.svg');
  assert.match(svg.content, /Play a little/);
  assert.match(svg.content, /width="63mm"/);
  assert.doesNotMatch(svg.content, /Temporary replacement/);
  console.log('PASS front/back, artwork upload, reusable JSON round-trip, and real SVG export');

  await editingTab('Data & copies').click();
  const expectedCopies = initial.studio.rows.reduce((sum, row) => sum + row.copies, 0);
  await button(`Generate ${expectedCopies} cards`).click();
  await page.getByText(`${expectedCopies} cards generated`, { exact: true }).waitFor();
  const print = await download('Print sheet', 'card-print-sheet.html');
  assert.match(print.content, /@page/);
  assert.match(print.content, /Play a little/);
  assert.match(print.content, /Browser Acorn/);
  assert.match(print.content, /Browser Fern/);
  const expectedPrintedPieces = expectedCopies * exportedDocument.faces.length;
  assert.equal((print.content.match(/class="print-piece"/g) || []).length, expectedPrintedPieces, 'Batch prints each expanded table copy on every face');
  const proof = await context.newPage();
  await proof.setContent(print.content);
  assert.equal(await proof.locator('.print-piece').count(), expectedPrintedPieces);
  for (const face of exportedDocument.faces)
    assert.equal(await proof.locator(`.print-piece[data-face="${face.id}"]`).count(), expectedCopies, `Print includes every ${face.name} copy`);
  await proof.screenshot({ path: `${artifacts}/card-print-sheet.png` });
  await proof.close();
  await editingTab('Template').click();
  const beforeReload = await design();
  await saved();
  await page.reload();
  await openDeck();
  assert.deepEqual((await design()).studio, beforeReload.studio, 'All document layers, table rows, artwork, and generated batch survive reload');
  console.log('PASS generated batch, print HTML, and complete reload persistence');

  await button('version history').click();
  await field('Remember this version').fill('Before the template experiment');
  await button('Save checkpoint').click();
  const checkpoints = page.getByRole('complementary', { name: 'Saved checkpoints' });
  await checkpoints.getByRole('button', { name: /Before the template experiment/ }).waitFor();
  await openDeck();
  await selectLayer('Browser static text');
  await fill('Text content', 'Altered after checkpoint');
  assert.equal(layerByName(await template(), 'Browser static text').content, 'Altered after checkpoint');
  await saved();
  await button('version history').click();
  await checkpoints.getByRole('button', { name: /Before the template experiment/ }).click();
  await button('Restore this version').click();
  await checkpoints.getByRole('button', { name: /Safety checkpoint before switching versions/ }).waitFor();
  await openDeck();
  assert.equal(layerByName(await template(), 'Browser static text').content, 'Play a little. Learn a lot.');
  assert.deepEqual((await template()).faces, beforeReload.studio.template.document.faces, 'Checkpoint restore recovers exact faces and artwork');
  await page.screenshot({ path: `${artifacts}/restored-template.png` });
  console.log('PASS checkpoint restore of an altered layer and safety checkpoint');

  const families = [['Game board', 'board'], ['Token set', 'token'], ['Tile set', 'tile'], ['Player mat', 'mat'], ['Game pieces', 'piece']];
  for (const [label, kind] of families) {
    await button('All components').click();
    await button('New component').click();
    const dialog = page.getByRole('dialog', { name: 'A new piece of your game' });
    await dialog.getByRole('button', { name: label, exact: true }).click();
    await dialog.getByLabel('Component name').fill(`Browser ${kind}`);
    await dialog.getByRole('button', { name: 'Create component', exact: true }).click();
    await editor.waitFor();
    const starter = await template();
    const border = layerByName(starter, 'Surface border');
    assert.ok(Math.abs(border.x + border.width / 2 - starter.widthMm / 2) < 0.01, `${kind}: starter artwork is centered in its physical width`);
    assert.ok(Math.abs(border.y + border.height / 2 - starter.heightMm / 2) < 0.01, `${kind}: starter artwork is centered in its physical height`);
    assert.ok(border.width <= starter.widthMm && border.height <= starter.heightMm, `${kind}: starter border fits its physical component`);
    for (const tool of ['Add text layer', 'Add image layer', 'Add rectangle layer', 'Add board grid', 'Add numbered track'])
      assert.equal(await button(tool).isEnabled(), true, `${kind}: shared ${tool} available`);
    await addText(`Browser ${kind} label`, `${kind} uses the shared canvas`);
    await fill('Rotation', 11);
    const beforeNavigation = await template();
    await editingTab('Data & copies').click();
    await editingTab('Physical specs').click();
    await editingTab('Template').click();
    assert.deepEqual(await template(), beforeNavigation, `${kind}: edits survive data and physical navigation`);
    assert.equal((await design()).kind, kind);
    await bounded(`${kind} editor`);
    await page.screenshot({ path: `${artifacts}/${kind}-template-editor.png` });
  }
  assert.ok(rowOptions.length > 1);
  assert.deepEqual(errors, [], 'No uncaught application errors');
  await writeFile(`${artifacts}/result.json`, JSON.stringify({ passed: true, finishedAt: new Date().toISOString(), families: families.map(([, kind]) => kind), browserErrors: errors }, null, 2));
  console.log('PASS boards, tokens, tiles, mats, and pieces share editable tools and preserve navigation state');
  console.log(`Screenshots and downloads: ${artifacts}`);
} catch (error) {
  console.error('Browser errors:', errors);
  await page.screenshot({ path: `${artifacts}/failure.png` }).catch(() => {});
  await writeFile(`${artifacts}/result.json`, JSON.stringify({ passed: false, browserErrors: errors, error: error.message }, null, 2));
  await writeFile(`${artifacts}/failure-details.txt`, error.stack || String(error));
  console.error((await page.locator('body').innerText()).slice(-7000));
  throw new Error(`${error.message.slice(0, 3000)}\nFull failure: ${artifacts}/failure-details.txt`);
} finally {
  await context.close();
  await browser.close();
}
