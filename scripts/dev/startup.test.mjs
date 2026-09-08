import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { catalogConfig, loadEnv } from './config.mjs';
import { assertPortFree, processManager, waitForReady } from './processes.mjs';

test('first-run env setup preserves later edits and parses quoted supplier credentials', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'turnbased-env-'));
  try {
    const filename = path.join(dir, '.env');
    writeFileSync(`${filename}.example`, 'PORT=3100\nGAMECRAFTER_PASSWORD="contains # and spaces"\n');
    assert.equal(loadEnv(filename).GAMECRAFTER_PASSWORD, 'contains # and spaces');
    writeFileSync(filename, 'PORT=3200\n');
    assert.equal(loadEnv(filename).PORT, '3200');
  } finally { rmSync(dir, { recursive: true }); }
});

test('catalog and Compose use the same overridden ports without inheriting a production database', () => {
  const config = catalogConfig({ CATALOG_PORT: '3200', CATALOG_DB_PORT: '54329' }, { PORT: '3000', DATABASE_URL: 'production', REDIS_PORT: '6379' }, { CATALOG_REDIS_PORT: '6381' });
  assert.equal(config.url, 'http://127.0.0.1:3200');
  assert.equal(new URL(config.apiEnv.DATABASE_URL).port, config.composeEnv.CATALOG_DB_PORT);
  assert.equal(config.apiEnv.REDIS_PORT, config.composeEnv.CATALOG_REDIS_PORT);
  assert.equal(config.apiEnv.HOST, '127.0.0.1');
  assert.throws(() => catalogConfig({ CATALOG_PORT: 'bad' }, {}, {}), /must be a port/);
});

test('readiness retries HTTP 200 error bodies and occupied ports fail without killing their owner', async () => {
  let calls = 0;
  const server = http.createServer((req, res) => {
    calls++;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ status: calls < 2 ? 'error' : 'ok' }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const port = server.address().port;
    await assert.rejects(assertPortFree(port, '127.0.0.1', 'API'), /already in use/);
    await waitForReady(`http://127.0.0.1:${port}`, { exitCode: null, signalCode: null }, 3000);
    assert.equal(calls, 2);
    await assert.rejects(waitForReady('http://127.0.0.1:1', { exitCode: 1, signalCode: null }), /exited/);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('supervisor captures secrets without logging them and stops the whole watcher process tree', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'turnbased-processes-'));
  const exits = [];
  const manager = processManager(dir, (error) => exits.push(error));
  try {
    const secret = await manager.run('capture', process.execPath, ['-e', 'console.log("private-test-value")'], { capture: true });
    assert.equal(secret.trim(), 'private-test-value');
    const worker = manager.start('watcher', process.execPath, ['-e', `
      const { spawn } = require('node:child_process');
      spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' });
      console.log('ready');
      setInterval(() => {}, 1000);
    `], { service: true });
    await once(worker.child.stdout, 'data');
    await manager.close();
    await worker.done;
    await delay(20);
    assert.equal(exits.length, 0);
    assert.throws(() => process.kill(-worker.child.pid, 0), { code: 'ESRCH' });
    assert.doesNotMatch(readFileSync(path.join(dir, 'logs/capture.log'), 'utf8'), /private-test-value/);
  } finally { await manager.close(); rmSync(dir, { recursive: true }); }
});

test('unexpected service exit is reported and failed setup commands reject', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'turnbased-exit-'));
  const exits = [];
  const manager = processManager(dir, (error) => exits.push(error.message));
  try {
    await manager.start('failed-service', process.execPath, ['-e', 'process.exit(2)'], { service: true }).done;
    assert.match(exits[0], /failed-service stopped/);
    await assert.rejects(manager.run('failed-setup', process.execPath, ['-e', 'process.exit(3)']), /failed-setup failed/);
  } finally { await manager.close(); rmSync(dir, { recursive: true }); }
});
