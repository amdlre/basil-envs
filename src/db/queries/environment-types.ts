import 'server-only';

import { asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { environmentTypes } from '@/db/schema';
import { requireSession } from '@/lib/auth/session';

export async function getDefaultEnvironmentTypeIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ id: environmentTypes.id })
    .from(environmentTypes)
    .where(eq(environmentTypes.isDefault, true))
    .orderBy(asc(environmentTypes.sortOrder));
  return rows.map((r) => r.id);
}

/** Full catalog in lifecycle order (names for display). */
export async function getAllEnvironmentTypes() {
  await requireSession();
  return getDb()
    .select({
      slug: environmentTypes.slug,
      nameEn: environmentTypes.nameEn,
      nameAr: environmentTypes.nameAr,
    })
    .from(environmentTypes)
    .orderBy(asc(environmentTypes.sortOrder));
}
