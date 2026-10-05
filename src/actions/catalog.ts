'use server';

import { count, eq, max } from 'drizzle-orm';
import { refresh } from 'next/cache';

import { getDb } from '@/db';
import { auditLogs, environments, environmentTypes } from '@/db/schema';
import { fail, ok } from '@/lib/action-result';
import { isUniqueViolation } from '@/lib/db-errors';
import { matchesEnvironmentName } from '@/lib/environments';
import { authedAction } from '@/lib/safe-action';
import {
  deleteEnvironmentTypeSchema,
  environmentTypeFormSchema,
  reorderEnvironmentTypesSchema,
  updateEnvironmentTypeSchema,
} from '@/lib/validations/environment';
import { zodFieldErrors } from '@/lib/validations/utils';

const nullable = (value: string) => (value === '' ? null : value);

export const createEnvironmentTypeAction = authedAction(async (_session, input: unknown) => {
  const parsed = environmentTypeFormSchema.safeParse(input);
  if (!parsed.success) return fail('validation', zodFieldErrors(parsed.error));
  const data = parsed.data;

  try {
    const created = await getDb().transaction(async (tx) => {
      const [last] = await tx
        .select({ value: max(environmentTypes.sortOrder) })
        .from(environmentTypes);
      const [row] = await tx
        .insert(environmentTypes)
        .values({
          ...data,
          descriptionEn: nullable(data.descriptionEn),
          descriptionAr: nullable(data.descriptionAr),
          sortOrder: (last?.value ?? 0) + 1, // new types go last; reorder from Settings
        })
        .returning({ id: environmentTypes.id });
      await tx.insert(auditLogs).values({
        action: 'catalog.type_created',
        entity: 'environment_type',
        entityId: row?.id ?? null,
        metadata: { type: data.slug, name: data.nameEn },
      });
      return row;
    });
    refresh();
    return ok({ id: created?.id ?? '' });
  } catch (error) {
    if (isUniqueViolation(error, 'environment_types_slug_unique')) {
      return fail('conflict', { slug: 'slugTaken' });
    }
    throw error;
  }
});

export const updateEnvironmentTypeAction = authedAction(async (_session, input: unknown) => {
  const parsed = updateEnvironmentTypeSchema.safeParse(input);
  if (!parsed.success) return fail('validation', zodFieldErrors(parsed.error));
  const { id, ...data } = parsed.data;
  const db = getDb();

  const [current] = await db.select().from(environmentTypes).where(eq(environmentTypes.id, id));
  if (!current) return fail('notFound');

  const next = {
    ...data,
    descriptionEn: nullable(data.descriptionEn),
    descriptionAr: nullable(data.descriptionAr),
  };
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter(
    (k) => next[k] !== current[k],
  );
  if (changed.length === 0) return ok(undefined);

  await db.transaction(async (tx) => {
    await tx.update(environmentTypes).set(next).where(eq(environmentTypes.id, id));
    await tx.insert(auditLogs).values({
      action: 'catalog.type_updated',
      entity: 'environment_type',
      entityId: id,
      metadata: { type: current.slug, name: next.nameEn, fields: changed },
    });
  });
  refresh();
  return ok(undefined);
});

/** Persists a full ordering. Must list every type exactly once (guards against stale UIs). */
export const reorderEnvironmentTypesAction = authedAction(async (_session, input: unknown) => {
  const parsed = reorderEnvironmentTypesSchema.safeParse(input);
  if (!parsed.success) return fail('validation');
  const { orderedIds } = parsed.data;

  const result = await getDb().transaction(async (tx) => {
    const rows = await tx.select({ id: environmentTypes.id }).from(environmentTypes).for('update');
    const known = new Set(rows.map((r) => r.id));
    if (orderedIds.length !== known.size || new Set(orderedIds).size !== orderedIds.length) {
      return fail('stale');
    }
    if (!orderedIds.every((id) => known.has(id))) return fail('stale');

    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(environmentTypes)
        .set({ sortOrder: index + 1 })
        .where(eq(environmentTypes.id, id));
    }
    await tx.insert(auditLogs).values({
      action: 'catalog.reordered',
      entity: 'environment_type',
      metadata: { count: orderedIds.length },
    });
    return ok(undefined);
  });
  if (result.ok) refresh();
  return result;
});

/** Only unused, unprotected types can be removed (projects reference types with RESTRICT). */
export const deleteEnvironmentTypeAction = authedAction(async (_session, input: unknown) => {
  const parsed = deleteEnvironmentTypeSchema.safeParse(input);
  if (!parsed.success) return fail('validation');
  const { id, confirmation } = parsed.data;
  const db = getDb();

  const [type] = await db.select().from(environmentTypes).where(eq(environmentTypes.id, id));
  if (!type) return fail('notFound');
  if (type.isProtected) return fail('forbidden');
  if (!matchesEnvironmentName(confirmation, type)) {
    return fail('validation', { confirmation: 'confirmationMismatch' });
  }

  const [usage] = await db
    .select({ n: count() })
    .from(environments)
    .where(eq(environments.typeId, id));
  if ((usage?.n ?? 0) > 0) return fail('conflict', { _form: 'typeInUse' });

  await db.transaction(async (tx) => {
    await tx.delete(environmentTypes).where(eq(environmentTypes.id, id));
    await tx.insert(auditLogs).values({
      action: 'catalog.type_deleted',
      entity: 'environment_type',
      entityId: id,
      metadata: { type: type.slug, name: type.nameEn },
    });
  });
  refresh();
  return ok(undefined);
});
