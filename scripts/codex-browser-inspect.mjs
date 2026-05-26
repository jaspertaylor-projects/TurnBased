#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const cdpUrl = process.env.CODEX_BROWSER_CDP_URL || 'http://127.0.0.1:9223';
const targetUrl = process.argv[2] || process.env.CODEX_BROWSER_URL || '';
const textLimit = Number(process.env.CODEX_BROWSER_TEXT_LIMIT || 2000);

function resolvePlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE_PATH,
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

const { chromium } = resolvePlaywright();
const browser = await chromium.connectOverCDP(cdpUrl);
try {
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
  if (targetUrl) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  }
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  const bodyText = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
  console.log(JSON.stringify({
    title: await page.title(),
    url: page.url(),
    text: bodyText.slice(0, textLimit),
  }, null, 2));
} finally {
  await browser.close();
}
