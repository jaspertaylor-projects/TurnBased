#!/usr/bin/env node
// Local recording workbench. JSON commands on stdin drive the actual app UI;
// scene boundaries let the final edit omit time spent operating the recorder.
import { createRequire } from 'node:module';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

const require = createRequire(import.meta.url);
let playwright;
for (const location of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright',
  '/home/anonymous/.npm/_npx/9833c18b2d85bc59/node_modules/playwright',
  '/home/anonymous/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'].filter(Boolean)) {
  try { playwright = require(location); break; } catch { /* Try installed locations. */ }
}
if (!playwright) throw new Error('Set PLAYWRIGHT_MODULE_PATH to an installed Playwright module.');
const output = resolve(process.env.DEMO_OUTPUT_DIR || 'artifacts/demos/moonlit-market');
await mkdir(`${output}/raw`, { recursive: true });
await mkdir(`${output}/downloads`, { recursive: true });
const browser = await playwright.chromium.launch({
  executablePath: process.env.DEMO_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1,
  recordVideo: { dir: `${output}/raw`, size: { width: 1600, height: 900 } },
  acceptDownloads: true,
});
await context.addInitScript(() => {
  // This cursor is a recording aid; it changes no app behavior or project data.
  window.addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div');
    cursor.dataset.layout = 'demoRecordingCursor';
    cursor.setAttribute('aria-hidden', 'true');
    Object.assign(cursor.style, {
      width: '18px', height: '18px', position: 'fixed', left: '-40px', top: '-40px',
      border: '2px solid #fff', borderRadius: '50%', background: '#0e766c',
      boxShadow: '0 1px 6px #0006', zIndex: '2147483647', pointerEvents: 'none',
      transform: 'translate(-50%, -50%)', transition: 'width .1s, height .1s',
    });
    document.body.append(cursor);
    window.addEventListener('mousemove', e => { cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`; });
    window.addEventListener('mousedown', () => { cursor.style.width = '28px'; cursor.style.height = '28px'; });
    window.addEventListener('mouseup', () => { cursor.style.width = '18px'; cursor.style.height = '18px'; });
  });
});
const started = Date.now();
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [], scenes = [], downloads = [], responses = [];
let currentScene = null, stopped = false;
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (/\/functions\/v1\/ai-(rules-writer|image-agent)$/.test(response.url()) && response.request().method() === 'POST') {
    responses.push({ endpoint: new URL(response.url()).pathname, status: response.status(), at: elapsed() });
  }
});
page.on('download', file => {
  const pending = file.saveAs(`${output}/downloads/${file.suggestedFilename()}`)
    .then(() => console.log(JSON.stringify({ downloaded: file.suggestedFilename() })));
  downloads.push(pending);
});
function elapsed() { return (Date.now() - started) / 1000; }
function locator(spec) {
  let target;
  if (spec.css) target = page.locator(spec.css);
  else if (spec.label) target = page.getByLabel(spec.label, { exact: true });
  else if (spec.text) target = page.getByText(spec.text, { exact: true });
  else target = page.getByRole(spec.role || 'button', { name: spec.name, exact: true });
  return spec.nth === undefined ? target : target.nth(spec.nth);
}
async function click(target) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
  await page.waitForTimeout(180);
  await target.click();
  await page.waitForTimeout(420);
}
async function fill(target, value, delay = 20) {
  await click(target);
  await target.fill('');
  if (delay) await target.pressSequentially(String(value), { delay });
  else await target.fill(String(value));
  await page.waitForTimeout(350);
}
async function saved() {
  await page.waitForTimeout(900);
  await page.getByRole('status').filter({ hasText: 'Draft saved in this browser' }).waitFor();
}
async function stop() {
  if (stopped) return;
  stopped = true;
  if (currentScene) { currentScene.end = elapsed(); currentScene = null; }
  await Promise.all(downloads);
  const url = page.url();
  await page.screenshot({ path: `${output}/last-frame.png` });
  await context.close();
  const video = await page.video().path();
  await browser.close();
  await writeFile(`${output}/recording.json`, JSON.stringify({ video, url, scenes, errors, responses }, null, 2));
  console.log(JSON.stringify({ stopped: true, video, url, scenes: scenes.length, errors, responses }));
}
const base = process.env.CODEX_BROWSER_URL || 'http://127.0.0.1:3000';
await page.goto(`${base}/#/`);
console.log(JSON.stringify({ ready: true, output, url: page.url() }));
const input = createInterface({ input: process.stdin });
for await (const line of input) {
  if (!line.trim()) continue;
  let command;
  try {
    command = JSON.parse(line);
    const commandStart = elapsed();
    let result;
    switch (command.action) {
      case 'begin':
        if (currentScene) currentScene.end = elapsed();
        currentScene = { title: command.title, caption: command.caption, start: elapsed() };
        scenes.push(currentScene);
        break;
      case 'end':
        if (currentScene) currentScene.end = elapsed();
        currentScene = null;
        break;
      case 'goto': await page.goto(command.url.startsWith('#') ? `${base}/${command.url}` : command.url); break;
      case 'click': await click(locator(command)); break;
      case 'fill': await fill(locator(command), command.value, command.delay); break;
      case 'select': await locator(command).selectOption(command.value); break;
      case 'pause': await page.waitForTimeout(command.ms || 1500); break;
      case 'saved': await saved(); break;
      case 'snapshot': result = (await page.locator('body').innerText()).slice(0, 22000); break;
      case 'screenshot': await page.screenshot({ path: `${output}/${command.name || 'frame'}.png` }); break;
      case 'run': {
        // Only local operator-authored Playwright code; never exposed as a service.
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        result = await new AsyncFunction('page', 'context', 'click', 'fill', 'saved', 'output', command.code)(page, context, click, fill, saved, output);
        break;
      }
      case 'stop': await stop(); break;
      default: throw new Error(`Unknown command: ${command.action}`);
    }
    await appendFile(`${output}/commands.jsonl`, `${JSON.stringify({ ...command, start: commandStart, end: elapsed(), success: true })}\n`);
    await writeFile(`${output}/timeline.json`, JSON.stringify({ scenes, errors, responses }, null, 2));
    console.log(JSON.stringify({ ok: true, action: command.action, at: elapsed(), result }));
    if (stopped) break;
  } catch (error) {
    console.error(JSON.stringify({ ok: false, action: command?.action, error: error.message, at: elapsed() }));
    await page.screenshot({ path: `${output}/operator-error.png` }).catch(() => {});
  }
}
await stop();
