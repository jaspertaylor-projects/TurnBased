import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export function processManager(root, onServiceExit) {
  const children = new Set();
  const logs = path.join(root, 'logs');
  mkdirSync(logs, { recursive: true });
  let closing = false;

  function start(name, command, args, { env = process.env, service = false, capture = false } = {}) {
    if (closing) throw new Error('Development stack is stopping.');
    const log = createWriteStream(path.join(logs, `${name}.log`), { flags: 'a' });
    log.write(`\n--- ${new Date().toISOString()} ---\n`);
    const child = spawn(command, args, { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (data) => {
      if (capture) output += data;
      else { process.stdout.write(data); log.write(data); }
    });
    child.stderr.on('data', (data) => { process.stderr.write(data); log.write(data); });
    children.add(child);
    const done = new Promise((resolve) => {
      child.once('error', (error) => {
        console.error(`${name}: ${error.message}`);
      });
      child.once('close', (code, signal) => {
        if (service && !closing) onServiceExit(new Error(`${name} stopped (${signal || code}). See logs/${name}.log.`));
        children.delete(child);
        log.end();
        resolve({ code: code ?? 1, signal, output });
      });
    });
    return { child, done };
  }

  async function run(name, command, args, options) {
    const result = await start(name, command, args, options).done;
    if (result.code !== 0) throw new Error(`${name} failed. See logs/${name}.log.`);
    return result.output;
  }

  async function close() {
    closing = true;
    const active = [...children];
    const signalGroup = (child, signal) => {
      if (!child.pid) return;
      try { process.kill(-child.pid, signal); } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    };
    for (const child of active) signalGroup(child, 'SIGTERM');
    // Watchers launch descendants. Signal the whole group even if npm exits first.
    for (let attempt = 0; attempt < 50; attempt++) {
      const alive = active.some((child) => {
        try { process.kill(-child.pid, 0); return true; } catch { return false; }
      });
      if (!alive) return;
      await delay(100);
    }
    for (const child of active) signalGroup(child, 'SIGKILL');
  }

  return { start, run, close };
}

export async function assertPortFree(port, host, label) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', () => reject(new Error(`${label} port ${host}:${port} is already in use. Stop the existing process or choose another port.`)));
    server.listen(port, host, resolve);
  });
  await new Promise((resolve) => server.close(resolve));
}

export async function waitForReady(url, child, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Catalog API exited before becoming ready.');
    try {
      const response = await fetch(`${url}/ready`, { signal: AbortSignal.timeout(2000) });
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch { /* Retry while Nest compiles and connects to the database. */ }
    await delay(500);
  }
  throw new Error(`Catalog API did not become ready at ${url}. See logs/catalog-api.log.`);
}
