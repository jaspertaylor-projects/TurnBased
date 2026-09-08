import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export function loadEnv(filename) {
  if (!existsSync(filename)) {
    copyFileSync(`${filename}.example`, filename);
    console.log(`Created ${filename} from its example.`);
  }
  return parseEnv(readFileSync(filename, 'utf8'));
}

export function port(value, name) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 65535) {
    throw new Error(`${name} must be a port between 1 and 65535.`);
  }
  return result;
}

export function catalogConfig(rootEnv, apiEnv, shellEnv = process.env) {
  const settings = { ...rootEnv, ...shellEnv };
  const apiPort = port(settings.CATALOG_PORT || apiEnv.PORT || 3100, 'CATALOG_PORT');
  const databasePort = port(settings.CATALOG_DB_PORT || 54328, 'CATALOG_DB_PORT');
  const redisPort = port(settings.CATALOG_REDIS_PORT || 6380, 'CATALOG_REDIS_PORT');
  // The dev launcher owns local dependencies. Direct workspace commands can use
  // DATABASE_URL / REDIS_HOST in apps/catalog-api/.env for external deployments.
  return {
    apiPort,
    url: `http://127.0.0.1:${apiPort}`,
    composeEnv: { ...shellEnv, CATALOG_DB_PORT: String(databasePort), CATALOG_REDIS_PORT: String(redisPort) },
    apiEnv: {
      ...shellEnv,
      ...apiEnv,
      HOST: '127.0.0.1',
      PORT: String(apiPort),
      NODE_ENV: 'development',
      DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${databasePort}/bgmapi?schema=public`,
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: String(redisPort),
    },
  };
}
