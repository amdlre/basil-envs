import path from 'node:path';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { closeDb, getDb } from './index';

/** Applies pending SQL migrations. Used locally and on container start. */
async function run() {
  await migrate(getDb(), {
    migrationsFolder: path.join(process.cwd(), 'src/db/migrations'),
  });
  console.info('✓ Migrations applied');
}

run()
  .catch((error: unknown) => {
    console.error('✗ Migration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
