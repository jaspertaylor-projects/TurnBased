#!/usr/bin/env node
// Decode and seek the final walkthrough in a separate Chrome process.
import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

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
const videoPath = resolve(process.argv[2] || 'artifacts/demos/moonlit-market/turnbased-game-creation.mp4');
const artifacts = resolve(process.env.DEMO_VIDEO_QA_DIR || `${dirname(videoPath)}/video-qa`);
const file = await stat(videoPath);
assert.ok(file.isFile() && file.size > 0, 'Video file exists and is not empty');
await mkdir(artifacts, { recursive: true });

// Only serve the requested video, with range support for real browser seeking.
const server = createServer((request, response) => {
  if (request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html lang="en"><title>Walkthrough playback check</title><style>body{margin:0;background:#24402e}video{display:block;width:1600px;height:1000px}</style><video muted preload="auto" src="/video.mp4" aria-label="TurnBased game creation walkthrough"></video></html>');
    return;
  }
  if (request.url !== '/video.mp4') { response.writeHead(404).end(); return; }
  const range = request.headers.range;
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0, end = file.size - 1;
  if (range) {
    if (!match || (!match[1] && !match[2])) { response.writeHead(416).end(); return; }
    start = match[1] ? Number(match[1]) : Math.max(0, file.size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
    if (start > end || start >= file.size) {
      response.writeHead(416, { 'Content-Range': `bytes */${file.size}` }).end(); return;
    }
  }
  const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 };
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${file.size}`;
  response.writeHead(range ? 206 : 200, headers);
  if (request.method === 'HEAD') { response.end(); return; }
  const stream = createReadStream(videoPath, { start, end });
  stream.on('error', error => response.destroy(error));
  response.on('close', () => stream.destroy());
  stream.pipe(response);
});
await new Promise((accept, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', accept);
});
let browser;
const report = { video: videoPath, bytes: file.size, passed: false, frames: [], errors: [] };
try {
  browser = await playwright.chromium.launch({
    executablePath: process.env.DEMO_CHROME_PATH || '/usr/bin/google-chrome',
    headless: true, args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    if (video.error) throw new Error(video.error.message);
    return video.readyState >= 2 && Number.isFinite(video.duration);
  }, null, { timeout: 20000 });
  report.metadata = await page.locator('video').evaluate(video => ({
    duration: video.duration, width: video.videoWidth, height: video.videoHeight,
    h264Support: video.canPlayType('video/mp4; codecs="avc1.640028"'),
  }));
  assert.deepEqual([report.metadata.width, report.metadata.height], [1600, 1000], 'Rendered video dimensions');
  assert.ok(report.metadata.duration > 0, 'Finite positive duration');
  await page.locator('video').evaluate(video => video.play());
  await page.waitForFunction(() => document.querySelector('video').currentTime > 0.15, null, { timeout: 10000 });
  await page.locator('video').evaluate(video => video.pause());
  const duration = report.metadata.duration;
  const samples = [
    ['beginning', Math.min(1, duration * 0.1)],
    ['middle', duration / 2],
    ['end', Math.max(duration * 0.9, duration - 0.75)],
  ];
  for (const [name, time] of samples) {
    const frame = await page.locator('video').evaluate(async (video, target) => {
      await new Promise((accept, reject) => {
        const timer = setTimeout(() => reject(new Error(`No decoded frame at ${target}s`)), 10000);
        let seekFinished = false, frameFinished = false;
        const finish = () => {
          if (seekFinished && frameFinished) { clearTimeout(timer); accept(); }
        };
        video.addEventListener('seeked', () => { seekFinished = true; finish(); }, { once: true });
        const inspectFrame = (_, metadata) => {
          if (Math.abs(metadata.mediaTime - target) < 0.1) { frameFinished = true; finish(); }
          else video.requestVideoFrameCallback(inspectFrame);
        };
        video.requestVideoFrameCallback(inspectFrame);
        video.currentTime = target;
      });
      if (video.error) throw new Error(video.error.message);
      const canvas = document.createElement('canvas');
      canvas.width = 80; canvas.height = 50;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      for (let index = 0; index < pixels.length; index += 4) {
        colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
      }
      const quality = video.getVideoPlaybackQuality();
      return {
        requestedTime: target, decodedTime: video.currentTime, readyState: video.readyState,
        distinctColors: colors.size, totalVideoFrames: quality.totalVideoFrames,
        droppedVideoFrames: quality.droppedVideoFrames, mediaError: video.error?.message || null,
      };
    }, time);
    assert.ok(Math.abs(frame.decodedTime - time) < 0.2, `${name}: seek reached the requested time`);
    assert.ok(frame.readyState >= 2, `${name}: decoded frame is available after seeking`);
    assert.ok(frame.totalVideoFrames > 0 && frame.distinctColors > 20, `${name}: visible decoded artwork`);
    const screenshot = `${artifacts}/${name}.png`;
    await page.locator('video').screenshot({ path: screenshot });
    report.frames.push({ name, ...frame, screenshot });
  }
  assert.deepEqual(report.errors, [], 'No browser errors');
  report.passed = true;
} catch (error) {
  report.errors.push(error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(accept => server.close(accept));
  await writeFile(`${artifacts}/playback.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
