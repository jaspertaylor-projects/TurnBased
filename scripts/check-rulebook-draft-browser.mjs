#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
let playwright;
for (const location of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright', '/home/anonymous/.npm/_npx/9833c18b2d85bc59/node_modules/playwright'].filter(Boolean)) {
  try { playwright = require(location); break; } catch { /* Next installed location. */ }
}
if (!playwright) throw new Error('Set PLAYWRIGHT_MODULE_PATH.');
const browser = await playwright.chromium.launch({ executablePath: process.env.DEMO_CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await context.newPage();
const errors = [], checks = [];
const output = process.env.RULEBOOK_DRAFT_ARTIFACT_DIR || '/tmp/turnbased-rulebook-draft';
await mkdir(output, { recursive: true });
const base = process.env.CODEX_BROWSER_URL || 'http://127.0.0.1:3000';
page.on('pageerror', (error) => errors.push(error.message));
let pending = null;
await context.route('**/functions/v1/ai-*', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
  assert.ok(route.request().url().endsWith('/ai-rules-writer'), 'No unrelated AI endpoint requested');
  pending = route;
});
const button = (name) => page.getByRole('button', { name, exact: true });
async function requested() {
  for (let n = 0; n < 100 && !pending; n++) await page.waitForTimeout(50);
  assert.ok(pending, 'A mocked AI request was made');
  return pending.request().postDataJSON();
}
async function respond(text) {
  const route = pending; pending = null;
  await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, json: { success: true, text, model: 'moonshotai/kimi-k2.6' } });
}
async function saved() {
  await page.waitForTimeout(850);
  await page.getByRole('status').filter({ hasText: 'Draft saved in this browser' }).waitFor();
}
let projectId;
const snapshot = () => page.evaluate(async (id) => (await import('/src/editor/storage.ts')).loadEditorProject(id), projectId);
try {
  await page.goto(base);
  projectId = await page.evaluate(async () => {
    const { createBlankProject } = await import('/src/editor/project.ts');
    const { saveEditorProject } = await import('/src/editor/storage.ts');
    const { supabase } = await import('/src/lib/supabaseClient.ts');
    const auth = await supabase.auth.signInWithPassword({ email: 'dev@turnbased.local', password: 'dev-local-only' });
    if (auth.error) throw auth.error;
    const project = { ...createBlankProject('AI rulebook browser check'), phase: 'ready' };
    project.rules.chapters.filter((chapter) => !chapter.kind || chapter.kind === 'standard').forEach((chapter) => { chapter.body = `Original ${chapter.title}`; });
    await saveEditorProject(project); return project.id;
  });
  await page.goto(`${base}/#/editor/${projectId}?section=rules`);
  await button('Draft rulebook with AI').waitFor();
  const before = await snapshot();
  const open = async () => { await button('Draft rulebook with AI').click(); await page.getByRole('dialog', { name: 'Write the rules together.' }).waitFor(); };
  await open();
  await page.getByLabel('Describe the game and how it should play').fill('Two traders gather coins and buy cards. Race to fifteen prestige.');
  await button('Generate rulebook draft').click();
  const request = await requested();
  assert.equal(request.mode, 'rulebook');
  assert.equal(request.targetChapters.length, 5);
  assert.ok(request.chapters.some((chapter) => chapter.body.startsWith('Original')));
  const generated = request.targetChapters.map((chapter) => ({ id: chapter.id, body: `AI draft for ${chapter.title}. Take two actions, gather two coins, or buy one card. Race to fifteen prestige.` }));
  await respond(JSON.stringify({ chapters: generated }));
  await button('Apply 5 chapters').waitFor();
  assert.deepEqual((await snapshot()).rules, before.rules, 'Preview does not mutate rules');
  await page.getByRole('navigation', { name: 'Draft chapters' }).getByRole('button', { name: 'Taking a Turn', exact: true }).click();
  await page.screenshot({ path: `${output}/preview.png` });
  assert.ok(await page.evaluate(() => {
    const r = document.querySelector('dialog').getBoundingClientRect();
    return r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && document.documentElement.scrollHeight <= innerHeight;
  }), 'Dialog and editor are bounded');
  await button('Apply 5 chapters').click(); await saved();
  const after = await snapshot();
  for (const entry of generated) assert.equal(after.rules.chapters.find((chapter) => chapter.id === entry.id).body, entry.body);
  assert.deepEqual(after.rules.chapters.filter((chapter) => chapter.kind && chapter.kind !== 'standard'), before.rules.chapters.filter((chapter) => chapter.kind && chapter.kind !== 'standard'));
  await button('Undo rulebook draft').click(); await saved();
  assert.deepEqual((await snapshot()).rules, before.rules);
  checks.push('Exact five-chapter proposal previews without mutation, applies atomically, retains structured chapters, and undoes through the UI.');

  await open(); await button('Generate rulebook draft').click(); await requested();
  await button('Cancel').click();
  await respond(JSON.stringify({ chapters: generated })); await saved();
  assert.deepEqual((await snapshot()).rules, before.rules, 'Late response after cancel is ignored');
  checks.push('Closing a running draft ignores its late response.');

  await open(); await button('Generate rulebook draft').click(); await requested();
  await respond(JSON.stringify({ chapters: [generated[0], generated[0]] }));
  await page.getByRole('alert').filter({ hasText: /every requested chapter/ }).waitFor();
  assert.equal(await button('Apply 5 chapters').count(), 0);
  assert.deepEqual((await snapshot()).rules, before.rules);
  await button('Cancel').click();
  checks.push('Malformed or incomplete AI results cannot be applied.');

  await open(); await button('Generate rulebook draft').click(); await requested();
  await respond(JSON.stringify({ chapters: generated })); await button('Apply 5 chapters').click(); await saved();
  await page.getByRole('textbox', { name: 'Chapter text', exact: true }).first().fill('A newer manual correction.');
  await saved(); assert.equal(await button('Undo rulebook draft').count(), 0, 'A newer manual edit invalidates AI undo');
  await page.reload(); await button('Draft rulebook with AI').waitFor(); await saved();
  assert.equal((await snapshot()).rules.chapters.find((chapter) => chapter.id === generated[0].id).body, 'A newer manual correction.');
  checks.push('Manual corrections invalidate stale undo and survive reload.');
  assert.deepEqual(errors, []);
  await writeFile(`${output}/result.json`, JSON.stringify({ passed: true, checks, errors, paidAiCalls: 0 }, null, 2));
  console.log(JSON.stringify({ passed: true, checks, errors, artifacts: output }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  await writeFile(`${output}/result.json`, JSON.stringify({ passed: false, checks, errors, error: error.message }, null, 2));
  throw error;
} finally { await context.close(); await browser.close(); }
