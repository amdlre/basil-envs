import { and, eq } from 'drizzle-orm';
import { expect } from 'vitest';

import { getDb } from '@/db';
import { environments, environmentTypes, envVariables, projects } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';

export function expectOk<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(`Expected ok, got ${JSON.stringify(result)}`);
  return result.data;
}

export function expectFail(result: ActionResult<unknown>, error: string) {
  expect(result).toMatchObject({ ok: false, error });
}

export async function typeBySlug(slug: string) {
  const [type] = await getDb()
    .select()
    .from(environmentTypes)
    .where(eq(environmentTypes.slug, slug));
  if (!type) throw new Error(`Unknown type ${slug}`);
  return type;
}

export async function projectBySlug(slug: string) {
  const [project] = await getDb().select().from(projects).where(eq(projects.slug, slug));
  if (!project) throw new Error(`Unknown project ${slug}`);
  return project;
}

export async function environmentSlugs(projectId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ slug: environmentTypes.slug })
    .from(environments)
    .innerJoin(environmentTypes, eq(environments.typeId, environmentTypes.id))
    .where(eq(environments.projectId, projectId))
    .orderBy(environmentTypes.sortOrder);
  return rows.map((r) => r.slug);
}

export async function environmentId(projectId: string, typeSlug: string): Promise<string> {
  const type = await typeBySlug(typeSlug);
  const [env] = await getDb()
    .select({ id: environments.id })
    .from(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.typeId, type.id)));
  if (!env) throw new Error(`No ${typeSlug} env`);
  return env.id;
}

/** Inserts a placeholder row (ciphertext content is irrelevant to these tests). */
export async function insertVariable(envId: string, key: string) {
  await getDb()
    .insert(envVariables)
    .values({ environmentId: envId, key, encryptedValue: 'x', iv: 'x', authTag: 'x' });
}
