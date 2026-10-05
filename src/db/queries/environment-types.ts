import 'server-only';

import { asc, count, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { environments, environmentTypes } from '@/db/schema';
import { requireSession } from '@/lib/auth/session';
import type { EnvironmentColor } from '@/lib/constants/environment-colors';

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

export type CatalogEntry = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  color: EnvironmentColor;
  sortOrder: number;
  isDefault: boolean;
  isProtected: boolean;
  /** Number of projects using this type. */
  usage: number;
};

/** Settings → catalog: every type in lifecycle order with how many projects use it. */
export async function listCatalog(): Promise<CatalogEntry[]> {
  await requireSession();
  return getDb()
    .select({
      id: environmentTypes.id,
      slug: environmentTypes.slug,
      nameEn: environmentTypes.nameEn,
      nameAr: environmentTypes.nameAr,
      descriptionEn: environmentTypes.descriptionEn,
      descriptionAr: environmentTypes.descriptionAr,
      color: environmentTypes.color,
      sortOrder: environmentTypes.sortOrder,
      isDefault: environmentTypes.isDefault,
      isProtected: environmentTypes.isProtected,
      usage: count(environments.id),
    })
    .from(environmentTypes)
    .leftJoin(environments, eq(environments.typeId, environmentTypes.id))
    .groupBy(environmentTypes.id)
    .orderBy(asc(environmentTypes.sortOrder), asc(environmentTypes.slug));
}
