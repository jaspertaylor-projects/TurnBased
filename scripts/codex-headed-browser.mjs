#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const appUrl = process.env.CODEX_BROWSER_URL || process.argv[2] || 'http://127.0.0.1:3000';
const profileDir = path.resolve(
  repoRoot,
  process.env.CODEX_BROWSER_PROFILE || '.playwright-codex/chrome-profile',
);
const debugPort = process.env.CODEX_BROWSER_DEBUG_PORT || '9223';
const viewport = {
  width: Number(process.env.CODEX_BROWSER_WIDTH || 1440),
  height: Number(process.env.CODEX_BROWSER_HEIGHT || 900),
};

function resolvePlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE_PATH,
    path.join(repoRoot, 'node_modules/playwright'),
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
  return null;
}

function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/brave',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function installShutdown(handler) {
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    await handler();
  }
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

async function launchWithPlaywright(playwright) {
  const { chromium } = playwright;
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless: false,
    viewport,
    args: [
      `--remote-debugging-port=${debugPort}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  installShutdown(async () => {
    await context.close();
    process.exit(0);
  });

  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  console.log(`Codex headed browser is open at ${appUrl}`);
  console.log(`Profile: ${profileDir}`);
  console.log(`Chrome DevTools Protocol: http://127.0.0.1:${debugPort}`);
  await new Promise(() => {});
}

function launchWithChrome() {
  const chrome = resolveChrome();
  if (!chrome) {
    throw new Error('Could not find Chrome/Chromium. Set CHROME_PATH or install Google Chrome.');
  }
  const child = spawn(chrome, [
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${debugPort}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    appUrl,
  ], {
    stdio: 'inherit',
    detached: false,
  });
  installShutdown(async () => {
    child.kill('SIGTERM');
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
  console.log(`Codex headed Chrome is open at ${appUrl}`);
  console.log(`Profile: ${profileDir}`);
  console.log(`Chrome DevTools Protocol: http://127.0.0.1:${debugPort}`);
}

mkdirSync(profileDir, { recursive: true });

const playwright = resolvePlaywright();
if (playwright) {
  launchWithPlaywright(playwright).catch((error) => {
    console.error('Playwright launch failed; falling back to direct Chrome.');
    console.error(error instanceof Error ? error.message : String(error));
    launchWithChrome();
  });
} else {
  launchWithChrome();
}
