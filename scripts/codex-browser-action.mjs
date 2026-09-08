#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const cdpUrl = process.env.CODEX_BROWSER_CDP_URL || 'http://127.0.0.1:9223';
const baseUrl = process.env.CODEX_BROWSER_URL || 'http://127.0.0.1:3000';

function resolvePlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE_PATH,
    'playwright',
    '/home/anonymous/.npm/_npx/9833c18b2d85bc59/node_modules/playwright',
    '/home/anonymous/.npm/_npx/e41f203b7505f1fb/node_modules/playwright',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // Try the next known install location.
    }
  }
  throw new Error('Could not find a Playwright install. Launch the MCP once or set PLAYWRIGHT_MODULE_PATH.');
}

function usage() {
  console.error(`Usage:
  node scripts/codex-browser-action.mjs open <url-or-hash>
  node scripts/codex-browser-action.mjs create-project [name]
  node scripts/codex-browser-action.mjs click-text <text> [url-or-hash]
  node scripts/codex-browser-action.mjs fill-label <label> <value> [url-or-hash]
  node scripts/codex-browser-action.mjs fill-placeholder <placeholder> <value> [url-or-hash]
  node scripts/codex-browser-action.mjs select-label <label> <value> [url-or-hash]
  node scripts/codex-browser-action.mjs storage-get <localStorage-key> [url-or-hash]`);
}

function resolveUrl(value) {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('#')) return `${baseUrl}/${value}`;
  if (value.startsWith('/')) return `${baseUrl}${value}`;
  throw new Error(`Expected a URL, hash route, or absolute path. Received: ${value}`);
}

async function getPage() {
  const { chromium } = resolvePlaywright();
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  return { browser, page };
}

async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (!action) {
    usage();
    process.exit(2);
  }

  const { browser, page } = await getPage();
  try {
    if (action === 'open') {
      const url = resolveUrl(args[0]);
      if (!url) throw new Error('open requires a URL or hash route.');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } else if (action === 'create-project') {
      const name = args[0] || `Codex UI Check ${new Date().toISOString().slice(0, 16)}`;
      await page.goto(`${baseUrl}/#/new`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.getByLabel('Game name').fill(name);
      await page.getByRole('button', { name: 'Make Game' }).click();
      await page.waitForURL(/#\/editor\//, { timeout: 15_000 });
    } else if (action === 'click-text') {
      const [text, maybeUrl] = args;
      if (!text) throw new Error('click-text requires visible text.');
      const url = resolveUrl(maybeUrl);
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.getByText(text, { exact: true }).first().click();
    } else if (action === 'fill-label') {
      const [label, value, maybeUrl] = args;
      if (!label || value === undefined) throw new Error('fill-label requires a label and value.');
      const url = resolveUrl(maybeUrl);
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.getByLabel(label).fill(value);
    } else if (action === 'fill-placeholder') {
      const [placeholder, value, maybeUrl] = args;
      if (!placeholder || value === undefined) throw new Error('fill-placeholder requires a placeholder and value.');
      const url = resolveUrl(maybeUrl);
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.getByPlaceholder(placeholder).fill(value);
    } else if (action === 'select-label') {
      const [label, value, maybeUrl] = args;
      if (!label || value === undefined) throw new Error('select-label requires a label and option value or label.');
      const url = resolveUrl(maybeUrl);
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.getByLabel(label).selectOption(value);
    } else if (action === 'storage-get') {
      const [key, maybeUrl] = args;
      if (!key) throw new Error('storage-get requires a localStorage key.');
      const url = resolveUrl(maybeUrl);
      if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const value = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), key);
      console.log(value ?? '');
      return;
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    const bodyText = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
    console.log(JSON.stringify({
      title: await page.title(),
      url: page.url(),
      text: bodyText.slice(0, 2000),
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
