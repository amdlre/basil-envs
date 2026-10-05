import 'server-only';

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getServerEnv } from '@/lib/env';

import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

type DbGlobal = { __vaultSql?: postgres.Sql; __vaultDb?: Database };
const globalForDb = globalThis as unknown as DbGlobal;

// Pool and client live on globalThis so dev hot reloads don't leak connections.
function createDb(): Database {
  globalForDb.__vaultSql ??= postgres(getServerEnv().DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    onnotice: () => undefined, // e.g. "schema already exists" from idempotent migrations
  });
  return drizzle({ client: globalForDb.__vaultSql, schema });
}

/** Lazily-initialized Drizzle client (no connection is opened at import/build time). */
export function getDb(): Database {
  globalForDb.__vaultDb ??= createDb();
  return globalForDb.__vaultDb;
}

/** Closes the pool — for CLI scripts only. */
export async function closeDb(): Promise<void> {
  await globalForDb.__vaultSql?.end({ timeout: 5 });
  globalForDb.__vaultSql = undefined;
  globalForDb.__vaultDb = undefined;
}

export { schema };
