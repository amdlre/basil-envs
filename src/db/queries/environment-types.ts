import 'server-only';

import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { environmentTypes } from '@/db/schema';

export async function getDefaultEnvironmentTypeIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ id: environmentTypes.id })
    .from(environmentTypes)
    .where(eq(environmentTypes.isDefault, true))
    .orderBy(asc(environmentTypes.sortOrder));
  return rows.map((r) => r.id);
}
