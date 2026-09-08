import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig } from 'vitest/config';

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));

export default defineConfig({
  resolve: {
    // Render exported library icons with the same React version as the web app.
    alias: {
      react: dirname(webRequire.resolve('react/package.json')),
      'lucide-react': join(
        dirname(webRequire.resolve('lucide-react/package.json')),
        'dist/esm/lucide-react.js',
      ),
    },
  },
  test: {
    server: { deps: { inline: ['lucide-react'] } },
    include: ['tests/workshop/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/workshop/setup.ts'],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
