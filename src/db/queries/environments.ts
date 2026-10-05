import 'server-only';

import { and, asc, count, eq, notExists } from 'drizzle-orm';

import { getDb } from '@/db';
import { environments, environmentTypes, envVariables } from '@/db/schema';
import { requireSession } from '@/lib/auth/session';
import type { EnvironmentColor } from '@/lib/constants/environment-colors';

export type CatalogType = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  color: EnvironmentColor;
  sortOrder: number;
  isProtected: boolean;
};

export type ProjectEnvironment = CatalogType & {
  /** environments.id (the catalog type id is `typeId`). */
  environmentId: string;
  typeId: string;
  variableCount: number;
};

const typeColumns = {
  slug: environmentTypes.slug,
  nameEn: environmentTypes.nameEn,
  nameAr: environmentTypes.nameAr,
  descriptionEn: environmentTypes.descriptionEn,
  descriptionAr: environmentTypes.descriptionAr,
  color: environmentTypes.color,
  sortOrder: environmentTypes.sortOrder,
  isProtected: environmentTypes.isProtected,
};

/** A project's environments, always in catalog lifecycle order (not insertion order). */
export async function getProjectEnvironments(projectId: string): Promise<ProjectEnvironment[]> {
  await requireSession();
  const rows = await getDb()
    .select({
      environmentId: environments.id,
      typeId: environmentTypes.id,
      ...typeColumns,
      variableCount: count(envVariables.id),
    })
    .from(environments)
    .innerJoin(environmentTypes, eq(environments.typeId, environmentTypes.id))
    .leftJoin(envVariables, eq(envVariables.environmentId, environments.id))
    .where(eq(environments.projectId, projectId))
    .groupBy(environments.id, environmentTypes.id)
    .orderBy(asc(environmentTypes.sortOrder), asc(environmentTypes.slug));

  return rows.map((row) => ({ ...row, id: row.typeId }));
}

/** Catalog types this project doesn't have yet — the only options offered by "+". */
export async function getAvailableEnvironmentTypes(projectId: string): Promise<CatalogType[]> {
  await requireSession();
  const db = getDb();
  return db
    .select({ id: environmentTypes.id, ...typeColumns })
    .from(environmentTypes)
    .where(
      notExists(
        db
          .select({ one: environments.id })
          .from(environments)
          .where(
            and(
              eq(environments.projectId, projectId),
              eq(environments.typeId, environmentTypes.id),
            ),
          ),
      ),
    )
    .orderBy(asc(environmentTypes.sortOrder), asc(environmentTypes.slug));
}
