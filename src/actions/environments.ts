'use server';

import { count, eq } from 'drizzle-orm';
import { refresh } from 'next/cache';

import { getDb } from '@/db';
import { auditLogs, environments, environmentTypes, envVariables, projects } from '@/db/schema';
import { fail, ok } from '@/lib/action-result';
import { isUniqueViolation } from '@/lib/db-errors';
import { matchesEnvironmentName } from '@/lib/environments';
import { authedAction } from '@/lib/safe-action';
import { addEnvironmentSchema, deleteEnvironmentSchema } from '@/lib/validations/environment';
import { zodFieldErrors } from '@/lib/validations/utils';

export const addEnvironmentAction = authedAction(async (_session, input: unknown) => {
  const parsed = addEnvironmentSchema.safeParse(input);
  if (!parsed.success) return fail('validation', zodFieldErrors(parsed.error));

  const { projectId, typeId } = parsed.data;
  const db = getDb();

  const [[project], [type]] = await Promise.all([
    db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)),
    db
      .select({ slug: environmentTypes.slug })
      .from(environmentTypes)
      .where(eq(environmentTypes.id, typeId)),
  ]);
  if (!project || !type) return fail('notFound');

  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(environments)
        .values({ projectId, typeId })
        .returning({ id: environments.id });
      await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
      await tx.insert(auditLogs).values({
        action: 'environment.added',
        entity: 'environment',
        entityId: created?.id ?? null,
        metadata: { projectId, type: type.slug },
      });
    });
  } catch (error) {
    // UNIQUE(project_id, type_id): already added (e.g. a double click or a second tab).
    if (isUniqueViolation(error, 'environments_project_type_unique')) return fail('conflict');
    throw error;
  }

  refresh();
  return ok({ slug: type.slug });
});

export const deleteEnvironmentAction = authedAction(async (_session, input: unknown) => {
  const parsed = deleteEnvironmentSchema.safeParse(input);
  if (!parsed.success) return fail('validation', zodFieldErrors(parsed.error));

  const { environmentId, confirmation } = parsed.data;
  const db = getDb();

  const [env] = await db
    .select({
      projectId: environments.projectId,
      slug: environmentTypes.slug,
      nameEn: environmentTypes.nameEn,
      nameAr: environmentTypes.nameAr,
      isProtected: environmentTypes.isProtected,
    })
    .from(environments)
    .innerJoin(environmentTypes, eq(environments.typeId, environmentTypes.id))
    .where(eq(environments.id, environmentId));
  if (!env) return fail('notFound');

  // Enforced here, not just hidden in the UI.
  if (env.isProtected) return fail('forbidden');
  if (!matchesEnvironmentName(confirmation, env)) {
    return fail('validation', { confirmation: 'confirmationMismatch' });
  }

  const [stats] = await db
    .select({ variables: count() })
    .from(envVariables)
    .where(eq(envVariables.environmentId, environmentId));

  await db.transaction(async (tx) => {
    await tx.delete(environments).where(eq(environments.id, environmentId)); // cascades variables
    await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, env.projectId));
    await tx.insert(auditLogs).values({
      action: 'environment.deleted',
      entity: 'environment',
      entityId: environmentId,
      metadata: { projectId: env.projectId, type: env.slug, variables: stats?.variables ?? 0 },
    });
  });

  refresh();
  return ok(undefined);
});
