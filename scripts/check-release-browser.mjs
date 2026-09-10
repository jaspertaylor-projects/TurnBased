#!/usr/bin/env node
// Exercise the deployed application through guest UI and browser APIs only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
for (const location of [
  process.env.PLAYWRIGHT_MODULE_PATH,
  'playwright',
  '/home/anonymous/.npm/_npx/9833c18b2d85bc59/node_modules/playwright',
  '/home/anonymous/.npm/_npx/e41f203b7505f1fb/node_modules/playwright',
].filter(Boolean)) {
  try { playwright = require(location); break; } catch { /* Try the next installation. */ }
}
if (!playwright) throw new Error('Set PLAYWRIGHT_MODULE_PATH to an installed Playwright module.');

const base = (process.env.CODEX_BROWSER_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const artifacts = resolve(process.env.RELEASE_ARTIFACT_DIR || '/tmp/turnbased-release-browser');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname);
const requireProduction = !local || process.env.RELEASE_REQUIRE_PRODUCTION === '1';
const report = {
  passed: false, base, artifacts, requireProduction, checks: [], layouts: [],
  pageErrors: [], blockedRequests: [], blockedInfrastructureRequests: [], downloads: [], media: null,
};
const heading = 'Rules, components, and playtests in one workspace.';
const videoLabel = 'Watch an AI agent write a game rulebook in TurnBased';
let browser;
let activePage;

function record(name, details = {}) {
  report.checks.push({ name, ...details });
  console.log(`PASS ${name}`);
}

async function isolatedPage(name, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
    acceptDownloads: true, serviceWorkers: 'block',
  });
  // Any unexpected request that could create remote state is stopped before sending.
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const ai = /\/functions\/v1\/ai-/.test(url.pathname);
    if (ai || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      // Cloudflare injects telemetry and browser-check scripts into hosted pages.
      // Block these too, while keeping their requests separate from app mutations.
      const infrastructure = url.origin === new URL(base).origin && (
        url.pathname === '/cdn-cgi/rum' || url.pathname.startsWith('/cdn-cgi/challenge-platform/')
      );
      if (infrastructure) {
        report.blockedInfrastructureRequests.push({
          context: name, method: request.method(),
          path: url.pathname === '/cdn-cgi/rum' ? '/cdn-cgi/rum' : '/cdn-cgi/challenge-platform/',
        });
      } else report.blockedRequests.push({ context: name, method: request.method(), path: `${url.origin}${url.pathname}` });
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', (error) => report.pageErrors.push({ context: name, message: error.message }));
  activePage = page;
  return page;
}

async function screenshot(page, name, fullPage = false) {
  await page.screenshot({ path: join(artifacts, `${name}.png`), fullPage });
}

async function bounded(page, name, allowVertical = false) {
  const dimensions = await page.evaluate(() => ({
    width: innerWidth, height: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    bodyWidth: document.body.scrollWidth,
  }));
  report.layouts.push({ name, ...dimensions });
  assert.ok(dimensions.documentWidth <= dimensions.width + 1, `${name}: no document horizontal overflow`);
  assert.ok(dimensions.bodyWidth <= dimensions.width + 1, `${name}: no body horizontal overflow`);
  if (!allowVertical) {
    assert.ok(dimensions.documentHeight <= dimensions.height + 1, `${name}: document stays in the application frame`);
  }
}

async function compactHeading(page, name) {
  const title = page.getByRole('heading', { name, exact: true });
  await title.waitFor();
  const fontSize = await title.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  assert.ok(fontSize <= 24.1, `${name}: compact page heading (${fontSize}px)`);
}

async function sidebar(page, name) {
  const open = page.getByRole('button', { name: 'Open sidebar', exact: true });
  if (await open.isVisible()) await open.click();
  await page.getByRole('button', { name, exact: true }).click();
}

async function saved(page) {
  // Wait past the draft debounce before accepting the existing saved status.
  await page.waitForTimeout(900);
  await page.getByRole('status').filter({ hasText: 'Draft saved in this browser' }).waitFor();
}

async function authBoundary(page, name) {
  await page.goto(`${base}/#/auth`);
  await page.getByRole('button', { name: 'Sign In', exact: true }).waitFor();
  const development = await page.locator('script[src*="/@vite/client"]').count() > 0;
  if (requireProduction) assert.equal(development, false, `${name}: production bundle, without Vite development client`);
  if (!development) {
    assert.equal(await page.getByRole('button', { name: 'Use local dev account', exact: true }).count(), 0,
      `${name}: production does not expose the development login shortcut`);
    record(`${name}: production authentication screen has no development shortcut`);
  } else record(`${name}: development bundle detected; production-only shortcut check deferred`);
  report.bundleMode = development ? 'development' : 'production';
  await bounded(page, `${name}-auth`);
}

async function checkLanding(page, name) {
  await page.goto(`${base}/`);
  await page.getByRole('heading', { name: heading, exact: true }).waitFor();
  await page.getByText('Watch the AI agent draft rules, then review and apply them.', { exact: true }).waitFor();
  const video = page.getByLabel(videoLabel, { exact: true });
  assert.deepEqual(await video.evaluate((element) => ({
    controls: element.controls, playsInline: element.playsInline,
    autoplay: element.autoplay, preload: element.preload,
  })), { controls: true, playsInline: true, autoplay: false, preload: 'none' });
  await bounded(page, `${name}-home`, true);
  await screenshot(page, `${name}-home`, true);
  record(`${name}: landing copy, native player, and horizontal bounds`);
}

async function desktopWorkflow(page) {
  await checkLanding(page, 'desktop');
  await page.locator('#cta-start').click();
  await compactHeading(page, 'Create game');
  await bounded(page, 'desktop-create');
  const projectName = `Release check ${new Date().toISOString()}`;
  await page.getByLabel('Game name', { exact: true }).fill(projectName);
  await page.getByLabel('Theme or first idea', { exact: true }).fill('A two-player resource trading game');
  await page.getByRole('button', { name: 'Create game', exact: true }).click();
  await page.waitForURL(/#\/editor\//);
  await compactHeading(page, 'Project overview');
  const projectUrl = page.url().split('?')[0];
  assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), projectName);
  await sidebar(page, 'rulebook');
  const chapter = page.getByLabel('Chapter text', { exact: true }).first();
  const ruleText = 'Players take one action each turn. Gather two coins or buy one card. The first player to twelve points wins.';
  await chapter.fill(ruleText);
  await chapter.blur();
  await saved(page);
  await screenshot(page, 'desktop-rulebook');
  await bounded(page, 'desktop-rulebook');
  // Explicit section URLs are the public route contract; sidebar state is not URL state.
  await page.goto(`${projectUrl}?section=rules`);
  await page.reload();
  assert.equal(await page.getByLabel('Chapter text', { exact: true }).first().inputValue(), ruleText);
  assert.equal(await page.getByLabel('Project name', { exact: true }).inputValue(), projectName);
  record('desktop: game creation, rule editing, and persistence after reload');

  await sidebar(page, 'print & share');
  await compactHeading(page, 'Print & share');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download rulebook', exact: true }).click();
  const download = await pending;
  assert.equal(await download.failure(), null, 'Rulebook download completes');
  const filename = join(artifacts, 'release-rulebook.html');
  await download.saveAs(filename);
  const html = await readFile(filename, 'utf8');
  assert.ok(html.includes(projectName), 'Export contains the project title');
  assert.ok(html.includes(ruleText), 'Export contains the saved authored rules');
  assert.match(html, /@page/, 'Export defines printable pages');
  report.downloads.push({ name: download.suggestedFilename(), path: filename, bytes: Buffer.byteLength(html) });
  await screenshot(page, 'desktop-print');
  await bounded(page, 'desktop-print');
  record('desktop: actual printable rulebook download contains saved rules');

  await page.goto(`${base}/#/new`);
  await page.getByRole('button', { name: 'Try Little Woodland', exact: true }).click();
  await page.waitForURL(/#\/editor\//);
  await compactHeading(page, 'Project overview');
  assert.equal(await page.locator('[data-layout="physicalComponentCopyCount"] dd').innerText(), '10');
  await sidebar(page, 'components');
  await compactHeading(page, 'Components');
  await page.getByRole('region', { name: 'Components workbench', exact: true }).waitFor();
  await page.locator('.component-design-card').filter({
    has: page.getByRole('heading', { name: 'Original card deck', exact: true }),
  }).click();
  await page.getByRole('navigation', { name: 'Component editing tools' })
    .getByRole('button', { name: 'Data & copies', exact: true }).click();
  assert.ok((await page.getByLabel('Card 1 title', { exact: true }).inputValue()).length > 0,
    'Example deck exposes editable card data');
  await screenshot(page, 'desktop-components');
  await bounded(page, 'desktop-components');
  await page.goto(`${base}/#/dashboard`);
  await compactHeading(page, 'My workshop');
  await page.reload();
  await page.getByRole('article', { name: projectName, exact: true }).waitFor();
  await page.getByRole('article', { name: 'Little Woodland', exact: true }).waitFor();
  await bounded(page, 'desktop-workshop');
  record('desktop: example component data and both projects retained in workshop');
  await authBoundary(page, 'desktop');
}

async function mobileWorkflow(page) {
  await checkLanding(page, 'mobile');
  await page.locator('#cta-start').click();
  await compactHeading(page, 'Create game');
  await bounded(page, 'mobile-create');
  await screenshot(page, 'mobile-create');
  await page.getByRole('button', { name: 'Try Little Woodland instead', exact: true }).click();
  await page.waitForURL(/#\/editor\//);
  await compactHeading(page, 'Project overview');
  await bounded(page, 'mobile-project');
  const sampleUrl = page.url().split('?')[0];
  for (const [section, title] of [['component_editor', 'Components'], ['print', 'Print & share']]) {
    await page.goto(`${sampleUrl}?section=${section}`);
    await compactHeading(page, title);
    const collapse = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
    if (await collapse.isVisible()) await collapse.click();
    await page.waitForTimeout(250);
    await bounded(page, `mobile-${section}`);
    await screenshot(page, `mobile-${section}`);
  }
  await page.goto(`${base}/#/dashboard`);
  await compactHeading(page, 'My workshop');
  await page.getByRole('article', { name: 'Little Woodland', exact: true }).waitFor();
  await bounded(page, 'mobile-workshop');
  await screenshot(page, 'mobile-workshop');
  await authBoundary(page, 'mobile');
  record('mobile: guest creation, components, print, workshop, and viewport bounds');
}

async function mediaCheck(page) {
  activePage = page;
  await page.goto(`${base}/`);
  const video = page.getByLabel(videoLabel, { exact: true });
  await video.waitFor();
  const paths = await video.evaluate((element) => ({
    poster: element.poster,
    source: element.querySelector('source').src,
    captions: element.querySelector('track').src,
  }));
  const assets = await Promise.all([
    page.context().request.get(paths.poster),
    page.context().request.get(paths.captions),
    page.context().request.head(paths.source),
  ]);
  for (const [index, response] of assets.entries()) assert.ok(response.ok(), `Media asset ${index + 1}: HTTP ${response.status()}`);
  assert.match(assets[0].headers()['content-type'], /^image\//, 'Poster has an image content type');
  const captionText = await assets[1].text();
  assert.match(captionText, /^WEBVTT/, 'Captions are WebVTT');
  assert.match(captionText, /\d{2}:\d{2}\.\d{3} -->/, 'Captions contain timed cues');
  assert.match(assets[2].headers()['content-type'], /^video\/mp4/, 'Ad has an MP4 content type');
  await video.evaluate(async (element) => {
    const image = new Image();
    image.src = element.poster;
    await image.decode();
    if (image.naturalWidth < 500) throw new Error('Poster is missing or too small');
    element.muted = true;
    element.load();
    await element.play();
  });
  await page.waitForFunction(() => {
    const element = document.querySelector('video');
    if (element.error) throw new Error(element.error.message);
    return element.currentTime > 0.25 && element.videoWidth > 0;
  }, null, { timeout: 30000 });
  await video.evaluate((element) => element.pause());
  const metadata = await video.evaluate((element) => ({
    duration: element.duration, width: element.videoWidth, height: element.videoHeight,
  }));
  assert.ok(Number.isFinite(metadata.duration) && metadata.duration > 15, 'Ad has a finite playable duration');
  assert.ok(metadata.width >= 960 && metadata.height >= 540, 'Ad has readable video dimensions');
  await video.evaluate((element) => { element.textTracks[0].mode = 'showing'; });
  await page.waitForFunction(() => {
    const track = document.querySelector('video track');
    return track.readyState === 2 && track.track.cues?.length > 0;
  });
  const frames = [];
  for (const [name, time] of [['beginning', 1], ['middle', metadata.duration / 2], ['end', metadata.duration - 0.75]]) {
    const frame = await video.evaluate(async (element, target) => {
      await new Promise((accept, reject) => {
        const timer = setTimeout(() => reject(new Error(`No decoded frame at ${target}s`)), 15000);
        let seeked = false, decoded = false;
        const finish = () => { if (seeked && decoded) { clearTimeout(timer); accept(); } };
        element.addEventListener('seeked', () => { seeked = true; finish(); }, { once: true });
        const inspect = (_, metadata) => {
          if (Math.abs(metadata.mediaTime - target) < 0.12) { decoded = true; finish(); }
          else element.requestVideoFrameCallback(inspect);
        };
        element.requestVideoFrameCallback(inspect);
        element.currentTime = target;
      });
      if (element.error) throw new Error(element.error.message);
      const canvas = document.createElement('canvas');
      canvas.width = 80; canvas.height = 50;
      const context = canvas.getContext('2d');
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      for (let offset = 0; offset < pixels.length; offset += 4) colors.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`);
      const quality = element.getVideoPlaybackQuality();
      return { time: element.currentTime, readyState: element.readyState, colors: colors.size,
        decodedFrames: quality.totalVideoFrames, droppedFrames: quality.droppedVideoFrames };
    }, time);
    assert.ok(Math.abs(frame.time - time) < 0.2 && frame.readyState >= 2, `${name}: seek succeeds`);
    assert.ok(frame.decodedFrames > 0 && frame.colors > 20, `${name}: video contains a decoded visual frame`);
    const path = join(artifacts, `ad-${name}.png`);
    await video.screenshot({ path });
    frames.push({ name, ...frame, screenshot: path });
  }
  report.media = { ...metadata, assets: paths, frames };
  record('ad: HTTP poster/captions/video, native playback, loaded cues, and decoded frames at three positions');
}

await mkdir(artifacts, { recursive: true });
try {
  browser = await playwright.chromium.launch({
    executablePath: process.env.DEMO_CHROME_PATH || '/usr/bin/google-chrome',
    headless: true, args: ['--no-sandbox'],
  });
  const desktop = await isolatedPage('desktop');
  await desktopWorkflow(desktop);
  const mobile = await isolatedPage('mobile', true);
  await mobileWorkflow(mobile);
  await mediaCheck(desktop);
  assert.deepEqual(report.pageErrors, [], 'No application page errors');
  assert.deepEqual(report.blockedRequests, [], 'Guest checks made no AI or remote-write requests');
  report.passed = true;
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  await activePage?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  await writeFile(join(artifacts, 'failure-page.txt'), await activePage?.locator('body').innerText().catch(() => '') || '');
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(join(artifacts, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
