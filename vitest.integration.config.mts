import path from 'node:path';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set — integration tests need a disposable database.');
}
if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL (tests truncate all tables).');
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'src/test/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    globalSetup: ['src/test/integration/global-setup.ts'],
    setupFiles: ['src/test/integration/setup.ts'],
    // One DB, shared state: run files sequentially.
    fileParallelism: false,
    env: { DATABASE_URL: testDatabaseUrl, NODE_ENV: 'test' },
    server: { deps: { inline: ['next-intl'] } },
  },
});
