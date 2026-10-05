import 'server-only';

import { asc, inArray } from 'drizzle-orm';

import { getDb } from '@/db';
import { envVariables } from '@/db/schema';
import { requireSession } from '@/lib/auth/session';

import { getProjectEnvironments, type ProjectEnvironment } from './environments';

export type ComparisonRow = { key: string; presentIn: string[] };

/** Keys × environments presence for a project (names only — no values involved). */
export async function getProjectComparison(projectId: string): Promise<{
  environments: ProjectEnvironment[];
  rows: ComparisonRow[];
}> {
  await requireSession();
  const environments = await getProjectEnvironments(projectId);
  if (environments.length === 0) return { environments, rows: [] };

  const pairs = await getDb()
    .select({ environmentId: envVariables.environmentId, key: envVariables.key })
    .from(envVariables)
    .where(
      inArray(
        envVariables.environmentId,
        environments.map((e) => e.environmentId),
      ),
    )
    .orderBy(asc(envVariables.key));

  const byKey = new Map<string, string[]>();
  for (const { environmentId, key } of pairs) {
    const list = byKey.get(key) ?? [];
    list.push(environmentId);
    byKey.set(key, list);
  }
  return {
    environments,
    rows: [...byKey.entries()].map(([key, presentIn]) => ({ key, presentIn })),
  };
}
