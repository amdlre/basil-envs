'use server';

import { randomBytes } from 'node:crypto';

import { count, eq } from 'drizzle-orm';
import { refresh } from 'next/cache';

import { getDb } from '@/db';
import { getDefaultEnvironmentTypeIds } from '@/db/queries/environment-types';
import { auditLogs, environments, envVariables, projects } from '@/db/schema';
import { fail, ok } from '@/lib/action-result';
import { isUniqueViolation } from '@/lib/db-errors';
import { authedAction } from '@/lib/safe-action';
import { slugify } from '@/lib/slug';
import {
  deleteProjectSchema,
  projectFormSchema,
  updateProjectSchema,
} from '@/lib/validations/project';
import { zodFieldErrors } from '@/lib/validations/utils';

const SLUG_CONSTRAINT = 'projects_slug_unique';
const MAX_AUTO_SLUG_ATTEMPTS = 5;

/** Slug candidates when the user didn't type one: name-based, then suffixed, then random. */
function autoSlugCandidates(name: string): string[] {
  const base = slugify(name) || `project-${randomBytes(3).toString('hex')}`;
  return [
    base,
    ...Array.from(
      { length: MAX_AUTO_SLUG_ATTEMPTS - 1 },
      (_, i) =>
        `${base.slice(0, 55)}-${i === MAX_AUTO_SLUG_ATTEMPTS - 2 ? randomBytes(2).toString('hex') : i + 2}`,
    ),
  ];
}

export const createProjectAction = authedAction(async (_session, input: unknown) => {
  const parsed = projectFormSchema.safeParse(input);
  if (!parsed.success) return fail('validation', zodFieldErrors(parsed.error));

  const { name, description } = parsed.data;
  const candidates = parsed.data.slug ? [parsed.data.slug] : autoSlugCandidates(name);
  const defaultTypeIds = await getDefaultEnvironmentTypeIds();

  for (const slug of candidates) {
    try {
      const project = await getDb().transaction(async (tx) => {
        const [created] = await tx
          .insert(projects)
          .values({ name, slug, description: description || null })
          .returning({ id: projects.id, slug: projects.slug });
        if (!created) throw new Error('Project insert returned no row');

        if (defaultTypeIds.length > 0) {
          await tx
            .insert(environments)
            .values(defaultTypeIds.map((typeId) => ({ projectId: created.id, typeId })));
        }
        await tx.insert(auditLogs).values({
          action: 'project.created',
          entity: 'project',
          entityId: created.id,
          metadata: { name, slug, defaultEnvironments: defaultTypeIds.length },
        });
        return created;
      });

      refresh();
      return ok({ slug: project.slug });
    } catch (error) {
      if (!isUniqueViolation(error, SLUG_CONSTRAINT)) throw error;
      // A user-chosen slug that's taken is a validation error; auto slugs try the next one.
      if (parsed.data.slug) return fail('conflict', { slug: 'slugTaken' });
    }
  }
  return fail('conflict', { slug: 'slugTaken' });
});

export const updateProjectAction = authedAction(async (_session, input: unknown) => {
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return fail('validation', zodFieldErrors(parsed.error));

  const { id, name, description } = parsed.data;
  const db = getDb();

  const [current] = await db
    .select({ slug: projects.slug, name: projects.name })
    .from(projects)
    .where(eq(projects.id, id));
  if (!current) return fail('notFound');

  // Editing never silently regenerates the slug: blank means "keep current".
  const slug = parsed.data.slug || current.slug;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({ name, slug, description: description || null })
        .where(eq(projects.id, id));
      await tx.insert(auditLogs).values({
        action: 'project.updated',
        entity: 'project',
        entityId: id,
        metadata: {
          ...(current.name !== name && { name: { from: current.name, to: name } }),
          ...(current.slug !== slug && { slug: { from: current.slug, to: slug } }),
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error, SLUG_CONSTRAINT)) return fail('conflict', { slug: 'slugTaken' });
    throw error;
  }

  refresh();
  return ok({ slug });
});

export const deleteProjectAction = authedAction(async (_session, input: unknown) => {
  const parsed = deleteProjectSchema.safeParse(input);
  if (!parsed.success) return fail('validation', zodFieldErrors(parsed.error));

  const { id, confirmation } = parsed.data;
  const db = getDb();

  const [project] = await db
    .select({ name: projects.name, slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, id));
  if (!project) return fail('notFound');

  // Server-side re-check of the typed confirmation (the dialog checks it too).
  if (confirmation.trim() !== project.name) {
    return fail('validation', { confirmation: 'confirmationMismatch' });
  }

  const [stats] = await db
    .select({ variables: count(envVariables.id) })
    .from(environments)
    .leftJoin(envVariables, eq(envVariables.environmentId, environments.id))
    .where(eq(environments.projectId, id));

  await db.transaction(async (tx) => {
    await tx.delete(projects).where(eq(projects.id, id)); // cascades environments + variables
    await tx.insert(auditLogs).values({
      action: 'project.deleted',
      entity: 'project',
      entityId: id,
      metadata: { name: project.name, slug: project.slug, variables: stats?.variables ?? 0 },
    });
  });

  refresh();
  return ok(undefined);
});
