#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { catalogConfig, loadEnv, port } from './dev/config.mjs';
import { assertPortFree, processManager, waitForReady } from './dev/processes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogOnly = process.argv.includes('--catalog-only');
const stopping = process.argv.includes('--stop');
let shuttingDown = false;
const processes = processManager(root, (error) => { void shutdown(1, error); });

async function shutdown(code, error) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (error) console.error(error.message);
  console.log('Stopping development processes...');
  await processes.close();
  console.log('Docker data is preserved. After Ctrl+C, use npm run dev:stop to stop the containers too.');
  process.exit(code);
}

process.once('SIGINT', () => { void shutdown(0); });
process.once('SIGTERM', () => { void shutdown(0); });

async function main() {
  const rootEnv = loadEnv(path.join(root, '.env'));
  const apiEnv = loadEnv(path.join(root, 'apps/catalog-api/.env'));
  const settings = { ...rootEnv, ...process.env };
  const catalog = catalogConfig(rootEnv, apiEnv);
  const compose = ['compose', '-f', path.join(root, 'compose.yml')];

  if (stopping) {
    await processes.run('catalog-deps', 'docker', [...compose, 'stop'], { env: catalog.composeEnv });
    await processes.run('supabase', 'npx', ['supabase', 'stop']);
    return;
  }

  const webHost = settings.WEB_HOST || '127.0.0.1';
  const webPort = port(settings.WEB_PORT || 3000, 'WEB_PORT');
  if (!catalogOnly && catalog.apiPort === webPort) throw new Error('WEB_PORT and CATALOG_PORT must differ.');
  await assertPortFree(catalog.apiPort, '127.0.0.1', 'Catalog API');
  if (!catalogOnly) await assertPortFree(webPort, webHost, 'Web app');

  console.log('Installing/checking workspace dependencies...');
  await processes.run('install', 'npm', ['install', '--no-audit', '--no-fund']);
  console.log('Starting catalog Postgres and Redis...');
  await processes.run('catalog-deps', 'docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '90'], { env: catalog.composeEnv });
  await processes.run('catalog-migrate', 'npm', ['run', 'db:generate', '--workspace', '@turnbased/catalog-api'], { env: catalog.apiEnv });
  await processes.run('catalog-migrate', 'npm', ['run', 'db:migrate', '--workspace', '@turnbased/catalog-api'], { env: catalog.apiEnv });
  await processes.run('catalog-seed', 'npm', ['run', 'seed', '--workspace', '@turnbased/catalog-api'], { env: catalog.apiEnv });

  const api = processes.start('catalog-api', 'npm', ['run', 'dev', '--workspace', '@turnbased/catalog-api'], { env: catalog.apiEnv, service: true });
  await waitForReady(catalog.url, api.child);
  console.log(`Catalog API ready at ${catalog.url}`);

  if (!catalogOnly) {
    console.log('Starting local Supabase...');
    await processes.run('supabase', 'npx', ['supabase', 'start'], { capture: true });
    if (settings.RESET_DB === '1') {
      await processes.run('supabase', 'npx', ['supabase', 'db', 'reset']);
    }
    // Use the running local stack's keys, including on a fresh checkout. Never
    // print or persist the captured service-role key in logs or browser config.
    const status = parseEnv(await processes.run('supabase', 'npx', ['supabase', 'status', '-o', 'env'], { capture: true }));
    if (!status.API_URL || !status.ANON_KEY) throw new Error('Supabase status did not provide local API_URL and ANON_KEY.');
    processes.start('edge-runtime', 'npx', ['supabase', 'functions', 'serve', settings.EDGE_FUNCTION || 'ai-project-builder', '--env-file', path.join(root, '.env')], { service: true });
    processes.start('web', 'npm', ['run', 'dev', '--workspace', 'web', '--', '--host', webHost, '--port', String(webPort), '--strictPort'], {
      service: true,
      env: {
        ...process.env,
        CATALOG_API_URL: catalog.url,
        VITE_SUPABASE_URL: status.API_URL,
        VITE_SUPABASE_ANON_KEY: status.ANON_KEY,
      },
    });
    console.log(`Web app starting at http://${webHost}:${webPort}; /v1 proxies to ${catalog.url}.`);
  }
  console.log('Logs: logs/. Press Ctrl+C to stop the API, web, and edge workers.');
}

main().catch((error) => { void shutdown(1, error); });
