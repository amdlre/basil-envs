import path from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { environmentTypes } from '../../db/schema';
import { ENVIRONMENT_TYPES_SEED } from '../../db/seed-data';

/** Migrates the disposable test database and seeds the environment catalog once per run. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');

  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    const db = drizzle({ client: sql });
    await migrate(db, { migrationsFolder: path.join(process.cwd(), 'src/db/migrations') });
    await sql`truncate projects, users, audit_logs, environment_types restart identity cascade`;
    await db.insert(environmentTypes).values([...ENVIRONMENT_TYPES_SEED]);
  } finally {
    await sql.end();
  }
}
