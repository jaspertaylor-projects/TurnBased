import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/workshop/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/workshop/setup.ts'],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
