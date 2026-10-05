import 'server-only';

import { asc, countDistinct, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { cache } from 'react';

import { getDb } from '@/db';
import { environments, environmentTypes, envVariables, projects } from '@/db/schema';
import { requireSession } from '@/lib/auth/session';
import type { EnvironmentColor } from '@/lib/constants/environment-colors';

export type ProjectEnvironmentChip = {
  slug: string;
  nameEn: string;
  nameAr: string;
  color: EnvironmentColor;
};

export type ProjectSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  updatedAt: Date;
  environmentCount: number;
  variableCount: number;
  environments: ProjectEnvironmentChip[];
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

async function environmentChips(projectIds: string[]) {
  const byProject = new Map<string, ProjectEnvironmentChip[]>();
  if (projectIds.length === 0) return byProject;

  const rows = await getDb()
    .select({
      projectId: environments.projectId,
      slug: environmentTypes.slug,
      nameEn: environmentTypes.nameEn,
      nameAr: environmentTypes.nameAr,
      color: environmentTypes.color,
    })
    .from(environments)
    .innerJoin(environmentTypes, eq(environments.typeId, environmentTypes.id))
    .where(inArray(environments.projectId, projectIds))
    .orderBy(asc(environmentTypes.sortOrder));

  for (const { projectId, ...chip } of rows) {
    const list = byProject.get(projectId) ?? [];
    list.push(chip);
    byProject.set(projectId, list);
  }
  return byProject;
}

async function summaries(where?: SQL): Promise<ProjectSummary[]> {
  const rows = await getDb()
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      updatedAt: projects.updatedAt,
      environmentCount: countDistinct(environments.id),
      variableCount: countDistinct(envVariables.id),
    })
    .from(projects)
    .leftJoin(environments, eq(environments.projectId, projects.id))
    .leftJoin(envVariables, eq(envVariables.environmentId, environments.id))
    .where(where)
    .groupBy(projects.id)
    .orderBy(desc(projects.updatedAt), asc(projects.name));

  const chips = await environmentChips(rows.map((r) => r.id));
  return rows.map((row) => ({ ...row, environments: chips.get(row.id) ?? [] }));
}

/** Projects with environment/variable counts, optionally filtered by name/slug/description. */
export async function listProjects(search = ''): Promise<ProjectSummary[]> {
  await requireSession();
  if (!search) return summaries();

  const pattern = `%${escapeLike(search)}%`;
  return summaries(
    or(
      ilike(projects.name, pattern),
      ilike(projects.slug, pattern),
      ilike(sql`coalesce(${projects.description}, '')`, pattern),
    ),
  );
}

export async function countProjects(): Promise<number> {
  await requireSession();
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(projects);
  return row?.n ?? 0;
}

export const getProjectBySlug = cache(async (slug: string): Promise<ProjectSummary | null> => {
  await requireSession();
  const [project] = await summaries(eq(projects.slug, slug));
  return project ?? null;
});
