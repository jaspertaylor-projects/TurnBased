#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

const cdpUrl = process.env.CODEX_BROWSER_CDP_URL || 'http://127.0.0.1:9223';
const targetUrl = process.argv[2] || process.env.CODEX_BROWSER_URL || '';
const outputDir = process.env.CODEX_BROWSER_SCREENSHOT_DIR || '.playwright-codex/screenshots';
const outputName = process.argv[3] || `codex-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
const outputPath = path.join(outputDir, outputName);

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

mkdirSync(outputDir, { recursive: true });

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
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(outputPath);
} finally {
  await browser.close();
}
